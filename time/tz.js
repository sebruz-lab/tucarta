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
import { avisoDeZona } from './avisos.js';
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

// ---------- Horario provincial argentino ----------
//
// Entre 1990 y 2010 varias provincias tuvieron, por ley o decreto propio,
// una hora distinta de la oficial nacional: Mendoza con su ley 5566, las
// del oeste en 2004, las once exceptuadas del decreto 1705/2008 (mas
// Jujuy, que se autoexcluyo) y San Luis hasta 2010. La carta lo avisa,
// porque es una hora que no figura en ninguna tabla nacional y sorprende
// a cualquiera que la mire.
//
// La hora oficial la lleva Buenos Aires: es la del meridiano que fija la
// ley y la unica que nunca se aparto. Se compara contra ella en lugar de
// repetir la tabla del Servicio de Hidrografia Naval, que habria que
// mantener al dia por separado y podria quedar distinta de los husos.
const OFICIAL_AR = 'America/Argentina/Buenos_Aires';
const ALIAS_OFICIAL_AR = 'America/Buenos_Aires';
// Desde el 5/10/1969 todas las zonas argentinas arrancan iguales (-3 con
// las reglas nacionales). Antes cada una tiene su hora local media y no
// hay con que comparar.
const DESDE_OFICIAL_AR = Date.UTC(1969, 9, 5) / 1000;
const ZONAS_AR = new Set([
    'America/Argentina/Buenos_Aires', 'America/Argentina/Catamarca',
    'America/Argentina/ComodRivadavia', 'America/Argentina/Cordoba',
    'America/Argentina/Jujuy', 'America/Argentina/La_Rioja',
    'America/Argentina/Mendoza', 'America/Argentina/Rio_Gallegos',
    'America/Argentina/Salta', 'America/Argentina/San_Juan',
    'America/Argentina/San_Luis', 'America/Argentina/Tucuman',
    'America/Argentina/Ushuaia', 'America/Buenos_Aires', 'America/Catamarca',
    'America/Cordoba', 'America/Jujuy', 'America/Mendoza', 'America/Rosario'
]);

// Si en ese instante esa provincia tenia una hora distinta de la oficial
// argentina.
export function esProvincial(zona, utcSeg) {
    if (!ZONAS_AR.has(zona) || zona === OFICIAL_AR || zona === ALIAS_OFICIAL_AR) return false;
    if (utcSeg < DESDE_OFICIAL_AR) return false;
    return husoEn(zona, utcSeg).total !== husoEn(OFICIAL_AR, utcSeg).total;
}

// Deja lista una zona para que husoEn y localAUtc la usen. Si falla la
// bajada no pasa nada: se sigue con Intl.
export async function cargarZona(zona) {
    // Para una zona argentina hace falta tambien Buenos Aires, que es con
    // lo que se compara para saber si el horario era provincial. Es otro
    // archivo de 1,5 KB y solo para los lugares de Argentina.
    if (ZONAS_AR.has(zona) && zona !== OFICIAL_AR && zona !== ALIAS_OFICIAL_AR) {
        await cargarZona(OFICIAL_AR);
    }
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
        return { total, base: total, verano: null, correccion: 0 };
    }
    let p = periodos[0];
    for (const x of periodos) if (x[0] <= utcSeg) p = x; else break;
    // p[3] marca los tramos donde corregimos la base IANA: 1 cuando
    // usamos la hora oficial argentina y 2 cuando la provincia no adhirio
    // al horario de verano nacional (ver time/correcciones.js).
    return { total: p[1], base: p[1] - p[2], verano: p[2], correccion: p[3] || 0 };
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
export function localAUtc({ fecha, hora }, zona, correccion = null, provincia = null) {
    const local = segundosLocales(fecha, hora);
    const tentativo = Number(fecha.slice(0, 4)) < ANIO_TENTATIVO;
    const lectura = (h) => ({ utcSeg: local - h.total, utc: partesUtc(local - h.total), ...h });

    // Lo mismo, pero tomando la base, el verano y la marca de correccion
    // del tramo que de verdad contiene ese instante. Los husos que se
    // prueban abajo se juntan por offset total, y dos tramos distintos
    // pueden tener el mismo total: por ejemplo un verano corregido y el
    // invierno siguiente, los dos en -3, uno con marca y el otro sin. Sin
    // esto la marca podia venir de un tramo vecino, hasta 36 h mas alla,
    // y la carta avisaba de menos o de mas.
    const lecturaDelTramo = (h) => {
        const l = lectura(h);
        const real = husoEn(zona, l.utcSeg);
        const con = real.total === h.total ? { ...l, ...real } : l;
        return {
            ...con,
            provincial: esProvincial(zona, l.utcSeg),
            // Una provincia de esta zona que tuvo otra hora y no se puede
            // calcular aparte: solo se avisa (ver time/avisos.js).
            aviso: avisoDeZona(zona, l.utcSeg, provincia)
        };
    };

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
        .map(lecturaDelTramo)
        .sort((a, b) => a.utcSeg - b.utcSeg);

    if (validas.length === 1) return { estado: 'ok', opciones: validas, tentativo, zona };
    if (validas.length > 1) return { estado: 'ambigua', opciones: validas, tentativo, zona };
    const todas = [...husos.values()].map(lecturaDelTramo).sort((a, b) => a.utcSeg - b.utcSeg);
    return { estado: 'inexistente', opciones: todas, tentativo, zona };
}
