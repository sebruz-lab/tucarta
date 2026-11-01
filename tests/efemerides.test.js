import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta, diaJuliano, flagsDe } from '../engine/chart.js';
import { efemeridesGraficas, TRANSITAN_EFEMERIDES } from '../engine/efemerides.js';
import { PUNTOS, ASPECTOS } from '../engine/config.js';

let swe, natal, desde, hasta;
const angulo = (id) => ASPECTOS.find((a) => a.id === id).angulo;
const lonDe = (id, jd) => {
    const p = PUNTOS.find((x) => x.id === id);
    return swe.calc(jd, p.swe, flagsDe(p.swe)).lon;
};
const separacion = (a, b) => {
    const d = Math.abs(((a - b) % 360 + 360) % 360);
    return d > 180 ? 360 - d : d;
};

beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
    desde = diaJuliano(swe, { anio: 2026, mes: 1, dia: 1, hora: 0, minuto: 0 });
    hasta = diaJuliano(swe, { anio: 2028, mes: 1, dia: 1, hora: 0, minuto: 0 });
}, 60000);

describe('efemérides gráficas', () => {
    it('una línea por planeta, un valor por día', () => {
        const e = efemeridesGraficas(swe, { natal, desde, hasta });
        expect(e.lineas.map((l) => l.id)).toEqual(TRANSITAN_EFEMERIDES);
        expect(e.lineas[0].lons).toHaveLength(e.dias + 1);
        expect(e.natales.map((n) => n.id)).toContain('asc');
    });

    it('cada cruce es un aspecto exacto (módulo 30)', () => {
        const e = efemeridesGraficas(swe, { natal, desde, hasta });
        expect(e.cruces.length).toBeGreaterThan(20);
        const lonNatal = Object.fromEntries(e.natales.map((n) => [n.id, n.lon]));
        for (const c of e.cruces) {
            expect(c.jd).toBeGreaterThanOrEqual(desde - 1);
            expect(c.jd).toBeLessThanOrEqual(hasta + 1);
            expect(Math.abs(separacion(lonDe(c.a, c.jd), lonNatal[c.b]) - angulo(c.aspecto))).toBeLessThan(0.01);
        }
        // La Luna Negra recorre ~80° en dos años: cruza el grado del Sol natal.
        expect(e.cruces.some((c) => c.a === 'lilith' && c.b === 'sol')).toBe(true);
        // Los cruces quedan ordenados por fecha.
        expect(e.cruces.every((c, i) => i === 0 || e.cruces[i - 1].jd <= c.jd)).toBe(true);
    });

    it('en módulo 45 solo hay aspectos múltiplos de 45°; en 90, conjunción, cuadratura y oposición', () => {
        const e45 = efemeridesGraficas(swe, { natal, desde, hasta, modulo: 45 });
        expect(new Set(e45.cruces.map((c) => angulo(c.aspecto) % 45))).toEqual(new Set([0]));
        const e90 = efemeridesGraficas(swe, { natal, desde, hasta, modulo: 90 });
        expect(e90.cruces.every((c) => ['conjuncion', 'cuadratura', 'oposicion'].includes(c.aspecto))).toBe(true);
    });

    it('se eligen los planetas y los puntos natales', () => {
        const e = efemeridesGraficas(swe, { natal, desde, hasta, planetas: ['saturno', 'quiron'], natales: ['sol', 'mc'] });
        expect(e.lineas.map((l) => l.id)).toEqual(['saturno', 'quiron']);
        expect(e.natales.map((n) => n.id)).toEqual(['sol', 'mc']);
        expect(e.cruces.every((c) => ['sol', 'mc'].includes(c.b))).toBe(true);
    });
});
