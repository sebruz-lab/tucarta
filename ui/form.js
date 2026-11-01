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
export function conectarBuscador(input, lista, alElegir, {
    sinResultados = 'No encontramos ese lugar. Probá con otra forma de escribirlo o cargá las coordenadas a mano.'
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
            const r = await buscar(texto);
            if (n !== pedido) return; // llego tarde: ya hay otra busqueda
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

    // pointerdown para elegir antes de que el blur cierre la lista.
    lista.addEventListener('pointerdown', (e) => {
        const li = e.target.closest('[data-i]');
        if (li) {
            e.preventDefault();
            elegir(+li.dataset.i);
        }
    });
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
