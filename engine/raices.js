// Busqueda de raices en el tiempo, compartida por el calendario de
// transitos, las efemerides graficas y las lunaciones.

export const PRECISION = 1 / 1440; // un minuto, en dias

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
