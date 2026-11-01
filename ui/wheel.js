// Rueda de la carta en SVG. Recibe el modelo de engine/chart.js.
//
// Esta pensada en anillos: la v1 dibuja uno (natal); para transitos o
// revolucion solar se pasa un segundo anillo de puntos por fuera.
//
// Orientacion clasica: Ascendente a la izquierda, el zodiaco avanza en
// sentido antihorario.

import { SIGNOS as G_SIGNOS, PUNTOS as G_PUNTOS, ASPECTOS as G_ASPECTOS, glifo } from './glyphs.js';
import { SIGNOS } from '../engine/chart.js';

// De afuera hacia adentro: signos, columnas de los planetas, numeros de
// casa y aspectos.
const R_BASE = {
    exterior: 294,   // borde del anillo de signos
    signos: 254,     // borde interior del anillo de signos (arriba de las columnas)
    casas: 150,      // linea que separa los planetas del anillo de numeros de casa
    numeros: 139,    // numeros de casa
    aspectos: 128    // circulo interior donde llegan los aspectos
};
// La natal dentro de la revolucion: sin aspectos, el centro se achica y
// los planetas ganan lugar (antes de escalar).
// Los numeros de casa van del lado de adentro, junto al centro, y los
// planetas ocupan el anillo que dejan libre.
const R_NATAL_EN_RS = { exterior: 294, signos: 254, casas: 72, numeros: 56, aspectos: 40 };

// Clase de linea de cada aspecto (los colores estan en tucarta.css).
const CLASE_ASPECTO = {
    trigono: 'asp-armonico', sextil: 'asp-armonico',
    cuadratura: 'asp-tenso', oposicion: 'asp-tenso',
    semicuadratura: 'asp-tenso asp-menor', sesquicuadratura: 'asp-tenso asp-menor',
    semisextil: 'asp-semisextil asp-menor', quincuncio: 'asp-quincuncio asp-menor'
};
// Color del glifo que va en el medio de cada linea de aspecto.
const COLOR_ASPECTO = {
    trigono: 'c-armonico', sextil: 'c-armonico',
    cuadratura: 'c-tenso', oposicion: 'c-tenso', semicuadratura: 'c-tenso', sesquicuadratura: 'c-tenso',
    semisextil: 'c-semisextil', quincuncio: 'c-quincuncio'
};
const ELEMENTOS = ['fuego', 'tierra', 'aire', 'agua']; // Aries, Tauro, Geminis, Cancer...

const rad = (g) => (g * Math.PI) / 180;

function crearPolar(asc) {
    // Longitud ecliptica -> punto en pantalla (y hacia abajo).
    return (lon, r) => {
        const a = rad(lon - asc);
        return [-r * Math.cos(a), r * Math.sin(a)];
    };
}

const f = (n) => n.toFixed(2);

// Ubica los glifos de los planetas sin que se pisen y sin sacarlos de la
// casa en la que caen: dentro de cada casa se reparten entre las dos
// cuspides, dejando medio glifo de margen para no cruzar la linea. Si la
// casa esta muy cargada se acercan mas (y el glifo se achica); si aun asi
// no entran, el grupo desborda la cuspide lo minimo indispensable, como
// hace Solar Fire.
//
// Devuelve, por planeta, { lon: posicion del glifo, paso: separacion en
// grados que le toco, nivel: 0 o 1 }. En una casa cargada los glifos y los
// grados alternan entre dos alturas (nivel) para no pisarse.
export function ubicarEnCasas(puntos, cusps, { minimo = 10, margen = 4.5, apretado = 6 } = {}) {
    const res = [];
    for (let c = 0; c < 12; c++) {
        const inicio = cusps[c];
        const ancho = ((cusps[(c + 1) % 12] - inicio) % 360 + 360) % 360;
        const items = puntos
            .map((p, i) => ({ i, rel: ((p.lon - inicio) % 360 + 360) % 360, casa: p.casa }))
            .filter((x) => x.casa === c + 1)
            .sort((a, b) => a.rel - b.rel);
        if (!items.length) continue;
        const m = Math.min(margen, ancho / 2);
        let lo = m;
        let hi = ancho - m;
        const n = items.length;
        const falta = (n - 1) * apretado - (hi - lo);
        if (falta > 0) {
            lo -= falta / 2;
            hi += falta / 2;
        }
        const paso = n > 1 ? Math.min(minimo, (hi - lo) / (n - 1)) : minimo;
        const pos = items.map((x) => Math.min(Math.max(x.rel, lo), hi));
        for (let k = 1; k < n; k++) pos[k] = Math.max(pos[k], pos[k - 1] + paso);
        if (pos[n - 1] > hi) {
            pos[n - 1] = hi;
            for (let k = n - 2; k >= 0; k--) pos[k] = Math.min(pos[k], pos[k + 1] - paso);
        }
        const cargada = paso < minimo;
        items.forEach((x, k) => { res[x.i] = { lon: inicio + pos[k], paso, nivel: cargada ? k % 2 : 0 }; });
    }
    return res;
}


