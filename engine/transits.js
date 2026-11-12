// Transitos: donde estan los planetas en un momento dado y que aspectos
// le hacen a una carta natal. No dependen del lugar (posiciones
// geocentricas); las casas son las de la carta natal.

import { PUNTOS, PUNTOS_TRANSITO, AJUSTES_POR_DEFECTO, enLaCarta } from './config.js';
import { calcularAspectos } from './aspects.js';
import { diaJuliano, flagsDe, enSigno, casaDe } from './chart.js';

const SE_MEAN_NODE = 10;
const SE_TRUE_NODE = 11;
const norm = (x) => ((x % 360) + 360) % 360;

// El cielo del momento medido desde su propio Nodo Norte, que queda en
// 0° Aries: es el zodiaco draconico de ESE dia, no el de la persona. Es
// lo que Solar Fire llama una Transits Chart con el zodiaco Draconic.
function nodoDelMomento(swe, jd, nodo) {
    const id = nodo === 'medio' ? SE_MEAN_NODE : SE_TRUE_NODE;
    return swe.calc(jd, id, flagsDe(id)).lon;
}

// natal: el modelo que devuelve calcularCarta.
// planetas: los que transitan. Si no se pide ninguno en particular van los
// que la persona dejo prendidos en los ajustes, para que el anillo de
// afuera tenga los mismos puntos que la carta de adentro. La vista de la
// lunacion pide solo el Sol y la Luna.
// draconica: 'real' o 'medio' para medir los transitos desde el Nodo de ese
// momento. La carta de adentro tiene que venir ya draconica: cada rueda se
// mide desde su propio Nodo, y por eso los aspectos no son los de siempre.
export function calcularTransitos(swe, { utc, natal, ajustes = AJUSTES_POR_DEFECTO, planetas = null, draconica = null }) {
    const jd = diaJuliano(swe, utc);
    const cusps = natal.cusps.map((c) => c.lon);
    const desde = draconica ? nodoDelMomento(swe, jd, draconica) : 0;

    const transitan = planetas || PUNTOS_TRANSITO.filter((id) => enLaCarta(ajustes, id));
    const puntos = PUNTOS.filter((p) => transitan.includes(p.id)).map((p) => {
        const r = swe.calc(jd, p.swe, flagsDe(p.swe));
        const lon = desde ? norm(r.lon - desde) : r.lon;
        return {
            id: p.id,
            lon,
            vel: r.velLon,
            retro: r.velLon < 0,
            casa: casaDe(lon, cusps), // casa de la carta de adentro en la que transita
            ...enSigno(lon)
        };
    });

    // La carta natal queda quieta: velocidad 0, asi "aplicativo" depende
    // solo del planeta en transito. Quien recibe los transitos es lo que
    // diga "Puntos aspectados": el Ascendente y el Medio Cielo entran solo
    // si estan prendidos ahi.
    const elegidos = ajustes.puntosAspectados;
    const recibe = (id) => (elegidos ? elegidos[id] !== false : true);
    const natales = [...natal.puntos, ...natal.angulos]
        .filter((p) => recibe(p.id))
        .map((p) => ({ id: p.id, lon: p.lon, vel: 0 }));
    const aspectos = calcularAspectos(puntos, natales, {
        orbesPorAspecto: ajustes.orbesTransito || AJUSTES_POR_DEFECTO.orbesTransito,
        aspectos: ajustes.aspectosTransito || ajustes.aspectos
    });

    return { meta: { jd, utc, ...(draconica ? { draconica: { nodo: draconica, desde } } : {}) }, puntos, aspectos };
}
