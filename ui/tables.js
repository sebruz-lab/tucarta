// Tablas de posiciones y de aspectos.

import { SIGNOS as G_SIGNOS, PUNTOS as G_PUNTOS, ASPECTOS as G_ASPECTOS, iconoSvg } from './glyphs.js';
import { NOMBRE_SIGNO, NOMBRE_PUNTO, NOMBRE_ASPECTO, gradoMin, orbeTexto, escapar } from './textos.js';
import { SIGNOS, casaDe } from '../engine/chart.js';

const ELEMENTOS = ['fuego', 'tierra', 'aire', 'agua'];
const iconoSigno = (s) => iconoSvg(G_SIGNOS[s], 16, NOMBRE_SIGNO[s], 'elem-' + ELEMENTOS[SIGNOS.indexOf(s) % 4]);

function filaPunto(p, glifoPunto) {
    return `<tr data-punto="${p.id}">
        <th scope="row">${glifoPunto ? iconoSvg(glifoPunto, 18, NOMBRE_PUNTO[p.id]) : ''}<span>${NOMBRE_PUNTO[p.id]}</span></th>
        <td>${iconoSigno(p.signo)}<span>${NOMBRE_SIGNO[p.signo]}</span></td>
        <td class="num">${gradoMin(p)}</td>
        <td class="num">${p.casa ?? ''}</td>
        <td class="retro">${p.retro ? '<abbr title="Retrógrado">R</abbr>' : ''}</td>
    </tr>`;
}

export function tablaPosiciones(carta) {
    const filas = [
        ...carta.puntos.map((p) => filaPunto(p, G_PUNTOS[p.id])),
        ...carta.angulos.map((a) => filaPunto(a, null))
    ];
    return `<table class="tabla">
        <thead><tr><th>Punto</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa</th><th><span class="visualmente-oculto">Retrógrado</span></th></tr></thead>
        <tbody>${filas.join('')}</tbody>
    </table>`;
}

