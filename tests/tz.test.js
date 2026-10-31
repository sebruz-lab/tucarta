// Hora local + zona IANA -> UTC, contra el huso que aplico Solar Fire en las
// cartas de referencia, y casos conocidos de la base IANA.
//
// Antes de 1970 una diferencia con Solar Fire no falla el test: se anota
// como tentativa en el informe del final.

import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localAUtc } from '../time/tz.js';

const H = 3600;
const dir = fileURLToPath(new URL('./fixtures/solarfire/', import.meta.url));
const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => ({ archivo: f, ...JSON.parse(readFileSync(dir + f, 'utf8')) }));

const tentativas = [];
afterAll(() => {
    if (!tentativas.length) return;
    console.log('\nHusos tentativos (antes de 1970, distintos de Solar Fire):\n' +
        tentativas.map((t) => `  ${t.archivo}: IANA ${t.iana}, Solar Fire ${t.sf}`).join('\n'));
});

const horas = (seg) => (seg >= 0 ? '+' : '-') + Math.abs(seg / H);

describe('husos vs Solar Fire', () => {
    for (const f of fixtures) {
        it(f.archivo, () => {
            const r = localAUtc(f.local, f.lugar.zona);
            expect(r.estado).toBe('ok');
            const [signo, hh, mm] = f.offsetSolarFire.match(/([+-])(\d\d):(\d\d)/).slice(1);
            const sf = (signo === '-' ? -1 : 1) * (+hh * H + +mm * 60);
            const iana = r.opciones[0].total;
            if (iana !== sf && r.tentativo) {
                tentativas.push({ archivo: f.archivo, iana: horas(iana), sf: f.offsetSolarFire });
                return;
            }
            expect(r.opciones[0].utc).toMatchObject(f.utc);
        });
    }
});

describe('base y horario de verano por separado', () => {
    const caso = (zona, fecha, hora) => localAUtc({ fecha, hora }, zona).opciones[0];

    it('Buenos Aires 1966: base -4 con verano +1', () => {
        expect(caso('America/Argentina/Buenos_Aires', '1966-11-28', '05:30')).toMatchObject({ base: -4 * H, verano: H });
    });
    it('Buenos Aires 1991: base -3 con verano +1', () => {
        expect(caso('America/Argentina/Buenos_Aires', '1991-02-01', '21:33')).toMatchObject({ base: -3 * H, verano: H });
    });
    it('Córdoba entre marzo y octubre de 1991: -4 sin verano', () => {
        expect(caso('America/Argentina/Cordoba', '1991-06-15', '12:00')).toMatchObject({ base: -4 * H, verano: 0 });
    });
    it('Mendoza 1992: verano sobre base -4', () => {
        expect(caso('America/Argentina/Mendoza', '1992-01-15', '12:00')).toMatchObject({ base: -4 * H, verano: H });
    });
    it('Mendoza en el verano 2008-09: -3 sin verano', () => {
        expect(caso('America/Argentina/Mendoza', '2009-01-15', '12:00')).toMatchObject({ base: -3 * H, verano: 0 });
    });
    it('San Luis en el verano 2008-09: verano sobre base -4', () => {
        expect(caso('America/Argentina/San_Luis', '2009-01-15', '12:00')).toMatchObject({ base: -4 * H, verano: H });
    });
    it('zona fuera de la tabla: solo offset total', () => {
        expect(caso('Asia/Tokyo', '1990-01-01', '12:00')).toMatchObject({ total: 9 * H, verano: null });
    });
});

describe('cambios de hora', () => {
    it('hora ambigua: 15/3/2008 23:30 en Buenos Aires pasó dos veces', () => {
        const r = localAUtc({ fecha: '2008-03-15', hora: '23:30' }, 'America/Argentina/Buenos_Aires');
        expect(r.estado).toBe('ambigua');
        expect(r.opciones.map((o) => o.total)).toEqual([-2 * H, -3 * H]);
    });
    it('hora inexistente: 30/12/2007 00:30 en Buenos Aires', () => {
        const r = localAUtc({ fecha: '2007-12-30', hora: '00:30' }, 'America/Argentina/Buenos_Aires');
        expect(r.estado).toBe('inexistente');
        expect(r.opciones).toHaveLength(2);
    });
    it('corrección manual', () => {
        const r = localAUtc({ fecha: '1965-11-21', hora: '07:50' }, 'Atlantic/Reykjavik', { base: -H, verano: 0 });
        expect(r.estado).toBe('manual');
        expect(r.opciones[0].utc).toMatchObject({ anio: 1965, mes: 11, dia: 21, hora: 8, minuto: 50 });
    });
    it('antes de 1970 es tentativo', () => {
        expect(localAUtc({ fecha: '1969-12-31', hora: '12:00' }, 'Europe/Madrid').tentativo).toBe(true);
        expect(localAUtc({ fecha: '1970-01-01', hora: '12:00' }, 'Europe/Madrid').tentativo).toBe(false);
    });
});
