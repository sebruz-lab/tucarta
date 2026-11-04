// Carta draconica: la misma carta natal medida desde el Nodo Norte, que
// queda en 0° Aries. A todo (planetas, angulos y cuspides) se le resta la
// longitud del Nodo: las distancias entre puntos no cambian, asi que las
// casas de cada planeta y los aspectos internos son los de la natal.
//
// nodo: 'real' (el Nodo verdadero de la carta, el mismo de siempre) o
// 'medio' (el Nodo medio, SE_MEAN_NODE).

import { flagsDe, enSigno } from './chart.js';

const SE_MEAN_NODE = 10;
const norm = (x) => ((x % 360) + 360) % 360;

export function calcularDraconica(swe, { natal, nodo = 'real' }) {
    const real = natal.puntos.find((p) => p.id === 'nodo');
    const desde = nodo === 'medio'
        ? swe.calc(natal.meta.jd, SE_MEAN_NODE, flagsDe(SE_MEAN_NODE)).lon
        : real.lon;
    const mover = (p) => {
        const lon = norm(p.lon - desde);
        return { ...p, lon, ...enSigno(lon) };
    };
    return {
        meta: { ...natal.meta, draconica: { nodo, desde } },
        puntos: natal.puntos.map(mover),
        angulos: natal.angulos.map(mover),
        cusps: natal.cusps.map(mover),
        aspectos: natal.aspectos
    };
}
