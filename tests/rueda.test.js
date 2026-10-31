import { describe, it, expect } from 'vitest';
import { ubicarEnCasas } from '../ui/wheel.js';
import { casaDe } from '../engine/chart.js';

const cusps = [62, 93, 128, 163, 195, 220, 242, 273, 308, 343, 15, 40];
const conCasa = (lons) => lons.map((lon) => ({ lon, casa: casaDe(lon, cusps) }));

describe('ubicarEnCasas', () => {
    it('ningún glifo sale de su casa', () => {
        const puntos = conCasa([341.3, 335.2, 339, 329.4, 314.1, 342.9, 344, 250, 252, 255]);
        ubicarEnCasas(puntos, cusps).forEach((u, i) => {
            expect(casaDe(u.lon, cusps)).toBe(puntos[i].casa);
        });
    });

    it('mantiene el orden y la separación dentro de la casa', () => {
        const puntos = conCasa([310, 311, 312]);
        const u = ubicarEnCasas(puntos, cusps).map((x) => x.lon);
        expect(u[1] - u[0]).toBeGreaterThanOrEqual(9.99);
        expect(u[2] - u[1]).toBeGreaterThanOrEqual(9.99);
    });

    it('si no entran ni apretados, desbordan lo mínimo y mantienen 6° entre sí', () => {
        // Casa 11 (15° a 40°): seis planetas entre 20° y 24°.
        const puntos = conCasa([20, 21, 22, 23, 24, 24.5]);
        const u = ubicarEnCasas(puntos, cusps).map((x) => x.lon);
        for (let k = 1; k < u.length; k++) expect(u[k] - u[k - 1]).toBeGreaterThanOrEqual(5.99);
        expect(u[0]).toBeGreaterThan(15 - 5);
    });

    it('un planeta solo no se mueve si no está pegado a la cúspide', () => {
        const u = ubicarEnCasas(conCasa([290]), cusps);
        expect(u[0].lon).toBeCloseTo(290);
    });
});
