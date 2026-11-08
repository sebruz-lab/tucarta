// Hora local -> UTC, con el huso base y el horario de verano por separado
// (Intl da el offset total pero no distingue "UTC-3 de base" de "UTC-4 mas
// una hora de verano", que es lo que la app muestra y deja corregir).
//
// El detalle de cada zona vive en su propio archivo (ui/public/husos/) y se
// baja recien cuando hace falta: son 597 zonas y 888 KB en total, pero cada
// una pesa kilo y medio. Lo unico que viaja siempre es el indice.
// Quien use esto llama antes a cargarZona(); si no esta cargada, se cae a
// Intl, que es lo que hacia para todo el mundo menos 23 zonas.
//
// Todas las horas se manejan en segundos: "local" es la hora de reloj
// contada como si fuera UTC, asi local - offset = instante UTC.

import indice from './zonas.json';
import { archivoDeZona } from './archivo.js';

export const VERSION_TZ = indice.version;

// Zonas que tienen detalle propio (todas las de tzdata y sus alias).
const CON_DETALLE = new Set(indice.zonas);
// Las ya bajadas: zona -> periodos.
const tabla = { zonas: {} };
// Quien trae el archivo de una zona. El navegador lo configura con fetch;
// los tests, leyendo del disco.
let traerZona = null;
export function configurarHusos(fn) { traerZona = fn; }

// Deja lista una zona para que husoEn y localAUtc la usen. Si falla la
// bajada no pasa nada: se sigue con Intl.
export async function cargarZona(zona) {
    if (!zona || !traerZona || tabla.zonas[zona] || !CON_DETALLE.has(zona)) return;
    try {
        const periodos = await traerZona(archivoDeZona(zona));
        if (Array.isArray(periodos)) tabla.zonas[zona] = periodos;
    } catch (e) {
        console.error('No se pudo bajar el huso de ' + zona, e);
    }
}
export const ANIO_TENTATIVO = 1970; // antes de esto la base IANA no garantiza exactitud

const fmt = {};
function offsetIntl(zona, seg) {
    fmt[zona] ||= new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'longOffset' });
    const s = fmt[zona].formatToParts(new Date(seg * 1000)).find((p) => p.type === 'timeZoneName').value;
    const m = s.match(/GMT([+-])(\d\d):(\d\d)(?::(\d\d))?/);
    if (!m) return 0; // "GMT" a secas
    return (m[1] === '-' ? -1 : 1) * (+m[2] * 3600 + +m[3] * 60 + +(m[4] || 0));
}

export const tieneDetalle = (zona) => CON_DETALLE.has(zona);

// Huso vigente en un instante UTC: { total, base, verano } en segundos.
// verano es null si la zona no esta en la tabla (no se sabe cuanto es).
export function husoEn(zona, utcSeg) {
    const periodos = tabla.zonas[zona];
    if (!periodos) {
        const total = offsetIntl(zona, utcSeg);
        return { total, base: total, verano: null };
    }
    let p = periodos[0];
    for (const x of periodos) if (x[0] <= utcSeg) p = x; else break;
    return { total: p[1], base: p[1] - p[2], verano: p[2] };
}

export function segundosLocales(fecha, hora) {
    const [a, m, d] = fecha.split('-').map(Number);
    const [h, min, s = 0] = hora.split(':').map(Number);
    return Date.UTC(a, m - 1, d, h, min, s) / 1000;
}

export function partesUtc(utcSeg) {
    const d = new Date(utcSeg * 1000);
    return {
        anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(),
        hora: d.getUTCHours(), minuto: d.getUTCMinutes(), segundo: d.getUTCSeconds()
    };
}

// Convierte fecha ('YYYY-MM-DD') y hora ('HH:MM') locales de una zona.
//
// correccion (opcional): { base, verano } en segundos, cargados a mano por
// la persona; reemplaza lo que dice la base IANA.
//
// Devuelve:
//   estado: 'ok' | 'ambigua' (la hora existio dos veces) |
//           'inexistente' (cayo en el salto de un cambio de hora) | 'manual'
//   opciones: una lectura posible (o dos, si es ambigua o inexistente), cada
//             una { utcSeg, utc, total, base, verano }
//   tentativo: true antes de 1970
export function localAUtc({ fecha, hora }, zona, correccion = null) {
    const local = segundosLocales(fecha, hora);
    const tentativo = Number(fecha.slice(0, 4)) < ANIO_TENTATIVO;
    const lectura = (h) => ({ utcSeg: local - h.total, utc: partesUtc(local - h.total), ...h });

    if (correccion) {
        const h = { total: correccion.base + correccion.verano, base: correccion.base, verano: correccion.verano };
        return { estado: 'manual', opciones: [lectura(h)], tentativo, zona };
    }

    // Husos que rigen alrededor de esa hora (un cambio de hora mueve a lo
    // sumo unas horas; se mira un dia y medio para cada lado).
    const husos = new Map();
    for (let dt = -36; dt <= 36; dt++) {
        const h = husoEn(zona, local + dt * 3600);
        husos.set(h.total, h);
    }

    // Una lectura vale si el huso que supone es el que realmente regia.
    const validas = [...husos.values()]
        .filter((h) => husoEn(zona, local - h.total).total === h.total)
        .map(lectura)
        .sort((a, b) => a.utcSeg - b.utcSeg);

    if (validas.length === 1) return { estado: 'ok', opciones: validas, tentativo, zona };
    if (validas.length > 1) return { estado: 'ambigua', opciones: validas, tentativo, zona };
    const todas = [...husos.values()].map(lectura).sort((a, b) => a.utcSeg - b.utcSeg);
    return { estado: 'inexistente', opciones: todas, tentativo, zona };
}
