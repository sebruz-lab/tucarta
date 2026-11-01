import { describe, it, expect } from 'vitest';
import { leerArchivoCartas, leerSolarFire, textoDeArchivo } from '../ui/importar.js';

// Renglones inventados con el formato de la exportacion de Solar Fire.
const r = (nombre, resto) => nombre.padEnd(30).slice(0, 30) + resto;
const ARCHIVO = [
    r('Ana Prueba', '1 Mar 1984    13:15     BZT2 +3:00   Moron               Argentina           34S39       058W37      '),
    r('Beto Segundos', '26 Feb 1988   17:00:45  BZT2 +3:00   Buenos Aires        Argentina           34S36       058W27      '),
    r('Carla Nombre Muy Largo Pegadoo', '31 Dec 2014   9:27      BZT2 +3:00   Villa Dolores       Argentina           31S56       065W12      '),
    'Dina Partida\r\n               15 May 1979   7:50      BZT2 +3:00   Buenos Aires        Argentina           34S36       058W27      ',
    r('Evento de 23 Feb 2020', '23 Feb 2020   12:31:42  BZT2 +3:00   San Javier          Argentina           31S56       065W12      '),
    r('Fede Europa', '7 Oct 1968    12:00     CET  -1:00   Wellingborough      United Kingdom      52N19       000W42      '),
    r('Gaby Hora Media', '9 Jul 1816    12:00     LMT  +3:53:48Buenos Aires        Argentina           34S36       058W27      '),
    r('Hugo Segundos Coord', '18 Oct 1977   1:00      PDT  +7:00   San Diego           California          32N42 55    117W09 23   '),
    r('Ines Sin Zona', '10 Mar 1974   0:45           +2:30   Montevideo          Uruguay             34S53       056W11      ')
].join('\r\n');

describe('importar cartas de Solar Fire', () => {
    const { formato, cartas, salteadas } = leerArchivoCartas(ARCHIVO);

    it('reconoce el formato y lee todas las cartas', () => {
        expect(formato).toBe('Solar Fire');
        expect(salteadas).toBe(0);
        expect(cartas.map((c) => c.nombre)).toEqual([
            'Ana Prueba', 'Beto Segundos', 'Carla Nombre Muy Largo Pegadoo', 'Dina Partida', 'Evento de 23 Feb 2020',
            'Fede Europa', 'Gaby Hora Media', 'Hugo Segundos Coord', 'Ines Sin Zona'
        ]);
        // El nombre de 30 caracteres queda pegado a la fecha, como en Solar Fire.
        expect(ARCHIVO).toContain('Pegadoo31 Dec 2014');
    });

    it('fecha, hora (sin segundos) y lugar', () => {
        expect(cartas[0]).toMatchObject({ fecha: '1984-03-01', hora: '13:15', lugar: { nombre: 'Moron', paisNombre: 'Argentina' } });
        expect(cartas[1].hora).toBe('17:00');
        expect(cartas[3]).toMatchObject({ nombre: 'Dina Partida', fecha: '1979-05-15', hora: '07:50' });
    });

    it('coordenadas, con segundos cuando los hay', () => {
        expect(cartas[0].lugar.lat).toBeCloseTo(-(34 + 39 / 60), 9);
        expect(cartas[0].lugar.lon).toBeCloseTo(-(58 + 37 / 60), 9);
        expect(cartas[5].lugar.lat).toBeCloseTo(52 + 19 / 60, 9);
        expect(cartas[7].lugar.lat).toBeCloseTo(32 + 42 / 60 + 55 / 3600, 9);
        expect(cartas[7].lugar.lon).toBeCloseTo(-(117 + 9 / 60 + 23 / 3600), 9);
    });

    it('el huso de Solar Fire (horas al oeste) pasa como corrección', () => {
        expect(cartas[0].correccion).toEqual({ base: -3 * 3600, verano: 0 });
        expect(cartas[5].correccion.base).toBe(3600);           // CET -1:00 = UTC+1
        expect(cartas[6].correccion.base).toBe(-(3 * 3600 + 53 * 60 + 48)); // hora media de Buenos Aires
        expect(cartas[8].correccion.base).toBe(-(2 * 3600 + 30 * 60));
        expect(cartas[0].lugar.zona).toBe('America/Argentina/Buenos_Aires');
        expect(cartas[7].lugar.zona).toBe('Etc/GMT+7');
    });

    it('renglones ilegibles se saltean sin romper el resto', () => {
        const { cartas: c, salteadas: s } = leerSolarFire(ARCHIVO + '\r\n' + r('Roto', '1 Jan 2000    10:00     XXX  ?????   Nada                Nada                ?????       ?????       '));
        expect(c).toHaveLength(9);
        expect(s).toBe(1);
    });

    it('un formato desconocido no se lee', () => {
        expect(leerArchivoCartas('hola, esto no es una carta').formato).toBe(null);
    });

    it('decodifica las tildes de Windows-1252', () => {
        const bytes = new Uint8Array([0x4d, 0x6f, 0x72, 0xf3, 0x6e]); // "Morón" en Windows-1252
        expect(textoDeArchivo(bytes.buffer)).toBe('Morón');
    });
});
