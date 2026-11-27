// Figuras de aspectos. Se arman con listas de aspectos a mano, que es lo
// unico que mira figurasDe, y al final se prueba contra una carta real.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { AJUSTES_POR_DEFECTO } from '../engine/config.js';
import { figurasDe } from '../engine/figuras.js';

// Un aspecto como lo devuelve calcularAspectos, con lo que mira figurasDe.
const asp = (a, b, aspecto, orbe = 1) => ({ a, b, aspecto, orbe });

const tipos = (fs) => fs.map((f) => f.tipo);
const puntosDe = (fs, tipo) => fs.find((f) => f.tipo === tipo)?.puntos.slice().sort();

describe('las figuras de tres puntos', () => {
    it('gran trígono', () => {
        const f = figurasDe([
            asp('sol', 'luna', 'trigono'), asp('luna', 'marte', 'trigono'), asp('sol', 'marte', 'trigono')
        ]);
        expect(tipos(f)).toEqual(['granTrigono']);
        expect(puntosDe(f, 'granTrigono')).toEqual(['luna', 'marte', 'sol']);
        expect(f[0].nombre).toBe('Gran trígono');
    });

    it('T cuadrada, con el vértice bien puesto', () => {
        const f = figurasDe([
            asp('sol', 'luna', 'oposicion'), asp('sol', 'marte', 'cuadratura'), asp('luna', 'marte', 'cuadratura')
        ]);
        expect(tipos(f)).toEqual(['tCuadrada']);
        // El vertice es el que cuadra a los dos que se oponen.
        expect(f[0].vertice).toBe('marte');
    });

    it('yod: dos quincuncios y un sextil', () => {
        const f = figurasDe([
            asp('venus', 'marte', 'sextil'), asp('venus', 'saturno', 'quincuncio'),
            asp('marte', 'saturno', 'quincuncio')
        ]);
        expect(tipos(f)).toEqual(['yod']);
        expect(f[0].vertice).toBe('saturno');
    });

    it('tres trígonos sueltos que no cierran no son figura', () => {
        expect(figurasDe([
            asp('sol', 'luna', 'trigono'), asp('luna', 'marte', 'trigono')
        ])).toEqual([]);
    });

    it('sin quincuncio no hay yod, y no se lo inventa', () => {
        // Es lo que pasa si alguien apaga el quincuncio en los ajustes:
        // ese aspecto no esta en carta.aspectos y la figura no aparece.
        expect(figurasDe([asp('venus', 'marte', 'sextil')])).toEqual([]);
    });
});

describe('el stellium', () => {
    it('tres o más encadenados por conjunción', () => {
        const f = figurasDe([
            asp('sol', 'mercurio', 'conjuncion'), asp('mercurio', 'venus', 'conjuncion')
        ]);
        expect(tipos(f)).toEqual(['stellium']);
        expect(puntosDe(f, 'stellium')).toEqual(['mercurio', 'sol', 'venus']);
    });

    it('dos en conjunción no alcanzan', () => {
        expect(figurasDe([asp('sol', 'mercurio', 'conjuncion')])).toEqual([]);
    });

    it('la cadena vale aunque las puntas no se toquen entre sí', () => {
        // Sol-Mercurio y Mercurio-Venus en conjuncion, pero Sol y Venus a
        // mas de un orbe: sigue siendo un solo stellium de tres.
        const f = figurasDe([
            asp('sol', 'mercurio', 'conjuncion'), asp('mercurio', 'venus', 'conjuncion'),
            asp('venus', 'marte', 'conjuncion')
        ]);
        expect(f).toHaveLength(1);
        expect(puntosDe(f, 'stellium')).toEqual(['marte', 'mercurio', 'sol', 'venus']);
    });

    it('dos grupos separados son dos stelliums', () => {
        const f = figurasDe([
            asp('sol', 'mercurio', 'conjuncion'), asp('mercurio', 'venus', 'conjuncion'),
            asp('urano', 'neptuno', 'conjuncion'), asp('neptuno', 'pluton', 'conjuncion')
        ]);
        expect(f).toHaveLength(2);
        expect(tipos(f)).toEqual(['stellium', 'stellium']);
    });
});

