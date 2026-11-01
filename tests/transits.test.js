import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularTransitos } from '../engine/transits.js';
import { calcularAspectos } from '../engine/aspects.js';
import { AJUSTES_POR_DEFECTO, ORBES_TRANSITO } from '../engine/config.js';

let swe;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
});

const nacimiento = { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 };

describe('tránsitos', () => {
    it('en el mismo instante del nacimiento cada planeta está conjunto a sí mismo', () => {
        const natal = calcularCarta(swe, nacimiento);
        const t = calcularTransitos(swe, { utc: nacimiento.utc, natal });
        expect(t.puntos.map((p) => p.id)).toEqual(['sol', 'luna', 'mercurio', 'venus', 'marte',
            'jupiter', 'saturno', 'urano', 'neptuno', 'pluton']);
        for (const p of t.puntos) {
            const a = t.aspectos.find((x) => x.a === p.id && x.b === p.id);
            expect(a.aspecto).toBe('conjuncion');
            expect(a.orbe).toBeLessThan(1e-6);
            expect(p.casa).toBe(natal.puntos.find((n) => n.id === p.id).casa);
        }
    });

    it('los ángulos natales reciben aspectos aunque la natal no los use', () => {
        const natal = calcularCarta(swe, nacimiento); // aspectosAngulos: false
        // Un instante en que el Sol en tránsito pisa el Ascendente natal.
        const asc = natal.angulos.find((x) => x.id === 'asc').lon;
        const sol = natal.puntos.find((x) => x.id === 'sol').lon;
        const dias = (((asc - sol) % 360) + 360) % 360 / 0.9856;
        const fecha = new Date(Date.UTC(1984, 2, 1, 16, 15) + dias * 864e5);
        const utc = { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate(),
            hora: fecha.getUTCHours(), minuto: fecha.getUTCMinutes() };
        const t = calcularTransitos(swe, { utc, natal });
        expect(t.aspectos.find((a) => a.a === 'sol' && a.b === 'asc')?.aspecto).toBe('conjuncion');
        expect(t.aspectos.every((a) => a.orbe <= a.orbeMax)).toBe(true);
    });
});

describe('orbes por aspecto', () => {
    const asp = (dist, menores = AJUSTES_POR_DEFECTO.menores) => calcularAspectos(
        [{ id: 'saturno', lon: dist, vel: 0.05 }], [{ id: 'sol', lon: 0, vel: 0 }],
        { orbesPorAspecto: ORBES_TRANSITO, menores });

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
