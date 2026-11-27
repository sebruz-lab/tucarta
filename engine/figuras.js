// Figuras de aspectos: las configuraciones clasicas que se leen de una
// carta como una unidad y no aspecto por aspecto (una T cuadrada, un gran
// trigono, un yod...).
//
// Sale de `carta.aspectos`, que ya esta calculado y ya viene filtrado por
// "Puntos aspectados": lo que no entra en los aspectos tampoco puede
// formar una figura. Si un aspecto esta apagado en los ajustes, las
// figuras que lo necesitan simplemente no aparecen (sin quincuncio no hay
// yod); la pantalla lo avisa, no se inventa el aspecto.
//
// Sin DOM, como todo lo de engine/: los tests lo corren en Node.

export const FIGURAS = {
    stellium: { nombre: 'Stellium', de: 3 },
    granTrigono: { nombre: 'Gran trígono', de: 3 },
    tCuadrada: { nombre: 'T cuadrada', de: 3, conVertice: true },
    yod: { nombre: 'Yod', de: 3, conVertice: true },
    granCruz: { nombre: 'Gran cruz', de: 4 },
    cometa: { nombre: 'Cometa', de: 4, conVertice: true },
    rectangulo: { nombre: 'Rectángulo místico', de: 4 }
};

// Mapa de ida y vuelta: rel[a][b] es el aspecto entre a y b, si lo hay.
function relaciones(aspectos) {
    const rel = new Map();
    const poner = (a, b, x) => {
        if (!rel.has(a)) rel.set(a, new Map());
        rel.get(a).set(b, x);
    };
    for (const x of aspectos) {
        poner(x.a, x.b, x);
        poner(x.b, x.a, x);
    }
    return rel;
}

// Las figuras se arman sobre los puntos que de verdad participan de
// algun aspecto: cualquier otro no puede estar en ninguna.
const enJuego = (aspectos) => [...new Set(aspectos.flatMap((x) => [x.a, x.b]))];

// Los grupos de puntos encadenados por conjuncion. No es "todos con
// todos": en un stellium de cuatro, el primero y el ultimo pueden estar
// a mas de un orbe y sigue siendo un stellium.
function stelliums(aspectos) {
    const grupos = [];
    const dondeEsta = new Map();
    for (const x of aspectos) {
        if (x.aspecto !== 'conjuncion') continue;
        const ga = dondeEsta.get(x.a);
        const gb = dondeEsta.get(x.b);
        if (ga && gb && ga !== gb) {
            // Dos cadenas que se tocan son una sola.
            for (const id of gb.puntos) { ga.puntos.add(id); dondeEsta.set(id, ga); }
            ga.aspectos.push(...gb.aspectos, x);
            gb.puntos.clear();
            continue;
        }
        const g = ga || gb || { puntos: new Set(), aspectos: [] };
        if (!ga && !gb) grupos.push(g);
        g.puntos.add(x.a);
        g.puntos.add(x.b);
        g.aspectos.push(x);
        dondeEsta.set(x.a, g);
        dondeEsta.set(x.b, g);
    }
    return grupos.filter((g) => g.puntos.size >= 3)
        .map((g) => ({ tipo: 'stellium', puntos: [...g.puntos], aspectos: g.aspectos }));
}