export function tablaCasas(carta) {
    return `<table class="tabla tabla-casas">
        <thead><tr><th>Casa</th><th>Signo</th><th class="num">Cúspide</th></tr></thead>
        <tbody>${carta.cusps.map((c) => `<tr>
            <th scope="row">${c.casa}</th>
            <td>${iconoSigno(c.signo)}<span>${NOMBRE_SIGNO[c.signo]}</span></td>
            <td class="num">${gradoMin(c)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

export function tablaAspectos(carta) {
    if (!carta.aspectos.length) return '<p class="nota">No hay aspectos mayores con los orbes elegidos.</p>';
    const icono = (id) => (G_PUNTOS[id] ? iconoSvg(G_PUNTOS[id], 16, NOMBRE_PUNTO[id]) : '');
    return `<table class="tabla">
        <thead><tr><th>Aspecto</th><th class="num">Orbe</th><th><span class="visualmente-oculto">Aplicativo o separativo</span></th></tr></thead>
        <tbody>${carta.aspectos.map((a) => `<tr data-a="${a.a}" data-b="${a.b}">
            <th scope="row" class="aspecto">
                ${icono(a.a)}<span>${NOMBRE_PUNTO[a.a]}</span>
                <span class="tipo-aspecto ${a.aspecto}">${iconoSvg(G_ASPECTOS[a.aspecto], 16, NOMBRE_ASPECTO[a.aspecto])}</span>
                ${icono(a.b)}<span>${NOMBRE_PUNTO[a.b]}</span>
            </th>
            <td class="num">${orbeTexto(a.orbe)}</td>
            <td class="ap">${a.aplicativo == null ? '' : a.aplicativo ? '<abbr title="Aplicativo">a</abbr>' : '<abbr title="Separativo">s</abbr>'}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

// Texto del detalle al tocar un planeta en la rueda.
export function detallePunto(carta, id) {
    const p = carta.puntos.find((x) => x.id === id);
    if (!p) return '';
    const asp = carta.aspectos.filter((a) => a.a === id || a.b === id).map((a) => {
        const otro = a.a === id ? a.b : a.a;
        return `${NOMBRE_ASPECTO[a.aspecto].toLowerCase()} a ${NOMBRE_PUNTO[otro]} (${orbeTexto(a.orbe)})`;
    });
    return `<strong>${NOMBRE_PUNTO[id]}</strong> en ${gradoMin(p)} de ${NOMBRE_SIGNO[p.signo]}, casa ${p.casa}` +
        `${p.retro ? ', retrógrado' : ''}.` +
        (asp.length ? `<br><span class="nota">${asp.join(' · ')}</span>` : '');
}

// ---------- Revolucion solar ----------

// Planetas de la revolucion: signo, grado, casa de la revolucion y casa
// natal en la que caen.
// e: { titulo: 'Revolución', sigla: 'RS' } o la de la progresion.
export function tablaPosicionesRevolucion(rs, natal, e = { titulo: 'Revolución', sigla: 'RS' }) {
    const cusps = natal.cusps.map((c) => c.lon);
    return `<table class="tabla">
        <thead><tr><th>${e.titulo}</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa ${e.sigla}</th><th class="num">${e.casaAdentro || 'Casa natal'}</th><th><span class="visualmente-oculto">Retrógrado</span></th></tr></thead>
        <tbody>${rs.puntos.map((p) => `<tr data-punto="r-${p.id}">
            <th scope="row">${iconoSvg(G_PUNTOS[p.id], 18, NOMBRE_PUNTO[p.id])}<span>${NOMBRE_PUNTO[p.id]}</span></th>
            <td>${iconoSigno(p.signo)}<span>${NOMBRE_SIGNO[p.signo]}</span></td>
            <td class="num">${gradoMin(p)}</td>
            <td class="num">${p.casa}</td>
            <td class="num">${casaDe(p.lon, cusps)}</td>
            <td class="retro">${p.retro ? '<abbr title="Retrógrado">R</abbr>' : ''}</td>
        </tr>`).join('')}${rs.angulos.map((p) => `<tr>
            <th scope="row"><span>${NOMBRE_PUNTO[p.id]}</span></th>
            <td>${iconoSigno(p.signo)}<span>${NOMBRE_SIGNO[p.signo]}</span></td>
            <td class="num">${gradoMin(p)}</td>
            <td class="num"></td>
            <td class="num">${casaDe(p.lon, cusps)}</td>
            <td></td>
        </tr>`).join('')}</tbody>
    </table>`;
}

// aspectosNatal: los que ese punto le hace a la carta natal (a = el punto
// de afuera, b = el natal). Se muestran las dos cosas: lo que hace adentro
// de su propia carta y lo que le toca a la natal.
export function detalleRevolucion(rs, natal, idR, de = 'de la revolución', aspectosNatal = null) {
    const id = idR.slice(2);
    const p = rs.puntos.find((x) => x.id === id);
    if (!p) return '';
    const asp = rs.aspectos.filter((a) => a.a === id || a.b === id).map((a) => {
        const otro = a.a === id ? a.b : a.a;
        return `${NOMBRE_ASPECTO[a.aspecto].toLowerCase()} a ${NOMBRE_PUNTO[otro]} (${orbeTexto(a.orbe)})`;
    });
    const aNatal = (aspectosNatal || []).filter((a) => a.a === id).map((a) =>
        `${NOMBRE_ASPECTO[a.aspecto].toLowerCase()} a ${NOMBRE_PUNTO[a.b]} natal (${orbeTexto(a.orbe)})`);
    const renglon = (titulo, lista) => `<br><span class="nota"><strong>${titulo}:</strong> ${lista.join(' · ')}</span>`;
    return `<strong>${NOMBRE_PUNTO[id]} ${de}</strong> en ${gradoMin(p)} de ${NOMBRE_SIGNO[p.signo]}, ` +
        `casa ${p.casa} ${de} y casa ${casaDe(p.lon, natal.cusps.map((c) => c.lon))} natal${p.retro ? ', retrógrado' : ''}.` +
        (asp.length || aspectosNatal
            ? (asp.length ? renglon(`Adentro ${de}`, asp) : '') +
              (aspectosNatal ? renglon('A la natal', aNatal.length ? aNatal : ['sin aspectos con los orbes elegidos']) : '')
            : '');
}

// ---------- Sinastria ----------

// Las dos personas, una debajo de la otra: primero la de afuera (con la
// casa en la que cae en la carta de adentro) y despues la de adentro.
export function tablaPosicionesSinastria(afuera, adentro, { nombreAfuera, nombreAdentro }) {
    const titulo = (t, donde) => `<h4 class="titulo-tabla">${escapar(t)} <span class="nota">(${donde})</span></h4>`;
    return titulo(nombreAfuera, 'afuera')
        + tablaPosicionesRevolucion(afuera, adentro, { titulo: nombreAfuera, sigla: 'af.', casaAdentro: 'Casa adentro' })
        + titulo(nombreAdentro, 'adentro')
        + tablaPosiciones(adentro);
}

export function tablaCasasSinastria(afuera, adentro, { nombreAfuera, nombreAdentro }) {
    const titulo = (t, donde) => `<h4 class="titulo-tabla">${escapar(t)} <span class="nota">(${donde})</span></h4>`;
    return titulo(nombreAfuera, 'afuera') + tablaCasas(afuera)
        + titulo(nombreAdentro, 'adentro') + tablaCasas(adentro);
}

// ---------- Transitos ----------

const iconoTransito = (id) => `<span class="en-transito">${iconoSvg(G_PUNTOS[id], 16, NOMBRE_PUNTO[id] + ' en tránsito')}</span>`;
const iconoNatal = (id) => (G_PUNTOS[id] ? iconoSvg(G_PUNTOS[id], 16, NOMBRE_PUNTO[id]) : '');
const apTexto = (a) => a.aplicativo == null ? '' : a.aplicativo ? '<abbr title="Aplicativo">a</abbr>' : '<abbr title="Separativo">s</abbr>';

// La carta de adentro no siempre es la natal: en la vista draconica con
// transitos draconicos es la draconica. De ahi el nombre que se muestra.
const DE_ADENTRO = 'natal';

// Planetas en transito: signo, grado y casa por la que pasan.
export function tablaPosicionesTransito(transitos, adentro = DE_ADENTRO) {
    return `<table class="tabla">
        <thead><tr><th>En tránsito</th><th>Signo</th><th class="num">Posición</th><th class="num">Casa ${adentro}</th><th><span class="visualmente-oculto">Retrógrado</span></th></tr></thead>
        <tbody>${transitos.puntos.map((p) => `<tr data-punto="t-${p.id}">
            <th scope="row">${iconoTransito(p.id)}<span>${NOMBRE_PUNTO[p.id]}</span></th>
            <td>${iconoSigno(p.signo)}<span>${NOMBRE_SIGNO[p.signo]}</span></td>
            <td class="num">${gradoMin(p)}</td>
            <td class="num">${p.casa}</td>
            <td class="retro">${p.retro ? '<abbr title="Retrógrado">R</abbr>' : ''}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

// Aspectos de los planetas en transito a la carta de adentro.
export function tablaAspectosTransito(transitos, adentro = DE_ADENTRO) {
    if (!transitos.aspectos.length) return '<p class="nota">No hay tránsitos con los orbes elegidos.</p>';
    return `<table class="tabla">
        <thead><tr><th>En tránsito → ${adentro}</th><th class="num">Orbe</th><th><span class="visualmente-oculto">Aplicativo o separativo</span></th></tr></thead>
        <tbody>${transitos.aspectos.map((a) => `<tr>
            <th scope="row" class="aspecto">
                ${iconoTransito(a.a)}<span>${NOMBRE_PUNTO[a.a]}</span>
                <span class="tipo-aspecto ${a.aspecto}">${iconoSvg(G_ASPECTOS[a.aspecto], 16, NOMBRE_ASPECTO[a.aspecto])}</span>
                ${iconoNatal(a.b)}<span>${NOMBRE_PUNTO[a.b]}</span>
            </th>
            <td class="num">${orbeTexto(a.orbe)}</td>
            <td class="ap">${apTexto(a)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

// Detalle al tocar un planeta en transito ("t-saturno").
export function detalleTransito(transitos, idT, adentro = DE_ADENTRO) {
    const id = idT.slice(2);
    const p = transitos.puntos.find((x) => x.id === id);
    if (!p) return '';
    const asp = transitos.aspectos.filter((a) => a.a === id).map((a) =>
        `${NOMBRE_ASPECTO[a.aspecto].toLowerCase()} a ${NOMBRE_PUNTO[a.b]} ${adentro} (${orbeTexto(a.orbe)})`);
    return `<strong>${NOMBRE_PUNTO[id]} en tránsito</strong> en ${gradoMin(p)} de ${NOMBRE_SIGNO[p.signo]}, por tu casa ${p.casa}` +
        `${p.retro ? ', retrógrado' : ''}.` +
        (asp.length ? `<br><span class="nota">${asp.join(' · ')}</span>` : '');
}

// Detalle de un planeta de la carta de adentro con los transitos que recibe.
export function detalleNatalConTransitos(carta, transitos, id, adentro = DE_ADENTRO) {
    const p = [...carta.puntos, ...carta.angulos].find((x) => x.id === id);
    if (!p) return '';
    const asp = transitos.aspectos.filter((a) => a.b === id).map((a) =>
        `${NOMBRE_PUNTO[a.a]} en tránsito, ${NOMBRE_ASPECTO[a.aspecto].toLowerCase()} (${orbeTexto(a.orbe)})`);
    return `<strong>${NOMBRE_PUNTO[id]}</strong> ${adentro} en ${gradoMin(p)} de ${NOMBRE_SIGNO[p.signo]}.` +
        `<br><span class="nota">${asp.length ? 'Recibe: ' + asp.join(' · ') : 'No recibe tránsitos con los orbes elegidos.'}</span>`;
}

// Aspectos de una carta exterior (progresada) a la natal.
export function tablaAspectosANatal(aspectos, titulo) {
    if (!aspectos.length) return '<p class="nota">No hay aspectos con los orbes elegidos.</p>';
    const icono = (id) => (G_PUNTOS[id] ? iconoSvg(G_PUNTOS[id], 16, NOMBRE_PUNTO[id]) : '');
    return `<table class="tabla">
        <thead><tr><th>${titulo} → natal</th><th class="num">Orbe</th><th><span class="visualmente-oculto">Aplicativo o separativo</span></th></tr></thead>
        <tbody>${aspectos.map((a) => `<tr>
            <th scope="row" class="aspecto">
                ${icono(a.a)}<span>${NOMBRE_PUNTO[a.a]}</span>
                <span class="tipo-aspecto ${a.aspecto}">${iconoSvg(G_ASPECTOS[a.aspecto], 16, NOMBRE_ASPECTO[a.aspecto])}</span>
                ${icono(a.b)}<span>${NOMBRE_PUNTO[a.b]}</span>
            </th>
            <td class="num">${orbeTexto(a.orbe)}</td>
            <td class="ap">${apTexto(a)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}
