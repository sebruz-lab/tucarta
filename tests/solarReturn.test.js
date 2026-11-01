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

// Revolucion 2026 de la carta de prueba, calculada en Solar Fire para
// Villa Dolores (31°56'S 065°12'O): 1/3/2026 17:46:49 BZT2+3:00.
describe('revolución solar contra Solar Fire', () => {
    const sf = {
        utc: { dia: 1, hora: 20, minuto: 46, segundo: 49 },
        asc: "00°Le52'24''", mc: "18°Ta37'41''",
        puntos: {
            luna: "21°Le02'59''", sol: "11°Pi16'30''", mercurio: "21°Pi32'55''", venus: "24°Pi17'37''",
            marte: "29°Aq25'34''", jupiter: "15°Cn13'41''", saturno: "01°Ar49'38''", urano: "27°Ta45'04''",
            neptuno: "01°Ar04'30''", pluton: "04°Aq33'24''", quiron: "24°Ar05'05''", nodo: "08°Pi58'56''"
        }
    };
    const SIG = { Ar: 0, Ta: 1, Ge: 2, Cn: 3, Le: 4, Vi: 5, Li: 6, Sc: 7, Sg: 8, Cp: 9, Aq: 10, Pi: 11 };
    const lonSF = (t) => {
        const m = t.match(/(\d+)°(\w\w)(\d+)'(\d+)''/);
        return SIG[m[2]] * 30 + Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
    };

    // Solar Fire usa para 2026 un Delta T de 87 s (estimacion vieja); el
    // medido, el de Swiss Ephemeris, ronda los 69 s. Por eso su instante
    // queda 18 s antes que el nuestro (y su Ascendente unos 5' atras). En
    // el mismo instante, casas y planetas coinciden.
    it('el instante difiere solo por el Delta T de Solar Fire (~18 s)', () => {
        const r = calcularRevolucion(swe, { natal, anio: 2026, lat: -(31 + 56 / 60), lon: -(65 + 12 / 60) });
        const seg = (u) => u.hora * 3600 + u.minuto * 60 + u.segundo;
        expect(r.utc.mes).toBe(3);
        expect(r.utc.dia).toBe(sf.utc.dia);
        expect(seg(r.utc) - seg(sf.utc)).toBeGreaterThan(15);
        expect(seg(r.utc) - seg(sf.utc)).toBeLessThan(21);
        for (const [id, t] of Object.entries(sf.puntos)) {
            const p = r.carta.puntos.find((x) => x.id === id);
            expect(distancia(p.lon, lonSF(t)) * 60, id).toBeLessThan(1);
        }
    });

    it('en el instante de Solar Fire, mismos ángulos y planetas (±1 minuto de arco)', () => {
        const c = calcularCarta(swe, { utc: { anio: 2026, mes: 3, ...sf.utc }, lat: -(31 + 56 / 60), lon: -(65 + 12 / 60) });
        for (const [id, t] of Object.entries(sf.puntos)) {
            expect(distancia(c.puntos.find((x) => x.id === id).lon, lonSF(t)) * 60, id).toBeLessThan(1);
        }
        expect(distancia(c.angulos[0].lon, lonSF(sf.asc)) * 60, 'asc').toBeLessThan(1);
        expect(distancia(c.angulos[1].lon, lonSF(sf.mc)) * 60, 'mc').toBeLessThan(1);
    });
});
