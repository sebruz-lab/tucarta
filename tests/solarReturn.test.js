import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta, diaJuliano } from '../engine/chart.js';
import { calcularRevolucion, momentoRevolucion } from '../engine/solarReturn.js';
import { distancia } from '../engine/aspects.js';

let swe, natal;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
});

describe('revolución solar', () => {
    it('el Sol de la revolución está en el grado exacto del Sol natal', () => {
        for (const anio of [1990, 2026, 2027, 2050]) {
            const r = calcularRevolucion(swe, { natal, anio, lat: -34.65, lon: -58.62 });
            const sol = r.carta.puntos.find((p) => p.id === 'sol').lon;
            expect(distancia(sol, natal.puntos[0].lon) * 3600).toBeLessThan(0.5); // menos de medio segundo de arco
            expect(r.utc.anio).toBe(anio);
            expect(Math.abs(r.utc.mes * 31 + r.utc.dia - (3 * 31 + 1))).toBeLessThanOrEqual(3); // cerca del cumpleaños
        }
    });

    it('sin año: la del próximo cumpleaños', () => {
        const ahora = diaJuliano(swe, { anio: 2026, mes: 11, dia: 1, hora: 12, minuto: 0 });
        expect(calcularRevolucion(swe, { natal, ahora, lat: -34.65, lon: -58.62 }).anio).toBe(2027);
        const antes = diaJuliano(swe, { anio: 2026, mes: 2, dia: 1, hora: 12, minuto: 0 });
        expect(calcularRevolucion(swe, { natal, ahora: antes, lat: -34.65, lon: -58.62 }).anio).toBe(2026);
        expect(momentoRevolucion(swe, natal, 2027)).toBeGreaterThan(ahora);
    });

    it('las casas dependen del lugar del cumpleaños', () => {
        const aca = calcularRevolucion(swe, { natal, anio: 2027, lat: -34.65, lon: -58.62 });
        const madrid = calcularRevolucion(swe, { natal, anio: 2027, lat: 40.42, lon: -3.70 });
        expect(aca.jd).toBe(madrid.jd);
        expect(distancia(aca.carta.angulos[0].lon, madrid.carta.angulos[0].lon)).toBeGreaterThan(10);
    });
});
