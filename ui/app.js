// Orquesta la pagina: formulario -> huso -> calculo (worker) -> rueda,
// tablas, interpretaciones y llamado a consultar.

import { localAUtc } from '../time/tz.js';
import { dibujarRueda } from './wheel.js';
import {
    tablaPosiciones, tablaAspectos, tablaCasas, detallePunto,
    tablaPosicionesTransito, tablaAspectosTransito, detalleTransito, detalleNatalConTransitos,
    tablaPosicionesRevolucion, detalleRevolucion, tablaAspectosANatal
} from './tables.js';
import { husoEn } from '../time/tz.js';
import { panelHuso } from './huso.js';
import { panelAjustes, ajustesDesde, leerAjustes, guardarAjustes, orbesModificados } from './settings.js';
import { conectarBuscador, opcionesZonas, parsearCoordenada, descripcionLugar } from './form.js';
import { bloquesInterpretacion, idsInterpretacion } from './interp.js';
import { textosInterpretacion, configRemota } from './firestore.js';
import { CONFIG_POR_DEFECTO } from './config.js';
import { evento } from './analytics.js';
import { NOMBRE_PUNTO, escapar, utcTexto, duracionTexto, coordTexto } from './textos.js';
import { SISTEMAS_CASAS } from '../engine/config.js';
import { almacenLocal, igualQue } from './miscartas.js';
import { imagenCarta, entregarImagen } from './descarga.js';
import { listaCalendario, jdDeFecha, fechaDeJd, fechaCorta, fechaParaVer } from './calendario.js';
import { conectarCuenta, sesionIniciada, conCuenta } from './panelCuenta.js';
import { leerArchivoCartas, textoDeArchivo } from './importar.js';

const $ = (sel) => document.querySelector(sel);
const CLAVE_DATOS = 'tucarta:ultima';

// ---------- Estado ----------

const estado = {
    datos: null,        // { nombre, fecha, hora, lugar, correccion, eleccion }
    ajustes: leerAjustes(),
    tz: null,           // resultado de localAUtc
    carta: null,
    seleccion: null,    // punto tocado en la rueda ("t-..." si esta en transito)
    corrigiendoHuso: false,
    // 'natal' | 'revolucion-sola' | 'revolucion' | 'transitos' | 'calendario'
    // | 'progresion-sola' | 'progresion'
    modo: 'natal',
    calendario: null,   // { desde: 'AAAA-MM-DD', lista }
    revolucion: null,   // { anio (null: el proximo cumpleanios), lugar (null: el de nacimiento), resultado }
    progresion: null,   // { fecha: 'AAAA-MM-DD' (a la que se progresa), resultado }
    transito: null,     // { fecha: 'AAAA-MM-DD', hora: 'HH:MM' } en la hora del dispositivo
    transitos: null     // resultado de engine/transits.js
};

// ---------- Worker de calculo ----------

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let siguienteId = 0;
const esperando = new Map();
worker.onmessage = ({ data }) => {
    const p = esperando.get(data.id);
    esperando.delete(data.id);
    if (data.error) p.reject(new Error(data.error));
    else p.resolve(data.carta);
};
const calcularEnWorker = (pedido) => new Promise((resolve, reject) => {
    const id = ++siguienteId;
    esperando.set(id, { resolve, reject });
    worker.postMessage({ id, pedido });
});

// ---------- Formulario ----------

const form = $('#datos');
let lugarElegido = null;
conectarBuscador($('#lugar'), $('#sugerencias'), (l) => { lugarElegido = l; });
let lugarRS = null;
conectarBuscador($('#lugar-rs'), $('#sugerencias-rs'), (l) => { lugarRS = l; });
form.elements.zona.innerHTML = opcionesZonas('America/Argentina/Buenos_Aires');

// Hora en formato 24 h con dos listas: el <input type="time"> sigue el
// formato del dispositivo y en muchos celulares muestra a. m. / p. m.
const dosCifras = (n) => String(n).padStart(2, '0');
const opcionesNum = (n) => '<option value="">--</option>' +
    Array.from({ length: n }, (_, i) => `<option value="${dosCifras(i)}">${dosCifras(i)}</option>`).join('');
form.elements.hh.innerHTML = opcionesNum(24);
form.elements.mm.innerHTML = opcionesNum(60);

// Fecha siempre en DD/MM/AAAA (el <input type="date"> sigue el formato del
// navegador, que puede ser MM/DD). Las barras se agregan solas.
function barrasFecha(e) {
    const n = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join('/');
}
form.elements.fecha.addEventListener('input', barrasFecha);

// Año de dos cifras: hasta 40 es 20xx, desde 41 es 19xx ("28" -> 2028,
// "61" -> 1961). Al salir del campo se completa a la vista.
function anioCompleto(texto) {
    return texto.replace(/^(\d{1,2}\/\d{1,2}\/)(\d{2})$/, (_, dm, aa) => dm + (+aa <= 40 ? '20' : '19') + aa);
}
form.elements.fecha.addEventListener('change', (e) => {
    e.target.value = anioCompleto(e.target.value.trim());
});

