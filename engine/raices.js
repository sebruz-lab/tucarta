// Busqueda de raices en el tiempo, compartida por el calendario de
// transitos, las efemerides graficas y las lunaciones.

export const PRECISION = 1 / 1440;   // un minuto, en dias
export const UN_SEGUNDO = 1 / 86400; // lo que pide el calendario del cielo

// Biseccion de f entre a y b (f(a) y f(b) de distinto signo).
export function biseccion(f, a, b, precision = PRECISION) {
    let fa = f(a);
    while (b - a > precision) {
        const m = (a + b) / 2;
        const fm = f(m);
        if ((fm <= 0) === (fa <= 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
}

// ---------- Cruces por cero en un periodo ----------
//
// El calendario del cielo necesita *todos* los instantes en que una
// funcion del tiempo pasa por cero dentro de un periodo: cada aspecto
// exacto, cada ingreso de signo, cada estacion. Las tres cosas son el
// mismo problema, y hasta ahora estaba copiado a mano en calendar.js y en
// lunaciones.js.
//
// Dos cuidados que no son obvios:
//
// 1. Una diferencia angular centrada en (-180, 180] **salta** de +180 a
//    -180 sin pasar por cero. Ese salto no es un cruce. Se lo descarta
//    por el tamanio del escalon: `salto` es el maximo que la funcion
//    puede moverse de verdad entre dos muestras.
// 2. El paso tiene que ser mas chico que lo que tarda la funcion en
//    entrar y salir de cero. Con la Luna (13°/dia) un paso de un dia se
//    come aspectos enteros; por eso el calendario muestrea cada 6 horas.
//
// Queda afuera un caso: una funcion que cruce dos veces *entre* dos
// muestras (un planeta que pasa por el blanco, estaciona y vuelve dentro
// del mismo paso). Pide que la estacion caiga a menos de una millonesima
// de grado del blanco, y `calendarioTransitos` ya vive con lo mismo.

// Muestras de f cada `paso` dias. La ultima cae exactamente en `hasta`,
// asi que el ultimo tramo puede ser mas corto que los demas.
export function muestras(f, desde, hasta, paso = 1) {
    const n = Math.max(1, Math.ceil((hasta - desde) / paso));
    const jds = Array.from({ length: n + 1 }, (_, k) => (k === n ? hasta : desde + k * paso));
    return { jds, valores: jds.map(f) };
}

// Cruces a partir de muestras ya tomadas. `f` se vuelve a llamar solo
// adentro de la biseccion de cada cruce.
export function crucesDe(f, jds, valores, { salto = 90, precision = PRECISION } = {}) {
    const res = [];
    for (let k = 1; k < jds.length; k++) {
        const v0 = valores[k - 1];
        const v1 = valores[k];
        if (v1 === 0) { res.push(jds[k]); continue; }
        if (v0 === 0) continue;                      // ya contado como v1 del paso anterior
        if (Math.sign(v0) === Math.sign(v1)) continue;
        if (Math.abs(v0 - v1) >= salto) continue;    // el salto de +180 a -180
        res.push(biseccion(f, jds[k - 1], jds[k], precision));
    }
    return res;
}

// Las dos cosas juntas, para quien no necesita reusar las muestras.
export function cruces(f, desde, hasta, paso = 1, opciones = {}) {
    const { jds, valores } = muestras(f, desde, hasta, paso);
    return crucesDe(f, jds, valores, opciones);
}
