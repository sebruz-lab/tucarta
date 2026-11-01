import { describe, it, expect } from 'vitest';
import { ubicarEnCasas, repartir } from '../ui/wheel.js';
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

describe('repartir (anillo de tránsitos)', () => {
    const sep = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

    it('no mueve lo que ya está separado', () => {
        expect(repartir([10, 100, 200], 6)).toEqual([10, 100, 200]);
    });

    it('separa un grupo apretado alrededor de su centro, también cruzando 0°', () => {
        for (const lons of [[50, 51, 52, 200], [358, 359, 1, 2, 120]]) {
            const pos = repartir(lons, 6);
            for (let i = 0; i < pos.length; i++) {
                for (let j = i + 1; j < pos.length; j++) expect(sep(pos[i], pos[j])).toBeGreaterThanOrEqual(6 - 1e-9);
            }
        }
        const p = repartir([50, 51, 52, 200], 6);
        expect((p[0] + p[1] + p[2]) / 3).toBeCloseTo(51, 6);
    });
});
