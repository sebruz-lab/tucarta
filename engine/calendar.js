// Calendario de transitos: para cada planeta lento en transito y cada
// punto de la carta natal, cuando entra en orbe cada aspecto, cuando es
// exacto (puede serlo varias veces por la retrogradacion) y cuando sale.
//
// Se recorre dia por dia y despues se afina cada fecha por biseccion. El
// recorrido arranca y termina dos anios por fuera del periodo pedido, para
// encontrar la entrada y la salida reales de los transitos largos.

import { PUNTOS, ASPECTOS, AJUSTES_POR_DEFECTO } from './config.js';
import { flagsDe } from './chart.js';
import { biseccion } from './raices.js';

export const PUNTOS_CALENDARIO = ['jupiter', 'saturno', 'urano', 'neptuno', 'pluton', 'quiron', 'nodo'];
const MARGEN = 730;      // dias antes y despues del periodo

// Diferencia angular con signo, en (-180, 180].
const dif = (a, b) => {
    const d = ((a - b) % 360 + 360) % 360;
    return d > 180 ? d - 360 : d;
};

// natal: modelo de calcularCarta. desde/hasta: dias julianos (UT).
// Devuelve [{ a, b, aspecto, menor, entra, sale, exactos: [jd] }] de los
// transitos que tocan el periodo, ordenados por la fecha en que empiezan
// a contar dentro del periodo. entra/sale quedan null si caen fuera del
// margen recorrido.
export function calendarioTransitos(swe, { natal, desde, hasta, ajustes = AJUSTES_POR_DEFECTO, planetas = PUNTOS_CALENDARIO }) {
    const orbes = ajustes.orbesTransito || AJUSTES_POR_DEFECTO.orbesTransito;
    const menores = ajustes.menores || AJUSTES_POR_DEFECTO.menores;
    const activos = ASPECTOS.filter((x) => !x.menor || menores[x.id]);
    const natales = [...natal.puntos, ...natal.angulos];
    const inicio = Math.floor(desde) - MARGEN;
    const dias = Math.ceil(hasta) + MARGEN - inicio;
    const res = [];

    for (const id of planetas) {
        const p = PUNTOS.find((x) => x.id === id);
        const lon = (jd) => swe.calc(jd, p.swe, flagsDe(p.swe)).lon;
        const lons = Array.from({ length: dias + 1 }, (_, k) => lon(inicio + k));

        for (const n of natales) {
            for (const asp of activos) {
                const orbe = asp.menor ? orbes.menor : orbes[asp.id];
                if (!(orbe > 0)) continue;
                // Cada aspecto tiene dos puntos exactos sobre el zodiaco
                // (salvo conjuncion y oposicion).
                const blancos = asp.angulo === 0 || asp.angulo === 180
                    ? [n.lon + asp.angulo] : [n.lon + asp.angulo, n.lon - asp.angulo];
                for (const blanco of blancos) {
                    const g = (jd) => dif(lon(jd), blanco);
                    const fuera = (jd) => Math.abs(g(jd)) - orbe;
                    let actual = null;
                    for (let k = 0; k <= dias; k++) {
                        const dentro = Math.abs(dif(lons[k], blanco)) <= orbe;
                        const jd = inicio + k;
                        if (dentro && !actual) {
                            actual = { entra: k === 0 ? null : biseccion(fuera, jd - 1, jd), exactos: [] };
                        }
                        if (actual && k > 0) {
                            const g0 = dif(lons[k - 1], blanco);
                            const g1 = dif(lons[k], blanco);
                            // Cruce por cero (y no el salto de +180 a -180).
                            if (g0 !== 0 && Math.sign(g0) !== Math.sign(g1) && Math.abs(g0 - g1) < 90) {
                                actual.exactos.push(biseccion(g, jd - 1, jd));
                            } else if (g1 === 0) actual.exactos.push(jd);
                        }
                        if (!dentro && actual) {
                            actual.sale = biseccion((x) => -fuera(x), jd - 1, jd);
                            guardar(actual);
                            actual = null;
                        }
                    }
                    if (actual) { actual.sale = null; guardar(actual); }

                    function guardar(t) {
                        const empieza = t.entra ?? -Infinity;
                        const termina = t.sale ?? Infinity;
                        if (termina < desde || empieza > hasta) return;
                        res.push({ a: id, b: n.id, aspecto: asp.id, menor: Boolean(asp.menor), ...t });
                    }
                }
            }
        }
    }
    const clave = (t) => Math.max(t.entra ?? -Infinity, desde);
    return res.sort((x, y) => clave(x) - clave(y) || (x.exactos[0] ?? 0) - (y.exactos[0] ?? 0));
}
