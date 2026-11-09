import { describe, it, expect } from 'vitest';
import { calcularCompuesta, puntoMedio } from '../engine/composite.js';
import { enSigno, casaDe } from '../engine/chart.js';

// Carta de juguete con casas iguales desde el Ascendente: alcanza para
// probar los puntos medios, que no tocan las efemerides.
const cartaDe = (lonsPorId, asc) => {
    const cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
    const mc = (asc + 270) % 360;
    return {
        meta: {},
        puntos: Object.entries(lonsPorId).map(([id, lon]) => ({
            id, lon, vel: 1, retro: true, casa: casaDe(lon, cusps), ...enSigno(lon)
        })),
        angulos: [{ id: 'asc', lon: asc, ...enSigno(asc) }, { id: 'mc', lon: mc, ...enSigno(mc) }],
        cusps: cusps.map((lon, i) => ({ casa: i + 1, lon, ...enSigno(lon) })),
        aspectos: []
    };
};

describe('puntoMedio', () => {
    it('toma el arco corto', () => {
        expect(puntoMedio(10, 50)).toBeCloseTo(30, 9);
        expect(puntoMedio(50, 10)).toBeCloseTo(30, 9);
    });
    it('cruza el 0 de Aries por el lado corto', () => {
        expect(puntoMedio(350, 10)).toBeCloseTo(0, 9);
        expect(puntoMedio(10, 350)).toBeCloseTo(0, 9);
    });
});

describe('carta compuesta por puntos medios', () => {
    const a = cartaDe({ sol: 10, luna: 100, venus: 350 }, 0);
    const b = cartaDe({ sol: 50, luna: 140, venus: 30 }, 40);
    const c = calcularCompuesta(null, { a, b });

    it('cada planeta es el punto medio de los dos', () => {
        const lon = (id) => c.puntos.find((p) => p.id === id).lon;
        expect(lon('sol')).toBeCloseTo(30, 6);
        expect(lon('luna')).toBeCloseTo(120, 6);
        expect(lon('venus')).toBeCloseTo(10, 6);
    });

    it('el Ascendente es el punto medio de los dos Ascendentes', () => {
        expect(c.angulos.find((x) => x.id === 'asc').lon).toBeCloseTo(20, 6);
        expect(c.cusps[0].lon).toBeCloseTo(20, 6);
    });

    it('las cúspides quedan en orden creciente desde el Ascendente', () => {
        const desde = c.cusps.map((x) => ((x.lon - c.cusps[0].lon) % 360 + 360) % 360);
        for (let i = 1; i < desde.length; i++) expect(desde[i]).toBeGreaterThan(desde[i - 1]);
    });

    it('no se mueve: sin velocidad ni retrogradación', () => {
        expect(c.puntos.every((p) => p.vel === 0 && p.retro === false)).toBe(true);
    });

    it('cada planeta trae la casa de la propia compuesta', () => {
        const cusps = c.cusps.map((x) => x.lon);
        expect(c.puntos.every((p) => p.casa === casaDe(p.lon, cusps))).toBe(true);
    });

    it('solo entran los puntos que están en las dos cartas', () => {
        const soloA = cartaDe({ sol: 10, quiron: 200 }, 0);
        const soloB = cartaDe({ sol: 50 }, 40);
        const x = calcularCompuesta(null, { a: soloA, b: soloB });
        expect(x.puntos.map((p) => p.id)).toEqual(['sol']);
    });

    it('el punto medio no depende del orden de las cartas', () => {
        const alReves = calcularCompuesta(null, { a: b, b: a });
        const lon = (carta, id) => carta.puntos.find((p) => p.id === id).lon;
        for (const id of ['sol', 'luna', 'venus']) {
            expect(lon(alReves, id)).toBeCloseTo(lon(c, id), 6);
        }
        expect(alReves.cusps[0].lon).toBeCloseTo(c.cusps[0].lon, 6);
    });
});
