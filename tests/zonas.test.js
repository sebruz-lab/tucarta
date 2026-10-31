// Controla el parser de tzdata (time/build/zonas.mjs): el offset total de
// cada periodo tiene que coincidir con el de Intl (ICU de Node, misma
// version de tzdata) cada 6 horas desde 1900 y alrededor de cada cambio.

import { describe, it, expect } from 'vitest';
import tabla from '../time/zonas.json';

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

describe(`tzdata ${tabla.version} vs Intl (ICU ${process.versions.tz})`, () => {
    for (const [zona, periodos] of Object.entries(tabla.zonas)) {
        it(zona, () => {
            const instantes = [];
            for (let s = DESDE; s < HASTA; s += 6 * 3600) instantes.push(s);
            for (const [d] of periodos) if (d >= DESDE) instantes.push(d - 1, d, d + 1);
            const fallas = instantes
                .filter((s) => offsetIntl(zona, s) !== offsetTabla(periodos, s))
                .map((s) => `${new Date(s * 1000).toISOString()} intl=${offsetIntl(zona, s)} tabla=${offsetTabla(periodos, s)}`);
            expect(fallas.slice(0, 5)).toEqual([]);
        });
    }
});
