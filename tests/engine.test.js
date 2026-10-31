// Compara el motor contra cartas calculadas en Solar Fire. Usa el UTC y las
// coordenadas que uso Solar Fire (no las de nuestro buscador), asi cualquier
// diferencia es del motor y no del huso ni del lugar.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { AJUSTES_POR_DEFECTO } from '../engine/config.js';
import { parsearPosicion, diferenciaMinutos } from './solarfire.js';

const TOLERANCIA_MIN = 1;
const dir = fileURLToPath(new URL('./fixtures/solarfire/', import.meta.url));
const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => ({ archivo: f, ...JSON.parse(readFileSync(dir + f, 'utf8')) }));

let swe;
beforeAll(async () => {
    swe = await cargarSwe(() =>
        readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
});

describe.skipIf(fixtures.length === 0)('motor vs Solar Fire', () => {
    for (const f of fixtures) {
        for (const [sistema, esperado] of Object.entries(f.cuspides || {})) {
            it(`${f.archivo}: cúspides ${sistema}`, () => {
                const c = calcularCarta(swe, {
                    utc: f.utc, lat: f.lugar.lat, lon: f.lugar.lon,
                    ajustes: { ...AJUSTES_POR_DEFECTO, casas: sistema }
                });
                esperado.forEach((pos, i) => {
                    expect(diferenciaMinutos(c.cusps[i].lon, parsearPosicion(pos)),
                        `casa ${i + 1}`).toBeLessThanOrEqual(TOLERANCIA_MIN);
                });
            });
        }

        it(`${f.archivo}: posiciones`, () => {
            const c = calcularCarta(swe, { utc: f.utc, lat: f.lugar.lat, lon: f.lugar.lon });
            for (const [id, pos] of Object.entries(f.posiciones)) {
                const p = c.puntos.find((x) => x.id === id);
                expect(diferenciaMinutos(p.lon, parsearPosicion(pos)), id)
                    .toBeLessThanOrEqual(TOLERANCIA_MIN);
                if (f.retrogrados) expect(p.retro, `${id} retro`).toBe(f.retrogrados.includes(id));
            }
        });
    }
});
