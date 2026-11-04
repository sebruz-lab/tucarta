// Anexos de la carta para la impresion y la imagen: lo que necesita quien no
// conoce los simbolos.
//   - Grilla de aspectos: triangular (como la de Solar Fire) con los
//     puntos de una carta; cuadrada en las cartas dobles (los de afuera en
//     filas y los natales en columnas). Glifo del aspecto con los colores de
//     la rueda.
//   - Planetas: glifo y nombre.
//   - Signos: glifo (en el color de su elemento) y nombre; debajo, los
//     aspectos que aparecen en la grilla, con su nombre.
// Va en una sola fila debajo de la rueda, con el mismo ancho (664 unidades,
// las de la rueda), asi la rueda no se achica.

import { SIGNOS as G_SIGNOS, PUNTOS as G_PUNTOS, ASPECTOS as G_ASPECTOS, glifo } from './glyphs.js';
import { ASPECTOS } from '../engine/config.js';

const SIGNOS = ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'];
const NOMBRE_SIGNO = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];
const ELEMENTOS = ['fuego', 'tierra', 'aire', 'agua'];
const COLOR_ASPECTO = {
    trigono: 'c-armonico', sextil: 'c-armonico', conjuncion: 'c-conjuncion',
    cuadratura: 'c-tenso', oposicion: 'c-tenso', semicuadratura: 'c-tenso', sesquicuadratura: 'c-tenso',
    semisextil: 'c-semisextil', quincuncio: 'c-quincuncio'
};

export const ANCHO = 664;
// Lado de cada casillero: un poco menor en la grilla cuadrada (tiene un
// renglon mas, el de los encabezados) para que entre en la hoja.
const C_TRIANGULAR = 15;
const C_CUADRADA = 13;
const RENGLON = 15;  // alto de cada renglon de las tablas
const ESPACIO = 22;  // entre bloques
const f = (n) => Number(n.toFixed(1));

const texto = (x, y, t, clase = '', extra = '') =>
    `<text class="${clase}" x="${f(x)}" y="${f(y)}" ${extra}>${t}</text>`;
// Glifo de un punto; los angulos van como texto (AC, MC).
const glifoPunto = (id, x, y, t) => (G_PUNTOS[id]
    ? `<g class="punto" data-punto="${id}">${glifo(G_PUNTOS[id], x, y, t)}</g>`
    : texto(x, y, id === 'asc' ? 'AC' : 'MC', 'anexo-angulo'));

// filas/columnas: ids de los puntos; aspectos: [{ a, b, aspecto }] (a de
// filas, b de columnas). triangular: filas y columnas son la misma carta.
function grilla({ filas, columnas, aspectos, triangular, titulo }) {
    const C = triangular ? C_TRIANGULAR : C_CUADRADA;
    const out = [];
    const clave = (a, b) => `${a}|${b}`;
    const asp = new Map();
    for (const x of aspectos) {
        asp.set(clave(x.a, x.b), x.aspecto);
        if (triangular) asp.set(clave(x.b, x.a), x.aspecto);
    }
    const celda = (x, y, a, b) => {
        out.push(`<rect class="anexo-celda" x="${f(x)}" y="${f(y)}" width="${C}" height="${C}"/>`);
        const id = asp.get(clave(a, b));
        if (id && G_ASPECTOS[id]) out.push(glifo(G_ASPECTOS[id], x + C / 2, y + C / 2, C - 5, '', `glifo-aspecto ${COLOR_ASPECTO[id] || ''}`, 1.3));
    };
    let ancho, alto;
    const y0 = titulo ? 14 : 0;
    if (titulo) out.push(texto(0, 9, titulo.toUpperCase(), 'anexo-titulo'));
    if (triangular) {
        // Escalera: el punto en la diagonal y sus aspectos a la izquierda.
        filas.forEach((a, i) => {
            const y = y0 + i * C;
            out.push(`<rect class="anexo-celda anexo-diagonal" x="${i * C}" y="${f(y)}" width="${C}" height="${C}"/>`);
            out.push(glifoPunto(a, i * C + C / 2, y + C / 2, 11));
            for (let j = 0; j < i; j++) celda(j * C, y, a, filas[j]);
        });
        ancho = filas.length * C;
        alto = y0 + filas.length * C;
    } else {
        // Cuadrada: natales arriba, los de afuera a la izquierda.
        columnas.forEach((b, j) => out.push(glifoPunto(b, C + j * C + C / 2, y0 + C / 2, 11)));
        filas.forEach((a, i) => {
            const y = y0 + C + i * C;
            out.push(glifoPunto(a, C / 2, y + C / 2, 11));
            columnas.forEach((b, j) => celda(C + j * C, y, a, b));
        });
        ancho = C + columnas.length * C;
        alto = y0 + C + filas.length * C;
    }
    return { svg: out.join(''), ancho, alto };
}