// Las de tres y cuatro puntos, por fuerza bruta: son trece o veinte
// puntos, asi que las combinaciones se cuentan en miles y no en millones.
function deTresYCuatro(aspectos) {
    const ids = enJuego(aspectos);
    const rel = relaciones(aspectos);
    const asp = (a, b) => rel.get(a)?.get(b);
    const es = (a, b, cual) => asp(a, b)?.aspecto === cual;
    const halladas = [];
    const sumar = (tipo, puntos, pares, vertice = null) =>
        halladas.push({ tipo, puntos, vertice, aspectos: pares.map(([a, b]) => asp(a, b)) });

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            for (let k = j + 1; k < ids.length; k++) {
                const t = [ids[i], ids[j], ids[k]];
                const [a, b, c] = t;
                if (es(a, b, 'trigono') && es(b, c, 'trigono') && es(a, c, 'trigono')) {
                    sumar('granTrigono', t, [[a, b], [b, c], [a, c]]);
                }
                // La T cuadrada y el yod tienen vertice: el punto que
                // mira a los otros dos. Se prueba cual de los tres es.
                for (const [p, q, v] of [[a, b, c], [a, c, b], [b, c, a]]) {
                    if (es(p, q, 'oposicion') && es(p, v, 'cuadratura') && es(q, v, 'cuadratura')) {
                        sumar('tCuadrada', [p, q, v], [[p, q], [p, v], [q, v]], v);
                    }
                    if (es(p, q, 'sextil') && es(p, v, 'quincuncio') && es(q, v, 'quincuncio')) {
                        sumar('yod', [p, q, v], [[p, q], [p, v], [q, v]], v);
                    }
                }
            }
        }
    }

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            for (let k = j + 1; k < ids.length; k++) {
                for (let l = k + 1; l < ids.length; l++) {
                    const q = [ids[i], ids[j], ids[k], ids[l]];
                    const [a, b, c, d] = q;
                    // Gran cruz y rectangulo se arman igual: dos
                    // oposiciones cruzadas. Cambia lo que las une.
                    for (const [p1, p2, p3, p4] of [[a, b, c, d], [a, c, b, d], [a, d, b, c]]) {
                        if (!es(p1, p2, 'oposicion') || !es(p3, p4, 'oposicion')) continue;
                        const lados = [[p1, p3], [p3, p2], [p2, p4], [p4, p1]];
                        if (lados.every(([x, y]) => es(x, y, 'cuadratura'))) {
                            sumar('granCruz', q, [[p1, p2], [p3, p4], ...lados]);
                            continue;
                        }
                        // El rectangulo: dos lados opuestos trigonos y
                        // los otros dos sextiles. Las dos vueltas, no
                        // una: con las oposiciones ya fijadas todavia
                        // quedan dos maneras de recorrer el rectangulo
                        // segun cual de los dos puntos de la segunda
                        // oposicion venga primero, y mirar una sola
                        // dejaba afuera la mitad de los rectangulos.
                        const seguido = (a1, a2, a3, a4) =>
                            es(p1, p3, a1) && es(p3, p2, a2) && es(p2, p4, a3) && es(p4, p1, a4);
                        if (seguido('trigono', 'sextil', 'trigono', 'sextil')
                            || seguido('sextil', 'trigono', 'sextil', 'trigono')) {
                            sumar('rectangulo', q, [[p1, p2], [p3, p4], ...lados]);
                        }
                    }
                    // Cometa: un gran trigono con un cuarto punto que se
                    // opone a uno de los tres y hace sextil a los otros
                    // dos. El vertice es ese cuarto punto.
                    for (const v of q) {
                        const [x, y, z] = q.filter((p) => p !== v);
                        if (!(es(x, y, 'trigono') && es(y, z, 'trigono') && es(x, z, 'trigono'))) continue;
                        for (const [op, s1, s2] of [[x, y, z], [y, x, z], [z, x, y]]) {
                            if (es(v, op, 'oposicion') && es(v, s1, 'sextil') && es(v, s2, 'sextil')) {
                                sumar('cometa', q, [[x, y], [y, z], [x, z], [v, op], [v, s1], [v, s2]], v);
                            }
                        }
                    }
                }
            }
        }
    }
    return halladas;
}

const clave = (f) => f.tipo + ':' + [...f.puntos].sort().join(',');
const contiene = (grande, chica) => chica.puntos.every((p) => grande.puntos.includes(p));

// Las figuras de una carta, de la mas exacta a la menos. Cada una:
// { tipo, nombre, puntos, vertice, aspectos, orbe }.
//
// `orbe` es el promedio de los aspectos que la arman, que es lo que se
// usa para ordenarlas: una T cuadrada de medio grado se lee antes que una
// que apenas entra.
export function figurasDe(aspectos = []) {
    const todas = [...stelliums(aspectos), ...deTresYCuatro(aspectos)];
    const unicas = [...new Map(todas.map((f) => [clave(f), f])).values()]
        .map((f) => ({
            ...f,
            nombre: FIGURAS[f.tipo].nombre,
            orbe: f.aspectos.reduce((s, x) => s + x.orbe, 0) / f.aspectos.length
        }));
    // Una gran cruz trae cuatro T cuadradas adentro, y un cometa trae su
    // gran trigono: listarlas todas seria ruido. Se queda la grande.
    const sobrevive = (f) => !unicas.some((g) =>
        g !== f && g.puntos.length > f.puntos.length && contiene(g, f));
    return unicas.filter(sobrevive)
        .sort((x, y) => y.puntos.length - x.puntos.length || x.orbe - y.orbe);
}
