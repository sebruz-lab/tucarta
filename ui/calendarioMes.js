// Calendario del cielo (engine/eventos.js) en dos formatos: la grilla del
// mes, como la de Solar Fire, y la agenda dia por dia.
//
// Todo lo de aca es puro: recibe los eventos y devuelve HTML. La hora sale
// del dia juliano en el huso del dispositivo y se **trunca** al minuto,
// como Solar Fire y como el resto de la calculadora trunca los grados:
// 21:51:40 es 21:51, no 21:52.

import { PUNTOS as G_PUNTOS, ASPECTOS as G_ASPECTOS, SIGNOS as G_SIGNOS, iconoSvg } from './glyphs.js';
import { NOMBRE_PUNTO, NOMBRE_ASPECTO, NOMBRE_SIGNO, escapar } from './textos.js';

const T = 14; // tamanio de los glifos en el renglon

export const NOMBRE_FASE = {
    nueva: 'Luna nueva', creciente: 'Cuarto creciente',
    llena: 'Luna llena', menguante: 'Cuarto menguante'
};
const NOMBRE_ESTACION = { SR: 'se hace retrógrado', SD: 'se hace directo' };

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// El dia juliano es un flotante: las 17:16 pueden llegar como 17:15:59,999
// y truncar las mostraria un minuto antes. Se redondea al segundo (que es
// la precision con la que el motor devuelve cada instante) y recien
// despues se trunca al minuto, que es lo que imprime Solar Fire.
const fechaLocal = (jd) => new Date(Math.round((jd - 2440587.5) * 86400) * 1000);

