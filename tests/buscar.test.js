import { describe, it, expect } from 'vitest';
import { buscarEnLista } from '../ui/miscartas.js';

const NOMBRES = ['Ana Iniesta', 'Ángela Ruiz', 'Beto Segundos', 'Jonathan Podoba', 'Lila Rubino', 'Seba Bru', 'Seba Bru', 'Sebastián Gómez', 'Zoe'];

describe('buscar en Mis cartas', () => {
    it('va a los que empiezan así, sin tildes ni mayúsculas', () => {
        expect(buscarEnLista(NOMBRES, 's')).toMatchObject({ indice: 5, como: 'inicio' });
        expect(buscarEnLista(NOMBRES, 'Seba')).toMatchObject({ indice: 5, coinciden: [5, 6, 7] });
        expect(buscarEnLista(NOMBRES, 'seba bru').coinciden).toEqual([5, 6]);
        expect(buscarEnLista(NOMBRES, 'angela')).toMatchObject({ indice: 1, coinciden: [1] });
    });

    it('si nada empieza así, busca por apellido', () => {
        expect(buscarEnLista(NOMBRES, 'bru')).toMatchObject({ indice: 5, coinciden: [5, 6], como: 'palabra' });
        expect(buscarEnLista(NOMBRES, 'rubi')).toMatchObject({ indice: 4, como: 'palabra' });
    });

    it('con errores de tipeo, lo más parecido', () => {
        expect(buscarEnLista(NOMBRES, 'sbea')).toMatchObject({ indice: 5, como: 'parecido' });
        expect(buscarEnLista(NOMBRES, 'jhonatan')).toMatchObject({ indice: 3, como: 'parecido' });
        expect(buscarEnLista(NOMBRES, 'iniseta')).toMatchObject({ indice: 0, como: 'parecido' });
    });

    it('si nada se parece, el lugar que le toca en el orden', () => {
        expect(buscarEnLista(NOMBRES, 'mxq')).toMatchObject({ indice: 5, coinciden: [], como: 'orden' });
        expect(buscarEnLista(NOMBRES, 'zzzz')).toMatchObject({ indice: 8, como: 'orden' });
    });
});
