import { describe, it, expect } from 'vitest';
import {
    POSICIONES, rutaTexto, urlPagina, posicionesInterpretacion,
    bloquesInterpretacion, cuerpoInterpretacion, PROXIMAMENTE, INCLUIR_CASAS
} from '../ui/interp.js';

// Una carta de juguete: solo lo que miran las interpretaciones (id y signo).
// Los signos son distintos a proposito, asi un cruce de ids se nota.
const CARTA = {
    puntos: [
        { id: 'sol', signo: 'tauro' },
        { id: 'luna', signo: 'piscis' },
        { id: 'mercurio', signo: 'geminis' },
        { id: 'venus', signo: 'aries' },
        { id: 'marte', signo: 'escorpio' },
        { id: 'jupiter', signo: 'leo' },
        { id: 'saturno', signo: 'acuario' },
        { id: 'quiron', signo: 'cancer' },
        { id: 'urano', signo: 'capricornio' },
        { id: 'neptuno', signo: 'sagitario' },
        { id: 'pluton', signo: 'libra' },
        { id: 'nodo', signo: 'virgo' },
        { id: 'lilith', signo: 'tauro' },
    ],
    angulos: [
        { id: 'asc', signo: 'leo' },
        { id: 'mc', signo: 'aries' },
    ],
};

const porPunto = (carta = CARTA) =>
    Object.fromEntries(posicionesInterpretacion(carta).map((p) => [p.punto, p]));

describe('los id del motor traducidos a los del sitio', () => {
    // Las cuatro que no coinciden. Si alguna se rompe, el enlace lleva a una
    // pagina que no existe (o, peor, a /lilith/, que en el sitio es otra cosa).
    it('luna va a /lunas/, en plural', () => {
        const p = porPunto().luna;
        expect(p.pagina).toBe('https://sebabru.com/carta-natal/lunas/piscis/');
        expect(p.ruta).toBe('luna-piscis');
    });

    it('asc va a /ascendente/ y sale de carta.angulos, no de puntos', () => {
        const p = porPunto().asc;
        expect(p.pagina).toBe('https://sebabru.com/carta-natal/ascendente/leo/');
        expect(p.ruta).toBe('asc-leo');
    });

    it('nodo va a /nodonorte/', () => {
        const p = porPunto().nodo;
        expect(p.pagina).toBe('https://sebabru.com/carta-natal/nodonorte/virgo/');
        expect(p.ruta).toBe('signos/nodonorte-virgo');
    });

    it('lilith va a /lunanegra/ y NUNCA a /lilith/', () => {
        const p = porPunto().lilith;
        expect(p.pagina).toBe('https://sebabru.com/carta-natal/lunanegra/tauro/');
        expect(p.ruta).toBe('signos/lunanegra-tauro');
        expect(p.pagina).not.toContain('/lilith/');
        expect(p.titulo).toBe('Luna Negra en Tauro');
    });

    it('los otros nueve usan su propio id, sin traducir', () => {
        for (const id of ['mercurio', 'venus', 'marte', 'jupiter', 'saturno',
                          'quiron', 'urano', 'neptuno', 'pluton']) {
            const p = porPunto()[id];
            expect(p.pagina).toBe(`https://sebabru.com/carta-natal/${id}/${p.signo}/`);
        }
    });
});