// Reparte posiciones sobre el circulo para que queden al menos a `minimo`
// grados entre si, moviendolas lo menos posible. Devuelve las posiciones
// en el mismo orden que `lons`.
export function repartir(lons, minimo) {
    const n = lons.length;
    if (n < 2) return lons.slice();
    const orden = lons.map((lon, i) => ({ i, lon: ((lon % 360) + 360) % 360 })).sort((a, b) => a.lon - b.lon);
    // Se corta el circulo en el hueco mas grande, para trabajar en linea.
    let corte = 0;
    let hueco = -1;
    orden.forEach((x, k) => {
        const sig = k + 1 < n ? orden[k + 1].lon : orden[0].lon + 360;
        if (sig - x.lon > hueco) { hueco = sig - x.lon; corte = (k + 1) % n; }
    });
    const linea = [...orden.slice(corte), ...orden.slice(0, corte).map((x) => ({ ...x, lon: x.lon + 360 }))];
    // Grupos: se juntan mientras se pisen; cada grupo se centra en su promedio.
    let grupos = linea.map((x) => ({ items: [x], centro: x.lon }));
    const inicio = (g) => g.centro - (g.items.length - 1) * minimo / 2;
    const fin = (g) => g.centro + (g.items.length - 1) * minimo / 2;
    let cambio = true;
    while (cambio) {
        cambio = false;
        for (let k = 0; k + 1 < grupos.length; k++) {
            if (inicio(grupos[k + 1]) - fin(grupos[k]) < minimo) {
                const items = [...grupos[k].items, ...grupos[k + 1].items];
                grupos.splice(k, 2, { items, centro: items.reduce((s, x) => s + x.lon, 0) / items.length });
                cambio = true;
                break;
            }
        }
    }
    const res = [];
    for (const g of grupos) g.items.forEach((x, k) => { res[x.i] = inicio(g) + k * minimo; });
    return res;
}

// Rueda doble: la natal se achica y los planetas en transito van en un
// anillo por fuera del zodiaco, todos del mismo color y sin grados.
const ESCALA_DOBLE = 0.84;
const R_DOBLE = { exterior: 294, glifos: 271 };

// Revolucion solar (como Solar Fire): la natal adentro, mas chica, y la
// revolucion afuera con su propio zodiaco, sus casas y sus planetas con
// grados. El centro queda sin lineas de aspectos.
const ESCALA_RS = 0.66;
// Letra de los numeros de la natal, tal como se ve en pantalla (en
// unidades de la rueda): la de la natal de adentro de la revolucion.
const LETRA_NATAL = { grado: 11.9, casa: 10.1, retro: 6.7 };
const R_RS = { exterior: 294, signos: 272, linea: 207, casas: 200 };

// Columna de cada planeta, como en Solar Fire: de afuera hacia adentro el
// glifo, el grado, el glifo del signo y los minutos. Distancias desde el
// borde del zodiaco y tamanios, en unidades de pantalla.
const COLUMNA_NATAL = { glifo: 20, grado: 43, signo: 60, minuto: 76, tG: 24, fG: 11.9, tS: 11, fM: 10.5, retro: 6.7 };
const COLUMNA_EXTERNA = { glifo: 13, grado: 31, signo: 44, minuto: 57, tG: 20, fG: 10.5, tS: 9.5, fM: 9.5, retro: 6.5 };

