// Carta compuesta por puntos medios (el "Composite - Midpoints" de Solar
// Fire): cada planeta y cada cuspide es el punto medio entre las dos
// cartas. No es una carta de un momento: no hay instante ni lugar, asi
// que no se calcula nada con las efemerides, solo se promedia.
//
// El punto medio en un circulo tiene dos soluciones (una y su opuesta).
// Para los planetas se toma la del arco corto, que es la convencion.
// Para las casas no alcanza con eso: si cada cuspide eligiera su mitad
// por separado, la serie podria salir desordenada y las casas quedarian
// dadas vuelta. Por eso las cuspides se arman desde el Ascendente
// compuesto, promediando la distancia que cada cuspide tiene con el
// Ascendente de su carta: asi la serie queda siempre creciente.
//
// Los planetas, en cambio, van por el arco corto directo. Puede pasar
// que un planeta caiga en una casa que no es la que daria el otro
// criterio: es una rareza conocida de la carta compuesta, y es lo que
// muestra Solar Fire.

import { AJUSTES_POR_DEFECTO } from './config.js';
import { enSigno, casaDe } from './chart.js';
import { calcularAspectos, opcionesDeOrbe } from './aspects.js';

const norm = (x) => ((x % 360) + 360) % 360;

// Punto medio por el arco corto entre dos longitudes.
export function puntoMedio(x, y) {
    const d = norm(y - x);
    return norm(x + (d > 180 ? d - 360 : d) / 2);
}

export function calcularCompuesta(swe, { a, b, ajustes = AJUSTES_POR_DEFECTO }) {
    const angulo = (c, id) => c.angulos.find((x) => x.id === id).lon;
    const ascA = angulo(a, 'asc');
    const ascB = angulo(b, 'asc');
    const asc = puntoMedio(ascA, ascB);
    // Desde el Ascendente compuesto, el promedio de las dos distancias.
    const desdeElAsc = (lonA, lonB) => norm(asc + puntoMedio(norm(lonA - ascA), norm(lonB - ascB)));

    const cusps = a.cusps.map((c, i) => desdeElAsc(c.lon, b.cusps[i].lon));
    cusps[0] = asc;
    const mc = desdeElAsc(angulo(a, 'mc'), angulo(b, 'mc'));

    // Solo los puntos que estan en las dos cartas (los opcionales pueden
    // faltar en una).
    const enB = new Map(b.puntos.map((p) => [p.id, p]));
    const puntos = a.puntos.filter((p) => enB.has(p.id)).map((p) => {
        const lon = puntoMedio(p.lon, enB.get(p.id).lon);
        // La compuesta no se mueve: no hay velocidad ni retrogradacion, y
        // por eso tampoco hay aplicativo ni separativo (con velocidad 0
        // todo saldria separativo, que seria mentir).
        return { id: p.id, lon, vel: null, retro: false, casa: casaDe(lon, cusps), ...enSigno(lon) };
    });

    const angulos = [
        { id: 'asc', lon: asc, ...enSigno(asc) },
        { id: 'mc', lon: mc, ...enSigno(mc) }
    ];

    const elegidos = ajustes.puntosAspectados;
    const entra = (id) => (elegidos ? elegidos[id] !== false : true);
    const conAngulos = elegidos ? (entra('asc') || entra('mc')) : ajustes.aspectosAngulos;
    const participantes = [
        ...puntos.filter((p) => entra(p.id)),
        ...(conAngulos ? angulos.filter((x) => entra(x.id)) : [])
    ];
    const aspectos = calcularAspectos(participantes, participantes, {
        ...opcionesDeOrbe(ajustes), mismaCarta: true
    });

    return {
        meta: { compuesta: true, ajustes, casas: ajustes.casas },
        puntos,
        angulos,
        cusps: cusps.map((lon, i) => ({ casa: i + 1, lon, ...enSigno(lon) })),
        aspectos
    };
}