describe('las figuras de cuatro puntos', () => {
    const granCruz = [
        asp('sol', 'luna', 'oposicion'), asp('marte', 'saturno', 'oposicion'),
        asp('sol', 'marte', 'cuadratura'), asp('marte', 'luna', 'cuadratura'),
        asp('luna', 'saturno', 'cuadratura'), asp('saturno', 'sol', 'cuadratura')
    ];

    it('gran cruz', () => {
        const f = figurasDe(granCruz);
        expect(tipos(f)).toContain('granCruz');
        expect(puntosDe(f, 'granCruz')).toEqual(['luna', 'marte', 'saturno', 'sol']);
    });

    it('la gran cruz se come las cuatro T cuadradas que tiene adentro', () => {
        // Sin la poda, esta misma lista devuelve una gran cruz y cuatro
        // T cuadradas, que es la misma figura contada cinco veces.
        expect(figurasDe(granCruz)).toHaveLength(1);
    });

    it('rectángulo místico', () => {
        const f = figurasDe([
            asp('sol', 'luna', 'oposicion'), asp('marte', 'saturno', 'oposicion'),
            asp('sol', 'marte', 'trigono'), asp('luna', 'saturno', 'trigono'),
            asp('marte', 'luna', 'sextil'), asp('saturno', 'sol', 'sextil')
        ]);
        expect(tipos(f)).toEqual(['rectangulo']);
    });

    it('cometa: el gran trígono queda adentro y no se lista aparte', () => {
        const f = figurasDe([
            asp('sol', 'luna', 'trigono'), asp('luna', 'marte', 'trigono'), asp('sol', 'marte', 'trigono'),
            asp('venus', 'sol', 'oposicion'), asp('venus', 'luna', 'sextil'), asp('venus', 'marte', 'sextil')
        ]);
        expect(tipos(f)).toEqual(['cometa']);
        expect(f[0].vertice).toBe('venus');
        expect(puntosDe(f, 'cometa')).toEqual(['luna', 'marte', 'sol', 'venus']);
    });
});

describe('el orden y el orbe', () => {
    it('el orbe es el promedio de los aspectos que la arman', () => {
        const f = figurasDe([
            asp('sol', 'luna', 'trigono', 1), asp('luna', 'marte', 'trigono', 2), asp('sol', 'marte', 'trigono', 3)
        ]);
        expect(f[0].orbe).toBe(2);
    });

    it('primero las de más puntos, y entre iguales la más exacta', () => {
        const f = figurasDe([
            // Un gran trigono flojo.
            asp('sol', 'luna', 'trigono', 5), asp('luna', 'marte', 'trigono', 5), asp('sol', 'marte', 'trigono', 5),
            // Y una T cuadrada exacta, con otros puntos.
            asp('venus', 'saturno', 'oposicion', 0.1), asp('venus', 'pluton', 'cuadratura', 0.1),
            asp('saturno', 'pluton', 'cuadratura', 0.1),
            // Mas un stellium de tres, que empata en puntos.
            asp('urano', 'neptuno', 'conjuncion', 0.5), asp('neptuno', 'quiron', 'conjuncion', 0.5)
        ]);
        expect(tipos(f)).toEqual(['tCuadrada', 'stellium', 'granTrigono']);
    });
});

describe('sobre una carta de verdad', () => {
    let swe;
    beforeAll(async () => {
        swe = await cargarSwe(() =>
            readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
    });

    it('no se cuelga ni devuelve basura', () => {
        const carta = calcularCarta(swe, {
            utc: { anio: 1984, mes: 3, dia: 1, hora: 16, minuto: 15 },
            lat: -34.65, lon: -58.62, ajustes: AJUSTES_POR_DEFECTO
        });
        const f = figurasDe(carta.aspectos);
        const ids = carta.puntos.map((p) => p.id);
        for (const x of f) {
            expect(Object.keys(FIGURAS_VALIDAS), x.tipo).toContain(x.tipo);
            expect(x.puntos.length).toBeGreaterThanOrEqual(3);
            // Nada de puntos repetidos ni inventados.
            expect(new Set(x.puntos).size).toBe(x.puntos.length);
            for (const p of x.puntos) expect([...ids, 'asc', 'mc'], p).toContain(p);
            expect(x.orbe).toBeGreaterThanOrEqual(0);
        }
    });
});

const FIGURAS_VALIDAS = {
    stellium: 1, granTrigono: 1, tCuadrada: 1, yod: 1, granCruz: 1, cometa: 1, rectangulo: 1
};
