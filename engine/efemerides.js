// Efemerides graficas (como las de Solar Fire): la posicion de cada planeta
// en transito dentro de un modulo, dia por dia, y sus cruces con los puntos
// natales. En modulo 30 se ve el grado dentro del signo, y cada cruce es un
// aspecto exacto multiplo de 30° (conjuncion, semisextil, sextil,
// cuadratura, trigono, quincuncio, oposicion). En modulo 45, los multiplos
// de 45° (los tensos); en modulo 90, conjuncion, cuadratura y oposicion.

import { PUNTOS, ASPECTOS } from './config.js';
import { flagsDe } from './chart.js';
import { biseccion } from './raices.js';

export const MODULOS = [30, 45, 90];
// Por defecto: de la Luna Negra en adelante (los lentos).
export const TRANSITAN_EFEMERIDES = ['lilith', 'nodo', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'];
const norm = (x, m) => ((x % m) + m) % m;

// natal: modelo de calcularCarta. desde/hasta: dias julianos (UT).
// planetas: los que transitan. natales: ids de los puntos natales (null:
// todos, con el Ascendente y el Medio Cielo).
// Devuelve { inicio, dias, modulo, lineas: [{ id, lons }], cruces: [{ a, b,
// jd, aspecto, grado }], natales: [{ id, lon }] }. lons: la longitud de cada
// dia desde `inicio`; grado: el del cruce dentro del modulo.
export function efemeridesGraficas(swe, { natal, desde, hasta, modulo = 30, planetas = TRANSITAN_EFEMERIDES, natales = null }) {
    if (!MODULOS.includes(modulo)) throw new Error('Módulo no válido');
    // Un valor por dia desde `desde` (a la hora que venga: por ejemplo, la
    // medianoche del dispositivo).
    const inicio = desde;
    const dias = Math.max(1, Math.round(hasta - desde));
    const puntosNatales = [...natal.puntos, ...natal.angulos].filter((n) => !natales || natales.includes(n.id));
    const lineas = [];
    const cruces = [];

    for (const id of planetas) {
        const p = PUNTOS.find((x) => x.id === id);
        if (!p) continue;
        const lon = (jd) => swe.calc(jd, p.swe, flagsDe(p.swe)).lon;
        const lons = Array.from({ length: dias + 1 }, (_, k) => lon(inicio + k));
        lineas.push({ id, lons: lons.map((l) => Math.round(l * 1e4) / 1e4) });

        for (const n of puntosNatales) {
            // Distancia al punto natal dentro del modulo, en (-m/2, m/2]:
            // vale cero en cada aspecto exacto multiplo del modulo.
            const g = (l) => {
                const d = norm(l - n.lon, modulo);
                return d > modulo / 2 ? d - modulo : d;
            };
            for (let k = 1; k <= dias; k++) {
                const g0 = g(lons[k - 1]);
                const g1 = g(lons[k]);
                // Cruce por cero (y no el salto de un borde al otro).
                if (g0 === 0 || Math.sign(g0) === Math.sign(g1) || Math.abs(g0 - g1) >= modulo / 2) continue;
                const jd = biseccion((x) => g(lon(x)), inicio + k - 1, inicio + k);
                const sep = norm(lon(jd) - n.lon, 360);
                const angulo = norm(Math.round(sep / modulo) * modulo, 360);
                const aspecto = ASPECTOS.find((x) => x.angulo === (angulo > 180 ? 360 - angulo : angulo));
                if (!aspecto) continue;
                cruces.push({ a: id, b: n.id, jd, aspecto: aspecto.id, grado: norm(n.lon, modulo) });
            }
        }
    }
    cruces.sort((x, y) => x.jd - y.jd);
    return { inicio, dias, modulo, lineas, cruces, natales: puntosNatales.map((n) => ({ id: n.id, lon: n.lon })) };
}
