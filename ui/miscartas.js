// "Mis cartas": las cartas que la persona guarda. Un almacen es cualquier
// objeto con listar(), guardar(carta), borrar(id) y borrarTodas(), todos
// async. Aca esta el del dispositivo (localStorage); el de la cuenta vive
// en cuenta.js y respeta la misma forma.
//
// Carta guardada: { id, nombre, fecha, hora, lugar, correccion, eleccion, tipo, grupo?, guardada }.
// grupo: de donde vino (por ejemplo, el curso en el que se inscribio).
// Las guardadas antes de que existiera el tipo cuentan como natales.

const CLAVE = 'tucarta:cartas';
const CAMPOS = ['nombre', 'fecha', 'hora', 'lugar', 'correccion', 'eleccion', 'tipo', 'grupo'];

// Que es cada carta guardada.
export const TIPOS = { natal: 'Natal', revolucion: 'Revolución solar', progresion: 'Progresada', evento: 'Evento' };

// Del lugar solo se guarda lo necesario para recalcular y mostrarlo.
const CAMPOS_LUGAR = ['nombre', 'provincia', 'pais', 'paisNombre', 'lat', 'lon', 'zona', 'manual'];

// Lo que se guarda de los datos del formulario (sin nada de mas).
export function datosDeCarta(d) {
    const res = Object.fromEntries(CAMPOS.map((k) => [k, d[k] ?? null]));
    res.nombre = res.nombre || '';
    res.eleccion = res.eleccion || 0;
    res.tipo = TIPOS[res.tipo] ? res.tipo : 'natal';
    if (!res.grupo) delete res.grupo;
    res.lugar = Object.fromEntries(CAMPOS_LUGAR.filter((k) => d.lugar?.[k] != null).map((k) => [k, d.lugar[k]]));
    return res;
}

// Misma persona y mismo momento: se actualiza en lugar de duplicarse.
export const mismaCarta = (a, b) =>
    (a.nombre || '') === (b.nombre || '') && a.fecha === b.fecha && a.hora === b.hora &&
    Math.abs(a.lugar.lat - b.lugar.lat) < 1e-6 && Math.abs(a.lugar.lon - b.lugar.lon) < 1e-6;

// Igual en todo lo que cambia el calculo (incluido el huso corregido).
export const igualQue = (a, b) =>
    JSON.stringify(datosDeCarta(a)) === JSON.stringify(datosDeCarta(b));

const nuevoId = () => (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));

function leer() {
    try {
        const v = JSON.parse(localStorage.getItem(CLAVE));
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}
function escribir(lista) {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
}

export const almacenLocal = {
    async listar() {
        return leer().sort((a, b) => (b.guardada || '').localeCompare(a.guardada || ''));
    },
    async guardar(datos) {
        const lista = leer();
        const previa = lista.find((c) => mismaCarta(c, datos));
        const carta = { ...datosDeCarta(datos), id: previa?.id || nuevoId(), guardada: new Date().toISOString() };
        escribir([carta, ...lista.filter((c) => c.id !== carta.id)]);
        return carta;
    },
    // Cambiar los datos de una carta que ya existe, sin crear otra.
    // guardar() busca una carta igual para no duplicar, asi que no sirve
    // para editar: justamente lo que cambia son los datos con los que la
    // buscaria.
    async editar(id, datos) {
        const lista = leer();
        if (!lista.some((c) => c.id === id)) return null;
        const carta = { ...datosDeCarta(datos), id, guardada: new Date().toISOString() };
        escribir([carta, ...lista.filter((c) => c.id !== id)]);
        return carta;
    },
    async borrar(id) {
        escribir(leer().filter((c) => c.id !== id));
    },
    // Muchas de una vez (importacion): una sola lectura y una sola escritura.
    // Devuelve cuantas se guardaron.
    async guardarVarias(lista) {
        const actuales = leer();
        const ahora = new Date().toISOString();
        for (const d of lista) {
            const k = actuales.findIndex((c) => mismaCarta(c, d));
            const carta = { ...datosDeCarta(d), id: k >= 0 ? actuales[k].id : nuevoId(), guardada: ahora };
            if (k >= 0) actuales[k] = carta; else actuales.push(carta);
        }
        escribir(actuales);
        return lista.length;
    },
    async borrarTodas() {
        try { localStorage.removeItem(CLAVE); } catch {}
    }
};

// ---------- Buscar en la lista ----------

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Cambios minimos para pasar de a a b (letras de mas, de menos, cambiadas o
// dadas vuelta).
function distancia(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const c = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}

// Adonde ir en una lista ordenada de nombres mientras se escribe `texto`:
//   - 'inicio': nombres que empiezan asi ("seb" -> Seba...).
//   - 'palabra': alguna palabra empieza asi (un apellido: "bru").
//   - 'parecido': con errores de tipeo ("sbea" -> Seba), lo mas parecido.
//   - 'orden': nada se parece; el lugar que le toca en el orden alfabetico.
// Devuelve { indice, coinciden (indices a resaltar), como }.
export function buscarEnLista(nombres, texto) {
    const q = normalizar(texto);
    if (!q) return { indice: -1, coinciden: [], como: 'vacio' };
    const ns = nombres.map((n) => normalizar(n || 'Sin nombre'));
    const resultado = (coinciden, como) => ({ indice: coinciden[0], coinciden, como });

    const inicio = ns.flatMap((n, i) => (n.startsWith(q) ? [i] : []));
    if (inicio.length) return resultado(inicio, 'inicio');
    const palabra = ns.flatMap((n, i) => (n.split(' ').some((w) => w.startsWith(q)) ? [i] : []));
    if (palabra.length) return resultado(palabra, 'palabra');

    // Errores de tipeo: se compara con el principio de cada palabra (y del
    // nombre entero), del largo de lo escrito, con una letra de mas o de menos.
    const tolera = q.length <= 2 ? 0 : q.length <= 5 ? 1 : 2;
    if (tolera) {
        const dist = ns.map((n) => Math.min(...[n, ...n.split(' ')].flatMap((w) =>
            [-1, 0, 1].map((k) => distancia(q, w.slice(0, q.length + k))))));
        const mejor = Math.min(...dist);
        if (mejor <= tolera) return resultado(dist.flatMap((d, i) => (d === mejor ? [i] : [])), 'parecido');
    }

    const k = ns.findIndex((n) => n.localeCompare(q, 'es') > 0);
    return { indice: k < 0 ? ns.length - 1 : k, coinciden: [], como: 'orden' };
}
