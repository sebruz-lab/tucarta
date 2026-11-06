// Dibujo de las efemerides graficas (engine/efemerides.js): el tiempo en
// horizontal, el grado dentro del modulo en vertical (0° arriba, como en
// Solar Fire). Cada planeta en transito es una linea que se corta cuando
// pasa de un borde al otro (en modulo 30, el cambio de signo, marcado arriba
// o abajo con el planeta y el signo al que entra). Cada punto natal es una
// linea punteada; cada cruce, el glifo del aspecto exacto.

import { SIGNOS as G_SIGNOS, PUNTOS as G_PUNTOS, ASPECTOS as G_ASPECTOS, glifo } from './glyphs.js';
import { fechaDeJd, jdDeFecha } from './calendario.js';

const SIGNOS = ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const COLOR_ASPECTO = {
    trigono: 'c-armonico', sextil: 'c-armonico', conjuncion: 'c-conjuncion',
    cuadratura: 'c-tenso', oposicion: 'c-tenso', semicuadratura: 'c-tenso', sesquicuadratura: 'c-tenso',
    semisextil: 'c-semisextil', quincuncio: 'c-quincuncio'
};

// Medidas del grafico (unidades del viewBox).
export const MEDIDAS = { ancho: 1200, alto: 700, izq: 84, der: 84, arriba: 80, abajo: 44 };
const f = (n) => n.toFixed(1);
const norm = (x, m) => ((x % m) + m) % m;

// Posicion en el grafico de un dia (jd) y un grado; y al reves (para leer
// donde esta el mouse).
export function geometria(e) {
    const { ancho, alto, izq, der, arriba, abajo } = MEDIDAS;
    const w = ancho - izq - der;
    const h = alto - arriba - abajo;
    return {
        x: (jd) => izq + ((jd - e.inicio) / e.dias) * w,
        y: (g) => arriba + (g / e.modulo) * h,
        jd: (x) => e.inicio + ((x - izq) / w) * e.dias,
        grado: (y) => ((y - arriba) / h) * e.modulo,
        dentro: (x, y) => x >= izq && x <= ancho - der && y >= arriba && y <= alto - abajo
    };
}

const glifoPunto = (id, x, y, t) => (G_PUNTOS[id]
    ? glifo(G_PUNTOS[id], x, y, t)
    : `<text x="${f(x)}" y="${f(y)}" class="ef-angulo">${id === 'asc' ? 'AC' : 'MC'}</text>`);
const signoDe = (lon) => SIGNOS[Math.floor(norm(lon, 360) / 30)];

// Separa rotulos ordenados por `y` para que queden al menos a `paso` (deja
// la posicion final en `ry`).
function separar(lista, paso) {
    lista.forEach((r, i) => { r.ry = i ? Math.max(r.y, lista[i - 1].ry + paso) : r.y; });
}

