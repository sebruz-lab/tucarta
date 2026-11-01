import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta, diaJuliano } from '../engine/chart.js';
import { calcularTransitos } from '../engine/transits.js';
import { calendarioTransitos, PUNTOS_CALENDARIO } from '../engine/calendar.js';
import { PUNTOS } from '../engine/config.js';
import { distancia } from '../engine/aspects.js';

let swe, natal, cal, desde, hasta;
const ASP = { conjuncion: 0, semisextil: 30, sextil: 60, cuadratura: 90, trigono: 120, quincuncio: 150, oposicion: 180 };

beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
    desde = diaJuliano(swe, { anio: 2026, mes: 11, dia: 1, hora: 0, minuto: 0 });
    hasta = desde + 365;
    cal = calendarioTransitos(swe, { natal, desde, hasta });
}, 60000);

const lonDe = (id, jd) => swe.calc(jd, PUNTOS.find((p) => p.id === id).swe, id === 'quiron' ? 2 | 256 : 4 | 256).lon;
const lonNatal = (id) => [...natal.puntos, ...natal.angulos].find((p) => p.id === id).lon;

describe('calendario de tránsitos', () => {
    it('encuentra tránsitos y todos tocan el período', () => {
        expect(cal.length).toBeGreaterThan(5);
        for (const t of cal) {
            expect(PUNTOS_CALENDARIO).toContain(t.a);
            expect((t.sale ?? Infinity) >= desde && (t.entra ?? -Infinity) <= hasta).toBe(true);
        }
    });

    it('las fechas exactas son exactas al minuto de arco y las de entrada y salida caen en el orbe', () => {
        for (const t of cal) {
            for (const jd of t.exactos) {
                expect(Math.abs(distancia(lonDe(t.a, jd), lonNatal(t.b)) - ASP[t.aspecto])).toBeLessThan(1 / 60);
            }
            const orbe = t.menor ? 1 : { conjuncion: 3, oposicion: 3 }[t.aspecto] ?? 2;
            for (const jd of [t.entra, t.sale].filter((x) => x != null)) {
                expect(Math.abs(Math.abs(distancia(lonDe(t.a, jd), lonNatal(t.b)) - ASP[t.aspecto]) - orbe)).toBeLessThan(0.01);
            }
        }
    });

    it('coincide con la rueda doble: cada tránsito lento de un día está en el calendario', () => {
        for (const offset of [10, 100, 200, 300]) {
            const jd = desde + offset;
            const fecha = new Date((jd - 2440587.5) * 864e5);
            const utc = { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1, dia: fecha.getUTCDate(),
                hora: fecha.getUTCHours(), minuto: fecha.getUTCMinutes() };
            const t = calcularTransitos(swe, { utc, natal });
            for (const a of t.aspectos.filter((x) => PUNTOS_CALENDARIO.includes(x.a))) {
                const hay = cal.some((c) => c.a === a.a && c.b === a.b && c.aspecto === a.aspecto &&
                    (c.entra ?? -Infinity) <= jd && (c.sale ?? Infinity) >= jd);
                expect(hay, `${a.a} ${a.aspecto} ${a.b} el día ${offset}`).toBe(true);
            }
        }
    });
});
