import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { crearBuscador } from '../places/search.js';

const buscar = crearBuscador(async (k) =>
    JSON.parse(await readFile(new URL(`../ui/public/lugares/${k}.json`, import.meta.url), 'utf8')));

const primero = async (texto) => (await buscar(texto))[0];

describe('buscador de lugares', () => {
    it('encuentra un pueblo chico con tilde, escrito sin tilde', async () => {
        expect(await primero('villa canas')).toMatchObject({
            nombre: 'Villa Cañás', provincia: 'Santa Fe', pais: 'AR', zona: 'America/Argentina/Cordoba'
        });
    });

    it('encuentra por una palabra del medio más la provincia', async () => {
        expect(await primero('cañas santa fe')).toMatchObject({ nombre: 'Villa Cañás' });
    });

    it('Morón de Buenos Aires antes que el de Catamarca', async () => {
        expect(await primero('moron')).toMatchObject({ provincia: 'Buenos Aires', zona: 'America/Argentina/Buenos_Aires' });
    });

    it('la provincia desambigua', async () => {
        expect(await primero('villa mercedes san luis')).toMatchObject({ provincia: 'San Luis', zona: 'America/Argentina/San_Luis' });
    });

    it('zona por provincia: Jujuy', async () => {
        expect(await primero('san salvador de jujuy')).toMatchObject({ zona: 'America/Argentina/Jujuy' });
    });

    it('fragmentos partidos: "san" solo y "san luis"', async () => {
        expect((await buscar('san')).length).toBeGreaterThan(0);
        expect(await primero('san luis')).toMatchObject({ nombre: 'San Luis', pais: 'AR' });
    });

    it('Córdoba de Argentina primero, pero el país desambigua', async () => {
        expect(await primero('cordoba')).toMatchObject({ pais: 'AR' });
        expect(await primero('cordoba españa')).toMatchObject({ pais: 'ES', zona: 'Europe/Madrid' });
    });

    it('Uruguay y el resto del mundo', async () => {
        expect(await primero('montevideo')).toMatchObject({ pais: 'UY', zona: 'America/Montevideo' });
        expect(await primero('reykjavik')).toMatchObject({ pais: 'IS', zona: 'Atlantic/Reykjavik' });
    });

    it('menos de 3 letras no busca', async () => {
        expect(await buscar('vi')).toEqual([]);
    });

    // Los lugares se guardan bajo las palabras de su nombre, no las de la
    // provincia. Con "La Paz, Cordoba" la palabra mas larga es la
    // provincia, y su fragmento no tiene ninguna Paz: antes daba vacio.
    it('agregar la provincia encuentra el pueblo chico, aunque sea la palabra mas larga', async () => {
        const conProvincia = await buscar('la paz cordoba');
        expect(conProvincia.length).toBeGreaterThan(0);
        for (const l of conProvincia) expect(l).toMatchObject({ nombre: 'La Paz', provincia: 'Córdoba', pais: 'AR' });
        // La coma no molesta, y el nombre solo no alcanza para llegar a el.
        expect(await buscar('la paz, cordoba')).toEqual(conProvincia);
        expect((await buscar('la paz')).some((l) => l.provincia === 'Córdoba')).toBe(false);
    });

    // La lista se corta en 8: la interfaz avisa cuando quedaron afuera.
    it('dice cuantos habia en total', async () => {
        const r = await buscar('la paz');
        expect(r.length).toBe(8);
        expect(r.total).toBeGreaterThan(8);
        const pocos = await buscar('villa de las rosas');
        expect(pocos.total).toBe(pocos.length);
    });
});