describe('de que carpeta sale cada texto', () => {
    // Sol, Luna y Ascendente tienen texto largo en /textos/. Los otros once,
    // el corto en /textos/signos/. Y los nombres COLISIONAN: sol-tauro existe
    // en las dos carpetas y son textos distintos, asi que la ruta (que es la
    // clave de la cache) tiene que llevar la carpeta.
    it('los tres largos, sin subcarpeta', () => {
        const p = porPunto();
        expect([p.sol.ruta, p.luna.ruta, p.asc.ruta]).toEqual(['sol-tauro', 'luna-piscis', 'asc-leo']);
    });

    it('los once cortos, bajo signos/', () => {
        const rutas = posicionesInterpretacion(CARTA)
            .filter((p) => !['sol', 'luna', 'asc'].includes(p.punto))
            .map((p) => p.ruta);
        expect(rutas).toHaveLength(11);
        expect(rutas.every((r) => r.startsWith('signos/'))).toBe(true);
    });

    it('el Sol largo y el Sol corto no comparten clave', () => {
        expect(rutaTexto(POSICIONES.find((p) => p.motor === 'sol'), 'tauro')).toBe('sol-tauro');
        expect(rutaTexto({ texto: 'sol', largo: false }, 'tauro')).toBe('signos/sol-tauro');
    });
});

describe('las posiciones de una carta', () => {
    it('son catorce, en orden de carta y sin repetir', () => {
        const pos = posicionesInterpretacion(CARTA);
        expect(pos).toHaveLength(14);
        expect(pos.slice(0, 4).map((p) => p.punto)).toEqual(['sol', 'luna', 'asc', 'mercurio']);
        expect(new Set(pos.map((p) => p.ruta)).size).toBe(14);
    });

    it('un punto que el motor no calculo no entra', () => {
        // Los puntos opcionales se pueden apagar en los ajustes.
        const sinLilith = { ...CARTA, puntos: CARTA.puntos.filter((p) => p.id !== 'lilith') };
        const pos = posicionesInterpretacion(sinLilith);
        expect(pos).toHaveLength(13);
        expect(pos.some((p) => p.punto === 'lilith')).toBe(false);
    });

    it('las casas quedan afuera hasta que esten sus 36 textos', () => {
        expect(INCLUIR_CASAS).toBe(false);
        expect(posicionesInterpretacion(CARTA).some((p) => p.punto.startsWith('casa'))).toBe(false);
    });

    it('urlPagina siempre termina en barra: es la URL canonica del sitio', () => {
        for (const pos of POSICIONES) expect(urlPagina(pos, 'aries').endsWith('/')).toBe(true);
    });
});

describe('el HTML que sale', () => {
    it('catorce desplegables cerrados, con la ruta y la pagina en el dataset', () => {
        const html = bloquesInterpretacion(CARTA);
        expect((html.match(/<details/g) || [])).toHaveLength(14);
        expect(html).not.toContain('open');
        expect(html).toContain('data-texto="luna-piscis"');
        expect(html).toContain('data-pagina="https://sebabru.com/carta-natal/lunas/piscis/"');
    });

    it('el texto NO viaja en el HTML: entra despues, por fetch', () => {
        // Es lo que mantiene a /cartas/ sin una segunda copia de los textos
        // compitiendo con las 196 paginas de /carta-natal/.
        const html = bloquesInterpretacion(CARTA);
        expect(html).toContain('Buscando el texto');
        expect(html).not.toContain('<p>El');
    });

    it('el cuerpo lleva el texto y el enlace a la pagina', () => {
        const pos = porPunto().sol;
        const html = cuerpoInterpretacion(pos, { texto: 'Primero.\n\nSegundo.' });
        expect(html).toContain('<p>Primero.</p>');
        expect(html).toContain('<p>Segundo.</p>');
        expect(html).toContain('href="https://sebabru.com/carta-natal/sol/tauro/"');
        expect(html).toContain('data-posicion="sol-tauro"');
        expect(html).toContain('Leer la página completa de Sol en Tauro');
    });

    it('sin texto publicado, el aviso y el enlace igual', () => {
        const html = cuerpoInterpretacion(porPunto().venus, null);
        expect(html).toContain(PROXIMAMENTE);
        expect(html).toContain('href="https://sebabru.com/carta-natal/venus/aries/"');
    });

    it('no se interpreta HTML que venga en el texto', () => {
        const html = cuerpoInterpretacion(porPunto().sol, { texto: '<script>alert(1)</script>' });
        expect(html).not.toContain('<script>');
    });
});
