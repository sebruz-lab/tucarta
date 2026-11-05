import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularProgresion, ANIO_TROPICO } from '../engine/progressions.js';
import { AJUSTES_POR_DEFECTO } from '../engine/config.js';
import { distancia } from '../engine/aspects.js';

let swe, natal;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    natal = calcularCarta(swe, { utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 }, lat: -34.65, lon: -58.62 });
});

const lonDe = (c, id) => [...c.puntos, ...c.angulos].find((p) => p.id === id).lon;
const ra = (lon, eps = 23.44) => {
    const r = Math.PI / 180;
    return ((Math.atan2(Math.sin(lon * r) * Math.cos(eps * r), Math.cos(lon * r)) / r) % 360 + 360) % 360;
};

describe('progresiones secundarias', () => {
    it('a edad cero es la carta natal', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd });
        for (const id of ['sol', 'luna', 'asc', 'mc']) expect(distancia(lonDe(p.carta, id), lonDe(natal, id))).toBeLessThan(1e-6);
    });

    it('un día por año: a los 42 años el Sol avanzó unos 42°', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 42 * ANIO_TROPICO });
        expect(p.edad).toBeCloseTo(42, 9);
        expect(p.jd - natal.meta.jd).toBeCloseTo(42, 9);
        expect(distancia(lonDe(p.carta, 'sol'), lonDe(natal, 'sol'))).toBeGreaterThan(40);
        expect(distancia(lonDe(p.carta, 'sol'), lonDe(natal, 'sol'))).toBeLessThan(44);
    });

    // La interfaz deja elegir la hora de la fecha a la que se progresa. Como
    // un anio de vida es un dia de efemerides, un dia entero de diferencia en
    // el objetivo son unos 4 minutos de efemerides: mueve la Luna progresada
    // un par de minutos de arco y practicamente nada al resto. Es precision,
    // no un cambio de carta.
    it('la hora de la fecha objetivo afina la Luna progresada y casi nada mas', () => {
        const jd = (h) => swe.julday(2026, 11, 1, h);
        const a = calcularProgresion(swe, { natal, jdObjetivo: jd(0) });
        const b = calcularProgresion(swe, { natal, jdObjetivo: jd(23.983) });
        expect(b.edad).toBeGreaterThan(a.edad);
        const mueve = (id) => Math.abs(lonDe(b.carta, id) - lonDe(a.carta, id)) * 60; // minutos de arco
        expect(mueve('luna')).toBeGreaterThan(1);
        expect(mueve('luna')).toBeLessThan(4);
        for (const id of ['sol', 'asc', 'mc']) expect(mueve(id)).toBeLessThan(0.5);
    });

    it('arco solar en longitud: el Medio Cielo avanza exactamente el arco solar', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 30 * ANIO_TROPICO });
        const avance = ((lonDe(p.carta, 'mc') - lonDe(natal, 'mc')) % 360 + 360) % 360;
        expect(Math.abs(avance - p.arco) * 3600).toBeLessThan(1);
    });

    it('Naibod: la ascensión recta del Medio Cielo avanza 0,98565° por año', () => {
        const ajustes = { ...AJUSTES_POR_DEFECTO, metodoProgresion: 'naibod' };
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 30 * ANIO_TROPICO, ajustes });
        const avance = ((ra(lonDe(p.carta, 'mc')) - ra(lonDe(natal, 'mc'))) % 360 + 360) % 360;
        expect(Math.abs(avance - 30 * 0.98564733)).toBeLessThan(0.02);
    });
});

// Progresada de la carta de prueba al 1/11/2026 10:51:34 (UTC-3), en
// Solar Fire con "SA in Long" y dia "Standard (Q2)".
describe('progresiones contra Solar Fire', () => {
    const SIG = { Ar: 0, Ta: 1, Ge: 2, Cn: 3, Le: 4, Vi: 5, Li: 6, Sc: 7, Sg: 8, Cp: 9, Aq: 10, Pi: 11 };
    const lonSF = (t) => {
        const m = t.match(/(\d+)°(\w\w)(\d+)'(\d+)''/);
        return SIG[m[2]] * 30 + Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
    };
    const sf = {
        asc: "06°Cn03'46''", mc: "25°Ar48'15''",
        cusps: ["06°Cn03'46''", "13°Le25'49''", "22°Vi38'54''", "25°Li48'15''", "21°Sc56'50''", "14°Sg10'24''"],
        puntos: {
            luna: "19°Vi16'27''", sol: "23°Ar35'33''", mercurio: "06°Ta34'48''", venus: "06°Ar47'01''",
            marte: "27°Sc57'58''", jupiter: "12°Cp32'26''", saturno: "14°Sc32'25''", urano: "13°Sg16'30''",
            neptuno: "01°Cp23'33''", pluton: "00°Sc57'23''", quiron: "00°Ge08'07''", nodo: "07°Ge26'12''"
        }
    };

    it('fecha derivada, planetas, ángulos y casas dentro de 1′', () => {
        const jdObjetivo = swe.julday(2026, 11, 1, 13 + 51 / 60 + 34 / 3600);
        const p = calcularProgresion(swe, { natal, jdObjetivo });
        const derivada = swe.julday(1984, 4, 13, 8 + 19 / 60 + 51 / 3600);
        expect(Math.abs(p.jd - derivada) * 86400, 'segundos de diferencia en la fecha derivada').toBeLessThan(60);
        for (const [id, t] of Object.entries(sf.puntos)) {
            expect(distancia(lonDe(p.carta, id), lonSF(t)) * 60, id).toBeLessThan(1);
        }
        expect(distancia(lonDe(p.carta, 'asc'), lonSF(sf.asc)) * 60, 'asc').toBeLessThan(1);
        expect(distancia(lonDe(p.carta, 'mc'), lonSF(sf.mc)) * 60, 'mc').toBeLessThan(1);
        sf.cusps.forEach((t, i) => expect(distancia(p.carta.cusps[i].lon, lonSF(t)) * 60, `casa ${i + 1}`).toBeLessThan(1));
    });
});

describe('orbes de las progresiones', () => {
    it('1° para todos los aspectos, entre sí y a la natal', () => {
        const p = calcularProgresion(swe, { natal, jdObjetivo: natal.meta.jd + 42.7 * ANIO_TROPICO });
        expect(p.carta.aspectos.every((a) => a.orbeMax === 1 && a.orbe <= 1)).toBe(true);
        expect(p.aspectosNatal.length).toBeGreaterThan(0);
        expect(p.aspectosNatal.every((a) => a.orbeMax === 1 && a.orbe <= 1)).toBe(true);
    });
});
