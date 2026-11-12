import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularTransitos } from '../engine/transits.js';
import { calcularAspectos } from '../engine/aspects.js';
import { AJUSTES_POR_DEFECTO, ORBES_TRANSITO, ASPECTOS } from '../engine/config.js';

let swe;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
});

const nacimiento = { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 };

describe('tránsitos', () => {
    it('en el mismo instante del nacimiento cada planeta está conjunto a sí mismo', () => {
        const natal = calcularCarta(swe, nacimiento);
        const t = calcularTransitos(swe, { utc: nacimiento.utc, natal });
        expect(t.puntos.map((p) => p.id)).toEqual(natal.puntos.map((p) => p.id));
        for (const p of t.puntos) {
            const a = t.aspectos.find((x) => x.a === p.id && x.b === p.id);
            expect(a.aspecto).toBe('conjuncion');
            expect(a.orbe).toBeLessThan(1e-6);
            expect(p.casa).toBe(natal.puntos.find((n) => n.id === p.id).casa);
        }
    });

    it('los ángulos natales reciben tránsitos si están entre los puntos aspectados', () => {
        // La natal no los aspecta entre sí, pero igual pueden recibir
        // tránsitos: eso lo decide "Puntos aspectados".
        const ajustes = { ...AJUSTES_POR_DEFECTO,
            puntosAspectados: { ...AJUSTES_POR_DEFECTO.puntosAspectados, asc: true } };
        const natal = calcularCarta(swe, nacimiento);
        // Un instante en que el Sol en tránsito pisa el Ascendente natal.
        const asc = natal.angulos.find((x) => x.id === 'asc').lon;
        const sol = natal.puntos.find((x) => x.id === 'sol').lon;
        const dias = (((asc - sol) % 360) + 360) % 360 / 0.9856;
        const fecha = new Date(Date.UTC(1984, 2, 1, 16, 15) + dias * 864e5);
        const utc = { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate(),
            hora: fecha.getUTCHours(), minuto: fecha.getUTCMinutes() };
        const t = calcularTransitos(swe, { utc, natal, ajustes });
        expect(t.aspectos.find((a) => a.a === 'sol' && a.b === 'asc')?.aspecto).toBe('conjuncion');
        expect(t.aspectos.every((a) => a.orbe <= a.orbeMax)).toBe(true);
    });
});

describe('orbes por aspecto', () => {
    const asp = (dist, aspectos = AJUSTES_POR_DEFECTO.aspectos) => calcularAspectos(
        [{ id: 'saturno', lon: dist, vel: 0.05 }], [{ id: 'sol', lon: 0, vel: 0 }],
        { orbesPorAspecto: ORBES_TRANSITO, aspectos });

    it('conjunción y oposición 3°, trígono, cuadratura y sextil 2°, menores 1°', () => {
        expect(asp(2.9)[0]).toMatchObject({ aspecto: 'conjuncion', orbeMax: 3 });
        expect(asp(3.1)).toHaveLength(0);
        expect(asp(182.9)[0]).toMatchObject({ aspecto: 'oposicion' });
        expect(asp(121.9)[0]).toMatchObject({ aspecto: 'trigono', orbeMax: 2 });
        expect(asp(92.1)).toHaveLength(0);
        expect(asp(61.5)[0]).toMatchObject({ aspecto: 'sextil' });
        expect(asp(30.9)[0]).toMatchObject({ aspecto: 'semisextil', orbeMax: 1 });
        expect(asp(31.1)).toHaveLength(0);
    });

    it('aplicativo según el movimiento del planeta en tránsito', () => {
        expect(asp(-2)[0].aplicativo).toBe(true);  // se acerca al Sol
        expect(asp(2)[0].aplicativo).toBe(false);  // ya pasó
    });
});

describe('qué entra en los tránsitos', () => {
    const AHORA = { anio: 2026, mes: 11, dia: 12, hora: 15, minuto: 0 };
    const con = (extra) => {
        const ajustes = { ...AJUSTES_POR_DEFECTO, ...extra };
        const natal = calcularCarta(swe, { ...nacimiento, ajustes });
        return calcularTransitos(swe, { utc: AHORA, natal, ajustes });
    };
    const aLosAngulos = (t) => t.aspectos.filter((a) => a.b === 'asc' || a.b === 'mc');

    it('los ángulos reciben tránsitos solo si están en "Puntos aspectados"', () => {
        // Antes los recibían siempre, aunque no se aspectaran en la carta.
        expect(aLosAngulos(con({}))).toHaveLength(0);
        const prendidos = { ...AJUSTES_POR_DEFECTO.puntosAspectados, asc: true, mc: true };
        expect(aLosAngulos(con({ puntosAspectados: prendidos })).length).toBeGreaterThan(0);
    });

    it('los aspectos de los tránsitos se eligen aparte de los de la carta', () => {
        const soloConjuncion = Object.fromEntries(ASPECTOS.map((x) => [x.id, x.id === 'conjuncion']));
        const t = con({ aspectosTransito: soloConjuncion });
        expect(t.aspectos.length).toBeGreaterThan(0);
        expect([...new Set(t.aspectos.map((a) => a.aspecto))]).toEqual(['conjuncion']);
        // Y la carta de adentro sigue con los suyos.
        const natal = calcularCarta(swe, { ...nacimiento, ajustes: { ...AJUSTES_POR_DEFECTO, aspectosTransito: soloConjuncion } });
        expect([...new Set(natal.aspectos.map((a) => a.aspecto))].length).toBeGreaterThan(1);
    });

    it('sin la lista nueva valen los aspectos de la carta', () => {
        // Unos ajustes guardados antes de que los tránsitos tuvieran la suya.
        const viejos = { ...AJUSTES_POR_DEFECTO };
        delete viejos.aspectosTransito;
        const natal = calcularCarta(swe, { ...nacimiento, ajustes: viejos });
        const t = calcularTransitos(swe, { utc: AHORA, natal, ajustes: viejos });
        expect(t.aspectos.length).toBeGreaterThan(0);
    });
});
