// Animacion de la carta en el tiempo, al estilo de la pagina animada de
// Solar Fire: se elige un paso (minutos, horas, dias, meses, anios) y la
// carta se recalcula para cada momento, de a un paso o sola.
//
// Este modulo es puro (no toca el DOM) para poder testearlo, como fecha.js.
// Un "momento" es { fecha: 'AAAA-MM-DD', hora: 'HH:MM' } en la hora local
// del lugar de la carta, igual que en el resto de la interfaz.

const dos = (n) => String(n).padStart(2, '0');

// Pasos ofrecidos. unidad: 'min' | 'hora' | 'dia' | 'mes' | 'anio'.
export const PASOS = [
    { id: 'min-1', nombre: '1 minuto', unidad: 'min', cantidad: 1 },
    { id: 'min-5', nombre: '5 minutos', unidad: 'min', cantidad: 5 },
    { id: 'min-15', nombre: '15 minutos', unidad: 'min', cantidad: 15 },
    { id: 'min-30', nombre: '30 minutos', unidad: 'min', cantidad: 30 },
    { id: 'hora-1', nombre: '1 hora', unidad: 'hora', cantidad: 1 },
    { id: 'hora-4', nombre: '4 horas', unidad: 'hora', cantidad: 4 },
    { id: 'hora-12', nombre: '12 horas', unidad: 'hora', cantidad: 12 },
    { id: 'dia-1', nombre: '1 día', unidad: 'dia', cantidad: 1 },
    { id: 'dia-7', nombre: '1 semana', unidad: 'dia', cantidad: 7 },
    { id: 'mes-1', nombre: '1 mes', unidad: 'mes', cantidad: 1 },
    { id: 'anio-1', nombre: '1 año', unidad: 'anio', cantidad: 1 }
];

export const PASO_POR_DEFECTO = 'dia-1';

// Pasos que tienen sentido en las vistas que solo se mueven por fecha
// (progresiones) o por anio (revolucion solar).
export const pasosDesde = (unidadMinima) => {
    const orden = ['min', 'hora', 'dia', 'mes', 'anio'];
    const desde = orden.indexOf(unidadMinima);
    return PASOS.filter((p) => orden.indexOf(p.unidad) >= desde);
};

// Milisegundos entre cuadros cuando la animacion corre sola. No es el
// tiempo real por cuadro: si calcular y dibujar tarda mas, manda eso.
export const VELOCIDADES = { lento: 700, normal: 350, rapido: 150 };
export const VELOCIDAD_POR_DEFECTO = 'normal';

// Date (hora del dispositivo) -> { fecha, hora }.
export function momentoLocal(d) {
    return {
        fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
        hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`
    };
}

// { fecha, hora } -> Date en la hora del dispositivo.
export function fechaDeMomento({ fecha, hora }) {
    const [a, m, d] = fecha.split('-').map(Number);
    const [h, mi] = (hora || '00:00').split(':').map(Number);
    return new Date(a, m - 1, d, h, mi);
}

// Sumar meses sin que se desborde el dia: 31/01 + 1 mes es 28/02 (o 29),
// no el 02 o el 03 de marzo, que es lo que haria setMonth solo.
function sumarMeses(d, n) {
    const dia = d.getDate();
    const t = new Date(d);
    t.setDate(1);
    t.setMonth(t.getMonth() + n);
    const ultimo = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(dia, ultimo));
    return t;
}

// Mueve el momento un paso (signo 1 adelante, -1 atras; veces para saltar
// varios de una). Devuelve un momento nuevo, sin tocar el que entra.
export function avanzar(momento, pasoId, signo = 1, veces = 1) {
    const paso = PASOS.find((p) => p.id === pasoId) || PASOS.find((p) => p.id === PASO_POR_DEFECTO);
    const n = paso.cantidad * Math.sign(signo || 1) * veces;
    const t = fechaDeMomento(momento);
    if (paso.unidad === 'min') t.setMinutes(t.getMinutes() + n);
    if (paso.unidad === 'hora') t.setHours(t.getHours() + n);
    if (paso.unidad === 'dia') t.setDate(t.getDate() + n);
    if (paso.unidad === 'mes') return momentoLocal(sumarMeses(t, n));
    if (paso.unidad === 'anio') return momentoLocal(sumarMeses(t, n * 12));
    return momentoLocal(t);
}

// Texto del momento para mostrarlo: "05/11/2026 12:16".
export const textoMomento = ({ fecha, hora }) =>
    `${fecha.split('-').reverse().join('/')} ${hora}`;
