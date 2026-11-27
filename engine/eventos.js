// Calendario del cielo: todos los instantes exactos de un periodo, que es
// lo que Solar Fire pone adentro de cada dia del mes.
//
// Son cinco cosas, y las primeras cuatro son el mismo problema (una
// funcion del tiempo que pasa por cero), resuelto por `cruces`:
//
//   aspecto-tr  dos puntos en transito llegan a un aspecto exacto
//   aspecto-na  un punto en transito llega a un aspecto exacto con la carta
//   ingreso     un punto cambia de signo
//   estacion    un punto se hace retrogrado (SR) o directo (SD)
//   fase        las cuatro fases de la Luna (sale de lunaciones.js)
//
// Aca no hay orbes: el calendario muestra el instante exacto, no la
// ventana. La ventana ya la da `calendarioTransitos`, que es la otra
// manera de mirar lo mismo y sigue siendo la vista de "Periodos".
//
// Se muestrea cada 6 horas y no cada dia: la Luna avanza 13° por dia, asi
// que con un paso diario se pierden aspectos enteros (entra y sale del
// blanco entre dos muestras). Las longitudes se calculan una sola vez por
// punto y se reusan para los cuatro carriles.

import { PUNTOS, AJUSTES_POR_DEFECTO } from './config.js';
import { aspectosActivos, participantes } from './aspects.js';
import { flagsDe, SIGNOS } from './chart.js';
import { crucesDe, UN_SEGUNDO } from './raices.js';
import { fasesEntre } from './lunaciones.js';
import { utcDeJd } from './solarReturn.js';

// Los trece de la carta. Cualquiera se puede sacar desde la interfaz: el
// que mas se saca es la Luna, que sola hace dos tercios de los renglones.
export const PUNTOS_CIELO = PUNTOS.map((p) => p.id);

// Seis horas. Con la Luna (13°/dia) son 3,3° entre muestras, muy por
// debajo de la tolerancia que necesita el descarte del salto de ±180.
export const PASO_CIELO = 0.25;

// Al minuto (la precision de biseccion por defecto) la mitad de los
// eventos cae en el minuto siguiente al que muestra Solar Fire, porque se
// devuelve el medio del intervalo. Al segundo eso desaparece.
const FINO = { precision: UN_SEGUNDO };

const CARRILES_POR_DEFECTO = { entrePlanetas: true, aLaCarta: true, cielo: true };

// Diferencia mas corta entre dos longitudes, en (-180, 180].
const dif = (x) => ((((x % 360) + 540) % 360) - 180);

// Los dos lugares del zodiaco donde un aspecto es exacto. La conjuncion y
// la oposicion tienen uno solo.
const blancosDe = (asp) => (asp.angulo === 0 || asp.angulo === 180 ? [asp.angulo] : [asp.angulo, -asp.angulo]);