// "03/01/1984" -> "1984-01-03", o null si no es una fecha valida.
function fechaIso(texto) {
    const m = anioCompleto(texto).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [d, mes, a] = [+m[1], +m[2], +m[3]];
    const f = new Date(Date.UTC(a, mes - 1, d));
    if (a < 1800 || a > 2399 || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
    return `${a}-${dosCifras(mes)}-${dosCifras(d)}`;
}

function mostrarError(msj) {
    const e = $('#error-form');
    e.textContent = msj;
    e.hidden = !msj;
}

function leerFormulario() {
    const f = form.elements;
    const fecha = fechaIso(f.fecha.value.trim());
    if (!fecha) return 'Revisá la fecha: tiene que ser día, mes y año, por ejemplo 03/01/1984.';
    if (!f.hh.value || !f.mm.value) return 'Falta la hora de nacimiento. Si no la sabés, poné la más aproximada.';
    let lugar = lugarElegido;
    if (!lugar && $('#manual').open) {
        const lat = parsearCoordenada(f.lat.value, 'N', 'S');
        const lon = parsearCoordenada(f.lon.value, 'E', 'WO');
        if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return 'Revisá la latitud y la longitud.';
        lugar = { nombre: 'Coordenadas cargadas a mano', lat, lon, zona: f.zona.value, manual: true };
    }
    if (!lugar) return 'Elegí el lugar de la lista que aparece al escribir, o cargá las coordenadas a mano.';
    return {
        nombre: f.nombre.value.trim(), fecha, hora: `${f.hh.value}:${f.mm.value}`,
        lugar, correccion: null, eleccion: 0
    };
}

// Vistas que usan la revolucion o la progresion, y las que la muestran sola.
const esRS = (m) => m === 'revolucion' || m === 'revolucion-sola';
const esPR = (m) => m === 'progresion' || m === 'progresion-sola';
const esSola = (m) => m === 'revolucion-sola' || m === 'progresion-sola';
const MODOS = ['natal', 'revolucion-sola', 'revolucion', 'transitos', 'calendario', 'progresion-sola', 'progresion'];

// Que calcular. Transitos, calendario y progresiones piden una fecha (hoy
// por defecto); la revolucion, donde se pasa el cumpleanios.
function tipoElegido() {
    const tipo = form.elements.tipo.value;
    $('#campos-transito').hidden = !(tipo === 'transitos' || tipo === 'calendario' || esPR(tipo));
    $('#campos-revolucion').hidden = !esRS(tipo);
    $('#etiqueta-fechaT').textContent = tipo === 'calendario' ? 'Desde' : esPR(tipo) ? 'Progresar al' : 'Fecha del tránsito';
    $('#hora-transito').hidden = tipo !== 'transitos';
    try { localStorage.setItem('tucarta:tipo', tipo); } catch {}
    return tipo;
}
form.elements.tipo.addEventListener('change', tipoElegido);
form.elements.fechaT.addEventListener('input', barrasFecha);
form.elements.fechaT.addEventListener('change', (e) => { e.target.value = anioCompleto(e.target.value.trim()); });

// Fecha del transito pedida en la primera pagina (la de hoy si se borro).
function transitoDelFormulario() {
    const f = form.elements;
    const fecha = fechaIso(f.fechaT.value.trim());
    return fecha ? { fecha, hora: `${f.hhT.value}:${f.mmT.value}` } : momentoLocal(new Date());
}

// El modo con el que se abre una carta: el elegido en la primera pagina.
function modoDelFormulario() {
    estado.modo = tipoElegido();
    if (estado.modo === 'transitos') estado.transito = transitoDelFormulario();
    if (estado.modo === 'calendario') estado.calendario = { desde: transitoDelFormulario().fecha };
    if (esRS(estado.modo)) estado.revolucion = { anio: null, lugar: lugarRS };
    if (esPR(estado.modo)) estado.progresion = { fecha: transitoDelFormulario().fecha };
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = leerFormulario();
    if (typeof datos === 'string') return mostrarError(datos);
    if (form.elements.tipo.value !== 'natal' && form.elements.fechaT.value.trim() && !fechaIso(form.elements.fechaT.value.trim())) {
        return mostrarError('Revisá la fecha del tránsito: tiene que ser día, mes y año, por ejemplo 01/11/2026.');
    }
    mostrarError('');
    modoDelFormulario();
    estado.datos = datos;
    estado.seleccion = null;
    estado.corrigiendoHuso = false;
    await calcular({ nueva: true });
});

// ---------- Calculo ----------

async function calcular({ nueva = false } = {}) {
    const d = estado.datos;
    estado.tz = localAUtc({ fecha: d.fecha, hora: d.hora }, d.lugar.zona, d.correccion);
    const opcion = estado.tz.opciones[d.eleccion] || estado.tz.opciones[0];

    $('#cargando').hidden = false;
    try {
        estado.carta = await calcularEnWorker({
            utc: opcion.utc, lat: d.lugar.lat, lon: d.lugar.lon, ajustes: estado.ajustes
        });
    } catch (err) {
        $('#cargando').hidden = true;
        mostrarError('No pudimos calcular la carta. Revisá los datos y volvé a probar.');
        console.error(err);
        return;
    }
    if (estado.modo === 'transitos') await calcularTransitos();
    if (estado.modo === 'calendario') await calcularCalendario();
    if (esRS(estado.modo)) await calcularRevolucionSolar();
    if (esPR(estado.modo)) await calcularProgresion();
    $('#cargando').hidden = true;
    guardarDatos();
    pintar();
    pintarBotonGuardar();

    if (nueva) {
        evento('carta_calculada', {
            tipo: estado.modo,
            sistema_casas: estado.ajustes.casas,
            orbes_modificados: orbesModificados(estado.ajustes),
            huso_corregido: Boolean(d.correccion)
        });
        $('#huso').open = false;
        $('#aviso-carta').hidden = true;
        form.hidden = true;
        $('.intro').hidden = true;
        $('#mis-cartas').hidden = true;
        $('#resultado').hidden = false;
        $('#resultado').scrollIntoView({ block: 'start' });
    }
}

// ---------- Pintado ----------

function pintar() {
    const { datos: d, carta } = estado;
    $('#titulo-carta').textContent = d.nombre ? `Carta de ${d.nombre}` : 'Tu carta';
    const [a, m, dia] = d.fecha.split('-');
    const sistema = SISTEMAS_CASAS.find((s) => s.id === estado.ajustes.casas)?.nombre;
    $('#resumen-datos').innerHTML = `${dia}/${m}/${a}, ${escapar(d.hora)} h · ` +
        `${escapar(d.lugar.manual ? `${d.lugar.lat.toFixed(4)}, ${d.lugar.lon.toFixed(4)}` : descripcionLugar(d.lugar))}` +
        ` · Casas ${sistema}`;

    pintarControlesTransito();
    $('#huso-contenido').innerHTML = panelHuso(estado.tz, d.eleccion, estado.corrigiendoHuso);
    pintarAdvertencia();
    pintarEsquinas(sistema);

    pintarRueda();
    const conTransitos = estado.modo === 'transitos' && estado.transitos;
    const { sola, externa } = cartasVista();
    $('#tabla-posiciones').innerHTML = sola ? tablaPosiciones(sola)
        : externa ? tablaPosicionesRevolucion(externa, carta, etiquetaExterna())
            : conTransitos ? tablaPosicionesTransito(estado.transitos) : tablaPosiciones(carta);
    const prANatal = externa && esPR(estado.modo) && estado.progresion?.resultado?.aspectosNatal;
    $('#tabla-aspectos').innerHTML = prANatal ? tablaAspectosANatal(prANatal, 'Progresión')
        : sola || externa ? tablaAspectos(sola || externa)
        : conTransitos ? tablaAspectosTransito(estado.transitos) : tablaAspectos(carta);
    $('#tabla-casas').innerHTML = tablaCasas(sola || externa || carta);
    $('#form-ajustes').innerHTML = panelAjustes(estado.ajustes);
    pintarInterpretaciones();
}