export function dibujarEfemerides(e, { hoy = null } = {}) {
    const { ancho, alto, izq, der, arriba, abajo } = MEDIDAS;
    const g = geometria(e);
    const out = [];
    const fin = e.inicio + e.dias;

    // Fondo, grilla de grados y rotulos de la izquierda.
    out.push(`<rect class="ef-fondo" x="${izq}" y="${arriba}" width="${ancho - izq - der}" height="${alto - arriba - abajo}"/>`);
    // Una linea por grado (como las de los meses), apenas mas marcadas cada
    // 5°; los rotulos, cada 5° (cada 10° en modulo 90).
    const paso = e.modulo === 90 ? 10 : 5;
    for (let d = 0; d <= e.modulo; d++) {
        out.push(`<line class="ef-grilla${d % 5 === 0 ? ' ef-grilla-5' : ''}" x1="${izq}" x2="${ancho - der}" y1="${f(g.y(d))}" y2="${f(g.y(d))}"/>`);
        if (d % paso === 0) out.push(`<text class="ef-grado" x="${izq - 4}" y="${f(g.y(d))}">${d}°</text>`);
    }

    // Anios y meses arriba.
    const d0 = fechaDeJd(e.inicio);
    const mesAncho = (ancho - izq - der) / (e.dias / 30.44);
    for (let k = 0; ; k++) {
        const ini = new Date(d0.getFullYear(), d0.getMonth() + k, 1);
        const jd0 = jdDeFecha(ini);
        if (jd0 >= fin) break;
        const jd1 = Math.min(jdDeFecha(new Date(ini.getFullYear(), ini.getMonth() + 1, 1)), fin);
        const x0 = g.x(Math.max(jd0, e.inicio));
        const x1 = g.x(jd1);
        out.push(`<line class="${ini.getMonth() === 0 ? 'ef-anio-linea' : 'ef-mes-linea'}" x1="${f(x0)}" x2="${f(x0)}" y1="${ini.getMonth() === 0 ? arriba - 64 : arriba - 50}" y2="${alto - abajo}"/>`);
        const rotulo = mesAncho >= 30 ? MESES[ini.getMonth()] : mesAncho >= 12 ? MESES[ini.getMonth()][0] : '';
        if (rotulo) out.push(`<text class="ef-mes" x="${f((x0 + x1) / 2)}" y="${arriba - 38}">${rotulo}</text>`);
        if (ini.getMonth() === 0 || k === 0) {
            const xFinAnio = g.x(Math.min(jdDeFecha(new Date(ini.getFullYear() + 1, 0, 1)), fin));
            out.push(`<text class="ef-anio" x="${f((x0 + xFinAnio) / 2)}" y="${arriba - 56}">${ini.getFullYear()}</text>`);
        }
    }

    // Hoy.
    if (hoy != null && hoy > e.inicio && hoy < fin) {
        out.push(`<line class="ef-hoy" x1="${f(g.x(hoy))}" x2="${f(g.x(hoy))}" y1="${arriba}" y2="${alto - abajo}"/>`);
    }

    // Puntos natales: linea punteada y, a la derecha, el glifo y su signo
    // (los rotulos se separan si caen muy juntos).
    const rotulos = e.natales
        .map((n) => ({ ...n, y: g.y(norm(n.lon, e.modulo)) }))
        .sort((a, b) => a.y - b.y);
    for (const n of rotulos) {
        out.push(`<line class="ef-natal" data-punto="${n.id}" x1="${izq}" x2="${ancho - der}" y1="${f(n.y)}" y2="${f(n.y)}"/>`);
    }
    separar(rotulos, 18);
    for (const n of rotulos) {
        const ry = n.ry ?? n.y;
        const x = ancho - der + 14;
        if (Math.abs(ry - n.y) > 1) out.push(`<line class="ef-guia" x1="${ancho - der}" x2="${x - 8}" y1="${f(n.y)}" y2="${f(ry)}"/>`);
        out.push(`<g class="punto" data-punto="${n.id}">${glifoPunto(n.id, x, ry, 18.7)}</g>`);
        const signo = signoDe(n.lon);
        out.push(`<g class="ef-signo">${glifo(G_SIGNOS[signo], x + 24, ry, 14.4, '', `elem-${['fuego', 'tierra', 'aire', 'agua'][SIGNOS.indexOf(signo) % 4]}`)}</g>`);
    }

    // Planetas en transito: una linea por tramo (se corta al pasar de un
    // borde al otro del modulo).
    for (const l of e.lineas) {
        const tramos = [];
        let tramo = [];
        l.lons.forEach((lon, k) => {
            const m = norm(lon, e.modulo);
            if (k > 0) {
                const prev = norm(l.lons[k - 1], e.modulo);
                if (Math.abs(m - prev) > e.modulo / 2) {
                    tramos.push(tramo);
                    tramo = [];
                    // En modulo 30 el corte es un cambio de signo: arriba si
                    // entra avanzando, abajo si vuelve retrogrado.
                    if (e.modulo === 30) {
                        const x = g.x(e.inicio + k);
                        const directo = m < prev;
                        const y = directo ? arriba - 8 : alto - abajo + 12;
                        const signo = signoDe(lon);
                        out.push(`<g class="punto ef-ingreso" data-punto="${l.id}">${glifo(G_PUNTOS[l.id], x, directo ? y - 17 : y, 15.8)}</g>`);
                        out.push(`<g class="ef-signo">${glifo(G_SIGNOS[signo], x, directo ? y : y + 17, 13.2, '', `elem-${['fuego', 'tierra', 'aire', 'agua'][SIGNOS.indexOf(signo) % 4]}`)}</g>`);
                    }
                }
            }
            tramo.push(`${f(g.x(e.inicio + k))},${f(g.y(m))}`);
        });
        tramos.push(tramo);
        for (const t of tramos.filter((x) => x.length > 1)) {
            out.push(`<polyline class="ef-linea" data-punto="${l.id}" points="${t.join(' ')}"/>`);
        }
    }

    // A la izquierda, cada planeta en transito donde empieza, con su signo
    // (separados si caen juntos).
    const inicios = e.lineas.map((l) => ({ id: l.id, lon: l.lons[0], y: g.y(norm(l.lons[0], e.modulo)) })).sort((a, b) => a.y - b.y);
    separar(inicios, 18);
    for (const p of inicios) {
        const ry = p.ry ?? p.y;
        if (Math.abs(ry - p.y) > 1) out.push(`<line class="ef-guia" x1="${izq - 4}" x2="${izq - 12}" y1="${f(p.y)}" y2="${f(ry)}"/>`);
        out.push(`<g class="punto" data-punto="${p.id}">${glifo(G_PUNTOS[p.id], izq - 64, ry, 17.3)}</g>`);
        const signo = signoDe(p.lon);
        out.push(`<g class="ef-signo">${glifo(G_SIGNOS[signo], izq - 42, ry, 14.4, '', `elem-${['fuego', 'tierra', 'aire', 'agua'][SIGNOS.indexOf(signo) % 4]}`)}</g>`);
    }

    // Cruces: el glifo del aspecto exacto (con un circulo para tocarlo).
    e.cruces.forEach((c, i) => {
        const x = g.x(c.jd);
        const y = g.y(c.grado);
        out.push(`<g class="ef-cruce" data-cruce="${i}" tabindex="0" role="button">` +
            `<circle class="ef-toque" cx="${f(x)}" cy="${f(y)}" r="6.5"/>` +
            glifo(G_ASPECTOS[c.aspecto], x, y, 8, '', `glifo-aspecto ${COLOR_ASPECTO[c.aspecto]}`, 1.3) + '</g>');
    });

    // Cursor: linea y lectura de fecha y grado (las mueve app.js).
    out.push(`<line class="ef-cursor" x1="0" x2="0" y1="${arriba}" y2="${alto - abajo}" visibility="hidden"/>`);
    out.push(`<text class="ef-lectura" x="0" y="${arriba + 14}" visibility="hidden"></text>`);

    return `<svg class="ef-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Efemérides gráficas">${out.join('')}</svg>`;
}
