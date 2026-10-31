// Glifos astrologicos como trazos SVG en una caja de 20x20. No se usan los
// caracteres Unicode (♈ ☉ ...) porque muchos celulares los muestran como
// emoji de colores y con tamaños dispares.
//
// Cada glifo: { d: trazos (stroke, sin relleno), r?: [cx, cy, radio] circulos
// con trazo, p?: [cx, cy, radio] puntos rellenos, f?: { d, caja: [x, y, ancho,
// alto] } forma rellena dibujada en otro lienzo, que se encaja en la caja }.

export const SIGNOS = {
    aries: { d: 'M3 8C3 2.5 10 2.5 10 9V18M10 9C10 2.5 17 2.5 17 8' },
    tauro: { d: 'M3 3C5 8.5 15 8.5 17 3', r: [[10, 13, 5]] },
    geminis: { d: 'M4 3.5Q10 6 16 3.5M4 16.5Q10 14 16 16.5M7.5 5V15M12.5 5V15' },
    cancer: { d: 'M6 4.8C10 3 14 3.5 17 6.5M14 15.2C10 17 6 16.5 3 13.5', r: [[6, 7.2, 2.3], [14, 12.8, 2.3]] },
    leo: { d: 'M8.4 12.5C8 8 5.5 4.5 10 3.5C14.5 2.8 15 7.5 12.2 11.5C10.2 14.5 11.5 18 16 16', r: [[6, 13, 2.5]] },
    virgo: { d: 'M3 5V15M3 7.5C3 4 7 4 7 7.5V15M7 7.5C7 4 11 4 11 7.5V14.5C11 17.5 13 18 15 16.5M11 11C12.5 8.5 16.5 9 15.5 12.5C15 14.5 13 16 11 16.5' },
    libra: { d: 'M3 16.5H17M3 13H7C5 7 15 7 13 13H17' },
    escorpio: { d: 'M3 5V15M3 7.5C3 4 7 4 7 7.5V15M7 7.5C7 4 11 4 11 7.5V14C11 16.5 13 17 16.5 15M14 12.5L16.5 15L14 17.5' },
    sagitario: { d: 'M4 16L16 4M10 4H16V10M6.5 10L10 13.5' },
    capricornio: { d: 'M3 5L6 15L8.5 6.5C9.5 4 13 4 13 8V13C13 17 17.5 17.5 17.5 14C17.5 11 13.5 11 13 14.5C12.5 17.5 10 18 8.5 16.5' },
    acuario: { d: 'M3 8.5L6 6.5L9 8.5L12 6.5L15 8.5L17 7.2M3 14L6 12L9 14L12 12L15 14L17 12.7' },
    piscis: { d: 'M5 3C9.5 7 9.5 13 5 17M15 3C10.5 7 10.5 13 15 17M4 10H16' }
};