// Datos en las esquinas de la rueda, como en Solar Fire: nacimiento a la
// izquierda; huso, coordenadas y casas a la derecha, con el acceso al
// panel del huso (y el aviso, si hay que revisarlo).
function pintarEsquinas(sistema) {
    const d = estado.datos;
    const o = estado.tz.opciones[d.eleccion] || estado.tz.opciones[0];
    const [a, m, dia] = d.fecha.split('-');
    const l = d.lugar;
    // Renglones cortos: mas abajo la rueda deja menos lugar en la esquina.
    const renglonesLugar = (x) => x.manual ? ['Coordenadas', 'a mano'] : [x.nombre, x.provincia, x.paisNombre].filter(Boolean);
    const renglon = (t, clase = '') => t ? `<span class="${clase}">${escapar(t)}</span>` : '';
    const botonHuso = estado.motivoHuso
        ? '<span class="aviso-esquina">ADVERTENCIA</span><button type="button" data-accion="editar-huso">Revisar huso</button>'
        : '<button type="button" data-accion="editar-huso">Editar huso horario</button>';
    const verano = o.verano === null ? '' : o.verano ? `verano +${duracionTexto(o.verano)}` : 'sin horario de verano';
    const { sola, externa } = cartasVista();
    const otra = sola || externa;
    const coords = (x) => renglon(`${coordTexto(x.lat, 'N', 'S')} ${coordTexto(x.lon, 'E', 'O')}`);
    const poner = (izq, der) => {
        $('#esquina-izq').innerHTML = izq.join('');
        $('#esquina-der').innerHTML = der.join('');
    };
    // La natal: el huso se edita tocando el UTC (o desde la Carta Natal).
    const natal = (titulo = 'Carta Natal') => [
        renglon(titulo, 'titulo-esquina'), renglon(`${dia}/${m}/${a}`, 'principal'),
        `<span class="principal">${escapar(d.hora)} h (<button type="button" class="enlace-huso" data-accion="editar-huso">${utcTexto(o.total)}</button>)</span>`,
        ...renglonesLugar(l).map((t) => renglon(t)),
        estado.motivoHuso ? '<span class="aviso-esquina">ADVERTENCIA</span>' : ''
    ];

    if (otra && esRS(estado.modo)) {
        const rs = momentoRevolucionLocal();
        const revo = [
            renglon(`Revolución solar ${estado.revolucion.anio}`, 'titulo-esquina'),
            renglon(rs.fecha, 'principal'), renglon(`${rs.hora} h (${utcTexto(rs.huso)})`, 'principal'),
            ...renglonesLugar(rs.lugar).map((t) => renglon(t))
        ];
        const cambiar = '<button type="button" data-accion="cambiar-lugar-rs">Cambiar lugar</button>';
        // Combinada: la natal adentro (izquierda) y la revolucion afuera
        // (derecha), como en Solar Fire. Sola: la revolucion y su lugar.
        if (externa) poner([renglon('Carta de adentro', 'leyenda'), ...natal()], [renglon('Carta de afuera', 'leyenda'), ...revo, cambiar]);
        else poner(revo, [coords(rs.lugar), renglon(sistema), cambiar]);
        return;
    }
    if (otra && esPR(estado.modo)) {
        const pr = [renglon('Progresiones', 'titulo-esquina'), ...textoProgresion().map((t) => renglon(t, 'principal'))];
        if (externa) poner([renglon('Carta de adentro', 'leyenda'), ...natal()], [renglon('Carta de afuera', 'leyenda'), ...pr]);
        else poner(pr, natal('Natal'));
        return;
    }
    $('#esquina-izq').innerHTML = [
        renglon(`${dia}/${m}/${a}`, 'principal'), renglon(`${d.hora} h`, 'principal'), ...renglonesLugar(l).map((t) => renglon(t))
    ].join('');
    $('#esquina-der').innerHTML = [
        renglon([utcTexto(o.total), d.correccion ? 'corregido a mano' : verano].filter(Boolean).join(' · '), 'principal'),
        renglon(`${coordTexto(l.lat, 'N', 'S')} ${coordTexto(l.lon, 'E', 'O')}`),
        renglon(sistema),
        botonHuso
    ].join('');
}

// Los datos de las esquinas no pisan la rueda: si hace falta (en el
// celular), la rueda baja lo justo y los primeros renglones quedan arriba;
// el resto va por el triangulito del costado. La rueda no se achica.
function acomodarEsquinas() {
    const fig = $('.figura-rueda');
    const svg = $('#rueda svg');
    if (!svg || fig.hidden) return;
    fig.style.paddingTop = '0px';
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2;
    const cy0 = r.top + r.height / 2;
    const radio = r.width * 300 / 664; // borde de la rueda con sus marcas
    const renglones = [...document.querySelectorAll('#esquina-izq > *, #esquina-der > *')]
        .map((el) => el.getBoundingClientRect()).filter((b) => b.width);
    const pisa = (p) => renglones.some((b) => {
        const cy = cy0 + p;
        const x = Math.min(Math.max(cx, b.left), b.right);
        const y = Math.min(Math.max(cy, b.top), b.bottom);
        return Math.hypot(x - cx, y - cy) < radio;
    });
    let p = 0;
    while (p < 240 && pisa(p)) p += 2;
    fig.style.paddingTop = p + 'px';
}
const acomodarLuego = () => requestAnimationFrame(acomodarEsquinas);
window.addEventListener('resize', acomodarLuego);
document.fonts?.ready.then(acomodarLuego);

// Cambiar el lugar de la revolucion sin volver a la primera pagina.
$('.figura-rueda').addEventListener('click', (e) => {
    if (!e.target.closest('[data-accion="cambiar-lugar-rs"]')) return;
    const panel = $('#panel-lugar-rs');
    panel.hidden = false;
    panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('#lugar-rs-nuevo').focus();
});
conectarBuscador($('#lugar-rs-nuevo'), $('#sugerencias-rs-nuevo'), async (l) => {
    if (!l || !estado.revolucion) return;
    estado.revolucion.lugar = l;
    lugarRS = l;
    $('#lugar-rs').value = descripcionLugar(l);
    $('#lugar-rs-nuevo').value = '';
    $('#panel-lugar-rs').hidden = true;
    estado.seleccion = null;
    await calcularRevolucionSolar();
    pintar();
    $('.figura-rueda').scrollIntoView({ block: 'start', behavior: 'smooth' });
});

