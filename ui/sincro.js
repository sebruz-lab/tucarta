// Las cartas de la cuenta, disponibles sin internet.
//
// Envuelve el almacen de Firestore (ver cuenta.js) con una copia local: se
// lee siempre de la copia, asi que la lista aparece al instante y anda sin
// conexion. Lo que se guarda o se borra sin internet queda anotado y se
// aplica solo cuando vuelve.
//
// Entre dos versiones de la misma carta gana la ultima guardada (el campo
// `guardada`, en ISO). Alcanza porque es una sola persona en sus dispositivos,
// no hay varios editando a la vez.

import { datosDeCarta, mismaCarta } from './miscartas.js';

const nuevoId = () => (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));

function leerJson(clave, porDefecto) {
    try {
        const v = JSON.parse(localStorage.getItem(clave));
        return v ?? porDefecto;
    } catch {
        return porDefecto;
    }
}
const escribirJson = (clave, v) => {
    try { localStorage.setItem(clave, JSON.stringify(v)); } catch {}
};

export function conSincro(remoto, uid, { alCambiar = () => {} } = {}) {
    const CLAVE_COPIA = `tucarta:nube:${uid}`;
    const CLAVE_COLA = `tucarta:cola:${uid}`;

    const copia = () => leerJson(CLAVE_COPIA, []);
    const guardarCopia = (lista) => escribirJson(CLAVE_COPIA, lista);
    const cola = () => leerJson(CLAVE_COLA, []);
    const guardarCola = (c) => escribirJson(CLAVE_COLA, c);
    const encolar = (op) => guardarCola([...cola(), op]);

    const ordenadas = (lista) => [...lista].sort((a, b) => (b.guardada || '').localeCompare(a.guardada || ''));

    let sincronizando = null;

    // Aplica lo pendiente y despues trae lo que haya en la nube.
    async function sincronizar() {
        if (!navigator.onLine) return false;
        if (sincronizando) return sincronizando;
        sincronizando = (async () => {
            try {
                const pendientes = cola();
                const quedan = [];
                for (const op of pendientes) {
                    try {
                        if (op.tipo === 'guardar') await remoto.escribirId(op.id, op.carta);
                        else if (op.tipo === 'borrar') await remoto.borrar(op.id);
                    } catch {
                        quedan.push(op); // se reintenta la proxima vez
                    }
                }
                guardarCola(quedan);

                const enLaNube = await remoto.listar();
                // Si algo quedo sin subir, su version local sigue valiendo.
                const sinSubir = new Map(quedan.filter((o) => o.tipo === 'guardar').map((o) => [o.id, { ...o.carta, id: o.id }]));
                const borradosSinSubir = new Set(quedan.filter((o) => o.tipo === 'borrar').map((o) => o.id));
                const final = enLaNube
                    .filter((c) => !borradosSinSubir.has(c.id))
                    .map((c) => sinSubir.get(c.id) || c);
                for (const [id, c] of sinSubir) if (!final.some((x) => x.id === id)) final.push(c);

                guardarCopia(ordenadas(final));
                alCambiar();
                return true;
            } catch {
                return false; // sin red o sin permiso: seguimos con la copia
            } finally {
                sincronizando = null;
            }
        })();
        return sincronizando;
    }

    // Al volver la conexion, ponerse al dia solo.
    window.addEventListener('online', () => { sincronizar(); });

    const almacen = {
        async listar() {
            // Lo que hay, ya. La nube se consulta por atras y, si trajo algo
            // distinto, la lista se vuelve a pintar (alCambiar).
            sincronizar();
            return ordenadas(copia());
        },

        async guardar(datos) {
            const lista = copia();
            const previa = lista.find((c) => mismaCarta(c, datos));
            const id = previa?.id || nuevoId();
            const carta = { ...datosDeCarta(datos), guardada: new Date().toISOString() };
            guardarCopia(ordenadas([{ ...carta, id }, ...lista.filter((c) => c.id !== id)]));

            if (navigator.onLine) {
                try {
                    await remoto.escribirId(id, carta);
                    return { ...carta, id };
                } catch { /* se encola abajo */ }
            }
            encolar({ tipo: 'guardar', id, carta });
            return { ...carta, id };
        },

        async borrar(id) {
            guardarCopia(copia().filter((c) => c.id !== id));
            if (navigator.onLine) {
                try {
                    await remoto.borrar(id);
                    return;
                } catch { /* se encola abajo */ }
            }
            encolar({ tipo: 'borrar', id });
        },

        // Estas dos tocan todo de una: pedimos conexion para no dejar a medias
        // algo que despues no se sabe deshacer.
        async borrarTodas() {
            if (!navigator.onLine) throw new Error('Para borrarlas todas hace falta internet.');
            await remoto.borrarTodas();
            guardarCopia([]);
            guardarCola([]);
        },

        async guardarVarias(lista, alAvanzar) {
            if (!navigator.onLine) throw new Error('Para importar cartas hace falta internet.');
            const n = await remoto.guardarVarias(lista, alAvanzar);
            await sincronizar();
            return n;
        },

        // Cuantos cambios estan esperando a que vuelva internet.
        pendientes: () => cola().length,
        sincronizar,
    };

    return almacen;
}
