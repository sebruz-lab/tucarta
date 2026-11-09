// Calculo de la carta. Entra el instante en UTC (la conversion desde la
// hora local la hace time/tz.js) y sale un modelo en JSON puro, que la
// interfaz dibuja y que los tests comparan contra Solar Fire.

import { PUNTOS, PUNTOS_OPCIONALES, AJUSTES_POR_DEFECTO } from './config.js';
import { calcularAspectos } from './aspects.js';

// Flags de Swiss Ephemeris (swephexp.h).
const SEFLG_SWIEPH = 2;
const SEFLG_MOSEPH = 4;
const SEFLG_SPEED = 256;

// Planetas y Luna con Moshier (no necesita archivos, precision de
// segundos de arco). Lo demas sale de archivos: Quiron y los cuatro
// asteroides de seas_18.se1, y Sedna y Eris del suyo.
const SWE_CHIRON = 15;
const SWE_CERES = 17;
const SWE_VESTA = 20;
const SWE_ASTEROIDE = 10000; // de aca en adelante, asteroides numerados
const conArchivo = (swe) => swe === SWE_CHIRON || (swe >= SWE_CERES && swe <= SWE_VESTA) || swe >= SWE_ASTEROIDE;
export const flagsDe = (swe) => (conArchivo(swe) ? SEFLG_SWIEPH : SEFLG_MOSEPH) | SEFLG_SPEED;

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

// Los puntos que la persona sumo en los ajustes. Los que tienen cuerpo en
// Swiss Ephemeris se piden como cualquier otro; el resto sale de los que
// ya estan calculados. Si a alguno le falta su archivo de efemerides se lo
// saltea en silencio: vale mas una carta sin ese punto que ninguna carta.
function puntosOpcionales(swe, jd, { puntos, casas, ajustes }) {
    const elegidos = ajustes.puntos || {};
    const activos = PUNTOS_OPCIONALES.filter((p) => elegidos[p.id]);
    if (!activos.length) return [];

    const lonDe = (id) => puntos.find((p) => p.id === id)?.lon;
    const norm = (x) => ((x % 360) + 360) % 360;
    // De dia la Fortuna es Asc + Luna - Sol; de noche se da vuelta. Es de
    // noche cuando el Sol esta sobre el horizonte... al reves: cuando esta
    // debajo, o sea en las casas 1 a 6 contando desde el Ascendente.
    const fortuna = () => {
        const sol = lonDe('sol');
        const luna = lonDe('luna');
        if (sol === undefined || luna === undefined) return undefined;
        const deNoche = ajustes.fortunaNocturna !== false && norm(sol - casas.asc) < 180;
        return deNoche ? norm(casas.asc + sol - luna) : norm(casas.asc + luna - sol);
    };
    const calculados = {
        nodosur: () => { const n = lonDe('nodo'); return n === undefined ? undefined : norm(n + 180); },
        tierra: () => { const s = lonDe('sol'); return s === undefined ? undefined : norm(s + 180); },
        fortuna
    };

    const salida = [];
    for (const p of activos) {
        let lon;
        let vel = 0;
        if (p.calculado) {
            lon = calculados[p.id]?.();
        } else {
            try {
                const r = swe.calc(jd, p.swe, flagsDe(p.swe));
                lon = r.lon;
                vel = r.velLon;
            } catch {
                continue; // sin su archivo de efemerides
            }
        }
        if (lon === undefined || !Number.isFinite(lon)) continue;
        salida.push({
            id: p.id, lon, vel, retro: vel < 0, opcional: true,
            casa: casaDe(lon, casas.cusps), ...enSigno(lon)
        });
    }
    return salida;
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

    puntos.push(...puntosOpcionales(swe, jd, { puntos, casas, ajustes }));

    // Quien entra en los aspectos: lo que la persona haya elegido. El
    // Ascendente y el Medio Cielo siguen atados a aspectosAngulos para no
    // cambiarle la carta a quien ya lo tenia configurado.
    const elegidos = ajustes.puntosAspectados;
    const entra = (id) => (elegidos ? elegidos[id] !== false : true);
    const conAngulos = elegidos ? (entra('asc') || entra('mc')) : ajustes.aspectosAngulos;
    const participantes = [
        ...puntos.filter((p) => entra(p.id)),
        ...(conAngulos ? angulos.filter((a) => entra(a.id)) : [])
    ];
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
