// Lunaciones: el instante exacto de cada luna nueva y cada luna llena, y
// en que casa de la carta natal cae.
//
// La elongacion (la distancia de la Luna al Sol, de 0 a 360) vale 0° en la
// luna nueva y 180° en la llena, y crece siempre: la Luna nunca retrograda
// respecto del Sol (la velocidad relativa no baja de unos 10,7° por dia).
// Por eso la busqueda es monotona y no necesita los cuidados que si
// necesita el calendario de transitos.
//
// g(jd) centra la elongacion en el multiplo de 180 mas cercano: cruza cero
// de abajo hacia arriba en cada lunacion y salta de +90 a -90 en los
// cuartos, que es el salto que hay que descartar.

import { AJUSTES_POR_DEFECTO } from './config.js';
import { casaDe, diaJuliano, enSigno, flagsDe } from './chart.js';
import { calcularTransitos } from './transits.js';
import { utcDeJd } from './solarReturn.js';
import { biseccion } from './raices.js';

const SOL = 0;
const LUNA = 1;
// Un mes sinodico son 29,53 dias: 20 a cada lado del momento de referencia
// alcanza para tener siempre una lunacion antes y otra despues.
const VENTANA = 20;

const norm = (x) => ((x % 360) + 360) % 360;
const centrar = (d) => ((d + 90) % 180) - 90;

const elongacion = (swe, jd) => norm(swe.calc(jd, LUNA, flagsDe(LUNA)).lon - swe.calc(jd, SOL, flagsDe(SOL)).lon);
const g = (swe, jd) => centrar(elongacion(swe, jd));

// Instante exacto dentro del intervalo: biseccion al minuto y despues unos
// pasos de Newton con la velocidad de la efemeride, que bajan el error al
// segundo (como en momentoRevolucion).
function afinar(swe, a, b) {
    let jd = biseccion((x) => g(swe, x), a, b);
    for (let i = 0; i < 4; i++) {
        const l = swe.calc(jd, LUNA, flagsDe(LUNA));
        const s = swe.calc(jd, SOL, flagsDe(SOL));
        const paso = -centrar(norm(l.lon - s.lon)) / (l.velLon - s.velLon);
        jd += paso;
        if (Math.abs(paso) < 1e-8) break; // ~0,001 segundos
    }
    return jd;
}

// Como queda cada lunacion: el instante, el tipo, y donde cae en el zodiaco
// (la longitud del Sol y la Luna, que en ese momento es la misma).
function datosDe(swe, jd) {
    const lon = swe.calc(jd, LUNA, flagsDe(LUNA)).lon;
    const d = elongacion(swe, jd);
    return {
        jd,
        utc: utcDeJd(jd),
        tipo: d < 90 || d > 270 ? 'nueva' : 'llena',
        lon,
        ...enSigno(lon)
    };
}

// Todas las lunaciones del periodo, en orden. desde/hasta: dias julianos UT.
export function lunacionesEntre(swe, { desde, hasta }) {
    const inicio = Math.floor(desde);
    const dias = Math.max(1, Math.ceil(hasta) - inicio);
    const gs = Array.from({ length: dias + 1 }, (_, k) => g(swe, inicio + k));
    const res = [];
    for (let k = 1; k <= dias; k++) {
        const g0 = gs[k - 1];
        const g1 = gs[k];
        // Cruce por cero hacia arriba, y no el salto de los cuartos.
        if (!(g0 < 0 && g1 >= 0 && g1 - g0 < 90)) continue;
        const jd = afinar(swe, inicio + k - 1, inicio + k);
        if (jd >= desde && jd <= hasta) res.push(datosDe(swe, jd));
    }
    return res;
}

// La lunacion mas cercana en el tiempo al momento pedido, para adelante o
// para atras (puede ser la de ayer si cae mas cerca que la que viene).
export function lunacionMasCercana(swe, { jd }) {
    const cerca = lunacionesEntre(swe, { desde: jd - VENTANA, hasta: jd + VENTANA });
    return cerca.reduce((mejor, l) => (!mejor || Math.abs(l.jd - jd) < Math.abs(mejor.jd - jd) ? l : mejor), null);
}

// La vista de la calculadora: la rueda doble en el instante de la lunacion
// mas cercana al momento de referencia, mas en que casa natal cae.
export function calcularLunacion(swe, { utc, natal, ajustes = AJUSTES_POR_DEFECTO }) {
    const lunacion = lunacionMasCercana(swe, { jd: diaJuliano(swe, utc) });
    if (!lunacion) throw new Error('No se encontró la lunación');
    const transitos = calcularTransitos(swe, { utc: lunacion.utc, natal, ajustes });
    const casa = casaDe(lunacion.lon, natal.cusps.map((c) => c.lon));
    return { ...transitos, lunacion: { ...lunacion, casa } };
}
