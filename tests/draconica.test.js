import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta, flagsDe } from '../engine/chart.js';
import { calcularDraconica } from '../engine/draconica.js';

let swe, natal;
const norm = (x) => ((x % 360) + 360) % 360;

beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
}, 60000);

describe('carta dracónica', () => {
    it('con el Nodo real, el Nodo queda en 0° Aries', () => {
        const d = calcularDraconica(swe, { natal });
        const nodo = d.puntos.find((p) => p.id === 'nodo');
        expect(nodo.lon).toBeCloseTo(0, 9);
        expect(nodo).toMatchObject({ signo: 'aries', grado: 0, minuto: 0 });
    });

    it('las distancias entre puntos, las casas y los aspectos son los de la natal', () => {
        const d = calcularDraconica(swe, { natal });
        const sol = (c) => c.puntos.find((p) => p.id === 'sol');
        const luna = (c) => c.puntos.find((p) => p.id === 'luna');
        expect(norm(luna(d).lon - sol(d).lon)).toBeCloseTo(norm(luna(natal).lon - sol(natal).lon), 9);
        expect(d.puntos.map((p) => p.casa)).toEqual(natal.puntos.map((p) => p.casa));
        expect(d.aspectos).toEqual(natal.aspectos);
        // Angulos y cuspides tambien se corren.
        const desde = natal.puntos.find((p) => p.id === 'nodo').lon;
        expect(d.angulos[0].lon).toBeCloseTo(norm(natal.angulos[0].lon - desde), 9);
        expect(d.cusps[9].lon).toBeCloseTo(norm(natal.cusps[9].lon - desde), 9);
    });

    it('con el Nodo medio se mide desde el Nodo medio', () => {
        const d = calcularDraconica(swe, { natal, nodo: 'medio' });
        const medio = swe.calc(natal.meta.jd, 10, flagsDe(10)).lon;
        const sol = natal.puntos.find((p) => p.id === 'sol');
        expect(d.puntos.find((p) => p.id === 'sol').lon).toBeCloseTo(norm(sol.lon - medio), 9);
        expect(d.meta.draconica.nodo).toBe('medio');
        // Real y medio difieren a lo sumo un par de grados.
        const real = natal.puntos.find((p) => p.id === 'nodo').lon;
        expect(Math.abs(((medio - real + 540) % 360) - 180)).toBeLessThan(2.5);
    });
});
