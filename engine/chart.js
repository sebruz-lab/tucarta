// Calculo de la carta. Entra el instante en UTC (la conversion desde la
// hora local la hace time/tz.js) y sale un modelo en JSON puro, que la
// interfaz dibuja y que los tests comparan contra Solar Fire.

import { PUNTOS, AJUSTES_POR_DEFECTO } from './config.js';
import { calcularAspectos } from './aspects.js';

// Flags de Swiss Ephemeris (swephexp.h).
const SEFLG_SWIEPH = 2;
const SEFLG_MOSEPH = 4;
const SEFLG_SPEED = 256;

// Planetas y Luna con Moshier (no necesita archivos, precision de
// segundos de arco). Quiron solo existe en seas_18.se1.
const SWE_CHIRON = 15;
export const flagsDe = (swe) => (swe === SWE_CHIRON ? SEFLG_SWIEPH : SEFLG_MOSEPH) | SEFLG_SPEED;

export const SIGNOS = ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo',
    'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'];

// 123.5 -> { signo: 'leo', grado: 3, minuto: 30 }. Se trunca al minuto,
// como Solar Fire: 29°59'45" sigue siendo 29°59' del mismo signo.
export function enSigno(lon) {
    let totalMin = Math.floor(((lon % 360) + 360) % 360 * 60 + 1e-9) % (360 * 60);
    const signo = Math.floor(totalMin / 1800);
    totalMin -= signo * 1800;
    return { signo: SIGNOS[signo], grado: Math.floor(totalMin / 60), minuto: totalMin % 60 };
}

// Casa en la que cae una longitud: la cuspide i es el comienzo de la casa i.
export function casaDe(lon, cusps) {
    for (let i = 0; i < 12; i++) {
        const desde = cusps[i];
        const hasta = cusps[(i + 1) % 12];
        const ancho = ((hasta - desde) % 360 + 360) % 360;
        const d = ((lon - desde) % 360 + 360) % 360;
        if (d < ancho) return i + 1;
    }
    return 1;
}

// utc: { anio, mes, dia, hora, minuto, segundo? } -> dia juliano.
export function diaJuliano(swe, utc) {
    return swe.julday(utc.anio, utc.mes, utc.dia, utc.hora + utc.minuto / 60 + (utc.segundo || 0) / 3600);
}

// casas: si viene, se usan esas casas en lugar de las del instante (las
// progresiones calculan sus angulos aparte).
export function calcularCarta(swe, { utc, lat, lon, ajustes = AJUSTES_POR_DEFECTO, casas: dadas = null }) {
    const jd = diaJuliano(swe, utc);

    const casas = dadas || swe.houses(jd, lat, lon, ajustes.casas);

    const puntos = PUNTOS.map((p) => {
        const r = swe.calc(jd, p.swe, flagsDe(p.swe));
        return {
            id: p.id,
            lon: r.lon,
            vel: r.velLon,
            retro: r.velLon < 0,
            casa: casaDe(r.lon, casas.cusps),
            ...enSigno(r.lon)
        };
    });

    const angulos = [
        { id: 'asc', lon: casas.asc, ...enSigno(casas.asc) },
        { id: 'mc', lon: casas.mc, ...enSigno(casas.mc) }
    ];

    const participantes = ajustes.aspectosAngulos ? [...puntos, ...angulos] : puntos;
    const aspectos = calcularAspectos(participantes, participantes, {
        orbes: ajustes.orbes, mismaCarta: true,
        menores: ajustes.menores, orbesMenores: ajustes.orbesMenores
    });

    return {
        meta: { jd, utc, lat, lon, ajustes },
        puntos,
        angulos,
        cusps: casas.cusps.map((c, i) => ({ casa: i + 1, lon: c, ...enSigno(c) })),
        aspectos
    };
}
