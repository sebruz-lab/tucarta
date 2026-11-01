// Progresiones secundarias: un dia despues del nacimiento por cada anio de
// vida (anio tropico, como el "Standard (Q2)" de Solar Fire). Los planetas
// salen de ese dia; los angulos se progresan aparte, segun el metodo:
//   'arco-long'  arco solar en longitud (el "SA in Long" de Solar Fire)
//   'arco-ra'    arco solar en ascension recta
//   'naibod'     Naibod en ascension recta (0°59'08" por anio)
// Las casas progresadas se arman con la ARMC progresada en la latitud natal.

import { AJUSTES_POR_DEFECTO } from './config.js';
import { calcularCarta } from './chart.js';
import { calcularAspectos } from './aspects.js';
import { utcDeJd } from './solarReturn.js';

export const ANIO_TROPICO = 365.24219;
export const METODOS_PROGRESION = [
    { id: 'arco-long', nombre: 'Arco solar en longitud (como Solar Fire)' },
    { id: 'arco-ra', nombre: 'Arco solar en ascensión recta' },
    { id: 'naibod', nombre: 'Naibod en ascensión recta' }
];
const NAIBOD = 0.98564733; // grados por anio
// En las progresiones el orbe es de 1° para todos los aspectos y puntos.
export const ORBES_PROGRESION = {
    conjuncion: 1, oposicion: 1, trigono: 1, cuadratura: 1, sextil: 1, menor: 1
};
const SOL = 0;
const SE_ECL_NUT = -1;
const SEFLG_MOSEPH = 4;
const SEFLG_EQUATORIAL = 2048;
const rad = Math.PI / 180;

const norm = (x) => ((x % 360) + 360) % 360;
const dif = (a, b) => {
    const d = norm(a - b);
    return d > 180 ? d - 360 : d;
};

// Ascension recta de un punto de la ecliptica (latitud 0).
const raDe = (lon, eps) => norm(Math.atan2(Math.sin(lon * rad) * Math.cos(eps * rad), Math.cos(lon * rad)) / rad);

// jdObjetivo: el momento al que se progresa (dia juliano UT).
export function calcularProgresion(swe, { natal, jdObjetivo, ajustes = AJUSTES_POR_DEFECTO }) {
    const { jd: jdNatal, lat, lon } = natal.meta;
    const metodo = ajustes.metodoProgresion || 'arco-long';
    const edad = (jdObjetivo - jdNatal) / ANIO_TROPICO; // en anios
    const jdProg = jdNatal + edad; // un dia por anio
    const utc = utcDeJd(jdProg);

    const eps = swe.calc(jdNatal, SE_ECL_NUT, SEFLG_MOSEPH).lon;
    const solNatal = swe.calc(jdNatal, SOL, SEFLG_MOSEPH);
    const solProg = swe.calc(jdProg, SOL, SEFLG_MOSEPH);
    const mcNatal = natal.angulos.find((a) => a.id === 'mc').lon;

    // Cuanto avanza la ARMC (en grados) segun el metodo.
    let avance;
    if (metodo === 'naibod') {
        avance = edad * NAIBOD;
    } else if (metodo === 'arco-ra') {
        const raN = swe.calc(jdNatal, SOL, SEFLG_MOSEPH | SEFLG_EQUATORIAL).lon;
        const raP = swe.calc(jdProg, SOL, SEFLG_MOSEPH | SEFLG_EQUATORIAL).lon;
        avance = norm(raP - raN);
    } else {
        const arco = norm(solProg.lon - solNatal.lon);
        avance = dif(raDe(mcNatal + arco, eps), raDe(mcNatal, eps));
    }

    // Mover la longitud geografica mueve la ARMC lo mismo: las casas del
    // instante natal con la longitud corrida son las casas progresadas.
    const lonCorrida = dif(lon + avance, 0);
    const casas = swe.houses(jdNatal, lat, lonCorrida, ajustes.casas);
    const carta = calcularCarta(swe, { utc, lat, lon, ajustes, casas });
    const opciones = { orbesPorAspecto: ORBES_PROGRESION, menores: ajustes.menores };
    const participantes = ajustes.aspectosAngulos ? [...carta.puntos, ...carta.angulos] : carta.puntos;
    carta.aspectos = calcularAspectos(participantes, participantes, { ...opciones, mismaCarta: true });
    // Progresada -> natal (la natal quieta, con sus angulos).
    const natales = [...natal.puntos, ...natal.angulos].map((p) => ({ id: p.id, lon: p.lon, vel: 0 }));
    const aspectosNatal = calcularAspectos([...carta.puntos, ...carta.angulos], natales, opciones);
    return { edad, jd: jdProg, jdObjetivo, metodo, arco: norm(solProg.lon - solNatal.lon), carta, aspectosNatal };
}
