import { describe, it, expect } from 'vitest';
import { normalizarFecha, anioCompleto, completarFecha } from '../ui/fecha.js';

// Simula escribir de a una tecla, como en el celular.
const escribir = (texto) => [...texto].reduce((v, c) => normalizarFecha(v + c, true), '');

describe('fecha escrita a mano', () => {
    it('con solo dígitos, las barras se ponen solas', () => {
        expect(escribir('01')).toBe('01/');
        expect(escribir('010384')).toBe('01/03/84');
        expect(escribir('01031984')).toBe('01/03/1984');
        expect(escribir('0103198455')).toBe('01/03/1984');
    });

    it('guiones, puntos y espacios valen como barra y completan con 0', () => {
        expect(escribir('1-3-84')).toBe('01/03/84');
        expect(escribir('01.03.1984')).toBe('01/03/1984');
        expect(escribir('1 3 84')).toBe('01/03/84');
        expect(escribir('1/3/1984')).toBe('01/03/1984');
        expect(normalizarFecha('1-', true)).toBe('01/');
    });

    it('al borrar no vuelve a poner la barra', () => {
        expect(normalizarFecha('01', false)).toBe('01');
        expect(normalizarFecha('01/03', false)).toBe('01/03');
        expect(normalizarFecha('01/0', false)).toBe('01/0');
    });

    it('un texto pegado entero también se acomoda', () => {
        expect(normalizarFecha('01-03-1984')).toBe('01/03/1984');
        expect(normalizarFecha('  5.3.90 ')).toBe('05/03/90');
    });

    it('año de dos cifras', () => {
        expect(anioCompleto('01/03/84')).toBe('01/03/1984');
        expect(anioCompleto('01/03/28')).toBe('01/03/2028');
        expect(anioCompleto('01/03/1984')).toBe('01/03/1984');
    });

    it('con un mes en letras no se toca mientras se escribe', () => {
        expect(normalizarFecha('1 de mar', true)).toBe('1 de mar');
    });
});

describe('al salir del campo, cualquier cascotazo a DD/MM/AAAA', () => {
    const casos = {
        '01/03/1984': '01/03/1984',
        '1/3/84': '01/03/1984',
        '1-3-1984': '01/03/1984',
        '1.3.84': '01/03/1984',
        '1 3 84': '01/03/1984',
        '01031984': '01/03/1984',
        '010384': '01/03/1984',
        '1984-03-01': '01/03/1984',
        '1984/3/1': '01/03/1984',
        '1 de marzo de 1984': '01/03/1984',
        '1 mar 84': '01/03/1984',
        'Marzo 1, 1984': '01/03/1984',
        '15 de setiembre de 2001': '15/09/2001',
        '7 de Diciembre de 1969': '07/12/1969',
        ' 01 - 03 - 1984 ': '01/03/1984',
        '1//3//84': '01/03/1984',
        '19840301': '01/03/1984',
        // "1984-03-01" escrito tecla por tecla queda así antes de salir
        '19/84/0301': '01/03/1984'
    };
    for (const [entrada, salida] of Object.entries(casos)) {
        it(`"${entrada}" -> ${salida}`, () => expect(completarFecha(entrada)).toBe(salida));
    }

    it('lo que no se entiende queda para que el formulario avise', () => {
        expect(completarFecha('')).toBe('');
        expect(completarFecha('0103')).toBe('01/03');
        expect(completarFecha('45/13/1984')).toBe('45/13/1984');
        expect(completarFecha('marzo')).toBe('marzo');
    });
});
