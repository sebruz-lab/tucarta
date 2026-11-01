// Aspectos mayores entre dos listas de puntos. Es generico a proposito:
// en la carta natal se llama con la misma lista dos veces; en transitos
// (etapa 2) sera transitos x natal.
//
// Cada punto: { id, lon, vel? } con lon en grados eclipticos [0, 360).

import { ASPECTOS, ORBES_POR_DEFECTO, ORBES_MENORES, MENORES_POR_DEFECTO } from './config.js';

// Distancia angular minima entre dos longitudes, en [0, 180].
export function distancia(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

export function orbeEntre(idA, idB, orbes = ORBES_POR_DEFECTO) {
    return Math.max(orbes[idA] ?? 0, orbes[idB] ?? 0);
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
// menores: { semisextil: true, ... } aspectos menores activos.
// orbesPorAspecto (transitos): { conjuncion: 3, ..., menor: 1 }; si viene,
// el orbe depende del aspecto y no de los puntos.
export function calcularAspectos(puntosA, puntosB, {
    orbes = ORBES_POR_DEFECTO, mismaCarta = false,
    menores = MENORES_POR_DEFECTO, orbesMenores = ORBES_MENORES, orbesPorAspecto = null
} = {}) {
    const activos = ASPECTOS.filter((x) => !x.menor || menores[x.id]);
    const res = [];
    puntosA.forEach((a, i) => {
        puntosB.forEach((b, j) => {
            if (mismaCarta && j <= i) return;
            const orbeMayor = orbeEntre(a.id, b.id, orbes);
            const orbeMenor = orbeEntre(a.id, b.id, orbesMenores);
            const d = distancia(a.lon, b.lon);
            // Si con orbes amplios entra en dos aspectos, gana el mas exacto.
            let mejor = null;
            for (const asp of activos) {
                const orbe = orbesPorAspecto
                    ? (asp.menor ? orbesPorAspecto.menor : orbesPorAspecto[asp.id]) ?? 0
                    : asp.menor ? orbeMenor : orbeMayor;
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
