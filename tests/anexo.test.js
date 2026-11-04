import { describe, it, expect } from 'vitest';
import { dibujarAnexo } from '../ui/anexo.js';

const nombres = { sol: 'Sol', luna: 'Luna', marte: 'Marte', asc: 'Ascendente', mc: 'Medio Cielo' };
const base = {
    puntos: ['sol', 'luna', 'marte', 'asc', 'mc'],
    nombres,
    filas: ['sol', 'luna', 'marte', 'asc', 'mc'],
    columnas: ['sol', 'luna', 'marte', 'asc', 'mc'],
    aspectos: [{ a: 'sol', b: 'luna', aspecto: 'trigono' }, { a: 'marte', b: 'asc', aspecto: 'cuadratura' }],
    triangular: true
};
const cuenta = (svg, texto) => svg.split(texto).length - 1;

describe('anexos de la carta', () => {
    it('sin nada elegido no dibuja nada', () => {
        expect(dibujarAnexo({ ...base, incluir: {} })).toBe('');
    });

    it('grilla triangular: un casillero por par y un glifo por aspecto', () => {
        const svg = dibujarAnexo({ ...base, incluir: { aspectos: true } });
        // 5 puntos: 5 en la diagonal + 10 pares
        expect(cuenta(svg, 'class="anexo-celda')).toBe(15);
        expect(cuenta(svg, 'glifo-aspecto c-armonico')).toBe(2); // en la grilla y en la leyenda
        expect(cuenta(svg, 'glifo-aspecto c-tenso')).toBe(2);
        expect(svg).toContain('Trígono');
        expect(svg).not.toContain('Oposición'); // solo los aspectos que aparecen
    });

    it('grilla cuadrada en las cartas dobles', () => {
        const svg = dibujarAnexo({
            ...base, triangular: false, filas: ['sol', 'luna'], columnas: ['sol', 'luna', 'marte'],
            aspectos: [{ a: 'sol', b: 'marte', aspecto: 'oposicion' }], tituloGrilla: 'Revolución → natal', incluir: { aspectos: true }
        });
        expect(cuenta(svg, 'class="anexo-celda')).toBe(6);
        expect(svg).toContain('REVOLUCIÓN → NATAL');
    });

    it('tablas de planetas y signos', () => {
        const svg = dibujarAnexo({ ...base, incluir: { planetas: true, signos: true } });
        for (const n of ['Sol', 'Luna', 'Marte', 'Ascendente', 'Medio Cielo', 'Aries', 'Piscis', 'Escorpio']) expect(svg).toContain(n);
        expect(cuenta(svg, 'elem-fuego')).toBe(3);
        expect(svg).toMatch(/^<svg class="anexo" viewBox="0 0 664 /);
    });
});