// Tabla de glifo y nombre en `cols` columnas.
function tabla(items, { cols = 2, anchoCol = 88, titulo }) {
    const out = [];
    const y0 = titulo ? 14 : 0;
    if (titulo) out.push(texto(0, 9, titulo.toUpperCase(), 'anexo-titulo'));
    const porCol = Math.ceil(items.length / cols);
    items.forEach((it, k) => {
        const x = Math.floor(k / porCol) * anchoCol;
        const y = y0 + (k % porCol) * RENGLON + RENGLON / 2;
        out.push(it.glifo(x + 6, y));
        out.push(texto(x + 16, y, it.nombre, 'anexo-nombre'));
    });
    return { svg: out.join(''), ancho: cols * anchoCol, alto: y0 + porCol * RENGLON };
}

// incluir: { planetas, signos, aspectos } (lo que eligio la persona).
// puntos: ids de los puntos de la carta (para la tabla de planetas).
// nombres: { sol: 'Sol', ... }. Devuelve '' si no hay nada que incluir.
export function dibujarAnexo({ incluir, puntos, nombres, filas, columnas, aspectos, triangular, tituloGrilla }) {
    const bloques = [];
    if (incluir.aspectos) bloques.push(grilla({ filas, columnas, aspectos, triangular, titulo: tituloGrilla }));
    if (incluir.planetas) {
        bloques.push(tabla(puntos.map((id) => ({
            nombre: nombres[id] || id,
            glifo: (x, y) => glifoPunto(id, x, y, 11)
        })), { titulo: 'Planetas y puntos' }));
    }
    if (incluir.signos || incluir.aspectos) {
        // Signos y, debajo, los aspectos que aparecen en la grilla.
        const partes = [];
        let alto = 0;
        let ancho = 0;
        if (incluir.signos) {
            const t = tabla(SIGNOS.map((s, i) => ({
                nombre: NOMBRE_SIGNO[i],
                glifo: (x, y) => glifo(G_SIGNOS[s], x, y, 11, '', `elem-${ELEMENTOS[i % 4]}`)
            })), { titulo: 'Signos' });
            partes.push(t.svg);
            alto = t.alto;
            ancho = t.ancho;
        }
        if (incluir.aspectos) {
            const presentes = ASPECTOS.filter((a) => aspectos.some((x) => x.aspecto === a.id));
            if (presentes.length) {
                const t = tabla(presentes.map((a) => ({
                    nombre: a.nombre,
                    glifo: (x, y) => glifo(G_ASPECTOS[a.id], x, y, 10, '', `glifo-aspecto ${COLOR_ASPECTO[a.id] || ''}`, 1.3)
                })), { titulo: 'Aspectos' });
                const dy = alto ? alto + 12 : 0;
                partes.push(`<g transform="translate(0 ${dy})">${t.svg}</g>`);
                alto = dy + t.alto;
                ancho = Math.max(ancho, t.ancho);
            }
        }
        if (partes.length) bloques.push({ svg: partes.join(''), ancho, alto });
    }
    if (!bloques.length) return '';

    // En una fila, centrados en el ancho de la rueda.
    const total = bloques.reduce((s, b) => s + b.ancho, 0) + ESPACIO * (bloques.length - 1);
    let x = Math.max(0, (ANCHO - total) / 2);
    const alto = Math.max(...bloques.map((b) => b.alto));
    const out = bloques.map((b) => {
        const g = `<g transform="translate(${f(x)} 0)">${b.svg}</g>`;
        x += b.ancho + ESPACIO;
        return g;
    });
    return `<svg class="anexo" viewBox="0 0 ${ANCHO} ${f(alto + 2)}" role="img" aria-label="Referencias de la carta">${out.join('')}</svg>`;
}
