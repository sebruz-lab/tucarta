// Que ningun `$('.clase')` apunte a una clase que esta mas de una vez en el
// HTML: el primero que aparece gana, y lo demas se pinta en el lugar
// equivocado. Paso de verdad: la ventana de la otra persona usa la clase
// `lista-cambiar` para su estilo y esta antes en el documento, asi que el
// menu de "Cambiar la carta visualizada" se abria vacio.
//
// Solo mira las clases escritas en index.html: las que arma el JS no se
// cuentan.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ui = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const html = readFileSync(join(ui, 'index.html'), 'utf8');

function cuantasVeces() {
    const cuenta = new Map();
    for (const m of html.matchAll(/class="([^"]+)"/g))
        for (const c of m[1].trim().split(/\s+/)) cuenta.set(c, (cuenta.get(c) || 0) + 1);
    return cuenta;
}

describe('selectores de una sola clase', () => {
    const cuenta = cuantasVeces();
    const archivos = readdirSync(ui).filter((f) => f.endsWith('.js'));

    it('index.html tiene clases repetidas (si no, el control no controla nada)', () => {
        expect([...cuenta.values()].some((n) => n > 1)).toBe(true);
    });

    for (const f of archivos) {
        it(`${f}: cada $('.clase') encuentra una sola`, () => {
            const js = readFileSync(join(ui, f), 'utf8');
            const ambiguas = [...js.matchAll(/\$\('\.([a-zA-Z0-9_-]+)'\)/g)]
                .map((m) => m[1])
                .filter((c) => (cuenta.get(c) || 0) > 1);
            expect([...new Set(ambiguas)]).toEqual([]);
        });
    }
});

// La lista de vistas estuvo escrita cuatro veces (este arreglo en app.js
// y tres <select> a mano), y de ahi salio el parche de la v1.21.1: una
// vista que falta en uno de los tres deja el selector en blanco al
// entrar en ella, sin manera de volver. Ahora sale de VISTAS y los tres
// <select> nacen vacios. Este test es para que no vuelva.
describe('la lista de vistas vive en un solo lugar', () => {
    const selects = ['name="tipo"', 'id="selector-modo"', 'class="selector-completa"'];

    for (const sel of selects) {
        it(`el <select> con ${sel} no trae opciones escritas a mano`, () => {
            const i = html.indexOf(`<select ${sel}>`);
            expect(i, `no esta el <select ${sel}>`).toBeGreaterThan(-1);
            const cuerpo = html.slice(i, html.indexOf('</select>', i));
            expect(cuerpo).not.toContain('<option');
            expect(cuerpo).not.toContain('<optgroup');
        });
    }

    it('app.js las arma a las tres desde VISTAS', () => {
        const js = readFileSync(join(ui, 'app.js'), 'utf8');
        expect(js).toContain('const VISTAS = [');
        // Una llamada por cada uno de los tres <select>.
        expect(js.match(/opcionesDeVista\(/g)).toHaveLength(3);
    });

    it('cada vista de VISTAS tiene su id una sola vez', () => {
        const js = readFileSync(join(ui, 'app.js'), 'utf8');
        const lista = js.slice(js.indexOf('const VISTAS = ['), js.indexOf('const MODOS = VISTAS'));
        const ids = [...lista.matchAll(/\['([a-z0-9-]+)', '/g)].map((m) => m[1]);
        expect(ids.length).toBeGreaterThan(15);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('la lista va corrida, sin categorías', () => {
        // Se probaron con optgroup el 26/11/2026 y Seba las prefiere en
        // una sola lista larga, como estaban antes.
        const js = readFileSync(join(ui, 'app.js'), 'utf8');
        expect(js).not.toContain('<optgroup');
    });
});
