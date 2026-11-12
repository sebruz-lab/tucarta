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
