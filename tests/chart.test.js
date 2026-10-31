import { describe, it, expect } from 'vitest';
import { enSigno, casaDe } from '../engine/chart.js';

describe('enSigno', () => {
    it('trunca al minuto, como Solar Fire', () => {
        expect(enSigno(341 + 16.5 / 60)).toEqual({ signo: 'piscis', grado: 11, minuto: 16 });
        expect(enSigno(29 + 59.75 / 60)).toEqual({ signo: 'aries', grado: 29, minuto: 59 });
    });
    it('normaliza longitudes fuera de rango', () => {
        expect(enSigno(360)).toEqual({ signo: 'aries', grado: 0, minuto: 0 });
        expect(enSigno(-30)).toEqual({ signo: 'piscis', grado: 0, minuto: 0 });
    });
});

describe('casaDe', () => {
    const cusps = [350, 20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320];
    it('casa que cruza 0° Aries', () => {
        expect(casaDe(355, cusps)).toBe(1);
        expect(casaDe(5, cusps)).toBe(1);
    });
    it('cúspide exacta pertenece a la casa que empieza', () => {
        expect(casaDe(20, cusps)).toBe(2);
    });
});