export const PUNTOS = {
    sol: { d: '', r: [[10, 10, 6.5]], p: [[10, 10, 1.4]] },
    // Dibujo de Seba (Illustrator).
    luna: { f: { caja: [293.9, 243.65, 481.01, 930.08], d: 'M758.93,243.65c10.65,4,15.98,10.39,15.98,19.18,0,11.72-17.05,18.12-51.14,19.18-28.5,7.19-58.33,27.44-89.49,60.73-42.35,48.48-73.25,111.33-92.69,188.57-13.85,56.2-20.77,109.47-20.77,159.8v35.16c0,123.32,31.96,232.51,95.88,327.6,18.38,24.24,39.15,44.48,62.32,60.73,25.03,15.98,52.2,23.97,81.5,23.97,8.52,4.79,12.78,10.12,12.78,15.98v3.2c0,9.33-6.93,14.65-20.77,15.98-79.37,0-159.8-23.97-241.3-71.91-26.11-14.38-60.73-44.21-103.87-89.49-75.64-91.62-113.46-192.83-113.46-303.63,0-117.46,42.08-223.46,126.24-318.01,97.74-98.01,210.67-147.02,338.78-147.02ZM329.06,697.49v22.37c0,107.87,42.61,206.42,127.84,295.64,43.95,40.75,82.83,67.92,116.66,81.5,18.38,9.59,36.49,16.52,54.33,20.77-47.94-51.67-80.97-104.4-99.08-158.21-28.76-82.03-43.15-165.66-43.15-250.89,0-143.82,35.69-267.4,107.07-370.74l35.16-38.35h-3.2c-52.47,17.05-97.75,42.09-135.83,75.11-24.24,17.05-49.28,42.62-75.11,76.71-56.47,78.57-84.7,160.6-84.7,246.1Z' } },
    mercurio: { d: 'M10 13.2V18.5M7.8 16H12.2M6.5 2.5C7 6 13 6 13.5 2.5', r: [[10, 9.8, 3.4]] },
    venus: { d: 'M10 11.5V18.5M7 15.3H13', r: [[10, 7, 4.5]] },
    marte: { d: 'M11.3 8.7L16.5 3.5M12 3.5H16.5V8', r: [[8, 12, 4.6]] },
    jupiter: { d: 'M4.5 6.5C4.5 3 10 3 9 7.5L4 13.5H16.5M13 4V18' },
    saturno: { d: 'M6.5 2.5V15M4 5H9M6.5 9.5C8.5 6.5 13.5 7 12.5 11.5L10 15C9.2 16.8 11.8 18.5 13.8 16.5' },
    urano: { d: 'M5 3V13M15 3V13M5 8H15M10 3V13.5', r: [[10, 16, 2]] },
    neptuno: { d: 'M4 4C4 11.5 16 11.5 16 4M10 3V18.5M7 15.5H13M3 5.5L4 3.5L5 5.5M15 5.5L16 3.5L17 5.5M9 4.5L10 2.5L11 4.5' },
    pluton: { d: 'M4.5 5.5C4.5 13.5 15.5 13.5 15.5 5.5M10 11.8V18.5M7 15.5H13', r: [[10, 5.8, 2.6]] },
    nodo: { d: 'M6 14.5C1.5 11.5 3 4 10 4C17 4 18.5 11.5 14 14.5', r: [[6, 16, 1.9], [14, 16, 1.9]] },
    lilith: { d: 'M12.5 2.5A5.4 5.4 0 1 0 12.5 13.3A4.2 4.2 0 1 1 12.5 2.5ZM9.6 13.4V18.8M7.2 16.2H12' },
    quiron: { d: 'M10 12V2.5M10 7.5L15 3.5M10 7.5L15 11', r: [[10, 15, 3]] }
};

export const ASPECTOS = {
    conjuncion: { d: 'M13 7L17 3', r: [[9, 11, 4.2]] },
    sextil: { d: 'M10 3V17M4 6.5L16 13.5M4 13.5L16 6.5' },
    cuadratura: { d: 'M4 4H16V16H4Z' },
    trigono: { d: 'M10 3.5L17 16H3Z' },
    oposicion: { d: 'M7.2 12.8L12.8 7.2', r: [[5, 15, 2.8], [15, 5, 2.8]] },
    semisextil: { d: 'M5 4L10 13L15 4M4 16H16' },
    quincuncio: { d: 'M4 4H16M5 16L10 7L15 16' },
    semicuadratura: { d: 'M16 4L4 16H16' },
    sesquicuadratura: { d: 'M3 9H11V17H3ZM11 9L17 3' }
};

// Escala una forma para que ocupe 15.5 de alto, centrada en la caja de 20.
function encajar([x, y, ancho, alto]) {
    const e = 15.5 / alto;
    return `translate(10 10) scale(${e.toFixed(5)}) translate(${-(x + ancho / 2)} ${-(y + alto / 2)})`;
}

// Devuelve el SVG interno de un glifo, centrado en (x, y) con tamaño `t`.
// `extra`: atributos adicionales; `clase`: clases CSS que se suman;
// `grosor`: multiplica el ancho del trazo.
export function glifo(g, x, y, t = 20, extra = '', clase = '', grosor = 1) {
    const s = t / 20;
    const partes = [];
    if (g.d) partes.push(`<path d="${g.d}"/>`);
    for (const [cx, cy, r] of g.r || []) partes.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
    for (const [cx, cy, r] of g.p || []) partes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`);
    if (g.f) partes.push(`<path d="${g.f.d}" fill="currentColor" stroke="none" transform="${encajar(g.f.caja)}"/>`);
    return `<g class="glifo${clase ? ' ' + clase : ''}" ${extra} transform="translate(${(x - t / 2).toFixed(2)} ${(y - t / 2).toFixed(2)}) scale(${s})" ` +
        `fill="none" stroke="currentColor" stroke-width="${(1.5 * grosor / Math.max(s, 0.6)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${partes.join('')}</g>`;
}

// Glifo suelto como <svg> inline (para tablas y textos).
export function iconoSvg(g, t = 18, titulo = '', clase = '', grosor = 1) {
    return `<svg class="icono${clase ? ' ' + clase : ''}" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}" role="img" aria-label="${titulo}">` +
        `${glifo(g, t / 2, t / 2, t, '', '', grosor)}</svg>`;
}
