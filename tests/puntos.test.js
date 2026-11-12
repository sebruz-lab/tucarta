// Que puntos entran en la carta. Cualquiera se puede apagar, incluso el
// Sol: los ajustes guardan un si/no por punto y el motor filtra al final.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularTransitos } from '../engine/transits.js';
import { AJUSTES_POR_DEFECTO, PUNTOS, PUNTOS_OPCIONALES, enLaCarta } from '../engine/config.js';
import { panelAjustes } from '../ui/settings.js';

const NACIMIENTO = { utc: { anio: 1983, mes: 5, dia: 14, hora: 17, minuto: 20 }, lat: -34.6, lon: -58.45 };
const AHORA = { anio: 2026, mes: 11, dia: 11, hora: 15, minuto: 0 };

const con = (puntos) => ({ ...AJUSTES_POR_DEFECTO, puntos: { ...AJUSTES_POR_DEFECTO.puntos, ...puntos } });
const apagarTodo = () => Object.fromEntries([...PUNTOS, ...PUNTOS_OPCIONALES].map((p) => [p.id, false]));

let swe;
beforeAll(async () => {
    swe = await cargarSwe(() =>
        readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
});

const ids = (carta) => carta.puntos.map((p) => p.id);
const carta = (ajustes = AJUSTES_POR_DEFECTO) => calcularCarta(swe, { ...NACIMIENTO, ajustes });

describe('enLaCarta', () => {
    it('por defecto están los de siempre y ninguno de los otros', () => {
        for (const p of PUNTOS) expect(enLaCarta(AJUSTES_POR_DEFECTO, p.id), p.id).toBe(true);
        for (const p of PUNTOS_OPCIONALES) expect(enLaCarta(AJUSTES_POR_DEFECTO, p.id), p.id).toBe(false);
    });

    it('unos ajustes viejos, que no nombran los de siempre, los dejan prendidos', () => {
        // Los que se guardaron antes de que se pudieran apagar solo tienen
        // los opcionales. Nadie se queda sin Sol por actualizar la página.
        const viejos = { puntos: { ceres: true, eris: false } };
        expect(enLaCarta(viejos, 'sol')).toBe(true);
        expect(enLaCarta(viejos, 'ceres')).toBe(true);
        expect(enLaCarta(viejos, 'eris')).toBe(false);
        expect(enLaCarta(viejos, 'fortuna')).toBe(false);
        // Y sin ajustes tampoco: la carta de siempre.
        expect(enLaCarta(undefined, 'luna')).toBe(true);
        expect(enLaCarta({}, 'juno')).toBe(false);
    });
});

describe('la carta con puntos apagados', () => {
    it('la carta de siempre trae los trece puntos', () => {
        expect(ids(carta())).toEqual(PUNTOS.map((p) => p.id));
    });

    it('el punto apagado no está ni en la rueda ni en los aspectos', () => {
        const c = carta(con({ lilith: false, quiron: false }));
        expect(ids(c)).not.toContain('lilith');
        expect(ids(c)).not.toContain('quiron');
        expect(c.aspectos.some((x) => x.a === 'lilith' || x.b === 'lilith')).toBe(false);
        expect(c.aspectos.some((x) => x.a === 'quiron' || x.b === 'quiron')).toBe(false);
        // El resto queda igual que en la carta completa.
        const entera = carta();
        expect(c.puntos.map((p) => p.lon)).toEqual(
            entera.puntos.filter((p) => p.id !== 'lilith' && p.id !== 'quiron').map((p) => p.lon));
    });

    it('se pueden sacar todos: quedan las casas y los ángulos', () => {
        const c = carta(con(apagarTodo()));
        expect(c.puntos).toEqual([]);
        expect(c.aspectos).toEqual([]);
        expect(c.cusps).toHaveLength(12);
        expect(c.angulos.map((x) => x.id)).toEqual(['asc', 'mc']);
    });

    it('la Parte de Fortuna sale igual con el Sol y la Luna apagados', () => {
        // Se calcula a partir de ellos, así que se calculan todos y se
        // filtra después: apagar el Sol no tiene que mover la Fortuna.
        const conSol = carta(con({ fortuna: true }));
        const sinSol = carta(con({ fortuna: true, sol: false, luna: false }));
        expect(ids(sinSol)).toEqual(['mercurio', 'venus', 'marte', 'jupiter', 'saturno',
            'urano', 'neptuno', 'pluton', 'nodo', 'lilith', 'quiron', 'fortuna']);
        const lon = (c) => c.puntos.find((p) => p.id === 'fortuna').lon;
        expect(lon(sinSol)).toBe(lon(conSol));
    });

    it('el Nodo Sur sale igual con el Nodo Norte apagado', () => {
        const lon = (a) => carta(a).puntos.find((p) => p.id === 'nodosur').lon;
        expect(lon(con({ nodosur: true, nodo: false }))).toBe(lon(con({ nodosur: true })));
    });
});

describe('los tránsitos', () => {
    it('afuera transitan los mismos puntos que hay adentro', () => {
        const ajustes = con({ mercurio: false, venus: false });
        const natal = carta(ajustes);
        const t = calcularTransitos(swe, { utc: AHORA, natal, ajustes });
        expect(t.puntos.map((p) => p.id)).not.toContain('mercurio');
        expect(t.puntos.map((p) => p.id)).not.toContain('venus');
        expect(t.puntos).toHaveLength(PUNTOS.length - 2);
    });

    it('quien pide una lista de planetas manda igual', () => {
        const ajustes = con({ luna: false });
        const natal = carta(ajustes);
        const t = calcularTransitos(swe, { utc: AHORA, natal, ajustes, planetas: ['sol', 'luna'] });
        expect(t.puntos.map((p) => p.id)).toEqual(['sol', 'luna']);
    });
});

describe('el panel de ajustes', () => {
    it('cada punto tiene su casilla, los de siempre marcados', () => {
        const html = panelAjustes({ ...AJUSTES_POR_DEFECTO, orbes: AJUSTES_POR_DEFECTO.orbes });
        for (const p of [...PUNTOS, ...PUNTOS_OPCIONALES]) {
            expect(html, p.id).toContain(`name="punto-${p.id}"`);
        }
        expect(html).toContain('name="punto-sol" checked');
        expect(html).toContain('name="punto-ceres" ');
        expect(html).not.toContain('name="punto-ceres" checked');
    });

    it('el punto apagado no figura entre los que pueden aspectar', () => {
        const html = panelAjustes(con({ quiron: false }));
        expect(html).not.toContain('name="aspecta-quiron"');
        expect(html).toContain('name="aspecta-sol"');
    });
});
