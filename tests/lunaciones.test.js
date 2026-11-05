import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta, casaDe, diaJuliano } from '../engine/chart.js';
import { lunacionesEntre, lunacionMasCercana, calcularLunacion } from '../engine/lunaciones.js';

let swe, natal, desde, hasta, lista;
const SOL = 0;
const LUNA = 1;
const FLAGS = 4 | 256; // Moshier con velocidades

beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
    desde = diaJuliano(swe, { anio: 2026, mes: 1, dia: 1, hora: 0, minuto: 0 });
    hasta = desde + 365;
    lista = lunacionesEntre(swe, { desde, hasta });
}, 60000);

// Elongacion: la distancia de la Luna al Sol, de 0 a 360.
const elongacion = (jd) => ((swe.calc(jd, LUNA, FLAGS).lon - swe.calc(jd, SOL, FLAGS).lon) % 360 + 360) % 360;
// Cuanto le falta a la elongacion para ser exactamente 0° o 180°.
const errorMin = (jd) => {
    const d = elongacion(jd);
    return Math.min(d, 360 - d, Math.abs(d - 180)) * 60;
};

describe('lunaciones', () => {
    it('encuentra las lunaciones del año y todas caen en el período', () => {
        // Un año tiene 12 o 13 lunas nuevas y otras tantas llenas.
        expect(lista.length).toBeGreaterThanOrEqual(24);
        expect(lista.length).toBeLessThanOrEqual(26);
        for (const l of lista) {
            expect(l.jd).toBeGreaterThanOrEqual(desde);
            expect(l.jd).toBeLessThanOrEqual(hasta);
        }
    });

    it('el instante es exacto al minuto de arco', () => {
        for (const l of lista) expect(errorMin(l.jd)).toBeLessThan(1 / 60);
    });

    it('el tipo es el que dice la elongación', () => {
        for (const l of lista) {
            const d = elongacion(l.jd);
            expect(l.tipo).toBe(d < 90 || d > 270 ? 'nueva' : 'llena');
        }
    });

    it('alternan nueva y llena, separadas por medio mes sinódico', () => {
        for (let i = 1; i < lista.length; i++) {
            expect(lista[i].tipo).not.toBe(lista[i - 1].tipo);
            const paso = lista[i].jd - lista[i - 1].jd;
            expect(paso).toBeGreaterThan(13.8);
            expect(paso).toBeLessThan(15.7);
        }
    });

    it('coincide con una búsqueda por fuerza bruta cada diez minutos', () => {
        // Referencia independiente: el minimo de la distancia a 0° o 180°
        // en un mes, barrido de a diez minutos, cae en la misma lunacion.
        const paso = 10 / 1440;
        const inicio = lista[0].jd - 20;
        let mejor = inicio;
        for (let jd = inicio; jd <= inicio + 40; jd += paso) {
            if (errorMin(jd) < errorMin(mejor)) mejor = jd;
        }
        const cerca = lista.reduce((m, l) => (Math.abs(l.jd - mejor) < Math.abs(m.jd - mejor) ? l : m), lista[0]);
        expect(Math.abs(cerca.jd - mejor)).toBeLessThan(paso);
    });

    it('la más cercana es la más cercana, y puede ser una que ya pasó', () => {
        const unaPasada = [];
        for (let k = 0; k < 40; k++) {
            const jd = desde + 30 + k * 9;
            const cerca = lunacionMasCercana(swe, { jd });
            expect(cerca).not.toBeNull();
            // Ninguna otra del año está más cerca.
            for (const l of lista) {
                expect(Math.abs(l.jd - jd)).toBeGreaterThanOrEqual(Math.abs(cerca.jd - jd) - 1e-9);
            }
            // Nunca más lejos que medio mes sinódico.
            expect(Math.abs(cerca.jd - jd)).toBeLessThan(7.9);
            if (cerca.jd < jd) unaPasada.push(cerca);
        }
        expect(unaPasada.length).toBeGreaterThan(0);
    });

    it('la vista arma la rueda doble y dice en qué casa cae', () => {
        const r = calcularLunacion(swe, { utc: { anio: 2026, mes: 11, dia: 4, hora: 12, minuto: 0 }, natal });
        const cusps = natal.cusps.map((c) => c.lon);
        expect(r.lunacion.casa).toBe(casaDe(r.lunacion.lon, cusps));
        expect(r.lunacion.casa).toBeGreaterThanOrEqual(1);
        expect(r.lunacion.casa).toBeLessThanOrEqual(12);
        // El cielo es el del instante de la lunacion: la Luna y el Sol en
        // tránsito están en el mismo grado, y en la misma casa.
        // Afuera van solo el Sol y la Luna, nada mas.
        expect(r.puntos.map((p) => p.id).sort()).toEqual(['luna', 'sol']);
        for (const a of r.aspectos) expect(['sol', 'luna']).toContain(a.a);
        const luna = r.puntos.find((p) => p.id === 'luna');
        const sol = r.puntos.find((p) => p.id === 'sol');
        expect(luna.casa).toBe(r.lunacion.casa);
        expect(errorMin(r.lunacion.jd)).toBeLessThan(1 / 60);
        const entre = Math.abs(((luna.lon - sol.lon) % 360 + 360) % 360);
        expect(Math.min(entre, 360 - entre, Math.abs(entre - 180))).toBeLessThan(1 / 60);
        expect(r.aspectos.length).toBeGreaterThan(0);
    });
});
