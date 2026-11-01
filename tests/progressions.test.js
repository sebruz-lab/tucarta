import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularProgresion, ANIO_TROPICO } from '../engine/progressions.js';
import { AJUSTES_POR_DEFECTO } from '../engine/config.js';
import { distancia } from '../engine/aspects.js';

let swe, natal;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
});

const lonDe = (c, id) => [...c.puntos, ...c.angulos].find((p) => p.id === id).lon;
const ra = (lon, eps = 23.44) => {
    const r = Math.PI / 180;
    return ((Math.atan2(Math.sin(lon * r) * Math.cos(eps * r), Math.cos(lon * r)) / r) % 360 + 360) % 360;
};

describe('progresiones secundarias', () => {
    it('a edad cero es la carta natal', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd });
        for (const id of ['sol', 'luna', 'asc', 'mc']) expect(distancia(lonDe(p.carta, id), lonDe(natal, id))).toBeLessThan(1e-6);
    });

    it('un día por año: a los 42 años el Sol avanzó unos 42°', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 42 * ANIO_TROPICO });
        expect(p.edad).toBeCloseTo(42, 9);
        expect(p.jd - natal.meta.jd).toBeCloseTo(42, 9);
        expect(distancia(lonDe(p.carta, 'sol'), lonDe(natal, 'sol'))).toBeGreaterThan(40);
        expect(distancia(lonDe(p.carta, 'sol'), lonDe(natal, 'sol'))).toBeLessThan(44);
    });

    it('arco solar en longitud: el Medio Cielo avanza exactamente el arco solar', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 30 * ANIO_TROPICO });
        const avance = ((lonDe(p.carta, 'mc') - lonDe(natal, 'mc')) % 360 + 360) % 360;
        expect(Math.abs(avance - p.arco) * 3600).toBeLessThan(1);
    });

    it('Naibod: la ascensión recta del Medio Cielo avanza 0,98565° por año', () => {
        const ajustes = { ...AJUSTES_POR_DEFECTO, metodoProgresion: 'naibod' };
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 30 * ANIO_TROPICO, ajustes });
        const avance = ((ra(lonDe(p.carta, 'mc')) - ra(lonDe(natal, 'mc'))) % 360 + 360) % 360;
        expect(Math.abs(avance - 30 * 0.98564733)).toBeLessThan(0.02);
    });
});
