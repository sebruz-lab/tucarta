// Buscador de lugares sobre los fragmentos estaticos de ui/public/lugares/.
// No toca el DOM ni la red directamente: recibe `cargar(clave)`, que
// devuelve el JSON de un fragmento (fetch en el navegador, fs en tests).

import { normalizar, VACIAS } from './normalizar.js';

// Prioridad de pais a igual coincidencia: el publico de la v1.
const PRIORIDAD = { AR: 3, UY: 2, ES: 1 };

let nombresPais = null;
export function nombrePais(codigo) {
    try {
        nombresPais ||= new Intl.DisplayNames(['es'], { type: 'region' });
        return nombresPais.of(codigo);
    } catch {
        return codigo;
    }
}

export function crearBuscador(cargar) {
    const cache = new Map();
    const fragmento = (k) => {
        if (!cache.has(k)) cache.set(k, cargar(k).catch(() => []));
        return cache.get(k);
    };
    let partidos = null;

    return async function buscar(texto, { limite = 8 } = {}) {
        const palabras = normalizar(texto).split(' ').filter(Boolean);
        const guias = palabras.filter((p) => p.length >= 3 && !VACIAS.has(p));
        if (!guias.length) return [];

        // Fragmento de cada palabra. Se usa el de una palabra cuyo fragmento
        // este completo (no partido); entre esas, la mas larga.
        partidos ||= new Set(await cargar('partidos'));
        const claveDe = (p) => {
            let k = p.slice(0, 3);
            while (partidos.has(k) && p.length > k.length) k = p.slice(0, k.length + 1);
            return k;
        };
        const opciones = guias.map((p) => ({ p, k: claveDe(p) }))
            .sort((a, b) => partidos.has(a.k) - partidos.has(b.k) || b.p.length - a.p.length);
        const clave = opciones[0].k;

        const consulta = palabras.join(' ');
        const resultados = [];
        for (const [nombre, provincia, pais, lat, lon, zona, poblacion] of await fragmento(clave)) {
            const n = normalizar(nombre);
            const pajar = (n + ' ' + normalizar(provincia) + ' ' + normalizar(nombrePais(pais))).split(' ');
            if (!palabras.every((p) => pajar.some((w) => w.startsWith(p)))) continue;
            const puntaje =
                (n === consulta ? 4 : 0) +
                (n.startsWith(consulta) ? 2 : 0) +
                (PRIORIDAD[pais] || 0) / 2 +
                Math.log10(poblacion + 1) / 2;
            resultados.push({ nombre, provincia, pais, paisNombre: nombrePais(pais), lat, lon, zona, poblacion, puntaje });
        }
        return resultados
            .sort((a, b) => b.puntaje - a.puntaje || b.poblacion - a.poblacion)
            .slice(0, limite);
    };
}