// Hora local truncada al minuto.
export function horaDeJd(jd) {
    const d = fechaLocal(jd);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// La clave del dia al que pertenece un evento, en el huso del dispositivo.
// No se usa Math.floor(jd): el dia juliano corta al mediodia UT, asi que
// un evento de las 22:00 caeria en el dia siguiente.
export function claveDia(jd) {
    const d = fechaLocal(jd);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const punto = (id) => (G_PUNTOS[id]
    ? iconoSvg(G_PUNTOS[id], T, NOMBRE_PUNTO[id] || id)
    : `<span class="cal-angulo" title="${escapar(NOMBRE_PUNTO[id] || id)}">${id === 'asc' ? 'AC' : 'MC'}</span>`);
const signo = (id) => iconoSvg(G_SIGNOS[id], T, NOMBRE_SIGNO[id] || id);
const aspecto = (id) => `<span class="tipo-aspecto ${id}">${iconoSvg(G_ASPECTOS[id], T, NOMBRE_ASPECTO[id])}</span>`;

// El cuerpo de un renglon, sin la hora: glifos a la vista y el texto
// entero en el title, que es lo que lee un lector de pantalla.
export function cuerpoEvento(ev) {
    switch (ev.tipo) {
        case 'aspecto-tr':
        case 'aspecto-na': {
            const natal = ev.tipo === 'aspecto-na';
            const texto = `${NOMBRE_PUNTO[ev.a]} ${NOMBRE_ASPECTO[ev.aspecto].toLowerCase()} `
                + `${NOMBRE_PUNTO[ev.b] || ev.b}${natal ? ' natal' : ''}`;
            return { texto, html: `${punto(ev.a)}${aspecto(ev.aspecto)}${punto(ev.b)}` };
        }
        case 'ingreso': {
            const texto = `${NOMBRE_PUNTO[ev.punto]} entra en ${NOMBRE_SIGNO[ev.signo]}${ev.retro ? ', retrógrado' : ''}`;
            return {
                texto,
                html: `${punto(ev.punto)}<span class="cal-flecha" aria-hidden="true">→</span>${signo(ev.signo)}`
                    + (ev.retro ? '<span class="cal-sigla">R</span>' : '')
            };
        }
        case 'estacion': {
            const texto = `${NOMBRE_PUNTO[ev.punto]} ${NOMBRE_ESTACION[ev.sentido]}`;
            return { texto, html: `${punto(ev.punto)}<span class="cal-sigla">${ev.sentido}</span>` };
        }
        case 'fase': {
            const grado = `${ev.grado}°${String(ev.minuto).padStart(2, '0')}'`;
            const texto = `${NOMBRE_FASE[ev.fase]} a ${grado} de ${NOMBRE_SIGNO[ev.signo]}`;
            return {
                texto,
                html: `<span class="cal-fase cal-fase-${ev.fase}" aria-hidden="true"></span>`
                    + `<span class="cal-fase-texto">${escapar(NOMBRE_FASE[ev.fase])}</span>`
                    + `${signo(ev.signo)}<span class="cal-grado">${grado}</span>`
            };
        }
        default:
            return { texto: ev.tipo, html: escapar(ev.tipo) };
    }
}

// Un renglon. `i` es la posicion en el arreglo que se le paso: es lo que
// app.js usa para saber a que instante llevar la rueda.
export function lineaEvento(ev, i, { conCarril = false } = {}) {
    const { texto, html } = cuerpoEvento(ev);
    const esAspecto = ev.tipo === 'aspecto-tr' || ev.tipo === 'aspecto-na';
    const carril = conCarril && esAspecto
        ? `<span class="cal-carril">${ev.tipo === 'aspecto-na' ? 'Tr-Na' : 'Tr-Tr'}</span>` : '';
    return `<li class="cal-ev cal-ev-${ev.tipo}">`
        + `<button type="button" data-ev="${i}" title="${escapar(texto)} · ${horaDeJd(ev.jd)}">`
        + `${carril}<span class="cal-glifos">${html}</span><span class="cal-hora">${horaDeJd(ev.jd)}</span>`
        + `<span class="visualmente-oculto">${escapar(texto)}</span></button></li>`;
}

// Los eventos agrupados por dia local, con su posicion original.
export function porDia(eventos) {
    const m = new Map();
    eventos.forEach((ev, i) => {
        const k = claveDia(ev.jd);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push({ ev, i });
    });
    for (const lista of m.values()) lista.sort((x, y) => x.ev.jd - y.ev.jd);
    return m;
}

// Las semanas del mes, de domingo a sabado, como las arma Solar Fire: la
// primera y la ultima traen celdas vacias.
export function semanasDelMes(anio, mes) {
    const primero = new Date(anio, mes, 1);
    const ultimo = new Date(anio, mes + 1, 0).getDate();
    const semanas = [];
    let fila = Array.from({ length: primero.getDay() }, () => null);
    for (let d = 1; d <= ultimo; d++) {
        fila.push(d);
        if (fila.length === 7) { semanas.push(fila); fila = []; }
    }
    if (fila.length) semanas.push([...fila, ...Array.from({ length: 7 - fila.length }, () => null)]);
    return semanas;
}

export const tituloMes = (anio, mes) => `${MESES[mes][0].toUpperCase()}${MESES[mes].slice(1)} ${anio}`;

const VACIO = '<p class="nota">No hay eventos en este período con lo que está elegido. '
    + 'Probá prender más aspectos o más puntos.</p>';

// La grilla del mes. `tope` es cuantos renglones se ven en cada dia antes
// de plegar el resto: con la Luna y los nueve aspectos salen quince
// eventos por dia y la celda no entra en ninguna pantalla.
export function grillaMes(eventos, { anio, mes, tope = 6, conCarril = false } = {}) {
    if (!eventos.length) return VACIO;
    const dias = porDia(eventos);
    const celda = (d) => {
        if (d == null) return '<td class="cal-dia cal-dia-vacio"></td>';
        const clave = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const lista = dias.get(clave) || [];
        const renglon = ({ ev, i }) => lineaEvento(ev, i, { conCarril });
        // La fase de la Luna va siempre en el mismo lugar: una linea fija
        // al pie de la celda, vacia los dias que no tienen. Es el renglon
        // mas largo de todos (lleva la palabra entera) y mezclado con los
        // demas empujaba la hora encima de los glifos del de al lado.
        const fases = lista.filter(({ ev }) => ev.tipo === 'fase');
        const otros = lista.filter(({ ev }) => ev.tipo !== 'fase');
        const ala = otros.slice(0, tope).map(renglon).join('');
        const resto = otros.slice(tope);
        // Lo que no entra en la celda abre el dia entero en una ventana:
        // desplegarlo adentro era empujar el problema, porque ahi no entra.
        // Pero los renglones siguen en el documento, ocultos: en el celular
        // la celda ocupa todo el ancho y en el papel no hay nada que
        // apretar, asi que en los dos lados se muestran todos.
        const mas = resto.length
            ? `<button type="button" class="cal-mas" data-cal-dia="${clave}">+${resto.length} más</button>`
                + `<ul class="cal-evs cal-ocultos">${resto.map(renglon).join('')}</ul>`
            : '';
        return `<td class="cal-dia"><span class="cal-num">${d}</span>`
            + `<ul class="cal-evs">${ala}</ul>${mas}`
            + `<ul class="cal-evs cal-linea-fase">${fases.map(renglon).join('')}</ul></td>`;
    };
    const filas = semanasDelMes(anio, mes)
        .map((semana) => `<tr>${semana.map(celda).join('')}</tr>`).join('');
    return `<table class="cal-grilla"><caption class="visualmente-oculto">${tituloMes(anio, mes)}</caption>`
        + `<thead><tr>${DIAS.map((d) => `<th scope="col">${d}</th>`).join('')}</tr></thead>`
        + `<tbody>${filas}</tbody></table>`;
}

// Un dia solo, para la ventana que abre el "+N" de la grilla.
export function bloqueDeUnDia(eventos, clave, { conCarril = false } = {}) {
    const lista = porDia(eventos).get(clave) || [];
    if (!lista.length) return { titulo: clave, html: VACIO };
    const d = fechaLocal(lista[0].ev.jd);
    return {
        titulo: `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`,
        html: `<ul class="cal-evs">${lista.map(({ ev, i }) => lineaEvento(ev, i, { conCarril })).join('')}</ul>`
    };
}

// La agenda: un bloque por dia con eventos, todos los renglones a la vista.
// Es lo que se ve en el celular, donde siete columnas no entran.
export function agendaDias(eventos, { conCarril = false } = {}) {
    if (!eventos.length) return VACIO;
    return [...porDia(eventos).values()].map((lista) => {
        const d = fechaLocal(lista[0].ev.jd);
        const titulo = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
        return `<section class="cal-dia-agenda" aria-label="${escapar(titulo)}"><h3>${titulo}</h3>`
            + `<ul class="cal-evs">${lista.map(({ ev, i }) => lineaEvento(ev, i, { conCarril })).join('')}</ul>`
            + '</section>';
    }).join('');
}