export function eventosDelCielo(swe, {
    desde, hasta, natal = null, carriles = CARRILES_POR_DEFECTO,
    puntos = PUNTOS_CIELO, ajustes = AJUSTES_POR_DEFECTO
} = {}) {
    const quiero = { ...CARRILES_POR_DEFECTO, ...carriles };
    const elegidos = PUNTOS.filter((p) => puntos.includes(p.id));
    const activos = aspectosActivos(ajustes.aspectosTransito || ajustes.aspectos
        || AJUSTES_POR_DEFECTO.aspectosTransito);

    // Una sola pasada de efemerides: longitud y velocidad de cada punto.
    const n = Math.max(1, Math.ceil((hasta - desde) / PASO_CIELO));
    const jds = Array.from({ length: n + 1 }, (_, k) => (k === n ? hasta : desde + k * PASO_CIELO));
    const lon = (p) => (jd) => swe.calc(jd, p.swe, flagsDe(p.swe)).lon;
    const serie = new Map(elegidos.map((p) => {
        const r = jds.map((jd) => swe.calc(jd, p.swe, flagsDe(p.swe)));
        return [p.id, { p, lons: r.map((x) => x.lon), vels: r.map((x) => x.velLon) }];
    }));

    const res = [];
    const dentro = (jd) => jd >= desde && jd <= hasta;
    const sumar = (ev) => { if (dentro(ev.jd)) res.push(ev); };

    // Aspectos entre dos puntos en transito.
    if (quiero.entrePlanetas) {
        for (let i = 0; i < elegidos.length; i++) {
            for (let j = i + 1; j < elegidos.length; j++) {
                const a = serie.get(elegidos[i].id);
                const b = serie.get(elegidos[j].id);
                const seps = a.lons.map((l, k) => dif(l - b.lons[k]));
                const lonA = lon(a.p);
                const lonB = lon(b.p);
                for (const asp of activos) {
                    for (const blanco of blancosDe(asp)) {
                        const f = (jd) => dif(lonA(jd) - lonB(jd) - blanco);
                        const valores = seps.map((s) => dif(s - blanco));
                        for (const jd of crucesDe(f, jds, valores, FINO)) {
                            sumar({ tipo: 'aspecto-tr', jd, a: a.p.id, b: b.p.id, aspecto: asp.id, menor: Boolean(asp.menor) });
                        }
                    }
                }
            }
        }
    }

    // Aspectos de un punto en transito a la carta abierta. Quien los
    // recibe sale de "Puntos aspectados", igual que en calendarioTransitos.
    if (quiero.aLaCarta && natal) {
        const natales = participantes(natal, ajustes);
        for (const { p, lons } of serie.values()) {
            const lonP = lon(p);
            for (const nat of natales) {
                for (const asp of activos) {
                    for (const blanco of blancosDe(asp)) {
                        const f = (jd) => dif(lonP(jd) - nat.lon - blanco);
                        const valores = lons.map((l) => dif(l - nat.lon - blanco));
                        for (const jd of crucesDe(f, jds, valores, FINO)) {
                            sumar({ tipo: 'aspecto-na', jd, a: p.id, b: nat.id, aspecto: asp.id, menor: Boolean(asp.menor) });
                        }
                    }
                }
            }
        }
    }

    // Ingresos y estaciones: no dependen de ninguna carta.
    if (quiero.cielo) {
        for (const { p, lons, vels } of serie.values()) {
            const lonP = lon(p);
            for (let s = 0; s < 12; s++) {
                const borde = s * 30;
                const f = (jd) => dif(lonP(jd) - borde);
                const valores = lons.map((l) => dif(l - borde));
                for (const jd of crucesDe(f, jds, valores, FINO)) {
                    const r = swe.calc(jd, p.swe, flagsDe(p.swe));
                    // De ida entra al signo que empieza en el borde; de
                    // vuelta (retrogrado) entra al anterior.
                    const retro = r.velLon < 0;
                    sumar({ tipo: 'ingreso', jd, punto: p.id, signo: SIGNOS[retro ? (s + 11) % 12 : s], retro });
                }
            }
            // Estaciones: la velocidad pasa por cero. No envuelve, asi que
            // no hay salto que descartar.
            const vel = (jd) => swe.calc(jd, p.swe, flagsDe(p.swe)).velLon;
            for (const jd of crucesDe(vel, jds, vels, { salto: Infinity, precision: UN_SEGUNDO })) {
                const antes = vel(jd - 1 / 48);
                sumar({ tipo: 'estacion', jd, punto: p.id, sentido: antes > 0 ? 'SR' : 'SD' });
            }
        }
        for (const f of fasesEntre(swe, { desde, hasta })) {
            sumar({ tipo: 'fase', jd: f.jd, fase: f.fase, lon: f.lon, signo: f.signo, grado: f.grado, minuto: f.minuto });
        }
    }

    for (const ev of res) ev.utc = utcDeJd(ev.jd);
    return res.sort((x, y) => x.jd - y.jd);
}
