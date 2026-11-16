import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularProgresion, ANIO_TROPICO } from '../engine/progressions.js';
import { calcularLunacionProgresada } from '../engine/lunacionProgresada.js';
import { distancia } from '../engine/aspects.js';
import { AJUSTES_POR_DEFECTO } from '../engine/config.js';

let swe, natal;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
});

const lonDe = (c, id) => [...c.puntos, ...c.angulos].find((p) => p.id === id).lon;
// Un minuto de arco, la tolerancia del resto del motor.
const UN_MINUTO = 1 / 60;
const anios = (jd) => (jd - natal.meta.jd) / ANIO_TROPICO;

describe('luna nueva progresada', () => {
    it('pre-natal: el Sol y la Luna progresados se conjuntan', () => {
        const r = calcularLunacionProgresada(swe, { natal, cual: 'prenatal' });
        expect(distancia(lonDe(r.carta, 'sol'), lonDe(r.carta, 'luna'))).toBeLessThan(UN_MINUTO);
    });

    it('pre-natal: cae antes del nacimiento y a menos de 29 años y medio', () => {
        const r = calcularLunacionProgresada(swe, { natal, cual: 'prenatal' });
        expect(r.lunacion.jdObjetivo).toBeLessThan(natal.meta.jd);
        expect(r.lunacion.antesDeNacer).toBe(true);
        expect(anios(r.lunacion.jdObjetivo)).toBeGreaterThan(-29.6);
        expect(r.edad).toBeLessThan(0);
    });

    it('actual: la última ocurrida, nunca una futura', () => {
        const utc = { anio: 2026, mes: 11, dia: 16, hora: 12, minuto: 0 };
        const r = calcularLunacionProgresada(swe, { natal, utc, cual: 'actual' });
        expect(distancia(lonDe(r.carta, 'sol'), lonDe(r.carta, 'luna'))).toBeLessThan(UN_MINUTO);
        // A los 42 anios, la unica luna nueva progresada cumplida es la que
        // abrio el ciclo a los 13 y pico: la siguiente cae despues de hoy.
        const edad = anios(r.lunacion.jdObjetivo);
        expect(edad).toBeGreaterThan(0);
        expect(edad).toBeLessThan(42.8);
        expect(edad).toBeGreaterThan(42.8 - 29.6);
        expect(r.lunacion.antesDeNacer).toBe(false);
    });

    it('recién nacida, la actual es la pre-natal', () => {
        const utc = { anio: 1984, mes: 3, dia: 2, hora: 16, minuto: 15 }; // un dia de vida
        const a = calcularLunacionProgresada(swe, { natal, utc, cual: 'actual' });
        const p = calcularLunacionProgresada(swe, { natal, cual: 'prenatal' });
        expect(a.lunacion.jd).toBeCloseTo(p.lunacion.jd, 6);
        expect(a.lunacion.antesDeNacer).toBe(true);
        expect(distancia(lonDe(a.carta, 'asc'), lonDe(p.carta, 'asc'))).toBeLessThan(1e-6);
    });

    it('la lunación cae en una casa de la carta natal', () => {
        const r = calcularLunacionProgresada(swe, { natal, cual: 'prenatal' });
        expect(r.lunacion.casa).toBeGreaterThanOrEqual(1);
        expect(r.lunacion.casa).toBeLessThanOrEqual(12);
        // Es el grado del Sol y la Luna progresados del momento.
        expect(distancia(r.lunacion.lon, lonDe(r.carta, 'sol'))).toBeLessThan(UN_MINUTO);
    });

    // Con edad negativa el arco solar es negativo. Antes se normalizaba a
    // 0..360 y los angulos progresados se iban 355° para el otro lado.
    it('los tres métodos retroceden los ángulos, no los adelantan', () => {
        const jdObjetivo = natal.meta.jd - 12 * ANIO_TROPICO;
        for (const metodo of ['arco-long', 'arco-ra', 'naibod']) {
            const p = calcularProgresion(swe, { natal, jdObjetivo, ajustes: { ...AJUSTES_POR_DEFECTO, metodoProgresion: metodo } });
            const d = ((lonDe(p.carta, 'mc') - lonDe(natal, 'mc') + 540) % 360) - 180;
            expect(d).toBeLessThan(0);
            expect(d).toBeGreaterThan(-16);
        }
    });
});
