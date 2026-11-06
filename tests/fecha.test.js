import { describe, it, expect } from 'vitest';
import { normalizarFecha, anioCompleto, completarFecha, completarHora } from '../ui/fecha.js';

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

describe('hora escrita a mano', () => {
    it('toma la hora sola y la completa con minutos en cero', () => {
        expect(completarHora('9')).toBe('09:00');
        expect(completarHora('7')).toBe('07:00');
        expect(completarHora('23')).toBe('23:00');
    });

    it('acepta cualquier separador', () => {
        for (const t of ['9:30', '9.30', '9,30', '9 30', '9h30', '9 h 30']) {
            expect(completarHora(t)).toBe('09:30');
        }
    });

    it('entiende los digitos pegados', () => {
        expect(completarHora('930')).toBe('09:30');   // tres: H MM
        expect(completarHora('0930')).toBe('09:30');  // cuatro: HH MM
        expect(completarHora('2115')).toBe('21:15');
    });

    it('pasa la tarde a 24 horas', () => {
        expect(completarHora('9 pm')).toBe('21:00');
        expect(completarHora('9pm')).toBe('21:00');
        expect(completarHora('9 de la noche')).toBe('21:00');
        expect(completarHora('4 de la tarde')).toBe('16:00');
        expect(completarHora('9 am')).toBe('09:00');
        expect(completarHora('12 am')).toBe('00:00');
        expect(completarHora('12 pm')).toBe('12:00');
    });

    it('entiende las formas de decirlo', () => {
        expect(completarHora('9 y media')).toBe('09:30');
        expect(completarHora('10 y cuarto')).toBe('10:15');
        expect(completarHora('mediodía')).toBe('12:00');
        expect(completarHora('medianoche')).toBe('00:00');
    });

    it('lo que ya esta bien no se toca', () => {
        expect(completarHora('00:00')).toBe('00:00');
        expect(completarHora('23:59')).toBe('23:59');
        expect(completarHora('14:05')).toBe('14:05');
    });

    it('lo que no se entiende vuelve como vino, para que el formulario avise', () => {
        expect(completarHora('no me acuerdo')).toBe('no me acuerdo');
        expect(completarHora('25:00')).toBe('25:00');
        expect(completarHora('9:75')).toBe('9:75');
        expect(completarHora('')).toBe('');
    });
});
