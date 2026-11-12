// De donde sale el orbe de un aspecto, que aspectos se miran, y el
// aplicativo/separativo de los puntos que no son planetas.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularAspectos, orbeDe, aspectosActivos } from '../engine/aspects.js';
import { AJUSTES_POR_DEFECTO, ASPECTOS, ORBES_ASPECTO, FACTORES_POR_DEFECTO } from '../engine/config.js';
import { leerAjustes, ajustesDesde, panelAjustes } from '../ui/settings.js';

const asp = (id) => ASPECTOS.find((x) => x.id === id);
const NACIMIENTO = { utc: { anio: 1983, mes: 5, dia: 14, hora: 17, minuto: 20 }, lat: -34.6, lon: -58.45 };

let swe;
beforeAll(async () => {
    swe = await cargarSwe(() =>
        readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
});

describe('orbeDe', () => {
    const factor = { modoOrbes: 'factor', orbesAspecto: ORBES_ASPECTO, factores: FACTORES_POR_DEFECTO };

    it('por factor: el orbe del aspecto por el porcentaje del punto', () => {
        // Sol y Luna se llevan el orbe entero.
        expect(orbeDe(asp('conjuncion'), 'sol', 'luna', factor)).toBe(9);
        // Marte 80% de 9; Urano 70%.
        expect(orbeDe(asp('conjuncion'), 'marte', 'marte', factor)).toBeCloseTo(7.2, 10);
        expect(orbeDe(asp('conjuncion'), 'urano', 'urano', factor)).toBeCloseTo(6.3, 10);
        // Quirón 75% del quincuncio, que mide 5.
        expect(orbeDe(asp('quincuncio'), 'quiron', 'quiron', factor)).toBeCloseTo(3.75, 10);
    });

    it('por factor: entre dos puntos manda el porcentaje más grande', () => {
        expect(orbeDe(asp('cuadratura'), 'sol', 'pluton', factor)).toBe(9);
        expect(orbeDe(asp('cuadratura'), 'pluton', 'marte', factor)).toBeCloseTo(7.2, 10);
        expect(orbeDe(asp('cuadratura'), 'pluton', 'ceres', factor)).toBeCloseTo(6.3, 10);
    });

    it('los orbes de los menores son los que pidió Seba', () => {
        expect(ORBES_ASPECTO.semisextil).toBe(3);
        expect(ORBES_ASPECTO.semicuadratura).toBe(3);
        expect(ORBES_ASPECTO.sesquicuadratura).toBe(3);
        expect(ORBES_ASPECTO.quincuncio).toBe(5);
    });

    it('a mano: el orbe de cada punto, uno para los mayores y otro para los menores', () => {
        expect(orbeDe(asp('conjuncion'), 'urano', 'pluton', { modoOrbes: 'punto' })).toBe(5);
        expect(orbeDe(asp('semisextil'), 'urano', 'venus', { modoOrbes: 'punto' })).toBe(5);
    });

    it('las luminarias llevan el orbe del aspecto, se elija lo que se elija', () => {
        // Es lo que dice la lista de arriba del panel: ese orbe es el del
        // Sol y la Luna, y a mano se eligen los demás.
        for (const modoOrbes of ['factor', 'punto']) {
            expect(orbeDe(asp('conjuncion'), 'sol', 'pluton', { modoOrbes })).toBe(9);
            expect(orbeDe(asp('quincuncio'), 'luna', 'luna', { modoOrbes })).toBe(5);
            expect(orbeDe(asp('semisextil'), 'sol', 'sol', { modoOrbes })).toBe(3);
        }
    });

    it('un orbe fijo por aspecto le gana a los dos (tránsitos, sinastría)', () => {
        const o = { orbesPorAspecto: { conjuncion: 3, menor: 1 }, ...factor };
        expect(orbeDe(asp('conjuncion'), 'sol', 'luna', o)).toBe(3);
        expect(orbeDe(asp('quincuncio'), 'sol', 'luna', o)).toBe(1);
    });
});

describe('aspectosActivos', () => {
    const ids = (sel) => aspectosActivos(sel).map((x) => x.id);

    it('por defecto: los cinco mayores, el semisextil y el quincuncio', () => {
        expect(ids(AJUSTES_POR_DEFECTO.aspectos)).toEqual(['conjuncion', 'semisextil',
            'sextil', 'cuadratura', 'trigono', 'quincuncio', 'oposicion']);
    });

    it('ahora también se puede apagar un aspecto mayor', () => {
        expect(ids({ ...AJUSTES_POR_DEFECTO.aspectos, trigono: false })).not.toContain('trigono');
        expect(ids({})).toEqual(['conjuncion', 'sextil', 'cuadratura', 'trigono', 'oposicion']);
    });

    it('unos ajustes viejos, que solo nombran los menores, siguen andando', () => {
        // Lo que guardaba la versión anterior en "menores".
        expect(ids({ semisextil: true, quincuncio: true, semicuadratura: false, sesquicuadratura: false }))
            .toEqual(['conjuncion', 'semisextil', 'sextil', 'cuadratura', 'trigono', 'quincuncio', 'oposicion']);
    });

    it('se pueden apagar todos', () => {
        const nada = Object.fromEntries(ASPECTOS.map((x) => [x.id, false]));
        expect(ids(nada)).toEqual([]);
        const c = calcularCarta(swe, { ...NACIMIENTO, ajustes: { ...AJUSTES_POR_DEFECTO, aspectos: nada } });
        expect(c.aspectos).toEqual([]);
    });
});

describe('aplicativo y separativo', () => {
    const con = (extra) => calcularCarta(swe, { ...NACIMIENTO,
        ajustes: { ...AJUSTES_POR_DEFECTO, ...extra } });

    it('el Ascendente y el Medio Cielo se mueven, así que también dicen', () => {
        const c = con({ puntosAspectados: { ...AJUSTES_POR_DEFECTO.puntosAspectados, asc: true, mc: true } });
        expect(c.angulos.filter((x) => x.vel > 0)).toHaveLength(2);
        const aAngulos = c.aspectos.filter((a) => ['asc', 'mc'].includes(a.a) || ['asc', 'mc'].includes(a.b));
        expect(aAngulos.length).toBeGreaterThan(0);
        expect(aAngulos.every((a) => a.aplicativo !== null)).toBe(true);
    });

    it('un planeta que viene atrás del Ascendente se separa, y el de adelante se aplica', () => {
        const asc = { id: 'asc', lon: 100, vel: 360 };
        const adelante = calcularAspectos([asc], [{ id: 'sol', lon: 102, vel: 1 }]);
        const atras = calcularAspectos([asc], [{ id: 'sol', lon: 98, vel: 1 }]);
        expect(adelante[0]).toMatchObject({ aspecto: 'conjuncion', aplicativo: true });
        expect(atras[0]).toMatchObject({ aspecto: 'conjuncion', aplicativo: false });
    });

    it('los puntos que salen de otros heredan su velocidad', () => {
        const c = con({ puntos: { ...AJUSTES_POR_DEFECTO.puntos, nodosur: true, tierra: true, fortuna: true } });
        const p = (id) => c.puntos.find((x) => x.id === id);
        expect(p('nodosur').vel).toBe(p('nodo').vel);
        expect(p('tierra').vel).toBe(p('sol').vel);
        // La Fortuna se mueve con el Ascendente: rápido y hacia adelante.
        expect(p('fortuna').vel).toBeGreaterThan(300);
        expect(c.aspectos.filter((a) => a.a === 'fortuna' || a.b === 'fortuna')
            .every((a) => a.aplicativo !== null)).toBe(true);
    });

    it('con las casas dadas (una progresión) los ángulos no inventan velocidad', () => {
        const casas = swe.houses(2445469.2, NACIMIENTO.lat, NACIMIENTO.lon, 'P');
        const c = calcularCarta(swe, { ...NACIMIENTO, ajustes: AJUSTES_POR_DEFECTO, casas });
        expect(c.angulos.every((x) => x.vel === null)).toBe(true);
    });
});

describe('los ajustes guardados', () => {
    const conGuardado = (g) => {
        globalThis.localStorage = {
            getItem: () => (g === null ? null : JSON.stringify(g)),
            setItem: () => {}
        };
        try { return leerAjustes(); } finally { delete globalThis.localStorage; }
    };

    it('sin nada guardado, el modo nuevo', () => {
        expect(conGuardado(null).modoOrbes).toBe('factor');
    });

    it('quien había tocado sus orbes por punto se queda con ese modo', () => {
        expect(conGuardado({ orbes: { sol: 12 } }).modoOrbes).toBe('punto');
        expect(conGuardado({ orbesMenores: { marte: 1 } }).modoOrbes).toBe('punto');
        // Tenerlos guardados sin cambios no cuenta: es el panel, no una decisión.
        expect(conGuardado({ orbes: { sol: 9 }, casas: 'K' }).modoOrbes).toBe('factor');
        // Y lo elegido a mano manda sobre todo.
        expect(conGuardado({ orbes: { sol: 12 }, modoOrbes: 'factor' }).modoOrbes).toBe('factor');
    });

    it('los menores viejos se convierten en la lista de aspectos', () => {
        const a = conGuardado({ menores: { semisextil: false, quincuncio: true, semicuadratura: true } });
        expect(a.aspectos.semisextil).toBe(false);
        expect(a.aspectos.quincuncio).toBe(true);
        expect(a.aspectos.semicuadratura).toBe(true);
        expect(a.aspectos.conjuncion).toBe(true);
    });
});

describe('el panel de aspectos y orbes', () => {
    // ajustesDesde solo mira form.elements[nombre].value / .checked.
    const formulario = (campos) => ({ elements: campos });
    const base = {
        casas: { value: 'P' }, 'metodo-progresion': { value: 'arco-long' },
        'nodo-draconica': { value: 'real' }, 'fortuna-nocturna': { checked: true }
    };

    it('el porcentaje se escribe en entero y se guarda en fracción', () => {
        const a = ajustesDesde(formulario({ ...base,
            'modo-orbes': { value: 'factor' },
            'factor-marte': { value: '75' },
            'orbe-asp-quincuncio': { value: '4' },
            'aspecto-trigono': { checked: false }
        }), AJUSTES_POR_DEFECTO);
        expect(a.factores.marte).toBe(0.75);
        expect(a.factores.sol).toBe(1);
        expect(a.orbesAspecto.quincuncio).toBe(4);
        expect(a.aspectos.trigono).toBe(false);
        expect(a.modoOrbes).toBe('factor');
    });

    it('el campo que no está en pantalla no se toca', () => {
        // En modo factor no se muestra la tabla de orbes por punto.
        const a = ajustesDesde(formulario({ ...base, 'modo-orbes': { value: 'factor' } }), AJUSTES_POR_DEFECTO);
        expect(a.orbes).toEqual(AJUSTES_POR_DEFECTO.orbes);
        expect(a.factores).toEqual(AJUSTES_POR_DEFECTO.factores);
    });

    it('cada modo muestra su tabla', () => {
        const factor = panelAjustes(AJUSTES_POR_DEFECTO);
        expect(factor).toContain('name="factor-marte"');
        expect(factor).toContain('name="orbe-asp-conjuncion"');
        expect(factor).not.toContain('name="orbe-marte"');

        // El Sol y la Luna no van en la tabla de abajo en ningún modo: su
        // orbe es el del aspecto.
        expect(factor).not.toContain('name="factor-sol"');
        expect(factor).not.toContain('name="factor-luna"');

        const punto = panelAjustes({ ...AJUSTES_POR_DEFECTO, modoOrbes: 'punto' });
        expect(punto).toContain('name="orbe-marte"');
        expect(punto).toContain('name="orbe-menor-marte"');
        expect(punto).not.toContain('name="factor-marte"');
        expect(punto).not.toContain('name="orbe-sol"');
        expect(punto).not.toContain('name="orbe-menor-luna"');
        // La lista de arriba, con los orbes, está en los dos modos.
        expect(punto).toContain('name="orbe-asp-conjuncion"');
        // Las casillas de los aspectos están en los dos.
        for (const x of ASPECTOS) {
            expect(factor, x.id).toContain('name="aspecto-' + x.id + '"');
            expect(punto, x.id).toContain('name="aspecto-' + x.id + '"');
        }
    });
});
