// Rueda de la carta en SVG. Recibe el modelo de engine/chart.js.
//
// Esta pensada en anillos: la v1 dibuja uno (natal); para transitos o
// revolucion solar se pasa un segundo anillo de puntos por fuera.
//
// Orientacion clasica: Ascendente a la izquierda, el zodiaco avanza en
// sentido antihorario.

import { SIGNOS as G_SIGNOS, PUNTOS as G_PUNTOS, glifo } from './glyphs.js';
import { SIGNOS } from '../engine/chart.js';

// De afuera hacia adentro: signos, numeros de casa, planetas y aspectos.
const R = {
    exterior: 294,   // borde del anillo de signos
    signos: 254,     // borde interior del anillo de signos
    casas: 228,      // borde interior del anillo de numeros de casa
    planetas: 200,   // glifos de los planetas
    grados: 168,     // grado de cada planeta
    aspectos: 138    // circulo interior donde llegan los aspectos
};

// Clase de linea de cada aspecto (los colores estan en tucarta.css).
const CLASE_ASPECTO = {
    trigono: 'asp-armonico', sextil: 'asp-armonico',
    cuadratura: 'asp-tenso', oposicion: 'asp-tenso',
    semicuadratura: 'asp-tenso asp-menor', sesquicuadratura: 'asp-tenso asp-menor',
    semisextil: 'asp-semisextil asp-menor', quincuncio: 'asp-quincuncio asp-menor'
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

// Tamaño del glifo segun el lugar que tiene: ~3,8 unidades por grado en el
// anillo de planetas.
// En una casa cargada el escalonado da aire extra: el glifo puede ser mas
// grande que lo que entra en linea recta.
const tamGlifo = (u) => Math.max(24, Math.min(34, u.paso * (R.planetas * Math.PI / 180) * (u.nivel === undefined ? 0.92 : 1.15)));
const ESCALON = { glifo: 12, grado: 16 }; // cuanto se mete hacia adentro el nivel 1

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

// clara: rueda para el fondo blanco; si no, para el fondo oscuro. En las
// dos los signos van en el color de su elemento.
// transitos: el modelo de engine/transits.js, para la rueda doble.
export function dibujarRueda(carta, { nombres = {}, seleccion = null, clara = false, transitos = null } = {}) {
    const asc = carta.angulos.find((a) => a.id === 'asc').lon;
    const mc = carta.angulos.find((a) => a.id === 'mc').lon;
    const polar = crearPolar(asc);
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

    // Casas: cuspides y numeros.
    carta.cusps.forEach((c, i) => {
        const angular = i % 3 === 0;
        const clase = i === 0 ? 'eje eje-ac' : angular ? 'eje' : 'cuspide';
        const largo = angular ? R.exterior + 6 : R.signos;
        out.push(linea(c.lon, largo, R.aspectos, clase));
        const sig = carta.cusps[(i + 1) % 12].lon;
        const medio = c.lon + (((sig - c.lon) % 360) + 360) % 360 / 2;
        const [x, y] = polar(medio, (R.signos + R.casas) / 2);
        out.push(`<text class="num-casa" x="${f(x)}" y="${f(y)}">${i + 1}</text>`);
    });
    // Rotulos de los angulos, por fuera del anillo.
    const rotulos = [];
    const radioRotulos = (transitos ? R_DOBLE.exterior : R.exterior) + 16;
    for (const [lon, txt] of [[asc, 'AC'], [mc, 'MC'], [asc + 180, 'DC'], [mc + 180, 'FC']]) {
        const [x, y] = polar(lon, radioRotulos);
        rotulos.push(`<text class="rotulo-eje${txt === 'AC' ? ' rotulo-ac' : ''}" x="${f(x)}" y="${f(y)}">${txt}</text>`);
    }

    // Aspectos: lineas entre puntos, por dentro. Con transitos, en lugar
    // de los natales van los del transito a la natal (prefijo "t-" en el
    // planeta en transito).
    const lonDe = Object.fromEntries([...carta.puntos, ...carta.angulos].map((p) => [p.id, p.lon]));
    const lineas = transitos
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
        const opacidad = atenuado ? 0.1 : Math.max(0.5, 1 - a.orbe / a.orbeMax * 0.5);
        out.push(`<line class="${clase}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" opacity="${opacidad.toFixed(2)}"/>`);
    }

    // Planetas: posicion real (marca en el anillo) y glifo dentro de su
    // casa, separado de los vecinos, con el grado debajo.
    const pos = ubicarEnCasas(carta.puntos, carta.cusps.map((c) => c.lon));
    carta.puntos.forEach((p, i) => {
        const sel = seleccion === p.id ? ' sel' : '';
        out.push(`<g class="punto${sel}" data-punto="${p.id}" tabindex="0" role="button" aria-label="${nombres[p.id] || p.id}">`);
        out.push(linea(p.lon, R.signos, R.signos + 10, 'marca-punto'));
        out.push(linea(p.lon, R.aspectos, R.aspectos + 5, 'marca-punto'));
        const u = pos[i];
        const t = u.paso < 10 ? tamGlifo(u) : 34;
        const [x, y] = polar(u.lon, R.planetas - u.nivel * ESCALON.glifo);
        out.push(`<circle class="toque" cx="${f(x)}" cy="${f(y)}" r="22"/>`);
        out.push(glifo(G_PUNTOS[p.id], x, y, t));
        const [gx, gy] = polar(u.lon, R.grados - u.nivel * ESCALON.grado);
        const fuente = u.paso < 10 ? ` font-size="${Math.max(10.5, Math.min(15, u.paso * 1.95)).toFixed(1)}"` : '';
        out.push(`<text class="grado-punto"${fuente} x="${f(gx)}" y="${f(gy)}">${p.grado}°${p.retro ? '<tspan class="retro">r</tspan>' : ''}</text>`);
        out.push('</g>');
    });

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
    return `<svg class="rueda${clara ? ' rueda-clara' : ''}${transitos ? ' rueda-doble' : ''}" viewBox="-332 -332 664 664" role="img" aria-label="Rueda de la carta">${cuerpo}</svg>`;
}
