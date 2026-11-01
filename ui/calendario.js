// Lista del calendario de transitos (engine/calendar.js), agrupada por el
// mes en que cada transito empieza a contar dentro del periodo.

import { PUNTOS as G_PUNTOS, ASPECTOS as G_ASPECTOS, iconoSvg } from './glyphs.js';
import { NOMBRE_PUNTO, NOMBRE_ASPECTO } from './textos.js';

// Dia juliano (UT) <-> Date.
export const jdDeFecha = (d) => d.getTime() / 864e5 + 2440587.5;
export const fechaDeJd = (jd) => new Date((jd - 2440587.5) * 864e5);

export const fechaCorta = (jd) => {
    const d = fechaDeJd(jd);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const MES = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
const nombreMes = (d) => { const t = MES.format(d).replace(' de ', ' '); return t[0].toUpperCase() + t.slice(1); };

// La fecha a la que lleva tocar el transito: el primer exacto dentro del
// periodo, si no el mas cercano, si no el comienzo.
export function fechaParaVer(t, desde, hasta) {
    const dentro = t.exactos.find((jd) => jd >= desde && jd <= hasta);
    if (dentro) return dentro;
    if (t.exactos.length) return t.exactos.reduce((m, jd) => (Math.abs(jd - desde) < Math.abs(m - desde) ? jd : m));
    return Math.max(t.entra ?? desde, desde);
}

export function listaCalendario(items, desde, hasta) {
    if (!items.length) return '<p class="nota">No hay tránsitos de planetas lentos en este período con los orbes elegidos.</p>';
    const grupos = new Map();
    items.forEach((t, i) => {
        const d = fechaDeJd(Math.max(t.entra ?? desde, desde));
        const clave = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
        if (!grupos.has(clave)) grupos.set(clave, { titulo: nombreMes(d), filas: [] });
        grupos.get(clave).filas.push(fila(t, i));
    });
    return [...grupos.values()].map((g) =>
        `<h3 class="cal-mes">${g.titulo}</h3><ul class="cal-lista">${g.filas.join('')}</ul>`).join('');
}

function fila(t, i) {
    const partes = [];
    partes.push(t.entra == null ? 'ya estaba en orbe' : `entra ${fechaCorta(t.entra)}`);
    partes.push(t.exactos.length
        ? `exacto ${t.exactos.map(fechaCorta).join(', ')}`
        : 'no llega a ser exacto');
    partes.push(t.sale == null ? 'sigue en orbe' : `sale ${fechaCorta(t.sale)}`);
    const pasadas = t.exactos.length > 1 ? ` <span class="cal-pasadas">(${t.exactos.length} pasadas)</span>` : '';
    return `<li><button type="button" class="cal-item" data-cal-item="${i}">
        <span class="cal-titulo">
            <span class="en-transito">${iconoSvg(G_PUNTOS[t.a], 16, NOMBRE_PUNTO[t.a] + ' en tránsito')}</span>${NOMBRE_PUNTO[t.a]}
            <span class="tipo-aspecto ${t.aspecto}">${iconoSvg(G_ASPECTOS[t.aspecto], 16, NOMBRE_ASPECTO[t.aspecto])}</span>${NOMBRE_ASPECTO[t.aspecto].toLowerCase()}
            ${G_PUNTOS[t.b] ? iconoSvg(G_PUNTOS[t.b], 16, NOMBRE_PUNTO[t.b]) : ''}${NOMBRE_PUNTO[t.b]} natal${pasadas}
        </span>
        <span class="cal-fechas">${partes.join(' · ')}</span>
    </button></li>`;
}
