import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('fetch', () => Promise.reject(new Error('sin red en tests')));
const { parsearCoordenada } = await import('../ui/form.js');

const lat = (t) => parsearCoordenada(t, 'N', 'S');
const lon = (t) => parsearCoordenada(t, 'E', 'WO');

describe('parsearCoordenada', () => {
    it('decimal con punto o coma', () => {
        expect(lat('-34.65')).toBeCloseTo(-34.65);
        expect(lat('-34,65')).toBeCloseTo(-34.65);
    });
    it('grados y minutos con hemisferio', () => {
        expect(lat("34°39'S")).toBeCloseTo(-34.65);
        expect(lon('58 37 W')).toBeCloseTo(-58.6167, 3);
        expect(lon("58°37'O")).toBeCloseTo(-58.6167, 3);
        expect(lat('64 09 N')).toBeCloseTo(64.15);
    });
    it('rechaza basura', () => {
        expect(lat('hola')).toBeNaN();
    });
});
