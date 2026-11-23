import { describe, it, expect } from 'vitest';
import { muestras, cruces, crucesDe, PRECISION, UN_SEGUNDO } from '../engine/raices.js';

// Diferencia mas corta, en (-180, 180]: la misma que usan el calendario y
// los eventos del cielo.
const dif = (x) => ((((x % 360) + 540) % 360) - 180);

describe('muestras', () => {
    it('la ultima cae exactamente en hasta', () => {
        const { jds } = muestras((x) => x, 0, 10, 3);
        expect(jds[0]).toBe(0);
        expect(jds[jds.length - 1]).toBe(10);
    });

    it('con un periodo mas corto que el paso deja igual los dos extremos', () => {
        const { jds } = muestras((x) => x, 5, 5.2, 1);
        expect(jds).toEqual([5, 5.2]);
    });
});

describe('cruces', () => {
    it('encuentra una raiz simple con la precision pedida', () => {
        const [r] = cruces((x) => x - 3.7, 0, 10, 1, { precision: UN_SEGUNDO });
        expect(r).toBeCloseTo(3.7, 4);
    });

    it('encuentra todas las raices del periodo', () => {
        // sen(pi x) cruza cero en cada entero.
        const r = cruces((x) => Math.sin(Math.PI * x), 0.5, 5.5, 0.25, { salto: Infinity });
        expect(r.map((x) => Math.round(x))).toEqual([1, 2, 3, 4, 5]);
    });

    it('no cuenta dos veces una muestra que cae justo en cero', () => {
        expect(cruces((x) => x - 2, 0, 4, 1)).toEqual([2]);
    });

    it('descarta el salto de +180 a -180, que no es un cruce', () => {
        // Una longitud que avanza 13 grados por dia, como la Luna: pasa por
        // +180 (salto) y por 0 (cruce de verdad) una vez cada uno.
        const g = (jd) => dif(13 * jd);
        const r = cruces(g, 0, 40, 1);
        // Da la vuelta cada 360/13 = 27,7 dias: un solo cruce por cero.
        expect(r).toHaveLength(1);
        expect(r[0]).toBeCloseTo(360 / 13, 2);
        // Sin el descarte aparecerian los dos.
        expect(cruces(g, 0, 40, 1, { salto: Infinity })).toHaveLength(2);
    });

    it('con un paso grande se pierde lo que entra y sale entre dos muestras', () => {
        // Esta es la razon por la que el calendario muestrea cada 6 horas y
        // no cada dia: la Luna cruza un blanco y vuelve del otro lado antes
        // de la muestra siguiente. g cruza cero en 0,5 y en 1, y en los dos
        // extremos del periodo vale lo mismo.
        const g = (x) => Math.sin(2 * Math.PI * x);
        expect(cruces(g, 0.1, 1.1, 1, { salto: Infinity })).toHaveLength(0);
        expect(cruces(g, 0.1, 1.1, 0.25, { salto: Infinity })).toHaveLength(2);
    });

    it('la precision por defecto es el minuto y se puede bajar al segundo', () => {
        const f = (x) => x - 3.123456;
        const [grueso] = cruces(f, 0, 10, 1);
        const [fino] = cruces(f, 0, 10, 1, { precision: UN_SEGUNDO });
        expect(Math.abs(grueso - 3.123456)).toBeLessThanOrEqual(PRECISION);
        expect(Math.abs(fino - 3.123456)).toBeLessThanOrEqual(UN_SEGUNDO);
        expect(Math.abs(fino - 3.123456)).toBeLessThan(Math.abs(grueso - 3.123456));
    });
});

describe('crucesDe', () => {
    it('reusa muestras ya tomadas y da lo mismo que cruces', () => {
        const f = (x) => Math.sin(Math.PI * x);
        const { jds, valores } = muestras(f, 0.5, 5.5, 0.25);
        expect(crucesDe(f, jds, valores, { salto: Infinity }))
            .toEqual(cruces(f, 0.5, 5.5, 0.25, { salto: Infinity }));
    });
});
