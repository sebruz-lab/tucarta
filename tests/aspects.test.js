import { describe, it, expect } from 'vitest';
import { calcularAspectos, distancia, orbeEntre } from '../engine/aspects.js';

describe('distancia', () => {
    it('cruza 0° Aries', () => {
        expect(distancia(355, 5)).toBe(10);
        expect(distancia(5, 355)).toBe(10);
    });
    it('nunca supera 180°', () => {
        expect(distancia(0, 200)).toBe(160);
    });
});

describe('orbeEntre', () => {
    it('usa el mayor de los dos', () => {
        expect(orbeEntre('sol', 'pluton')).toBe(9);
        expect(orbeEntre('saturno', 'lilith')).toBe(7);
        expect(orbeEntre('quiron', 'nodo')).toBe(5);
    });
});

describe('calcularAspectos', () => {
    it('Sol–Plutón en cuadratura a 8° entra por el orbe del Sol', () => {
        const p = [{ id: 'sol', lon: 10 }, { id: 'pluton', lon: 108 }];
        const r = calcularAspectos(p, p, { mismaCarta: true });
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({ a: 'sol', b: 'pluton', aspecto: 'cuadratura', orbeMax: 9 });
        expect(r[0].orbe).toBeCloseTo(8);
    });

    it('Urano–Neptuno a 6° de trígono queda afuera', () => {
        const p = [{ id: 'urano', lon: 0 }, { id: 'neptuno', lon: 126 }];
        expect(calcularAspectos(p, p, { mismaCarta: true })).toHaveLength(0);
    });

    it('conjunción a través de 0° Aries', () => {
        const p = [{ id: 'venus', lon: 358 }, { id: 'marte', lon: 3 }];
        const r = calcularAspectos(p, p, { mismaCarta: true });
        expect(r[0].aspecto).toBe('conjuncion');
    });

    it('detecta si es aplicativo con las velocidades', () => {
        // Luna rapida detras del Sol: se acerca a la conjuncion.
        const p = [{ id: 'sol', lon: 100, vel: 1 }, { id: 'luna', lon: 95, vel: 13 }];
        expect(calcularAspectos(p, p, { mismaCarta: true })[0].aplicativo).toBe(true);
    });
});

describe('aspectos menores', () => {
    const par = (lonB, opciones) => calcularAspectos(
        [{ id: 'sol', lon: 0 }, { id: 'marte', lon: lonB }],
        [{ id: 'sol', lon: 0 }, { id: 'marte', lon: lonB }],
        { mismaCarta: true, ...opciones });

    it('semisextil y quincuncio activos por defecto, con orbe propio', () => {
        // Sol-Marte: el orbe menor del Sol (7°) manda.
        expect(par(36.5)[0]).toMatchObject({ aspecto: 'semisextil', menor: true, orbeMax: 7 });
        expect(par(152.5)[0]).toMatchObject({ aspecto: 'quincuncio', orbeMax: 7 });
        expect(par(37.5)).toHaveLength(0); // fuera del orbe de 7°
    });

    it('el orbe menor sale de los dos puntos, el mayor gana', () => {
        const p = (idA, idB, lonB) => calcularAspectos(
            [{ id: idA, lon: 0 }, { id: idB, lon: lonB }],
            [{ id: idA, lon: 0 }, { id: idB, lon: lonB }], { mismaCarta: true });
        expect(p('urano', 'pluton', 33)[0]).toMatchObject({ aspecto: 'semisextil', orbeMax: 3 });
        expect(p('urano', 'pluton', 33.5)).toHaveLength(0);
        expect(p('venus', 'pluton', 34.5)[0]).toMatchObject({ orbeMax: 5 });
    });

    it('semicuadratura y sesquicuadratura solo si se activan', () => {
        expect(par(45)).toHaveLength(0);
        const menores = { semisextil: true, quincuncio: true, semicuadratura: true, sesquicuadratura: true };
        expect(par(45, { menores })[0].aspecto).toBe('semicuadratura');
        expect(par(136, { menores })[0].aspecto).toBe('sesquicuadratura');
    });

    it('si entra en dos aspectos, gana el más exacto', () => {
        // 134°: trígono a 14° (entra con orbe 15) y sesquicuadratura a 1°.
        const orbes = { sol: 15, marte: 15 };
        const menores = { sesquicuadratura: true };
        expect(par(134, { orbes, menores })[0]).toMatchObject({ aspecto: 'sesquicuadratura', orbe: 1 });
    });
});
