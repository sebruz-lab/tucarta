// Aspectos mayores entre dos listas de puntos. Es generico a proposito:
// en la carta natal se llama con la misma lista dos veces; en transitos
// (etapa 2) sera transitos x natal.
//
// Cada punto: { id, lon, vel? } con lon en grados eclipticos [0, 360).

import { ASPECTOS, ORBES_POR_DEFECTO, ORBES_MENORES, ASPECTOS_POR_DEFECTO,
    ORBES_ASPECTO, FACTORES_POR_DEFECTO } from './config.js';

// Distancia angular minima entre dos longitudes, en [0, 180].
export function distancia(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

export function orbeEntre(idA, idB, orbes = ORBES_POR_DEFECTO) {
    return Math.max(orbes[idA] ?? 0, orbes[idB] ?? 0);
}

// Las luminarias llevan el orbe del aspecto, sea cual sea el modo: esa
// tabla es justamente "el orbe del Sol y la Luna".
const LUMINARIAS = new Set(['sol', 'luna']);

// De donde sale el orbe de un aspecto entre dos puntos. Entre los dos
// siempre manda el mas grande.
//
// orbesPorAspecto: un orbe fijo por aspecto, sin mirar los puntos. Lo usan
// los transitos, la sinastria y las progresiones, que tienen su propia
// tabla y no entran en esta eleccion.
// modoOrbes 'factor': cada punto se lleva un porcentaje del orbe de las
// luminarias.
// modoOrbes 'punto': el orbe de cada punto a mano, una tabla para los
// aspectos mayores y otra para los menores.
export function orbeDe(asp, idA, idB, {
    orbes = ORBES_POR_DEFECTO, orbesMenores = ORBES_MENORES, orbesPorAspecto = null,
    modoOrbes = 'factor', orbesAspecto = ORBES_ASPECTO, factores = FACTORES_POR_DEFECTO
} = {}) {
    if (orbesPorAspecto) return (asp.menor ? orbesPorAspecto.menor : orbesPorAspecto[asp.id]) ?? 0;
    const delAspecto = orbesAspecto?.[asp.id] ?? 0;
    if (modoOrbes === 'factor') {
        return delAspecto * Math.max(factores?.[idA] ?? 0, factores?.[idB] ?? 0);
    }
    const aMano = (id) => (LUMINARIAS.has(id)
        ? delAspecto
        : (asp.menor ? orbesMenores : orbes)?.[id] ?? 0);
    return Math.max(aMano(idA), aMano(idB));
}

// Las opciones de orbe que salen de los ajustes, para no repetirlas en
// cada lugar que calcula aspectos de una carta.
export const opcionesDeOrbe = (ajustes) => ({
    aspectos: ajustes.aspectos,
    modoOrbes: ajustes.modoOrbes,
    orbesAspecto: ajustes.orbesAspecto,
    factores: ajustes.factores,
    orbes: ajustes.orbes,
    orbesMenores: ajustes.orbesMenores
});

// Que aspectos se miran. Los mayores van salvo que se los apague; los
// menores, solo si estan prendidos. Los ajustes viejos nombran unicamente
// a los menores, y asi siguen andando igual.
export function aspectosActivos(sel = ASPECTOS_POR_DEFECTO) {
    return ASPECTOS.filter((x) => (x.menor ? Boolean(sel?.[x.id]) : sel?.[x.id] !== false));
}

// Un aspecto es aplicativo si la distancia al angulo exacto se achica.
// Hace falta la velocidad de los dos puntos; sin ella queda null.
function aplicativo(a, b, angulo) {
    if (a.vel == null || b.vel == null) return null;
    const dt = 1 / 1440; // un minuto, en dias
    const ahora = Math.abs(distancia(a.lon, b.lon) - angulo);
    const luego = Math.abs(distancia(a.lon + a.vel * dt, b.lon + b.vel * dt) - angulo);
    return luego < ahora;
}

// mismaCarta: true cuando A y B son la misma lista (natal x natal), para
// no repetir pares ni comparar un punto consigo mismo.
// aspectos: { conjuncion: true, semisextil: true, ... } los que se miran.
// El orbe sale de orbeDe: ver ahi las tres maneras.
export function calcularAspectos(puntosA, puntosB, opciones = {}) {
    const { mismaCarta = false, aspectos = ASPECTOS_POR_DEFECTO } = opciones;
    const activos = aspectosActivos(aspectos);
    const res = [];
    puntosA.forEach((a, i) => {
        puntosB.forEach((b, j) => {
            if (mismaCarta && j <= i) return;
            const d = distancia(a.lon, b.lon);
            // Si con orbes amplios entra en dos aspectos, gana el mas exacto.
            let mejor = null;
            for (const asp of activos) {
                const orbe = orbeDe(asp, a.id, b.id, opciones);
                const desvio = Math.abs(d - asp.angulo);
                if (desvio <= orbe && (!mejor || desvio < mejor.orbe)) {
                    mejor = { a: a.id, b: b.id, aspecto: asp.id, menor: Boolean(asp.menor), orbe: desvio, orbeMax: orbe };
                }
            }
            if (mejor) res.push({ ...mejor, aplicativo: aplicativo(a, b, ASPECTOS.find((x) => x.id === mejor.aspecto).angulo) });
        });
    });
    return res.sort((x, y) => x.orbe - y.orbe);
}
