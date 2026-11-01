// Transitos: donde estan los planetas en un momento dado y que aspectos
// le hacen a una carta natal. No dependen del lugar (posiciones
// geocentricas); las casas son las de la carta natal.

import { PUNTOS, PUNTOS_TRANSITO, AJUSTES_POR_DEFECTO } from './config.js';
import { calcularAspectos } from './aspects.js';
import { diaJuliano, flagsDe, enSigno, casaDe } from './chart.js';

// natal: el modelo que devuelve calcularCarta.
export function calcularTransitos(swe, { utc, natal, ajustes = AJUSTES_POR_DEFECTO }) {
    const jd = diaJuliano(swe, utc);
    const cusps = natal.cusps.map((c) => c.lon);

    const puntos = PUNTOS.filter((p) => PUNTOS_TRANSITO.includes(p.id)).map((p) => {
        const r = swe.calc(jd, p.swe, flagsDe(p.swe));
        return {
            id: p.id,
            lon: r.lon,
            vel: r.velLon,
            retro: r.velLon < 0,
            casa: casaDe(r.lon, cusps), // casa natal en la que transita
            ...enSigno(r.lon)
        };
    });

    // La carta natal queda quieta: velocidad 0, asi "aplicativo" depende
    // solo del planeta en transito. Los angulos natales siempre cuentan.
    const natales = [...natal.puntos, ...natal.angulos].map((p) => ({ id: p.id, lon: p.lon, vel: 0 }));
    const aspectos = calcularAspectos(puntos, natales, {
        orbesPorAspecto: ajustes.orbesTransito || AJUSTES_POR_DEFECTO.orbesTransito,
        menores: ajustes.menores
    });

    return { meta: { jd, utc }, puntos, aspectos };
}
