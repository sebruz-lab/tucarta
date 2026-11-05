import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta, flagsDe } from '../engine/chart.js';
import { calcularDraconica } from '../engine/draconica.js';
import { calcularTransitos } from '../engine/transits.js';

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

// Transitos draconicos: el cielo del momento medido desde el Nodo de ESE
// momento (no el de la persona). Contrastado con una Transits Chart de
// Solar Fire con el zodiaco Draconic y True Node.
describe('tránsitos dracónicos', () => {
    // 5 Nov 2026, 13:41:45 en Moron (BZT2 +3:00) = 16:41:45 UT.
    const utc = { anio: 2026, mes: 11, dia: 5, hora: 16, minuto: 41, segundo: 45 };
    const SOLAR_FIRE = {
        sol: ['sagitario', 16, 26], luna: ['escorpio', 4, 17], mercurio: ['sagitario', 13, 55],
        venus: ['escorpio', 27, 26], marte: ['virgo', 24, 6], jupiter: ['virgo', 28, 1],
        saturno: ['tauro', 12, 10], urano: ['cancer', 7, 39], neptuno: ['tauro', 5, 9],
        pluton: ['piscis', 6, 19], nodo: ['aries', 0, 0], lilith: ['acuario', 8, 57],
        quiron: ['geminis', 1, 1]
    };

    it('el Nodo del día queda en 0° Aries y todo coincide con Solar Fire', () => {
        const t = calcularTransitos(swe, { utc, natal, draconica: 'real' });
        for (const p of t.puntos) {
            const [signo, grado, minuto] = SOLAR_FIRE[p.id];
            expect({ id: p.id, signo: p.signo, grado: p.grado, minuto: p.minuto })
                .toEqual({ id: p.id, signo, grado, minuto });
        }
        expect(t.meta.draconica).toEqual({ nodo: 'real', desde: expect.any(Number) });
    });

    it('sin el pedido draconico, los transitos son los tropicales de siempre', () => {
        const d = calcularTransitos(swe, { utc, natal, draconica: 'real' });
        const tr = calcularTransitos(swe, { utc, natal });
        const lon = (t, id) => t.puntos.find((p) => p.id === id).lon;
        expect(lon(tr, 'nodo')).toBeGreaterThan(0);
        // Todos corridos lo mismo: el Nodo del momento.
        const desde = d.meta.draconica.desde;
        for (const p of tr.puntos) expect(lon(d, p.id)).toBeCloseTo(norm(p.lon - desde), 9);
    });

    it('rotar las dos ruedas por el mismo Nodo no cambiaria los aspectos: por eso se usa el del día', () => {
        const draconica = calcularDraconica(swe, { natal });
        const propios = calcularTransitos(swe, { utc, natal: draconica, draconica: 'real' });
        const tropicales = calcularTransitos(swe, { utc, natal });
        // Con cada rueda desde su propio Nodo el dibujo de aspectos cambia.
        const clave = (a) => a.map((x) => `${x.a}-${x.b}-${x.aspecto}`).sort().join('|');
        expect(clave(propios.aspectos)).not.toBe(clave(tropicales.aspectos));
    });
});
