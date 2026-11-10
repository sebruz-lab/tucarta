// Controla el parser de tzdata (time/build/zonas.mjs): el offset total de
// cada periodo tiene que coincidir con el de Intl (ICU de Node, misma
// version de tzdata) cada 6 horas desde 1900 y alrededor de cada cambio.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import indice from '../time/zonas.json';
import { archivoDeZona } from '../time/archivo.js';
import { estaCorregido, corregir } from '../time/correcciones.js';

// El detalle de cada zona vive en su propio archivo (ui/public/husos/).
const tabla = {
    version: indice.version,
    zonas: Object.fromEntries(indice.zonas.map((z) => [z,
        JSON.parse(readFileSync(new URL(`../ui/public/husos/${archivoDeZona(z)}`, import.meta.url), 'utf8'))]))
};

const fmt = {};
function offsetIntl(zona, seg) {
    fmt[zona] ||= new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'longOffset' });
    const s = fmt[zona].formatToParts(new Date(seg * 1000)).find((p) => p.type === 'timeZoneName').value;
    const m = s.match(/GMT([+-])(\d\d):(\d\d)(?::(\d\d))?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (+m[2] * 3600 + +m[3] * 60 + +(m[4] || 0));
}

function offsetTabla(periodos, seg) {
    let r = periodos[0];
    for (const p of periodos) if (p[0] <= seg) r = p; else break;
    return r[1];
}

const DESDE = Date.UTC(1900, 0, 1) / 1000;
const HASTA = Date.UTC(2030, 0, 1) / 1000;

// La comparacion solo tiene sentido con la misma tzdata de los dos lados:
// Intl usa el ICU que trae Node, que en el runner puede ser otra version.
// Cuando no coinciden se saltea (el generador ya hizo esta misma
// comparacion, con versiones iguales, antes de escribir los archivos).
const mismaTz = process.versions.tz === tabla.version;
if (!mismaTz) {
    console.warn(`Husos: se saltea la comparacion con Intl (datos ${tabla.version}, ICU de Node ${process.versions.tz}).`);
}

describe.skipIf(!mismaTz)(`tzdata ${tabla.version} vs Intl (ICU ${process.versions.tz})`, () => {
    for (const [zona, periodos] of Object.entries(tabla.zonas)) {
        it(zona, () => {
            const instantes = [];
            for (let s = DESDE; s < HASTA; s += 6 * 3600) instantes.push(s);
            for (const [d] of periodos) if (d >= DESDE) instantes.push(d - 1, d, d + 1);
            // Los tramos de time/correcciones.js son justamente donde no
            // seguimos a IANA: Intl no puede confirmarlos. Se miran los
            // periodos que llevan la marca de correccion y no la lista de
            // CORRECCIONES, porque asi tambien quedan cubiertos los alias
            // (America/Rosario sale de America/Argentina/Cordoba y lleva
            // la misma marca, pero la lista esta escrita con el nombre de
            // la zona real).
            const marcados = periodos
                .map((p, i) => (p[3] ? [p[0], periodos[i + 1] ? periodos[i + 1][0] : Infinity] : null))
                .filter(Boolean);
            const corregido = (s) => estaCorregido(zona, s) || marcados.some(([a, b]) => s >= a && s < b);
            const fallas = instantes
                .filter((s) => !corregido(s))
                .filter((s) => offsetIntl(zona, s) !== offsetTabla(periodos, s))
                .map((s) => `${new Date(s * 1000).toISOString()} intl=${offsetIntl(zona, s)} tabla=${offsetTabla(periodos, s)}`);
            expect(fallas.slice(0, 5)).toEqual([]);
        });
    }
});

// El armado de las correcciones (time/correcciones.js). Son dos cosas que
// se rompen en silencio: la marca que se pierde al unir periodos, y los
// alias, que salen de la zona real pero se piden por su propio nombre.
describe('correcciones', () => {
    const H = 3600;
    const utc = (a, m, d, h) => Date.UTC(a, m - 1, d, h) / 1000;

    it('un periodo corregido pegado a uno real con el mismo huso conserva su marca', () => {
        // Salta se queda en -3 todo el verano 92-93, y el 7/3/1993 el pais
        // vuelve a -3: dos tramos con el mismo huso y distinta marca. Si se
        // unieran, o se pierde el aviso o se derrama a fechas que no
        // corregimos.
        const ps = corregir('America/Argentina/Salta', [
            [utc(1992, 10, 18, 3), -2 * H, H],
            [utc(1993, 3, 7, 2), -3 * H, 0]
        ]);
        const enero = ps.filter((p) => p[0] <= utc(1993, 1, 15, 12)).pop();
        const abril = ps.filter((p) => p[0] <= utc(1993, 4, 15, 12)).pop();
        expect(enero[1]).toBe(-3 * H);
        expect(enero[3]).toBe(2);
        expect(abril[1]).toBe(-3 * H);
        expect(abril[3]).toBeUndefined();
    });

    it('no quedan periodos consecutivos iguales', () => {
        // El invariante de la salida: nunca dos tramos seguidos con el mismo
        // huso, el mismo verano y la misma marca. Uno de los dos no diria
        // nada y solo haria mas grande el archivo.
        for (const zona of ['America/Argentina/Salta', 'America/Argentina/Cordoba', 'America/Argentina/La_Rioja']) {
            const ps = corregir(zona, [
                [utc(1990, 10, 21, 3), -2 * H, H],
                [utc(1991, 3, 3, 2), -4 * H, 0],
                [utc(1991, 10, 20, 4), -2 * H, H],
                [utc(1992, 3, 1, 2), -3 * H, 0],
                [utc(1992, 10, 18, 3), -2 * H, H],
                [utc(1993, 3, 7, 2), -3 * H, 0]
            ]);
            const repetidos = ps.filter((p, i) => i > 0
                && p[1] === ps[i - 1][1] && p[2] === ps[i - 1][2] && (p[3] || 0) === (ps[i - 1][3] || 0));
            expect(repetidos, zona).toEqual([]);
            // Y los instantes quedan ordenados.
            expect(ps.map((p) => p[0]), zona).toEqual([...ps.map((p) => p[0])].sort((a, b) => a - b));
        }
    });

    it('la correccion llega al alias cuando se le pasa la zona real', () => {
        const entrada = [[utc(1991, 3, 3, 2), -4 * H, 0], [utc(1991, 10, 20, 4), -2 * H, H]];
        const porNombre = corregir('America/Rosario', entrada);
        const porReal = corregir('America/Rosario', entrada, 'America/Argentina/Cordoba');
        expect(porNombre).toEqual(entrada);           // sin la zona real no corrige
        expect(porReal[0][1]).toBe(-3 * H);
        expect(porReal[0][3]).toBe(1);
    });

    it('una zona sin correcciones queda igual', () => {
        const entrada = [[utc(1991, 3, 3, 2), -3 * H, 0]];
        expect(corregir('Europe/Madrid', entrada, 'Europe/Madrid')).toBe(entrada);
    });
});
