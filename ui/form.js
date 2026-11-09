// Formulario de datos de nacimiento y buscador de lugares con
// autocompletado (accesible con teclado: flechas, Enter, Escape).

import { crearBuscador } from '../places/search.js';
import { escapar } from './textos.js';

export const buscar = crearBuscador((clave) =>
    fetch(`${import.meta.env.BASE_URL}lugares/${clave}.json`).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
    }));

export const descripcionLugar = (l) =>
    [l.nombre, l.provincia, l.paisNombre].filter(Boolean).join(', ');

// Conecta el campo de lugar con su lista de sugerencias. `alElegir(lugar)`
// recibe el lugar elegido (o null si se borro el texto). sinResultados: el
// texto cuando no aparece nada (otras paginas no tienen carga manual).
// respaldo: una funcion async(texto) que devuelve lugares, para cuando el
// indice local no tiene ninguno. La calculadora no la usa (no consulta a
// terceros); la pasan los formularios del sitio, que preguntan a GeoNames.
export function conectarBuscador(input, lista, alElegir, {
    sinResultados = 'No encontramos ese lugar. Tocá ? para más info',
    respaldo = null
} = {}) {
    let resultados = [];
    let activo = -1;
    let pedido = 0;
    let espera;

    const cerrar = () => {
        lista.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        activo = -1;
    };

    const pintar = () => {
        if (!resultados.length) {
            lista.innerHTML = input.value.trim().length >= 3
                ? `<li class="sin-resultados" role="presentation">${escapar(sinResultados)}</li>`
                : '';
        } else {
            lista.innerHTML = resultados.map((l, i) => `<li id="${lista.id}-${i}" role="option" data-i="${i}" aria-selected="${i === activo}">
                <span class="lugar-nombre">${escapar(l.nombre)}</span>
                <span class="lugar-region">${escapar([l.provincia, l.paisNombre].filter(Boolean).join(', '))}</span></li>`).join('');
            // Hay nombres que se repiten en medio mundo (La Paz, San Jose):
            // el pueblo chico queda lejos en la lista y la persona cree que
            // no esta. Se avisa y se ensenia el truco: agregar la provincia.
            // Sin data-i: no se puede tocar ni se recorre con las flechas.
            if (resultados.total > resultados.length) {
                lista.insertAdjacentHTML('beforeend',
                    '<li class="sugerencia-pista" role="presentation">Hay más lugares con ese nombre. '
                    + 'Agregá la provincia o el país, por ejemplo <strong>Potrerillos, Mendoza</strong>.</li>');
            }
        }
        lista.hidden = !lista.innerHTML;
        input.setAttribute('aria-expanded', String(!lista.hidden));
        if (activo >= 0) input.setAttribute('aria-activedescendant', `${lista.id}-${activo}`);
    };

    const elegir = (i) => {
        const l = resultados[i];
        if (!l) return;
        input.value = descripcionLugar(l);
        cerrar();
        alElegir(l);
    };

    input.addEventListener('input', () => {
        alElegir(null);
        clearTimeout(espera);
        const texto = input.value;
        espera = setTimeout(async () => {
            const n = ++pedido;
            let r = await buscar(texto);
            if (n !== pedido) return; // llego tarde: ya hay otra busqueda
            if (!r.length && respaldo) {
                try { r = await respaldo(texto) || []; } catch { r = []; }
                if (n !== pedido) return; // el respaldo tarda: puede haber quedado viejo
            }
            resultados = r;
            activo = -1;
            pintar();
        }, 150);
    });

    input.addEventListener('keydown', (e) => {
        if (lista.hidden) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const n = resultados.length;
            activo = (activo + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
            pintar();
        } else if (e.key === 'Enter' && activo >= 0) {
            e.preventDefault();
            elegir(activo);
        } else if (e.key === 'Escape') {
            cerrar();
        }
    });

    // Con el mouse se elige en pointerdown, antes de que el blur cierre la
    // lista. Con el dedo no: ahi hay que poder arrastrar para recorrerla,
    // asi que se espera a levantar el dedo y solo cuenta si no se movio.
    let toque = null;
    lista.addEventListener('pointerdown', (e) => {
        const li = e.target.closest('[data-i]');
        if (!li) return;
        if (e.pointerType === 'mouse') {
            e.preventDefault();
            elegir(+li.dataset.i);
            return;
        }
        toque = { i: +li.dataset.i, x: e.clientX, y: e.clientY };
    });
    lista.addEventListener('pointerup', (e) => {
        if (!toque) return;
        const li = e.target.closest('[data-i]');
        const quieto = Math.hypot(e.clientX - toque.x, e.clientY - toque.y) < 10;
        if (li && Number(li.dataset.i) === toque.i && quieto) elegir(toque.i);
        toque = null;
    });
    lista.addEventListener('pointercancel', () => { toque = null; });
    input.addEventListener('blur', () => setTimeout(cerrar, 100));
}

// Zonas horarias para la carga manual de lugar.
export function opcionesZonas(seleccionada) {
    let zonas = [];
    try { zonas = Intl.supportedValuesOf('timeZone'); } catch {}
    if (!zonas.length) zonas = ['America/Argentina/Buenos_Aires', 'America/Montevideo', 'Europe/Madrid', 'UTC'];
    return zonas.map((z) => `<option value="${z}" ${z === seleccionada ? 'selected' : ''}>${z.replace(/_/g, ' ')}</option>`).join('');
}

// "-34.65", "-34,65", "34°39'S", "34 39 S" -> -34.65 (o NaN)
export function parsearCoordenada(texto, positivo, negativo) {
    const t = texto.trim().toUpperCase().replace(',', '.');
    if (/^[-+]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    const m = t.match(/^(\d+)[^\dA-Z]+(\d+)(?:[^\dA-Z]+(\d+(?:\.\d+)?))?[^\dA-Z]*([A-Z])?$/);
    if (!m) return NaN;
    const valor = +m[1] + +m[2] / 60 + (+m[3] || 0) / 3600;
    const letra = m[4];
    if (letra && !positivo.includes(letra) && !negativo.includes(letra)) return NaN;
    return negativo.includes(letra) ? -valor : valor;
}
