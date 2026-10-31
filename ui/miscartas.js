// "Mis cartas": las cartas que la persona guarda. Un almacen es cualquier
// objeto con listar(), guardar(carta), borrar(id) y borrarTodas(), todos
// async. Aca esta el del dispositivo (localStorage); el de la cuenta vive
// en cuenta.js y respeta la misma forma.
//
// Carta guardada: { id, nombre, fecha, hora, lugar, correccion, eleccion, guardada }.

const CLAVE = 'tucarta:cartas';
const CAMPOS = ['nombre', 'fecha', 'hora', 'lugar', 'correccion', 'eleccion'];

// Del lugar solo se guarda lo necesario para recalcular y mostrarlo.
const CAMPOS_LUGAR = ['nombre', 'provincia', 'pais', 'paisNombre', 'lat', 'lon', 'zona', 'manual'];

// Lo que se guarda de los datos del formulario (sin nada de mas).
export function datosDeCarta(d) {
    const res = Object.fromEntries(CAMPOS.map((k) => [k, d[k] ?? null]));
    res.nombre = res.nombre || '';
    res.eleccion = res.eleccion || 0;
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
    async borrar(id) {
        escribir(leer().filter((c) => c.id !== id));
    },
    async borrarTodas() {
        try { localStorage.removeItem(CLAVE); } catch {}
    }
};