const difAng = (a, b) => {
    const d = (((a - b) % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
};

// Reparte los planetas en columnas por toda la rueda y calcula por donde
// pasa cada cuspide entre las columnas (`paso`). Devuelve el SVG de las
// columnas, los angulos de paso de las cuspides y los radios usados.
function columnas(puntos, cusps, { polar, linea, rTope, marca, escala = 1, m, prefijo = '', clase = '', etiqueta = '', seleccion, nombres }) {
    const r = (d) => rTope - d / escala;
    const rG = r(m.glifo), rGr = r(m.grado), rS = r(m.signo), rM = r(m.minuto);
    const grados = (ancho, radio) => ancho / radio * 180 / Math.PI;
    const texto = (px, letras) => 0.6 * px * letras / escala;
    const minimo = Math.max(
        grados(m.tG / escala, rG), grados(texto(m.fG, 3), rGr),
        grados(m.tS / escala, rS), grados(texto(m.fM, 3.6), rM)) + 0.8;
    const pos = repartir(puntos.map((p) => p.lon), minimo);

    // Cada cuspide pasa entre la ultima columna de su casa y la primera de
    // la siguiente: recta si su grado cae en ese hueco; si no, se corre lo
    // minimo y se quiebra arriba hasta su grado.
    const orden = puntos.map((p, i) => ({ lon: p.lon, pos: pos[i] }));
    const medio = minimo / 2;
    const paso = cusps.map((c) => {
        let antes = null, despues = null;
        for (const o of orden) {
            const d = difAng(o.lon, c);
            if (d < 0 && (!antes || d > antes.d)) antes = { d, pos: c + difAng(o.pos, c) };
            if (d >= 0 && (!despues || d < despues.d)) despues = { d, pos: c + difAng(o.pos, c) };
        }
        const desde = antes ? antes.pos + medio : -Infinity;
        const hasta = despues ? despues.pos - medio : Infinity;
        if (desde <= hasta) return Math.min(Math.max(c, desde), hasta);
        return (antes.pos + despues.pos) / 2;
    });

    const letra = (px) => ` style="font-size:${(px / escala).toFixed(2)}px"`;
    const dos = (n) => String(n).padStart(2, '0');
    const out = [];
    puntos.forEach((p, i) => {
        const id = prefijo + p.id;
        const sel = seleccion === id ? ' sel' : '';
        out.push(`<g class="punto${clase ? ' ' + clase : ''}${sel}" data-punto="${id}" tabindex="0" role="button" aria-label="${nombres[p.id] || p.id}${etiqueta}">`);
        out.push(linea(p.lon, rTope, rTope + marca / escala, 'marca-punto'));
        const a = pos[i];
        const [x, y] = polar(a, rG);
        out.push(`<circle class="toque" cx="${f(x)}" cy="${f(y)}" r="${f(m.tG * 0.75 / escala)}"/>`);
        out.push(glifo(G_PUNTOS[p.id], x, y, m.tG / escala));
        const [gx, gy] = polar(a, rGr);
        out.push(`<text class="grado-punto"${letra(m.fG)} x="${f(gx)}" y="${f(gy)}">${dos(p.grado)}°</text>`);
        const [sx, sy] = polar(a, rS);
        const iSigno = SIGNOS.indexOf(p.signo);
        out.push(glifo(G_SIGNOS[p.signo], sx, sy, m.tS / escala, '', `signo-columna elem-${ELEMENTOS[iSigno % 4]}`, 0.75));
        const [mx, my] = polar(a, rM);
        out.push(`<text class="grado-punto minuto"${letra(m.fM)} x="${f(mx)}" y="${f(my)}">${dos(p.minuto)}'${p.retro ? `<tspan class="retro"${letra(m.retro)}>r</tspan>` : ''}</text>`);
        out.push('</g>');
    });
    return {
        svg: out, paso,
        codo: rG + (m.tG / 2 + 3) / escala,          // arriba de los glifos
        codoAbajo: rM - (m.fM * 0.6 + 3) / escala     // debajo de los minutos
    };
}

// Cuspide desde `rAdentro` hasta `rAfuera`. Si las columnas no le dejan
// pasar por su grado, en el tramo de los planetas se corre a su paso entre
// columnas y se quiebra en los dos extremos: arriba hasta su grado en el
// borde del zodiaco (`rTope`) y abajo hasta su grado en `rQuiebre` (el
// anillo de numeros de casa, o el borde de la carta de adentro).
function cuspide(polar, c, paso, { rAdentro, rQuiebre, codoAbajo, codo, rTope, rAfuera }, clase) {
    const pts = Math.abs(difAng(paso, c)) < 0.01
        ? [polar(c, rAdentro), polar(c, rAfuera)]
        : [polar(c, rAdentro), polar(c, rQuiebre), polar(paso, codoAbajo), polar(paso, codo), polar(c, rTope), polar(c, rAfuera)];
    return `<polyline class="${clase}" fill="none" points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}"/>`;
}

// Numeros de casa a mitad de camino entre sus cuspides (en su grado real:
// ahi la cuspide ya volvio a su lugar).
const medioCasa = (lons, i) => lons[i] + ((((lons[(i + 1) % 12] - lons[i]) % 360) + 360) % 360) / 2;

// clara: rueda para el fondo blanco; si no, para el fondo oscuro. En las
// dos los signos van en el color de su elemento.
// transitos: el modelo de engine/transits.js, para la rueda doble.
// revolucion: la carta de la revolucion solar (calcularCarta), para la
// rueda doble completa.
export function dibujarRueda(carta, { nombres = {}, seleccion = null, clara = false, transitos = null, revolucion = null } = {}) {
    const asc = carta.angulos.find((a) => a.id === 'asc').lon;
    const mc = carta.angulos.find((a) => a.id === 'mc').lon;
    // Con revolucion, manda su Ascendente (a la izquierda) y la natal gira.
    const polar = crearPolar(revolucion ? revolucion.angulos.find((a) => a.id === 'asc').lon : asc);
    const R = revolucion ? R_NATAL_EN_RS : R_BASE;
    // La natal se ve con la misma letra en todas las vistas, aunque vaya
    // achicada dentro de los transitos o de la revolucion.
    const escala = revolucion ? ESCALA_RS : transitos ? ESCALA_DOBLE : 1;
    const letra = (px) => ` style="font-size:${(px / escala).toFixed(2)}px"`;
    const linea = (lon, r1, r2, clase) => {
        const [x1, y1] = polar(lon, r1);
        const [x2, y2] = polar(lon, r2);
        return `<line class="${clase}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    };
    const out = [];

    // Circulos base.
    for (const [r, c] of [[R.exterior, 'borde'], [R.signos, 'borde'], [R.casas, 'fino'], [R.aspectos, 'fino']]) {
        out.push(`<circle class="${c}" r="${r}"/>`);
    }

    // Anillo de signos: divisiones, marcas de grados (en su borde interior)
    // y glifos.
    SIGNOS.forEach((s, i) => {
        out.push(linea(i * 30, R.signos, R.exterior, 'borde'));
        const [x, y] = polar(i * 30 + 15, (R.exterior + R.signos) / 2);
        out.push(glifo(G_SIGNOS[s], x, y, 28, `data-signo="${s}"`, `elem-${ELEMENTOS[i % 4]}`, 1.45));
    });
    for (let g = 0; g < 360; g++) {
        if (g % 30 === 0) continue;
        const largo = g % 10 === 0 ? 9 : g % 5 === 0 ? 6 : 3;
        out.push(linea(g, R.signos, R.signos + largo, 'marca'));
    }

    // Planetas en columnas; las cuspides pasan entre ellas.
    const col = columnas(carta.puntos, carta.cusps.map((c) => c.lon), {
        polar, linea, rTope: R.signos, marca: 10, escala, m: COLUMNA_NATAL, seleccion, nombres
    });

    // Casas: cuspides y numeros.
    carta.cusps.forEach((c, i) => {
        const angular = i % 3 === 0;
        const clase = i === 0 ? 'eje eje-ac' : angular ? 'eje' : 'cuspide';
        const largo = angular ? (revolucion ? R.exterior : R.exterior + 6) : R.signos;
        out.push(cuspide(polar, c.lon, col.paso[i], {
            rAdentro: R.aspectos, rQuiebre: R.casas, codoAbajo: col.codoAbajo, codo: col.codo, rTope: R.signos, rAfuera: largo
        }, clase));
        const [x, y] = polar(medioCasa(carta.cusps.map((k) => k.lon), i), R.numeros);
        out.push(`<text class="num-casa"${letra(LETRA_NATAL.casa)} x="${f(x)}" y="${f(y)}">${i + 1}</text>`);
    });
    // Con revolucion, el AC de la natal va adentro, junto a su eje.
    if (revolucion) {
        const [x, y] = polar(asc + 4, R.signos - 16);
        out.push(`<text class="rotulo-eje rotulo-ac"${letra(12.5)} x="${f(x)}" y="${f(y)}">AC</text>`);
    }
    // Rotulos de los angulos, por fuera del anillo.
    const rotulos = [];
    const radioRotulos = (transitos || revolucion ? R_DOBLE.exterior : R.exterior) + 16;
    // Con revolucion, los rotulos son de sus angulos (la natal va adentro).
    const angRotulos = revolucion
        ? ['asc', 'mc'].map((id) => revolucion.angulos.find((a) => a.id === id).lon)
        : [asc, mc];
    for (const [lon, txt] of [[angRotulos[0], 'AC'], [angRotulos[1], 'MC'], [angRotulos[0] + 180, 'DC'], [angRotulos[1] + 180, 'FC']]) {
        const [x, y] = polar(lon, radioRotulos);
        rotulos.push(`<text class="rotulo-eje${txt === 'AC' ? ' rotulo-ac' : ''}" x="${f(x)}" y="${f(y)}">${txt}</text>`);
    }

    // Aspectos: lineas entre puntos, por dentro. Con transitos, en lugar
    // de los natales van los del transito a la natal (prefijo "t-" en el
    // planeta en transito).
    const lonDe = Object.fromEntries([...carta.puntos, ...carta.angulos].map((p) => [p.id, p.lon]));
    const lineas = revolucion ? []
        : transitos
            ? transitos.aspectos.map((a) => ({ ...a, lonA: transitos.puntos.find((p) => p.id === a.a).lon, a: 't-' + a.a }))
            : carta.aspectos.map((a) => ({ ...a, lonA: lonDe[a.a] }));
    for (const a of lineas) {
        if (a.aspecto === 'conjuncion') continue;
        const [x1, y1] = polar(a.lonA, R.aspectos);
        const [x2, y2] = polar(lonDe[a.b], R.aspectos);
        const clase = CLASE_ASPECTO[a.aspecto];
        const activo = seleccion && (a.a === seleccion || a.b === seleccion);
        const atenuado = seleccion && !activo;
        // Mas opaco cuanto mas exacto.
        const op = `opacity="${(atenuado ? 0.1 : Math.max(0.5, 1 - a.orbe / a.orbeMax * 0.5)).toFixed(2)}"`;
        // La linea se corta en el medio y ahi va el glifo del aspecto.
        const largo = Math.hypot(x2 - x1, y2 - y1);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        // Hueco limpio para el glifo: en las lineas partidas, un trazo y
        // dos espacios (14 + 5 + 5); la linea nunca lo pisa.
        const hueco = 12;
        if (largo < hueco * 4) {
            out.push(`<line class="${clase}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${op}/>`);
            continue;
        }
        const ux = (x2 - x1) / largo;
        const uy = (y2 - y1) / largo;
        out.push(`<line class="${clase}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(mx - ux * hueco)}" y2="${f(my - uy * hueco)}" ${op}/>`);
        out.push(`<line class="${clase}" x1="${f(mx + ux * hueco)}" y1="${f(my + uy * hueco)}" x2="${f(x2)}" y2="${f(y2)}" ${op}/>`);
        out.push(glifo(G_ASPECTOS[a.aspecto], mx, my, 13, op, `glifo-aspecto ${COLOR_ASPECTO[a.aspecto]}`, 1.2));
    }

    // Planetas: las columnas, y una marca en el circulo de aspectos.
    carta.puntos.forEach((p) => out.push(linea(p.lon, R.aspectos, R.aspectos + 5, 'marca-punto marca-' + p.id)));
    out.push(...col.svg);

    let cuerpo = out.join('') + rotulos.join('');
    if (transitos) {
        const doble = [`<g transform="scale(${ESCALA_DOBLE})">${out.join('')}</g>`];
        const borde = R.exterior * ESCALA_DOBLE;
        // Los ejes cruzan tambien el anillo de transitos.
        carta.cusps.forEach((c, i) => {
            if (i % 3 === 0) doble.push(linea(c.lon, borde, R_DOBLE.exterior + 6, i === 0 ? 'eje eje-ac' : 'eje'));
        });
        const pos = repartir(transitos.puntos.map((p) => p.lon), 6.5);
        transitos.puntos.forEach((p, i) => {
            const id = 't-' + p.id;
            const sel = seleccion === id ? ' sel' : '';
            doble.push(`<g class="punto transito${sel}" data-punto="${id}" tabindex="0" role="button" aria-label="${nombres[p.id] || p.id} en tránsito">`);
            doble.push(linea(p.lon, borde, borde + 9, 'marca-punto'));
            const [x, y] = polar(pos[i], R_DOBLE.glifos);
            doble.push(`<circle class="toque" cx="${f(x)}" cy="${f(y)}" r="18"/>`);
            doble.push(glifo(G_PUNTOS[p.id], x, y, 26));
            doble.push('</g>');
        });
        cuerpo = doble.join('') + rotulos.join('');
    }
    if (revolucion) cuerpo = anilloRevolucion(revolucion, out, { polar, linea, seleccion, nombres }) + rotulos.join('');
    // Disco de fondo (blanco en la version clara).
    const fondo = `<circle class="fondo-rueda" r="${R_BASE.exterior}"/>`;
    return `<svg class="rueda${clara ? ' rueda-clara' : ''}${transitos || revolucion ? ' rueda-doble' : ''}" viewBox="-332 -332 664 664" role="img" aria-label="Rueda de la carta">${fondo}${cuerpo}</svg>`;
}

// Anillo de afuera de la revolucion solar; `natal` es el dibujo de la
// natal, que va adentro achicado.
function anilloRevolucion(rs, natal, { polar, linea, seleccion, nombres }) {
    const R2 = R_RS;
    const borde = R_BASE.exterior * ESCALA_RS;
    const out = [`<g transform="scale(${ESCALA_RS})">${natal.join('')}</g>`];
    out.push(`<circle class="borde" r="${R2.exterior}"/>`, `<circle class="borde" r="${R2.signos}"/>`);
    // Linea que separa los numeros de casa de los planetas.
    out.push(`<circle class="fino" r="${R2.linea}"/>`);

    // Zodiaco propio de la revolucion.
    SIGNOS.forEach((s, i) => {
        out.push(linea(i * 30, R2.signos, R2.exterior, 'borde'));
        const [x, y] = polar(i * 30 + 15, (R2.exterior + R2.signos) / 2);
        out.push(glifo(G_SIGNOS[s], x, y, 17, `data-signo="${s}"`, `elem-${ELEMENTOS[i % 4]}`, 1.45));
    });
    for (let g = 0; g < 360; g++) {
        if (g % 30 === 0) continue;
        const largo = g % 10 === 0 ? 7 : g % 5 === 0 ? 5 : 2.5;
        out.push(linea(g, R2.signos, R2.signos + largo, 'marca'));
    }

    // Planetas de afuera en columnas; sus cuspides pasan entre ellas.
    const col = columnas(rs.puntos, rs.cusps.map((c) => c.lon), {
        polar, linea, rTope: R2.signos, marca: 6, m: COLUMNA_EXTERNA,
        prefijo: 'r-', clase: 'revolucion', etiqueta: ' de afuera', seleccion, nombres
    });
    rs.cusps.forEach((c, i) => {
        const angular = i % 3 === 0;
        const clase = i === 0 ? 'eje eje-ac' : angular ? 'eje' : 'cuspide';
        out.push(cuspide(polar, c.lon, col.paso[i], {
            rAdentro: borde, rQuiebre: R2.linea, codoAbajo: col.codoAbajo, codo: col.codo,
            rTope: R2.signos, rAfuera: angular ? R2.exterior + 6 : R2.signos
        }, clase));
        const [x, y] = polar(medioCasa(rs.cusps.map((k) => k.lon), i), R2.casas);
        out.push(`<text class="num-casa" style="font-size:10px" x="${f(x)}" y="${f(y)}">${i + 1}</text>`);
    });
    out.push(...col.svg);
    return out.join('');
}
