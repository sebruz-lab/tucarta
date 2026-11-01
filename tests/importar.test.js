import { describe, it, expect } from 'vitest';
import { leerArchivoCartas, leerSolarFire, leerSolarFireDat, textoDeArchivo, clasificar } from '../ui/importar.js';

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

// Renglones inventados con el formato del .dat de Solar Fire.
const DAT = [
    '"Ana Prueba",1984,3,1,13,15,0,0,3,"BZT2",3,"Moron, Argentina",58.6166666666667,-34.65,-1,0,""',
    '"Beto, el ""Segundo""",1988,2,26,17,0,45,0,3,"BZT2",3,"Quilmes, Buenos Aire, Argentina",58.45,-34.6,-1,0,""',
    '"Gaby Hora Media",1816,7,9,12,0,0,0,3,"LMT",3.89666676521301,"Buenos Aires, Argentina",58.45,-34.6,-1,0,""',
    '"Fede Europa",1968,10,7,12,0,0,0,3,"CET",-1,"Paris, France",-2.33333333333333,48.8666666666667,-1,0,""',
    '"Ines Sin Zona",1974,3,10,0,45,0,0,3,"",2.5,"Montevideo, Uruguay",56.1833333333333,-34.8833333333333,-1,0,""',
    '"Roto",1974,13,10,0,45,0,0,3,"",2.5,"Nada",,,-1,0,""',
    '"Juan Partido\r\nEn Dos",1990,5,5,10,0,0,0,3,"BZT2",3,"Buenos Aires, Argentina",58.45,-34.6,-1,0,""',
    ''
].join('\r\n');

describe('importar el .dat de Solar Fire', () => {
    const { formato, cartas, salteadas } = leerArchivoCartas(DAT);

    it('reconoce el formato y saltea los renglones rotos', () => {
        expect(formato).toBe('Solar Fire');
        expect(salteadas).toBe(1);
        expect(cartas.map((c) => c.nombre)).toEqual(['Ana Prueba', 'Beto, el "Segundo"', 'Gaby Hora Media', 'Fede Europa', 'Ines Sin Zona', 'Juan Partido En Dos']);
    });

    it('fecha, hora sin segundos, lugar y país', () => {
        expect(cartas[0]).toMatchObject({ fecha: '1984-03-01', hora: '13:15', lugar: { nombre: 'Moron', paisNombre: 'Argentina', zona: 'America/Argentina/Buenos_Aires' } });
        expect(cartas[1]).toMatchObject({ hora: '17:00', lugar: { nombre: 'Quilmes, Buenos Aire', paisNombre: 'Argentina' } });
    });

    it('longitud positiva al oeste y huso en horas al oeste', () => {
        expect(cartas[0].lugar.lon).toBeCloseTo(-58.6166666666667, 9);
        expect(cartas[0].lugar.lat).toBeCloseTo(-34.65, 9);
        expect(cartas[3].lugar.lon).toBeCloseTo(2.33333333333333, 9);
        expect(cartas[0].correccion).toEqual({ base: -3 * 3600, verano: 0 });
        expect(cartas[2].correccion.base).toBe(-(3 * 3600 + 53 * 60 + 48));
        expect(cartas[3].correccion.base).toBe(3600);
        expect(cartas[4].correccion.base).toBe(-(2 * 3600 + 30 * 60));
    });

    it('lee el renglón suelto con leerSolarFireDat', () => {
        expect(leerSolarFireDat(DAT.split('\r\n')[0]).cartas).toHaveLength(1);
    });
});

describe('tipo de cada carta importada', () => {
    const ARCH = [
        r('Ana Prueba', '1 Mar 1984    13:15     BZT2 +3:00   Moron               Argentina           34S39       058W37      '),
        r('Ana Prueba', '1 Mar 2025    11:58:35  BZT2 +3:00   Villa Dolores       Argentina           31S56       065W12      '),
        r('Petra Romero Lopez', '27 Oct 1991   23:05     EST  +5:00   Bogota              Colombia            04N36       074W05      '),
        r('Petra', '27 Oct 2026   10:40:25  EST  +5:00   Bogota              Colombia            04N36       074W05      '),
        r('Lila Rubino', '27 Jan 2000    9:05     ADT  +3:00   Villa Dolores       Argentina           31S56       065W12      '),
        r('Lila Rubino', '26 Jan 2023   23:04:44  BZT2 +3:00   Paraty              Brazil              23S13       044W43      '),
        r('Transits Seba', '1 Jun 2024    14:53:23  BZT2 +3:00   Villa Dolores       Argentina           31S56       065W12      '),
        r('1Luna llena en cancer', '10 Jan 2020   16:20:48  BZT2 +3:00   Buenos Aires        Argentina           34S36       058W27      '),
        r('Beto Segundos', '26 Feb 1988   17:00:45  BZT2 +3:00   Buenos Aires        Argentina           34S36       058W27      ')
    ].join('\r\n');

    it('natales, revoluciones (segundos y cumpleaños) y eventos', () => {
        const { cartas } = leerArchivoCartas(ARCH);
        expect(cartas.map((c) => c.tipo)).toEqual([
            'natal', 'revolucion', 'natal', 'revolucion', 'natal', 'revolucion', 'evento', 'evento', 'natal'
        ]);
        expect(cartas.every((c) => !('conSegundos' in c))).toBe(true);
    });

    it('sin una natal de la misma persona, una hora con segundos no alcanza', () => {
        const [c] = clasificar([{ nombre: 'Solo', fecha: '2020-05-05', hora: '10:00', conSegundos: true }]);
        expect(c.tipo).toBe('natal');
    });
});