$('.figura-rueda').addEventListener('click', (e) => {
    if (!e.target.closest('[data-accion="editar-huso"]')) return;
    $('#huso').open = true;
    $('#huso').scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// Si el resultado puede no ser fiel: aviso corto en la esquina de la
// rueda y el motivo completo dentro del panel del huso.
function pintarAdvertencia() {
    const tz = estado.tz;
    const o = tz.opciones[estado.datos.eleccion] || tz.opciones[0];
    let motivo = '';
    if (tz.estado === 'ambigua' || tz.estado === 'inexistente') {
        motivo = 'esa hora coincidió con un cambio de horario. Revisá el huso y elegí cuál corresponde.';
    } else if (tz.estado === 'manual') {
        motivo = '';
    } else if (tz.tentativo) {
        motivo = 'para nacimientos anteriores a 1970 el huso horario puede no ser exacto. Si el Ascendente o las casas no te cierran, revisá el huso.';
    } else if (o.verano === null) {
        motivo = 'para este país no tenemos el detalle histórico del huso horario y del horario de verano. Revisá que el huso sea el correcto.';
    }
    estado.motivoHuso = motivo;
    // El panel ya explica por su cuenta lo de antes de 1970 y las horas
    // ambiguas; el recuadro queda para el caso sin datos de horario de verano.
    const caja = $('#advertencia-huso');
    caja.hidden = !motivo || tz.tentativo || tz.estado === 'ambigua' || tz.estado === 'inexistente';
    caja.innerHTML = motivo ? `<strong>ADVERTENCIA:</strong> ${motivo}` : '';
}

// Que se dibuja: la otra carta (revolucion o progresion) sola, o afuera
// de la natal.
function cartasVista() {
    const otra = esRS(estado.modo) ? estado.revolucion?.resultado?.carta
        : esPR(estado.modo) ? estado.progresion?.resultado?.carta : null;
    return esSola(estado.modo) ? { sola: otra || null, externa: null } : { sola: null, externa: otra || null };
}
const etiquetaExterna = () => (esPR(estado.modo)
    ? { titulo: 'Progresión', sigla: 'PR', de: 'de la progresión' }
    : { titulo: 'Revolución', sigla: 'RS', de: 'de la revolución' });

function pintarRueda() {
    const transitos = estado.modo === 'transitos' ? estado.transitos : null;
    const { sola, externa } = cartasVista();
    const base = sola || estado.carta;
    $('#rueda').innerHTML = dibujarRueda(base, {
        nombres: NOMBRE_PUNTO, seleccion: estado.seleccion,
        clara: tema === 'claro', transitos, revolucion: externa
    });
    acomodarLuego();
    const s = estado.seleccion;
    const e = etiquetaExterna();
    $('#detalle-punto').innerHTML = !s
        ? (transitos ? 'Tocá un planeta natal o en tránsito para ver sus aspectos.'
            : externa ? `Tocá un planeta ${e.de} (afuera) o natal (adentro).`
                : 'Tocá un planeta para ver dónde está y con quién se relaciona.')
        : s.startsWith('r-') ? detalleRevolucion(externa, estado.carta, s, e.de)
        : s.startsWith('t-') ? detalleTransito(transitos, s)
            : transitos ? detalleNatalConTransitos(estado.carta, transitos, s)
                : detallePunto(base, s);
}

// ---------- Transitos ----------

const formTransito = $('#form-transito');
formTransito.elements.hh.innerHTML = opcionesNum(24).replace('<option value="">--</option>', '');
formTransito.elements.mm.innerHTML = opcionesNum(60).replace('<option value="">--</option>', '');
formTransito.elements.fecha.addEventListener('input', barrasFecha);

// Momento del transito en la hora del dispositivo.
function momentoLocal(d) {
    return {
        fecha: `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`,
        hora: `${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`
    };
}
function fechaDeTransito({ fecha, hora }) {
    const [a, m, d] = fecha.split('-').map(Number);
    const [h, mi] = hora.split(':').map(Number);
    return new Date(a, m - 1, d, h, mi);
}

async function calcularTransitos() {
    estado.transito ||= momentoLocal(new Date());
    const t = fechaDeTransito(estado.transito);
    const utc = {
        anio: t.getUTCFullYear(), mes: t.getUTCMonth() + 1, dia: t.getUTCDate(),
        hora: t.getUTCHours(), minuto: t.getUTCMinutes()
    };
    try {
        estado.transitos = await calcularEnWorker({ tipo: 'transitos', utc, natal: estado.carta, ajustes: estado.ajustes });
    } catch (err) {
        console.error(err);
        estado.transitos = null;
    }
}

function pintarControlesTransito() {
    const enTransitos = estado.modo === 'transitos';
    $('#selector-modo').value = estado.modo;
    formTransito.hidden = !enTransitos;
    pintarCalendario();
    pintarControlesRevolucion();
    pintarControlesProgresion();
    if (!enTransitos || !estado.transito) return;
    const f = formTransito.elements;
    if (document.activeElement !== f.fecha) f.fecha.value = estado.transito.fecha.split('-').reverse().join('/');
    [f.hh.value, f.mm.value] = estado.transito.hora.split(':');
    const offset = -fechaDeTransito(estado.transito).getTimezoneOffset() * 60;
    $('#nota-transito').textContent = `Fecha y hora de tu dispositivo (${utcTexto(offset)}).`;
}

async function cambiarTransito(nuevo) {
    estado.transito = nuevo;
    await calcularTransitos();
    pintar();
}

// Menu de la pagina de la carta: cambia la vista al instante y queda
// elegido tambien en el de la primera pagina.
$('#selector-modo').addEventListener('change', async (e) => {
    const modo = e.target.value;
    if (modo === estado.modo) return;
    estado.modo = modo;
    form.elements.tipo.value = modo;
    tipoElegido();
    estado.seleccion = null;
    if (modo === 'transitos') {
        await calcularTransitos();
        evento('transitos_vistos', {});
    }
    if (esRS(modo)) {
        estado.revolucion ||= { anio: null, lugar: lugarRS };
        await calcularRevolucionSolar();
        evento('revolucion_vista', { sola: esSola(modo) });
    }
    if (esPR(modo)) {
        await calcularProgresion();
        evento('progresion_vista', { sola: esSola(modo) });
    }
    if (modo === 'calendario') {
        $('#cargando').hidden = false;
        await calcularCalendario();
        $('#cargando').hidden = true;
        evento('calendario_visto', {});
    }
    pintar();
});

// ---------- Revolucion solar ----------

async function calcularRevolucionSolar() {
    estado.revolucion ||= { anio: null, lugar: null };
    const l = estado.revolucion.lugar || estado.datos.lugar;
    try {
        estado.revolucion.resultado = await calcularEnWorker({
            tipo: 'revolucion', natal: estado.carta, anio: estado.revolucion.anio,
            ahora: jdDeFecha(new Date()), lat: l.lat, lon: l.lon, ajustes: estado.ajustes
        });
        estado.revolucion.anio = estado.revolucion.resultado.anio;
    } catch (err) {
        console.error(err);
        estado.revolucion.resultado = null;
    }
}

// Momento de la revolucion en la hora del lugar del cumpleanios.
function momentoRevolucionLocal() {
    const r = estado.revolucion.resultado;
    const lugar = estado.revolucion.lugar || estado.datos.lugar;
    const utcSeg = Math.round((r.jd - 2440587.5) * 86400);
    const { total } = husoEn(lugar.zona, utcSeg);
    const d = new Date((utcSeg + total) * 1000);
    return {
        fecha: `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`,
        hora: `${dosCifras(d.getUTCHours())}:${dosCifras(d.getUTCMinutes())}`,
        huso: total, lugar
    };
}

function pintarControlesRevolucion() {
    const r = esRS(estado.modo) && estado.revolucion?.resultado;
    $('#controles-rs').hidden = !r;
    if (!r) $('#panel-lugar-rs').hidden = true;
    if (!r) return;
    const m = momentoRevolucionLocal();
    $('#nota-rs').textContent = `Revolución solar ${r.anio}: ${m.fecha} a las ${m.hora} h (${utcTexto(m.huso)}) ` +
        `en ${m.lugar.manual ? 'las coordenadas cargadas' : descripcionLugar(m.lugar)}.`;
}

$('#controles-rs').addEventListener('click', async (e) => {
    const paso = e.target.closest('[data-rs]')?.dataset.rs;
    if (!paso) return;
    estado.revolucion.anio += Number(paso);
    estado.seleccion = null;
    await calcularRevolucionSolar();
    pintar();
});

// ---------- Progresiones secundarias ----------

const NOMBRE_METODO = {
    'arco-long': 'arco solar en longitud', 'arco-ra': 'arco solar en ascensión recta', naibod: 'Naibod en ascensión recta'
};

async function calcularProgresion() {
    estado.progresion ||= { fecha: momentoLocal(new Date()).fecha };
    const [a, m, d] = estado.progresion.fecha.split('-').map(Number);
    try {
        estado.progresion.resultado = await calcularEnWorker({
            tipo: 'progresion', natal: estado.carta,
            jdObjetivo: jdDeFecha(new Date(a, m - 1, d, 12, 0)), ajustes: estado.ajustes
        });
    } catch (err) {
        console.error(err);
        estado.progresion.resultado = null;
    }
}

// ['al 1/11/2026', '42,7 años']
function textoProgresion() {
    const r = estado.progresion.resultado;
    const fecha = estado.progresion.fecha.split('-').reverse().map(Number).join('/');
    return [`al ${fecha}`, `${r.edad.toFixed(1).replace('.', ',')} años`];
}

function pintarControlesProgresion() {
    const r = esPR(estado.modo) && estado.progresion?.resultado;
    $('#controles-pr').hidden = !r;
    if (!r) return;
    const [al, edad] = textoProgresion();
    $('#nota-pr').textContent = `Progresiones ${al} (${edad}). Ascendente y Medio Cielo por ${NOMBRE_METODO[r.metodo]}; se cambia en Ajustes.`;
}

$('#controles-pr').addEventListener('click', async (e) => {
    const paso = e.target.closest('[data-pr]')?.dataset.pr;
    if (!paso) return;
    if (paso === 'hoy') {
        estado.progresion.fecha = momentoLocal(new Date()).fecha;
    } else {
        const [a, m, d] = estado.progresion.fecha.split('-').map(Number);
        estado.progresion.fecha = momentoLocal(new Date(a, m - 1 + Number(paso), d)).fecha;
    }
    estado.seleccion = null;
    await calcularProgresion();
    pintar();
});

// ---------- Calendario de transitos ----------

// Periodo de 6 meses desde la fecha elegida (00:00 del dispositivo).
const MESES_CALENDARIO = 6;
function periodoCalendario() {
    estado.calendario ||= { desde: momentoLocal(new Date()).fecha };
    const [a, m, d] = estado.calendario.desde.split('-').map(Number);
    return { desde: jdDeFecha(new Date(a, m - 1, d)), hasta: jdDeFecha(new Date(a, m - 1 + MESES_CALENDARIO, d)) };
}

async function calcularCalendario() {
    const { desde, hasta } = periodoCalendario();
    try {
        estado.calendario.lista = await calcularEnWorker({
            tipo: 'calendario', natal: estado.carta, desde, hasta, ajustes: estado.ajustes
        });
    } catch (err) {
        console.error(err);
        estado.calendario.lista = null;
    }
}

function pintarCalendario() {
    const visible = estado.modo === 'calendario' && estado.calendario?.lista;
    $('#calendario').hidden = !visible;
    // En el calendario va directo la lista: la rueda aparece al tocar un transito.
    for (const sel of ['.figura-rueda', '.barra-carta', '#huso']) $(sel).hidden = estado.modo === 'calendario';
    if (!visible) return;
    const { desde, hasta } = periodoCalendario();
    $('#cal-periodo').textContent = `Del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
    $('#cal-lista').innerHTML = listaCalendario(estado.calendario.lista, desde, hasta);
}

$('#calendario').addEventListener('click', async (e) => {
    const paso = e.target.closest('[data-cal]')?.dataset.cal;
    const item = e.target.closest('[data-cal-item]')?.dataset.calItem;
    if (paso) {
        const [a, m, d] = estado.calendario.desde.split('-').map(Number);
        estado.calendario = { desde: momentoLocal(new Date(a, m - 1 + Number(paso), d)).fecha };
        $('#cargando').hidden = false;
        await calcularCalendario();
        $('#cargando').hidden = true;
        pintar();
    } else if (item != null) {
        // A la rueda doble, en la fecha exacta del transito.
        const t = estado.calendario.lista[Number(item)];
        const { desde, hasta } = periodoCalendario();
        estado.modo = 'transitos';
        estado.seleccion = 't-' + t.a;
        estado.transito = momentoLocal(fechaDeJd(fechaParaVer(t, desde, hasta)));
        await calcularTransitos();
        pintar();
        $('.modo-carta').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
});

formTransito.addEventListener('click', (e) => {
    const paso = e.target.closest('[data-paso]')?.dataset.paso;
    if (!paso) return;
    const t = fechaDeTransito(estado.transito);
    if (paso === 'hoy') return cambiarTransito(momentoLocal(new Date()));
    if (paso === '-dia' || paso === '+dia') t.setDate(t.getDate() + (paso === '+dia' ? 1 : -1));
    if (paso === '-mes' || paso === '+mes') t.setMonth(t.getMonth() + (paso === '+mes' ? 1 : -1));
    cambiarTransito(momentoLocal(t));
});

formTransito.addEventListener('change', (e) => {
    const f = formTransito.elements;
    if (e.target === f.fecha) f.fecha.value = anioCompleto(f.fecha.value.trim());
    const fecha = fechaIso(f.fecha.value.trim());
    if (!fecha) return; // fecha a medio escribir: se espera
    cambiarTransito({ fecha, hora: `${f.hh.value}:${f.mm.value}` });
});
formTransito.addEventListener('submit', (e) => e.preventDefault());

async function pintarInterpretaciones() {
    const carta = estado.carta;
    $('#interpretaciones').innerHTML = bloquesInterpretacion(carta, {});
    const textos = await textosInterpretacion(idsInterpretacion(carta).map((x) => x.id));
    if (estado.carta === carta) $('#interpretaciones').innerHTML = bloquesInterpretacion(carta, textos);
}

// ---------- Interacciones del resultado ----------

function elegirPunto(id) {
    estado.seleccion = estado.seleccion === id ? null : id;
    pintarRueda();
}

$('#rueda').addEventListener('click', (e) => {
    const g = e.target.closest('[data-punto]');
    if (g) elegirPunto(g.dataset.punto);
});
$('#rueda').addEventListener('keydown', (e) => {
    const g = e.target.closest('[data-punto]');
    if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        elegirPunto(g.dataset.punto);
    }
});

// Pestañas de las tablas.
document.querySelectorAll('.pestanas [role="tab"]').forEach((tab) => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.pestanas [role="tab"]').forEach((t) => {
            const activa = t === tab;
            t.setAttribute('aria-selected', String(activa));
            $('#' + t.getAttribute('aria-controls')).hidden = !activa;
        });
    });
});

// Panel del huso.
$('#huso-contenido').addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    const d = estado.datos;
    if (accion === 'corregir-huso') {
        estado.corrigiendoHuso = true;
        $('#huso').open = true;
        pintar();
    } else if (accion === 'cancelar-huso') {
        estado.corrigiendoHuso = false;
        pintar();
    } else if (accion === 'aplicar-huso') {
        const c = $('#huso-contenido');
        d.correccion = {
            base: Number(c.querySelector('[name="huso-base"]').value),
            verano: Number(c.querySelector('[name="huso-verano"]').value)
        };
        d.eleccion = 0;
        estado.corrigiendoHuso = false;
        evento('huso_corregido', { tentativo: estado.tz.tentativo });
        calcular();
    } else if (accion === 'huso-iana') {
        d.correccion = null;
        calcular();
    }
});
$('#huso-contenido').addEventListener('change', (e) => {
    if (e.target.name === 'eleccion-huso') {
        estado.datos.eleccion = Number(e.target.value);
        calcular();
    }
});

// Ajustes.
$('#form-ajustes').addEventListener('change', () => {
    estado.ajustes = ajustesDesde($('#form-ajustes'), estado.ajustes);
    guardarAjustes(estado.ajustes);
    calcular();
});
$('#form-ajustes').addEventListener('click', (e) => {
    if (e.target.closest('[data-accion="ajustes-defecto"]')) {
        try { localStorage.removeItem('tucarta:ajustes'); } catch {}
        estado.ajustes = leerAjustes();
        calcular();
    }
});

// Otra carta / borrar.
document.querySelector('.acciones').addEventListener('click', (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'otra-carta') {
        mostrarFormulario();
    } else if (accion === 'borrar') {
        if (!confirm('Se borran de este dispositivo tus datos, tus ajustes y las cartas guardadas en él. ¿Seguimos?')) return;
        try {
            localStorage.removeItem(CLAVE_DATOS);
            localStorage.removeItem('tucarta:ajustes');
            localStorage.removeItem('tucarta:tema');
            localStorage.removeItem('tucarta:tipo');
        } catch {}
        almacenLocal.borrarTodas();
        estado.ajustes = leerAjustes();
        form.reset();
        lugarElegido = null;
        mostrarFormulario();
    }
});

$('#resultado').addEventListener('click', (e) => {
    if (e.target.closest('[data-accion="volver"]')) mostrarFormulario();
});

function mostrarFormulario() {
    $('#resultado').hidden = true;
    form.hidden = false;
    $('.intro').hidden = false;
    pintarMisCartas();
    window.scrollTo({ top: 0 });
}

// ---------- Mis cartas ----------

// Al iniciar sesion se cambia por el almacen de la cuenta.
let almacen = almacenLocal;
let guardadas = [];

// Con la sesion iniciada: solo el titulo y el desplegable "Tus cartas"
// (cerrado). Sin sesion: la pregunta y el texto de bienvenida, y "Mis
// cartas" como titulo fijo si hay cartas en el dispositivo.
let modoSesion = null;

async function pintarMisCartas() {
    try { guardadas = await almacen.listar(); } catch (e) { console.error(e); guardadas = []; }
    const sesion = sesionIniciada();
    $('#pregunta-intro').hidden = sesion;
    $('#texto-intro').hidden = sesion;
    const seccion = $('#mis-cartas');
    const titulo = $('#titulo-mis-cartas');
    if (sesion !== modoSesion) {
        modoSesion = sesion;
        titulo.textContent = sesion ? 'Tus cartas' : 'Mis cartas';
        titulo.classList.toggle('fijo', !sesion);
        seccion.open = !sesion;
    }
    seccion.hidden = !$('#resultado').hidden || (!guardadas.length && !sesion);
    // Con muchas cartas, un buscador por nombre.
    $('#buscar-cartas').hidden = guardadas.length <= 8;
    if (!guardadas.length) {
        $('#lista-cartas').innerHTML = '<li class="sin-cartas">Todavía no guardaste ninguna carta.</li>';
        return;
    }
    const busqueda = normalizarTexto($('#buscar-cartas').value);
    const visibles = busqueda ? guardadas.filter((c) => normalizarTexto(c.nombre || '').includes(busqueda)) : guardadas;
    if (!visibles.length) {
        $('#lista-cartas').innerHTML = '<li class="sin-cartas">Ninguna carta con ese nombre.</li>';
        return;
    }
    $('#lista-cartas').innerHTML = visibles.map((c) => {
        const nombre = c.nombre || 'Sin nombre';
        const lugar = c.lugar.manual ? 'Coordenadas a mano' : c.lugar.nombre;
        return `<li>
            <button type="button" class="carta-guardada" data-abrir="${escapar(c.id)}">
                <span class="nombre">${escapar(nombre)}</span>
                <span class="nota">${c.fecha.split('-').reverse().join('/')} · ${escapar(c.hora)} h · ${escapar(lugar)}</span>
            </button>
            <button type="button" class="quitar" data-quitar="${escapar(c.id)}" aria-label="Borrar la carta de ${escapar(nombre)}">×</button>
        </li>`;
    }).join('');
}

// Sin sesion "Mis cartas" es un titulo: no se pliega.
$('#titulo-mis-cartas').addEventListener('click', (e) => {
    if (!sesionIniciada()) e.preventDefault();
});

const normalizarTexto = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
$('#buscar-cartas').addEventListener('input', () => pintarMisCartas());

// ---------- Importar cartas (de Solar Fire; se lee en el navegador) ----------

let paraImportar = [];
$('[data-importar]').addEventListener('click', () => $('#archivo-cartas').click());
$('#archivo-cartas').addEventListener('change', async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    const formatos = new Set();
    let salteadas = 0;
    paraImportar = [];
    for (const a of archivos) {
        const r = leerArchivoCartas(textoDeArchivo(await a.arrayBuffer()));
        if (r.formato) formatos.add(r.formato);
        paraImportar.push(...r.cartas);
        salteadas += r.salteadas;
    }
    pintarImportar([...formatos], salteadas);
    $('#ventana-importar').showModal();
});

function pintarImportar(formatos, salteadas) {
    const hay = paraImportar.length > 0;
    $('#imp-resumen').textContent = hay
        ? `Encontramos ${paraImportar.length} cartas (${formatos.join(', ')}).` +
          (salteadas ? ` ${salteadas} renglones no se pudieron leer.` : '') +
          ' Cada una usa el huso y las coordenadas del archivo, así da igual que en el programa de origen.'
        : 'No encontramos cartas en ese archivo. Por ahora se pueden importar las exportaciones de texto de Solar Fire.';
    $('#imp-todas-caja').hidden = !hay;
    $('#imp-todas').checked = true;
    $('#imp-lista').innerHTML = paraImportar.map((c, i) => `<li><label class="casilla">
        <input type="checkbox" data-i="${i}" checked>
        <span><span class="nombre">${escapar(c.nombre || 'Sin nombre')}</span>
        <span class="nota">${c.fecha.split('-').reverse().join('/')} · ${escapar(c.hora)} h · ${escapar(c.lugar.nombre)}</span></span>
    </label></li>`).join('');
    $('#imp-destino').textContent = hay
        ? (conCuenta() ? 'Se guardan en tu cuenta: las vas a ver desde cualquier dispositivo.' : 'Se guardan en este dispositivo.')
        : '';
    $('[data-imp="importar"]').hidden = !hay;
    contarImportar();
}

function contarImportar() {
    const n = $('#imp-lista').querySelectorAll('input:checked').length;
    const b = $('[data-imp="importar"]');
    b.textContent = n === 1 ? 'Importar 1 carta' : `Importar ${n} cartas`;
    b.disabled = n === 0;
}

$('#ventana-importar').addEventListener('change', (e) => {
    if (e.target.id === 'imp-todas') {
        $('#imp-lista').querySelectorAll('input').forEach((c) => { c.checked = e.target.checked; });
    }
    contarImportar();
});

$('#ventana-importar').addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-imp]')?.dataset.imp;
    if (accion === 'cerrar') {
        $('#ventana-importar').close();
    } else if (accion === 'importar') {
        const elegidas = [...$('#imp-lista').querySelectorAll('input:checked')].map((c) => paraImportar[Number(c.dataset.i)]);
        const b = e.target.closest('button');
        b.disabled = true;
        try {
            const n = await almacen.guardarVarias(elegidas, (hechas, total) => { b.textContent = `Guardando ${hechas} de ${total}…`; });
            evento('cartas_importadas', { cantidad: n });
            $('#ventana-importar').close();
            $('#nota-importar').textContent = n === 1 ? 'Listo: importaste 1 carta.' : `Listo: importaste ${n} cartas.`;
            $('#nota-importar').hidden = false;
            await pintarMisCartas();
            $('#mis-cartas').open = true;
        } catch (err) {
            console.error(err);
            $('#imp-destino').textContent = 'No pudimos guardarlas todas. Probá de nuevo en un rato: las que ya estaban no se duplican.';
            b.disabled = false;
        }
    }
});

$('#lista-cartas').addEventListener('click', async (e) => {
    const abrir = e.target.closest('[data-abrir]')?.dataset.abrir;
    const quitar = e.target.closest('[data-quitar]')?.dataset.quitar;
    if (abrir) {
        const c = guardadas.find((x) => x.id === abrir);
        if (!c) return;
        estado.datos = {
            nombre: c.nombre || '', fecha: c.fecha, hora: c.hora, lugar: c.lugar,
            correccion: c.correccion || null, eleccion: c.eleccion || 0
        };
        estado.seleccion = null;
        estado.corrigiendoHuso = false;
        modoDelFormulario();
        evento('carta_abierta', {});
        await calcular({ nueva: true });
    } else if (quitar) {
        const c = guardadas.find((x) => x.id === quitar);
        if (!c || !confirm(`¿Borrar la carta de ${c.nombre || 'Sin nombre'}?`)) return;
        await almacen.borrar(quitar);
        pintarMisCartas();
    }
});

function avisar(texto) {
    $('#aviso-carta').textContent = texto;
    $('#aviso-carta').hidden = !texto;
}

async function pintarBotonGuardar() {
    try { guardadas = await almacen.listar(); } catch { guardadas = []; }
    const ya = guardadas.some((c) => igualQue(c, estado.datos));
    const b = document.querySelector('[data-accion="guardar"]');
    b.textContent = ya ? 'Guardada en mis cartas ✓' : 'Guardar en mis cartas';
    b.disabled = ya;
}

document.querySelector('.barra-carta').addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'guardar') {
        try {
            await almacen.guardar(estado.datos);
            evento('carta_guardada', {});
            avisar(almacen === almacenLocal
                ? 'Listo: la vas a encontrar en "Mis cartas", en este dispositivo.'
                : 'Listo: la vas a encontrar en "Mis cartas", desde cualquier dispositivo.');
        } catch (err) {
            console.error(err);
            avisar('No pudimos guardarla. Probá de nuevo en un rato.');
        }
        pintarBotonGuardar();
    } else if (accion === 'descargar') {
        const b = e.target.closest('button');
        b.disabled = true;
        try {
            await descargarImagen();
        } catch (err) {
            console.error(err);
            avisar('No pudimos armar la imagen. Probá de nuevo.');
        }
        b.disabled = false;
    }
});

// ---------- Imagen para descargar ----------

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function descargarImagen() {
    // Rueda limpia, sin el planeta tocado, en un contenedor fuera de la vista.
    const caja = $('#para-imagen');
    const transitos = estado.modo === 'transitos' ? estado.transitos : null;
    const { sola, externa } = cartasVista();
    const rs = esRS(estado.modo) && (sola || externa);
    const pr = esPR(estado.modo) && (sola || externa);
    caja.innerHTML = dibujarRueda(sola || estado.carta, { nombres: NOMBRE_PUNTO, clara: tema === 'claro', transitos, revolucion: externa });
    const cs = getComputedStyle(document.body);
    const color = (v) => cs.getPropertyValue(v).trim();
    const d = estado.datos;
    try {
        const fechaT = transitos ? estado.transito.fecha.split('-').reverse().join('/') : '';
        const blob = await imagenCarta(caja.querySelector('svg'), {
            titulo: transitos ? `Tránsitos del ${fechaT}`
                : rs ? `Revolución solar ${estado.revolucion.anio}`
                    : pr ? `Progresiones ${textoProgresion()[0]}` : $('#titulo-carta').textContent,
            datos: rs ? $('#nota-rs').textContent.replace(/^Revolución solar \d+: /, '')
                : transitos || pr ? `${$('#titulo-carta').textContent} · ${$('#resumen-datos').textContent}`
                    : $('#resumen-datos').textContent,
            colores: { fondo: color('--bg'), texto: color('--texto'), suave: color('--texto-suave') }
        });
        const archivo = rs
            ? `revolucion-${slug(d.nombre || 'natal') || 'natal'}-${estado.revolucion.anio}.png`
            : pr
            ? `progresiones-${slug(d.nombre || 'natal') || 'natal'}-${estado.progresion.fecha}.png`
            : transitos
            ? `transitos-${slug(d.nombre || 'natal') || 'natal'}-${estado.transito.fecha}.png`
            : `carta-${slug(d.nombre || 'natal') || 'natal'}-${d.fecha}.png`;
        const como = await entregarImagen(blob, archivo, $('#titulo-carta').textContent);
        if (como !== 'cancelada') evento('imagen_descargada', { fondo: tema, como });
    } finally {
        caja.innerHTML = '';
    }
}

// Llamado a consultar.
document.querySelectorAll('[data-destino]').forEach((a) => {
    a.addEventListener('click', () => evento('clic_consulta', { destino: a.dataset.destino }));
});

async function aplicarConfig() {
    const c = { ...CONFIG_POR_DEFECTO, ...(await configRemota()) };
    const seguro = (u) => /^https:\/\//.test(u || '') ? u : null;
    if (seguro(c.linkSeba)) $('#cta-seba').href = c.linkSeba;
    const egresadxs = seguro(c.linkEgresadxs);
    if (egresadxs) $('#cta-egresadxs').href = egresadxs;
    $('#cta-egresadxs').hidden = !egresadxs;
    $('#nota-egresadxs').hidden = !egresadxs;
}
aplicarConfig();

// ---------- Fondo oscuro / claro (lo elige la persona) ----------

// Claro por defecto; el oscuro, si la persona lo eligio.
let tema = 'claro';
try { tema = localStorage.getItem('tucarta:tema') === 'oscuro' ? 'oscuro' : 'claro'; } catch {}

function aplicarTema(nuevo, { medir = false } = {}) {
    tema = nuevo;
    document.body.classList.toggle('tema-claro', tema === 'claro');
    document.querySelectorAll('[data-tema]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.tema === tema)));
    try { localStorage.setItem('tucarta:tema', tema); } catch {}
    if (estado.carta) pintarRueda();
    if (medir) evento('cambio_fondo', { fondo: tema });
}
document.querySelector('.selector-tema').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tema]');
    if (b) aplicarTema(b.dataset.tema, { medir: true });
});
aplicarTema(tema);

// ---------- Datos guardados en el dispositivo ----------

function guardarDatos() {
    try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(estado.datos)); } catch {}
}

function restaurar() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(CLAVE_DATOS)); } catch {}
    if (!d?.fecha || !d?.lugar) return;
    const f = form.elements;
    f.nombre.value = d.nombre || '';
    f.fecha.value = d.fecha.split('-').reverse().join('/');
    [f.hh.value, f.mm.value] = d.hora.split(':');
    if (d.lugar.manual) {
        $('#manual').open = true;
        f.lat.value = d.lugar.lat;
        f.lon.value = d.lugar.lon;
        f.zona.value = d.lugar.zona;
    } else {
        f.lugar.value = descripcionLugar(d.lugar);
        lugarElegido = d.lugar;
    }
}
restaurar();
pintarMisCartas();

// Selector de la primera pagina: el ultimo elegido, y el transito en el
// momento actual.
form.elements.hhT.innerHTML = opcionesNum(24).replace('<option value="">--</option>', '');
form.elements.mmT.innerHTML = opcionesNum(60).replace('<option value="">--</option>', '');
{
    const ahora = momentoLocal(new Date());
    form.elements.fechaT.value = ahora.fecha.split('-').reverse().join('/');
    [form.elements.hhT.value, form.elements.mmT.value] = ahora.hora.split(':');
    try {
        const tipo = localStorage.getItem('tucarta:tipo');
        if (MODOS.includes(tipo)) form.elements.tipo.value = tipo;
    } catch {}
    tipoElegido();
}

// Cuenta: al entrar o salir cambia donde se guardan las cartas.
conectarCuenta({
    alCambiarAlmacen(nuevo) {
        almacen = nuevo;
        pintarMisCartas();
        if (estado.carta) pintarBotonGuardar();
    }
});
document.addEventListener('tucarta:mis-cartas', () => {
    mostrarFormulario();
    $('#mis-cartas').open = true;
    $('#mis-cartas').scrollIntoView({ block: 'start' });
});
