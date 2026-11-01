// Revolucion solar: el instante en que el Sol vuelve a la longitud exacta
// que tenia al nacer, y la carta de ese instante para el lugar donde la
// persona pasa el cumpleanios.

import { AJUSTES_POR_DEFECTO } from './config.js';
import { calcularCarta, diaJuliano, flagsDe } from './chart.js';

const SOL = 0;

const dif = (a, b) => {
    const d = ((a - b) % 360 + 360) % 360;
    return d > 180 ? d - 360 : d;
};

// Dia juliano (UT) -> { anio, mes, dia, hora, minuto, segundo }.
export function utcDeJd(jd) {
    const d = new Date(Math.round((jd - 2440587.5) * 864e5));
    return {
        anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(),
        hora: d.getUTCHours(), minuto: d.getUTCMinutes(), segundo: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000
    };
}

// Instante (dia juliano UT) de la revolucion del anio pedido.
export function momentoRevolucion(swe, natal, anio) {
    const sol = natal.puntos.find((p) => p.id === 'sol').lon;
    const u = natal.meta.utc;
    // Arranca en el cumpleanios de ese anio (el 29/2 cae el 1/3).
    let jd = diaJuliano(swe, { ...u, anio });
    for (let i = 0; i < 20; i++) {
        const r = swe.calc(jd, SOL, flagsDe(SOL));
        const paso = dif(sol, r.lon) / r.velLon;
        jd += paso;
        if (Math.abs(paso) < 1e-7) break; // ~0,01 segundos
    }
    return jd;
}

// anio: el de la revolucion; o null para la del proximo cumpleanios
// contando desde `ahora` (dia juliano).
export function calcularRevolucion(swe, { natal, anio = null, ahora, lat, lon, ajustes = AJUSTES_POR_DEFECTO }) {
    let a = anio;
    if (a == null) {
        a = utcDeJd(ahora).anio;
        if (momentoRevolucion(swe, natal, a) < ahora) a += 1;
    }
    const jd = momentoRevolucion(swe, natal, a);
    const utc = utcDeJd(jd);
    return { anio: a, jd, utc, carta: calcularCarta(swe, { utc, lat, lon, ajustes }) };
}
