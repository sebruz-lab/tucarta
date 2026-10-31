import { describe, it, expect } from 'vitest';
import { aValor, valor } from '../ui/firestore.js';
import { datosDeCarta, mismaCarta, igualQue } from '../ui/miscartas.js';

const carta = {
    nombre: 'Ana', fecha: '1984-03-01', hora: '13:15',
    lugar: { nombre: 'Morón', provincia: 'Buenos Aires', pais: 'AR', paisNombre: 'Argentina',
        lat: -34.65, lon: -58.62, zona: 'America/Argentina/Buenos_Aires', poblacion: 1, puntaje: 9 },
    correccion: null, eleccion: 0
};

describe('formato de Firestore', () => {
    it('ida y vuelta de una carta guardada', () => {
        const d = { ...datosDeCarta(carta), guardada: '2026-10-31T12:00:00.000Z' };
        expect(valor(aValor(d))).toEqual(d);
        expect(valor(aValor({ correccion: { base: -10800, verano: 3600 } }))).toEqual({ correccion: { base: -10800, verano: 3600 } });
    });

    it('enteros y decimales', () => {
        expect(aValor(-34)).toEqual({ integerValue: '-34' });
        expect(aValor(-34.5)).toEqual({ doubleValue: -34.5 });
    });
});

describe('mis cartas', () => {
    it('del lugar guarda solo lo necesario', () => {
        expect(Object.keys(datosDeCarta(carta).lugar).sort()).toEqual(['lat', 'lon', 'nombre', 'pais', 'paisNombre', 'provincia', 'zona']);
    });

    it('misma carta aunque cambie el huso; igual solo si coincide todo', () => {
        const otra = { ...carta, correccion: { base: -10800, verano: 0 } };
        expect(mismaCarta(carta, otra)).toBe(true);
        expect(igualQue(carta, otra)).toBe(false);
        expect(igualQue(carta, { ...carta })).toBe(true);
    });
});
