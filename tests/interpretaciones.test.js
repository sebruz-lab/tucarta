import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { urlTexto, textosInterpretacion } from '../ui/interpretaciones.js';

const ORIGEN = 'https://sebabru.com/cartas/';

describe('de donde salen los textos', () => {
    it('del mismo dominio, un nivel arriba de la app', () => {
        expect(urlTexto('sol-aries', '/cartas/', ORIGEN)).toBe('https://sebabru.com/textos/sol-aries.json');
        expect(urlTexto('luna-tauro', '/', 'http://localhost:5173/')).toBe('http://localhost:5173/textos/luna-tauro.json');
    });

    it('nunca a Firestore ni a otro dominio', () => {
        const u = new URL(urlTexto('asc-virgo', '/cartas/', ORIGEN));
        expect(u.origin).toBe('https://sebabru.com');
    });
});

describe('lectura de los textos', () => {
    let respuestas;

    beforeEach(() => {
        respuestas = {};
        const guardado = {};
        globalThis.location = { href: ORIGEN };
        globalThis.sessionStorage = {
            getItem: (k) => guardado[k] ?? null,
            setItem: (k, v) => { guardado[k] = v; },
        };
        globalThis.fetch = vi.fn(async (url) => {
            const id = url.split('/').pop().replace('.json', '');
            const r = respuestas[id];
            if (r === 'error') throw new Error('sin internet');
            if (!r) return { ok: false, status: 404 };
            return { ok: true, status: 200, json: async () => r };
        });
    });

    afterEach(() => {
        delete globalThis.fetch;
        delete globalThis.sessionStorage;
        delete globalThis.location;
    });

    it('devuelve el texto publicado', async () => {
        respuestas['sol-aries'] = { titulo: 'Sol en Aries', texto: 'Arranca.' };
        const t = await textosInterpretacion(['sol-aries']);
        expect(t['sol-aries'].texto).toBe('Arranca.');
        expect(globalThis.fetch).toHaveBeenCalledWith('https://sebabru.com/textos/sol-aries.json');
    });

    it('un 404 es "todavia no hay texto", y no se vuelve a pedir', async () => {
        expect((await textosInterpretacion(['luna-leo']))['luna-leo']).toBe(null);
        await textosInterpretacion(['luna-leo']);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('si falla la red no se guarda nada: la proxima vuelve a intentar', async () => {
        respuestas['asc-libra'] = 'error';
        expect((await textosInterpretacion(['asc-libra']))['asc-libra']).toBe(null);
        respuestas['asc-libra'] = { texto: 'Ahora si.' };
        expect((await textosInterpretacion(['asc-libra']))['asc-libra'].texto).toBe('Ahora si.');
    });

    it('los tres de una carta se piden juntos y se cachean por la sesion', async () => {
        respuestas['sol-aries'] = { texto: 'a' };
        respuestas['luna-tauro'] = { texto: 'b' };
        respuestas['asc-geminis'] = { texto: 'c' };
        const ids = ['sol-aries', 'luna-tauro', 'asc-geminis'];
        await textosInterpretacion(ids);
        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        const otra = await textosInterpretacion(['sol-aries', 'luna-tauro', 'asc-virgo']);
        expect(globalThis.fetch).toHaveBeenCalledTimes(4);
        expect(otra['asc-virgo']).toBe(null);
    });
});
