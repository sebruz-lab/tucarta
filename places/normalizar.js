// Normalizacion compartida por el armado del indice y el buscador: sin
// tildes, sin mayusculas, ñ -> n, solo letras y numeros.

export function normalizar(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Palabras que no sirven para buscar (casi todos los lugares las tienen).
export const VACIAS =new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en']);

// Claves de fragmento: las 3 primeras letras de cada palabra con sentido.
export function clavesDe(nombre) {
    const claves = new Set();
    for (const p of normalizar(nombre).split(' ')) {
        if (p.length >= 3 && !VACIAS.has(p)) claves.add(p.slice(0, 3));
    }
    return claves;
}
