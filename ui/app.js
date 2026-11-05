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
import { NOMBRE_PUNTO, NOMBRE_ASPECTO, NOMBRE_SIGNO, gradoMin, escapar, utcTexto, duracionTexto, coordTexto } from './textos.js';
import { SISTEMAS_CASAS, PUNTOS, ANGULOS } from '../engine/config.js';
import { almacenLocal, igualQue } from './miscartas.js';
import { imagenCarta, imagenEfemerides, entregarImagen } from './descarga.js';
import { listaCalendario, jdDeFecha, fechaDeJd, fechaCorta, fechaParaVer } from './calendario.js';
import { dibujarEfemerides, geometria } from './efemerides.js';
import { normalizarFecha, completarFecha } from './fecha.js';
import { dibujarAnexo } from './anexo.js';
import { calcularAspectos } from '../engine/aspects.js';
import { TRANSITAN_EFEMERIDES } from '../engine/efemerides.js';
import { conectarCuenta, sesionIniciada, conCuenta, abrirEntrar, esAdmin } from './panelCuenta.js';
import { leerArchivoCartas, textoDeArchivo, completarLugares } from './importar.js';
import { buscar as buscarLugar } from './form.js';
import { TIPOS, buscarEnLista } from './miscartas.js';

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
    // | 'progresion-sola' | 'progresion' | 'lunacion'
    modo: 'natal',
    calendario: null,   // { desde: 'AAAA-MM-DD', lista }
    revolucion: null,   // { anio (null: el cumpleanios mas cercano), lugar (null: el de nacimiento), resultado }
    progresion: null,   // { fecha: 'AAAA-MM-DD' (a la que se progresa), resultado }
    lunacion: null,     // { referencia: { fecha, hora } }; el resultado va en estado.transitos
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
// navegador, que puede ser MM/DD). Las barras se agregan solas y "-", "."
// o un espacio valen como barra (ver fecha.js). Al salir del campo, el año
// de dos cifras se completa a la vista.
function barrasFecha(e) {
    e.target.value = normalizarFecha(e.target.value, !e.inputType || e.inputType.startsWith('insert'));
}
form.elements.fecha.addEventListener('input', barrasFecha);
form.elements.fecha.addEventListener('change', (e) => {
    e.target.value = completarFecha(e.target.value.trim());
});

// "03/01/1984" -> "1984-01-03", o null si no es una fecha valida.
function fechaIso(texto) {
    const m = completarFecha(texto).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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

// Vistas que usan la revolucion, la progresion, la relocalizacion o la
// draconica, y las que la muestran sola.
const esRS = (m) => m === 'revolucion' || m === 'revolucion-sola';
const esPR = (m) => m === 'progresion' || m === 'progresion-sola';
const esDR = (m) => m === 'draconica' || m === 'draconica-sola';
const esRL = (m) => m === 'reubicacion';
const esLN = (m) => m === 'lunacion';
const esSola = (m) => m === 'revolucion-sola' || m === 'progresion-sola' || m === 'draconica-sola' || m === 'reubicacion';
const MODOS = ['natal', 'revolucion-sola', 'revolucion', 'transitos', 'lunacion', 'calendario', 'efemerides', 'progresion-sola',
    'progresion', 'reubicacion', 'draconica-sola', 'draconica'];
// Los transitos que se dibujan afuera de la natal: en la vista de transitos
// y en la de la lunacion, que es el cielo del instante de la lunacion.
const transitosDeLaVista = () => (estado.modo === 'transitos' || esLN(estado.modo) ? estado.transitos : null);
// Vistas sin rueda: listas y graficos de tiempo.
const sinRueda = (m) => m === 'calendario' || m === 'efemerides';

// Que calcular. Transitos, calendario y progresiones piden una fecha (hoy
// por defecto); la revolucion, donde se pasa el cumpleanios.
function tipoElegido() {
    const tipo = form.elements.tipo.value;
    $('#campos-transito').hidden = !(tipo === 'transitos' || sinRueda(tipo) || esPR(tipo) || esLN(tipo));
    $('#campos-revolucion').hidden = !(esRS(tipo) || esRL(tipo));
    $('#etiqueta-lugar-rs').textContent = esRL(tipo) ? '¿En qué lugar?' : '¿Dónde pasás tu cumpleaños?';
    $('#etiqueta-fechaT').textContent = sinRueda(tipo) ? 'Desde'
        : esPR(tipo) ? 'Progresar al'
            : esLN(tipo) ? 'Lunación más cercana a' : 'Fecha del tránsito';
    $('#hora-transito').hidden = tipo !== 'transitos';
    try { localStorage.setItem('tucarta:tipo', tipo); } catch {}
    return tipo;
}
form.elements.tipo.addEventListener('change', tipoElegido);
form.elements.fechaT.addEventListener('input', barrasFecha);
form.elements.fechaT.addEventListener('change', (e) => { e.target.value = completarFecha(e.target.value.trim()); });

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
    if (estado.modo === 'efemerides') estado.efemerides = { anio: Number(transitoDelFormulario().fecha.slice(0, 4)) };
    if (esRS(estado.modo)) estado.revolucion = { anio: null, lugar: lugarRS };
    if (esPR(estado.modo)) estado.progresion = { fecha: transitoDelFormulario().fecha };
    if (esRL(estado.modo)) estado.reubicacion = { lugar: lugarRS };
    if (esLN(estado.modo)) estado.lunacion = { referencia: transitoDelFormulario() };
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
    if (estado.modo === 'efemerides') await calcularEfemerides();
    if (esRS(estado.modo)) await calcularRevolucionSolar();
    if (esPR(estado.modo)) await calcularProgresion();
    if (esRL(estado.modo)) await calcularReubicacion();
    if (esDR(estado.modo)) await calcularDraconica();
    if (esLN(estado.modo)) await calcularLunacion();
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
    pintarFichasImpresion(sistema);

    pintarRueda();
    pintarAvisoLunacion();
    const conTransitos = transitosDeLaVista();
    const { sola, externa } = cartasVista();
    $('#tabla-posiciones').innerHTML = sola ? tablaPosiciones(sola)
        : externa ? tablaPosicionesRevolucion(externa, carta, etiquetaExterna())
            : conTransitos ? tablaPosicionesTransito(estado.transitos) : tablaPosiciones(carta);
    const prANatal = externa && esPR(estado.modo) && estado.progresion?.resultado?.aspectosNatal;
    const drANatal = externa && esDR(estado.modo) && estado.draconica?.aspectosNatal;
    $('#tabla-aspectos').innerHTML = prANatal ? tablaAspectosANatal(prANatal, 'Progresión')
        : drANatal ? tablaAspectosANatal(drANatal, 'Dracónica')
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
    // El nombre arriba de todo a la izquierda (en pantalla completa es lo
    // unico que dice de quien es la carta).
    const nombre = renglon(d.nombre, 'nombre-esquina');
    $('.cambiar-carta').hidden = !guardadas.length;
    const poner = (izq, der) => {
        $('#esquina-izq').innerHTML = [nombre, ...izq].join('');
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
    if (otra && esRL(estado.modo)) {
        // El mismo instante del nacimiento, en otro lugar: su hora local ahi.
        const rl = momentoReubicacionLocal();
        poner([renglon('Carta relocalizada', 'titulo-esquina'), renglon(rl.fecha, 'principal'),
            renglon(`${rl.hora} h (${utcTexto(rl.huso)})`, 'principal'), ...renglonesLugar(rl.lugar).map((t) => renglon(t))],
        [coords(rl.lugar), renglon(sistema), '<button type="button" data-accion="cambiar-lugar-rs">Cambiar lugar</button>']);
        return;
    }
    if (otra && esDR(estado.modo)) {
        const dr = [renglon('Carta dracónica', 'titulo-esquina'), renglon(textoNodoDraconica(), 'principal')];
        if (externa) poner([renglon('Carta de adentro', 'leyenda'), ...natal()], [renglon('Carta de afuera', 'leyenda'), ...dr]);
        else poner([...dr, renglon(`${dia}/${m}/${a}`), renglon(`${d.hora} h`), ...renglonesLugar(l).map((t) => renglon(t))], [renglon(sistema)]);
        return;
    }
    if (otra && esPR(estado.modo)) {
        const pr = [renglon('Progresiones', 'titulo-esquina'), ...textoProgresion().map((t) => renglon(t, 'principal'))];
        if (externa) poner([renglon('Carta de adentro', 'leyenda'), ...natal()], [renglon('Carta de afuera', 'leyenda'), ...pr]);
        else poner(pr, natal('Natal'));
        return;
    }
    $('#esquina-izq').innerHTML = [
        nombre, renglon(`${dia}/${m}/${a}`, 'principal'), renglon(`${d.hora} h`, 'principal'), ...renglonesLugar(l).map((t) => renglon(t))
    ].join('');
    $('#esquina-der').innerHTML = [
        renglon([utcTexto(o.total), d.correccion ? 'corregido a mano' : verano].filter(Boolean).join(' · '), 'principal'),
        renglon(`${coordTexto(l.lat, 'N', 'S')} ${coordTexto(l.lon, 'E', 'O')}`),
        renglon(sistema),
        botonHuso
    ].join('');
}

// Fichas de la hoja impresa, como las de Solar Fire: nombre, que carta es,
// fecha, hora con su zona horaria, lugar y coordenadas; y debajo, como se
// calculo (geocentrica, tropical, sistema de casas, nodo real). Con
// otra carta (revolucion, progresiones, transitos), su ficha a la derecha.
function pintarFichasImpresion(sistema) {
    const d = estado.datos;
    const o = estado.tz.opciones[d.eleccion] || estado.tz.opciones[0];
    const linea = (t, clase = '') => (t ? `<span${clase ? ` class="${clase}"` : ''}>${escapar(t)}</span>` : '');
    const lugar = (l) => (l.manual ? ['Coordenadas a mano'] : [[l.nombre, l.provincia, l.paisNombre].filter(Boolean).join(', ')]);
    const coords = (l) => `${coordTexto(l.lat, 'N', 'S')} ${coordTexto(l.lon, 'E', 'O')}`;
    const fecha = (iso) => iso.split('-').reverse().join('/');
    const calculo = ['Geocéntrica', 'Tropical', sistema, 'Nodo real'].map((t) => linea(t, 'calculo')).join('');
    const natal = (titulo) => [
        linea(d.nombre, 'nombre'), linea(titulo), linea(fecha(d.fecha)), linea(`${d.hora} ${utcTexto(o.total)}`),
        ...lugar(d.lugar).map((t) => linea(t)), linea(coords(d.lugar))
    ];
    const { sola, externa } = cartasVista();
    let izq = natal('Carta Natal');
    let der = [];
    if ((sola || externa) && esRS(estado.modo)) {
        const rs = momentoRevolucionLocal();
        const revo = [linea(`Revolución Solar ${estado.revolucion.anio}`), linea(rs.fecha), linea(`${rs.hora} ${utcTexto(rs.huso)}`),
            ...lugar(rs.lugar).map((t) => linea(t)), linea(coords(rs.lugar))];
        if (externa) der = revo;
        else izq = [linea(d.nombre, 'nombre'), ...revo];
    } else if ((sola || externa) && esPR(estado.modo)) {
        const [al, edad] = textoProgresion();
        const pr = [linea('Progresiones secundarias'), linea(al), linea(edad)];
        if (externa) der = pr;
        else izq = [linea(d.nombre, 'nombre'), ...pr, ...lugar(d.lugar).map((t) => linea(t)), linea(coords(d.lugar))];
    } else if ((sola || externa) && esRL(estado.modo)) {
        const rl = momentoReubicacionLocal();
        izq = [linea(d.nombre, 'nombre'), linea('Carta relocalizada'), linea(rl.fecha), linea(`${rl.hora} ${utcTexto(rl.huso)}`),
            ...lugar(rl.lugar).map((t) => linea(t)), linea(coords(rl.lugar))];
        der = [linea('Nacimiento'), linea(fecha(d.fecha)), linea(`${d.hora} ${utcTexto(o.total)}`), ...lugar(d.lugar).map((t) => linea(t))];
    } else if ((sola || externa) && esDR(estado.modo)) {
        const dr = [linea('Carta dracónica'), linea(textoNodoDraconica())];
        if (externa) der = dr;
        else izq = [linea(d.nombre, 'nombre'), ...dr, linea(fecha(d.fecha)), linea(`${d.hora} ${utcTexto(o.total)}`),
            ...lugar(d.lugar).map((t) => linea(t)), linea(coords(d.lugar))];
    } else if (esLN(estado.modo) && laLunacion()) {
        const ln = momentoLunacionLocal();
        der = [linea(tituloLunacion()), linea(fecha(ln.fecha)), linea(`${ln.hora} h`), linea(`En la casa ${laLunacion().casa}`)];
    } else if (estado.modo === 'transitos' && estado.transito) {
        der = [linea('Tránsitos'), linea(fecha(estado.transito.fecha)), linea(`${estado.transito.hora} h`)];
    }
    $('#ficha-izq').innerHTML = izq.join('') + calculo;
    $('#ficha-der').innerHTML = der.join('');
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

// Pantalla completa: la rueda con sus esquinas ocupa toda la pantalla. Con
// el modo del navegador si lo hay; si no (Safari en el iPhone), la figura
// se agranda sobre la pagina.
const enCompleta = () => document.fullscreenElement === $('.figura-rueda') || $('.figura-rueda').classList.contains('completa');
async function pantallaCompleta(entrar) {
    const fig = $('.figura-rueda');
    if (entrar) {
        evento('pantalla_completa', {});
        try {
            if (!fig.requestFullscreen) throw new Error('sin pantalla completa');
            await fig.requestFullscreen({ navigationUI: 'hide' });
        } catch {
            fig.classList.add('completa');
            document.body.classList.add('sin-scroll');
        }
    } else {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        fig.classList.remove('completa');
        document.body.classList.remove('sin-scroll');
    }
    acomodarLuego();
}
document.addEventListener('fullscreenchange', acomodarLuego);
// Panel de pantalla completa: otra carta de "Mis cartas" y las vistas
// (todas menos el calendario, que no tiene rueda). Con mouse, la vista
// cambia al pasar por la palabra; tocando, al tocarla.
$('.figura-rueda').addEventListener('click', (e) => {
    const accion = e.target.closest('[data-completa]')?.dataset.completa;
    if (accion === 'salir') pantallaCompleta(false);
    else if (accion === 'entrar') pantallaCompleta(true);
    else if (accion === 'cartas') mostrarCartasCompleta($('.cartas-completa').hidden);
    const id = e.target.closest('[data-abrir-completa]')?.dataset.abrirCompleta;
    if (id) {
        mostrarCartasCompleta(false);
        abrirGuardada(guardadas.find((c) => c.id === id), { mismaVista: true });
    }
});
$('.selector-completa').addEventListener('change', (e) => cambiarModo(e.target.value));

function mostrarCartasCompleta(abrir) {
    $('.cartas-completa').hidden = !abrir;
    $('.cambiar-carta').setAttribute('aria-expanded', String(abrir));
    if (abrir) {
        $('.buscar-completa').value = '';
        pintarCartasCompleta();
        $('.buscar-completa').focus();
    }
}
function pintarCartasCompleta() {
    const r = buscarEnLista(guardadas.map((c) => c.nombre), $('.buscar-completa').value);
    const marcadas = new Set(r.coinciden);
    $('.lista-completa').innerHTML = guardadas.map((c, i) => `<li${marcadas.has(i) ? ' class="coincide"' : ''}>
        <button type="button" data-abrir-completa="${escapar(c.id)}">${escapar(c.nombre || 'Sin nombre')}
        <span class="nota">${c.fecha.split('-').reverse().join('/')}${c.tipo && c.tipo !== 'natal' ? ' · ' + TIPOS[c.tipo] : ''}</span></button></li>`).join('');
    const li = $('.lista-completa').children[r.indice];
    $('.lista-completa').scrollTop = li ? li.offsetTop : 0;
}
$('.buscar-completa').addEventListener('input', pintarCartasCompleta);
$('.buscar-completa').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    $('.lista-completa .coincide button')?.click();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('.figura-rueda').classList.contains('completa')) pantallaCompleta(false);
});
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
    const rl = esRL(estado.modo);
    if (!l || (rl ? !estado.reubicacion : !estado.revolucion)) return;
    (rl ? estado.reubicacion : estado.revolucion).lugar = l;
    lugarRS = l;
    $('#lugar-rs').value = descripcionLugar(l);
    $('#lugar-rs-nuevo').value = '';
    $('#panel-lugar-rs').hidden = true;
    estado.seleccion = null;
    await (rl ? calcularReubicacion() : calcularRevolucionSolar());
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
        : esPR(estado.modo) ? estado.progresion?.resultado?.carta
            : esRL(estado.modo) ? estado.reubicacion?.carta
                : esDR(estado.modo) ? estado.draconica?.carta : null;
    return esSola(estado.modo) ? { sola: otra || null, externa: null } : { sola: null, externa: otra || null };
}
const etiquetaExterna = () => (esPR(estado.modo)
    ? { titulo: 'Progresión', sigla: 'PR', de: 'de la progresión' }
    : esDR(estado.modo) ? { titulo: 'Dracónica', sigla: 'DR', de: 'de la dracónica' }
        : { titulo: 'Revolución', sigla: 'RS', de: 'de la revolución' });

function pintarRueda() {
    const transitos = transitosDeLaVista();
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
    $('.selector-completa').value = estado.modo;
    formTransito.hidden = !enTransitos;
    pintarCalendario();
    pintarEfemerides();
    pintarControlesRevolucion();
    pintarControlesProgresion();
    pintarControlesLunacion();
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
// Cambio de vista. Van de a uno: si se pide otro mientras se calcula (al
// pasar el mouse por el panel de pantalla completa), queda el ultimo.
let cambiandoModo = false;
let modoPendiente = null;
async function cambiarModo(modo) {
    if (cambiandoModo) {
        modoPendiente = modo;
        return;
    }
    cambiandoModo = true;
    try {
        await aplicarModo(modo);
    } finally {
        cambiandoModo = false;
    }
    if (modoPendiente) {
        const m = modoPendiente;
        modoPendiente = null;
        cambiarModo(m);
    }
}
$('#selector-modo').addEventListener('change', (e) => cambiarModo(e.target.value));

async function aplicarModo(modo) {
    $('#selector-modo').value = modo;
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
    if (esRL(modo)) {
        estado.reubicacion ||= { lugar: lugarRS };
        await calcularReubicacion();
        evento('relocalizada_vista', {});
    }
    if (esDR(modo)) {
        await calcularDraconica();
        evento('draconica_vista', { sola: esSola(modo) });
    }
    if (esLN(modo)) {
        estado.lunacion ||= { referencia: momentoLocal(new Date()) };
        await calcularLunacion();
        evento('lunacion_vista', { tipo: laLunacion()?.tipo || 'ninguna' });
    }
    if (modo === 'calendario') {
        $('#cargando').hidden = false;
        await calcularCalendario();
        $('#cargando').hidden = true;
        evento('calendario_visto', {});
    }
    if (modo === 'efemerides') {
        $('#cargando').hidden = false;
        await calcularEfemerides();
        $('#cargando').hidden = true;
        evento('efemerides_vistas', {});
    }
    pintar();
}

// ---------- Relocalizacion y draconica ----------

// Relocalizada: el mismo instante del nacimiento en otro lugar (cambian el
// Ascendente, el Medio Cielo y las casas; los planetas quedan iguales).
async function calcularReubicacion() {
    estado.reubicacion ||= { lugar: null };
    const l = estado.reubicacion.lugar || estado.datos.lugar;
    const o = estado.tz.opciones[estado.datos.eleccion] || estado.tz.opciones[0];
    try {
        estado.reubicacion.carta = await calcularEnWorker({ utc: o.utc, lat: l.lat, lon: l.lon, ajustes: estado.ajustes });
    } catch (err) {
        console.error(err);
        estado.reubicacion.carta = null;
    }
}

// La hora del nacimiento en el lugar de la relocalizacion.
function momentoReubicacionLocal() {
    const lugar = estado.reubicacion.lugar || estado.datos.lugar;
    return { ...momentoEn(estado.carta.meta.jd, lugar), lugar };
}

// Draconica: la natal medida desde el Nodo Norte (real o medio, segun los
// ajustes), con sus aspectos a la natal.
async function calcularDraconica() {
    const nodo = estado.ajustes.nodoDraconica === 'medio' ? 'medio' : 'real';
    try {
        const carta = await calcularEnWorker({ tipo: 'draconica', natal: estado.carta, nodo });
        const pts = (c) => [...c.puntos, ...c.angulos];
        estado.draconica = {
            carta,
            aspectosNatal: calcularAspectos(pts(carta), pts(estado.carta),
                { orbesPorAspecto: estado.ajustes.orbesTransito, menores: estado.ajustes.menores })
        };
    } catch (err) {
        console.error(err);
        estado.draconica = null;
    }
}
const textoNodoDraconica = () => (estado.draconica?.carta.meta.draconica.nodo === 'medio' ? 'Desde el Nodo medio' : 'Desde el Nodo real');

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
    const lugar = estado.revolucion.lugar || estado.datos.lugar;
    return { ...momentoEn(estado.revolucion.resultado.jd, lugar), lugar };
}

// Fecha y hora de un instante (dia juliano) en la hora local de un lugar.
function momentoEn(jd, lugar) {
    const utcSeg = Math.round((jd - 2440587.5) * 86400);
    const { total } = husoEn(lugar.zona, utcSeg);
    const d = new Date((utcSeg + total) * 1000);
    return {
        fecha: `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`,
        hora: `${dosCifras(d.getUTCHours())}:${dosCifras(d.getUTCMinutes())}`,
        huso: total
    };
}

function pintarControlesRevolucion() {
    const r = esRS(estado.modo) && estado.revolucion?.resultado;
    $('#controles-rs').hidden = !r;
    $('#etiqueta-lugar-rs-nuevo').textContent = esRL(estado.modo) ? '¿En qué lugar?' : '¿Dónde pasás tu cumpleaños?';
    if (!r && !esRL(estado.modo)) $('#panel-lugar-rs').hidden = true;
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

const formProgresion = $('#controles-pr');
formProgresion.elements.fecha.addEventListener('input', barrasFecha);

function pintarControlesProgresion() {
    const r = esPR(estado.modo) && estado.progresion?.resultado;
    formProgresion.hidden = !r;
    if (!r) return;
    const f = formProgresion.elements;
    if (document.activeElement !== f.fecha) f.fecha.value = estado.progresion.fecha.split('-').reverse().join('/');
    const [al, edad] = textoProgresion();
    $('#nota-pr').textContent = `Progresiones ${al} (${edad}). Ascendente y Medio Cielo por ${NOMBRE_METODO[r.metodo]}; se cambia en Ajustes.`;
}

async function cambiarProgresion(fecha) {
    estado.progresion.fecha = fecha;
    estado.seleccion = null;
    await calcularProgresion();
    pintar();
}

// Pasos de un anio, un mes o un dia. El dia sirve para afinar la
// progresion a una fecha puntual.
formProgresion.addEventListener('click', (e) => {
    const paso = e.target.closest('[data-pr]')?.dataset.pr;
    if (!paso) return;
    if (paso === 'hoy') return cambiarProgresion(momentoLocal(new Date()).fecha);
    const [a, m, d] = estado.progresion.fecha.split('-').map(Number);
    const t = new Date(a, m - 1, d);
    const signo = paso.startsWith('-') ? -1 : 1;
    if (paso.endsWith('dia')) t.setDate(t.getDate() + signo);
    if (paso.endsWith('mes')) t.setMonth(t.getMonth() + signo);
    if (paso.endsWith('anio')) t.setFullYear(t.getFullYear() + signo);
    cambiarProgresion(momentoLocal(t).fecha);
});

formProgresion.addEventListener('change', (e) => {
    const f = formProgresion.elements;
    if (e.target !== f.fecha) return;
    f.fecha.value = completarFecha(f.fecha.value.trim());
    const fecha = fechaIso(f.fecha.value.trim());
    if (!fecha) return; // fecha a medio escribir: se espera
    cambiarProgresion(fecha);
});
formProgresion.addEventListener('submit', (e) => e.preventDefault());

// ---------- Lunacion en la carta ----------
//
// La luna nueva o la luna llena mas cercana en el tiempo al momento de
// referencia, dibujada afuera de la natal igual que un transito (que es lo
// que es: el cielo de ese instante), mas en que casa natal cae.

const laLunacion = () => (esLN(estado.modo) ? estado.transitos?.lunacion || null : null);
const tituloLunacion = () => (laLunacion()?.tipo === 'llena' ? 'Luna llena' : 'Luna nueva');
const momentoLunacionLocal = () => momentoLocal(fechaDeJd(laLunacion().jd));
// Donde Seba cuenta que significa cada lunacion.
const PAGINA_LUNACION = { nueva: 'https://sebabru.com/lunanueva', llena: 'https://sebabru.com/lunallena' };
// Medio mes sinodico: alcanza para que la mas cercana sea la de al lado.
const MEDIO_MES = 14.77;

async function calcularLunacion() {
    estado.lunacion ||= { referencia: momentoLocal(new Date()) };
    const t = fechaDeTransito(estado.lunacion.referencia);
    const utc = {
        anio: t.getUTCFullYear(), mes: t.getUTCMonth() + 1, dia: t.getUTCDate(),
        hora: t.getUTCHours(), minuto: t.getUTCMinutes()
    };
    try {
        estado.transitos = await calcularEnWorker({ tipo: 'lunacion', utc, natal: estado.carta, ajustes: estado.ajustes });
    } catch (err) {
        console.error(err);
        estado.transitos = null;
    }
}

function pintarControlesLunacion() {
    const l = laLunacion();
    $('#controles-ln').hidden = !l;
    if (!l) return;
    const ln = momentoLunacionLocal();
    const offset = -fechaDeJd(l.jd).getTimezoneOffset() * 60;
    $('#nota-ln').textContent = `${tituloLunacion()} del ${ln.fecha.split('-').reverse().join('/')} a las ${ln.hora} `
        + `(hora de tu dispositivo, ${utcTexto(offset)}).`;
}

// La linea de abajo de la rueda: en que casa cae y donde leer que
// significa. Se ve en pantalla, en pantalla completa y en la hoja impresa.
function pintarAvisoLunacion() {
    const caja = $('#aviso-lunacion');
    const l = laLunacion();
    caja.hidden = !l;
    if (!l) return;
    caja.innerHTML = `<span class="lunacion-casa">Esta ${escapar(tituloLunacion())} cae en tu casa ${l.casa}</span>`
        + `<span class="lunacion-grado">${gradoMin(l)} de ${escapar(NOMBRE_SIGNO[l.signo])}</span>`
        + `<a class="lunacion-link" href="${PAGINA_LUNACION[l.tipo]}" target="_blank" rel="noopener">`
        + 'Acá encontrás más info de qué significa</a>';
}

$('#controles-ln').addEventListener('click', async (e) => {
    const paso = e.target.closest('[data-ln]')?.dataset.ln;
    if (!paso) return;
    estado.lunacion = paso === 'hoy'
        ? { referencia: momentoLocal(new Date()) }
        : { referencia: momentoLocal(fechaDeJd(laLunacion().jd + Number(paso) * MEDIO_MES)) };
    estado.seleccion = null;
    await calcularLunacion();
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
    for (const sel of ['.figura-rueda', '.barra-carta', '#huso']) $(sel).hidden = sinRueda(estado.modo);
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

// ---------- Efemerides graficas ----------

// Lo elegido (periodo, modulo, planetas y puntos) queda en el dispositivo.
const EF_POR_DEFECTO = { anios: 2, modulo: 30, transitan: TRANSITAN_EFEMERIDES, natales: null };
const PUNTOS_EF = PUNTOS.filter((p) => p.id !== 'luna'); // la Luna da la vuelta al modulo cada dos dias
let ef = { ...EF_POR_DEFECTO };
try { ef = { ...EF_POR_DEFECTO, ...JSON.parse(localStorage.getItem('tucarta:efemerides') || '{}') }; } catch {}
const guardarEf = () => { try { localStorage.setItem('tucarta:efemerides', JSON.stringify(ef)); } catch {} };

function periodoEfemerides() {
    estado.efemerides ||= { anio: new Date().getFullYear() };
    const a = estado.efemerides.anio;
    return { desde: jdDeFecha(new Date(a, 0, 1)), hasta: jdDeFecha(new Date(a + ef.anios, 0, 1)) };
}

async function calcularEfemerides() {
    const { desde, hasta } = periodoEfemerides();
    try {
        estado.efemerides.datos = await calcularEnWorker({
            tipo: 'efemerides', natal: estado.carta, desde, hasta,
            modulo: ef.modulo, planetas: ef.transitan, natales: ef.natales
        });
    } catch (err) {
        console.error(err);
        estado.efemerides.datos = null;
    }
    estado.efemerides.cruce = null;
}

const casilla = (grupo, id, nombre, marcada) =>
    `<label class="casilla"><input type="checkbox" data-ef-${grupo}="${id}"${marcada ? ' checked' : ''}> ${escapar(nombre)}</label>`;

function pintarEfemerides() {
    const e = estado.modo === 'efemerides' && estado.efemerides?.datos;
    $('#efemerides').hidden = !e;
    document.body.classList.toggle('vista-efemerides', Boolean(e));
    if (!e) return;
    const { desde, hasta } = periodoEfemerides();
    $('#ef-periodo').textContent = `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
    $('#ef-subtitulo').dataset.periodo = `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
    $('#ef-subtitulo').textContent = [estado.datos.nombre, 'Tránsitos geocéntricos', `módulo ${ef.modulo}°`].filter(Boolean).join(' · ');
    $('#ef-anios').value = String(ef.anios);
    $('#ef-modulo').value = String(ef.modulo);
    $('#ef-transitan').innerHTML = PUNTOS_EF.map((p) => casilla('t', p.id, NOMBRE_PUNTO[p.id] || p.nombre, ef.transitan.includes(p.id))).join('');
    const natales = [...PUNTOS, ...ANGULOS];
    $('#ef-natales').innerHTML = natales.map((p) => casilla('n', p.id, NOMBRE_PUNTO[p.id] || p.nombre, !ef.natales || ef.natales.includes(p.id))).join('');
    $('#ef-grafico').innerHTML = dibujarEfemerides(e, { hoy: jdDeFecha(new Date()) });
    pintarDetalleEf();
}

function pintarDetalleEf() {
    const e = estado.efemerides.datos;
    const c = e.cruces[estado.efemerides.cruce];
    $('#ef-detalle').innerHTML = !c
        ? 'Pasá el mouse para ver la fecha y el grado; tocá un aspecto para ver el detalle.'
        : `<strong>${escapar(NOMBRE_PUNTO[c.a])} en tránsito, ${escapar(NOMBRE_ASPECTO[c.aspecto].toLowerCase())} a ${escapar(NOMBRE_PUNTO[c.b])} natal</strong>` +
          ` · exacto el ${fechaCorta(c.jd)} <button type="button" class="boton-texto en-linea" data-ef-ver>Ver en la rueda</button>`;
    document.querySelectorAll('#ef-grafico .ef-cruce').forEach((g) => g.classList.toggle('sel', Number(g.dataset.cruce) === estado.efemerides.cruce));
}

async function recalcularEfemerides() {
    guardarEf();
    $('#cargando').hidden = false;
    await calcularEfemerides();
    $('#cargando').hidden = true;
    pintarEfemerides();
}

// Pantalla completa del grafico (con el modo del navegador o, si no hay,
// agrandando la seccion sobre la pagina).
async function efPantallaCompleta(entrar) {
    const s = $('#efemerides');
    if (entrar) {
        evento('pantalla_completa', { vista: 'efemerides' });
        try {
            if (!s.requestFullscreen) throw new Error('sin pantalla completa');
            await s.requestFullscreen({ navigationUI: 'hide' });
        } catch {
            s.classList.add('completa');
            document.body.classList.add('sin-scroll');
        }
    } else {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        s.classList.remove('completa');
        document.body.classList.remove('sin-scroll');
    }
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#efemerides').classList.contains('completa')) efPantallaCompleta(false);
});

async function descargarEfemerides(boton) {
    const d = estado.datos;
    const { desde, hasta } = periodoEfemerides();
    const cs = getComputedStyle(document.body);
    const color = (v) => cs.getPropertyValue(v).trim();
    boton.disabled = true;
    try {
        const blob = await imagenEfemerides($('#ef-grafico svg'), {
            titulo: d.nombre ? `Efemérides gráficas de ${d.nombre}` : 'Efemérides gráficas',
            datos: `Tránsitos geocéntricos · módulo ${ef.modulo}° · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`,
            colores: { fondo: color('--bg'), texto: color('--texto'), suave: color('--texto-suave') }
        });
        const anio = estado.efemerides.anio;
        const como = await entregarImagen(blob, `efemerides-${slug(d.nombre || 'natal') || 'natal'}-${anio}-${anio + ef.anios - 1}.png`, 'Efemérides gráficas');
        if (como !== 'cancelada') evento('imagen_descargada', { vista: 'efemerides', fondo: tema, como });
    } catch (err) {
        console.error(err);
        $('#ef-detalle').textContent = 'No pudimos armar la imagen. Probá de nuevo.';
    }
    boton.disabled = false;
}

$('#efemerides').addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-ef-accion]')?.dataset.efAccion;
    if (accion === 'completa') return efPantallaCompleta(true);
    if (accion === 'salir') return efPantallaCompleta(false);
    if (accion === 'imprimir') {
        evento('carta_impresa', { tipo: 'efemerides' });
        return window.print();
    }
    if (accion === 'descargar') return descargarEfemerides(e.target.closest('button'));
    const paso = e.target.closest('[data-ef]')?.dataset.ef;
    const cruce = e.target.closest('[data-cruce]')?.dataset.cruce;
    if (paso) {
        estado.efemerides.anio += Number(paso) * ef.anios;
        await recalcularEfemerides();
    } else if (cruce != null) {
        estado.efemerides.cruce = Number(cruce);
        pintarDetalleEf();
    } else if (e.target.closest('[data-ef-ver]')) {
        // A la rueda doble, el dia exacto del aspecto.
        const c = estado.efemerides.datos.cruces[estado.efemerides.cruce];
        estado.modo = 'transitos';
        estado.seleccion = 't-' + c.a;
        estado.transito = momentoLocal(fechaDeJd(c.jd));
        await calcularTransitos();
        pintar();
        $('.modo-carta').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
});

$('#efemerides').addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'ef-anios') ef.anios = Number(t.value);
    else if (t.id === 'ef-modulo') ef.modulo = Number(t.value);
    else if (t.dataset.efT) {
        ef.transitan = [...document.querySelectorAll('[data-ef-t]:checked')].map((c) => c.dataset.efT);
    } else if (t.dataset.efN) {
        const marcados = [...document.querySelectorAll('[data-ef-n]:checked')].map((c) => c.dataset.efN);
        ef.natales = marcados.length === PUNTOS.length + ANGULOS.length ? null : marcados;
    } else return;
    const abierto = $('.ef-ajustes').open;
    await recalcularEfemerides();
    $('.ef-ajustes').open = abierto;
});

// Lectura de fecha y grado bajo el mouse (o el dedo).
$('#ef-grafico').addEventListener('pointermove', (e) => {
    const svg = e.target.closest('svg');
    const datos = estado.efemerides?.datos;
    if (!svg || !datos) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const g = geometria(datos);
    const linea = svg.querySelector('.ef-cursor');
    const texto = svg.querySelector('.ef-lectura');
    const dentro = g.dentro(p.x, p.y);
    linea.setAttribute('visibility', dentro ? 'visible' : 'hidden');
    texto.setAttribute('visibility', dentro ? 'visible' : 'hidden');
    if (!dentro) return;
    const grado = g.grado(p.y);
    const gr = Math.floor(grado);
    const min = Math.floor((grado - gr) * 60);
    linea.setAttribute('x1', p.x);
    linea.setAttribute('x2', p.x);
    texto.setAttribute('x', p.x + (p.x > 900 ? -8 : 8));
    texto.setAttribute('text-anchor', p.x > 900 ? 'end' : 'start');
    texto.textContent = `${fechaCorta(g.jd(p.x))} · ${gr}°${String(min).padStart(2, '0')}'`;
});
$('#ef-grafico').addEventListener('pointerleave', () => {
    document.querySelectorAll('#ef-grafico .ef-cursor, #ef-grafico .ef-lectura').forEach((x) => x.setAttribute('visibility', 'hidden'));
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
    if (e.target === f.fecha) f.fecha.value = completarFecha(f.fecha.value.trim());
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
let visibles = []; // las de la lista, con el filtro por tipo

// Con la sesion iniciada: el titulo, "Mis cartas" y "Calculá una nueva
// carta". Sin sesion: la pregunta y el texto de bienvenida, y "Mis cartas"
// si hay cartas en el dispositivo.

// Si la ultima vez habia sesion, "Mis cartas" se muestra desde el arranque
// (en gris, con la ruedita, sin desplegarse) mientras Firebase confirma la
// sesion y llegan las cartas de la cuenta.
let esperandoCuenta = (() => { try { return localStorage.getItem('tucarta:sesion') === '1'; } catch { return false; } })();
let errorCartas = false;
let porBorrar = null; // la carta que pide confirmar el borrado
let pedidoCartas = 0;

async function pintarMisCartas() {
    const n = ++pedidoCartas;
    let lista = [];
    let error = false;
    if (esperandoCuenta) pintarListaCartas();
    else {
        try { lista = await almacen.listar(); } catch (e) { console.error(e); error = true; }
    }
    // Si mientras tanto cambio el almacen, manda el pedido mas nuevo.
    if (n !== pedidoCartas || esperandoCuenta) return;
    guardadas = lista;
    errorCartas = error;
    porBorrar = null;
    pintarListaCartas();
}

function pintarListaCartas() {
    // En orden alfabetico por nombre (sin distinguir tildes ni mayusculas);
    // las de un mismo nombre, por fecha.
    guardadas.sort((a, b) => (a.nombre || 'Sin nombre').localeCompare(b.nombre || 'Sin nombre', 'es', { sensitivity: 'base', numeric: true }) ||
        a.fecha.localeCompare(b.fecha));
    const sesion = sesionIniciada() || esperandoCuenta;
    $('#pregunta-intro').hidden = sesion;
    $('#texto-intro').hidden = sesion;
    const seccion = $('#mis-cartas');
    $('#titulo-calcular').hidden = !sesion || !$('#resultado').hidden;
    seccion.hidden = !$('#resultado').hidden || (!guardadas.length && !sesion);
    seccion.classList.toggle('cargando', esperandoCuenta);
    seccion.setAttribute('aria-busy', String(esperandoCuenta));
    $('#titulo-mis-cartas').setAttribute('aria-disabled', String(esperandoCuenta));
    if (esperandoCuenta) {
        seccion.open = false;
        return;
    }
    // Con muchas cartas, un buscador por nombre; si hay de varios tipos, un
    // filtro por tipo.
    $('#buscar-cartas').hidden = guardadas.length <= 8;
    const tipoDe = (c) => (TIPOS[c.tipo] ? c.tipo : 'natal');
    // Los grupos (por ejemplo, el curso de las inscripciones) tambien se
    // pueden filtrar.
    const grupos = [...new Set(guardadas.map((c) => c.grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const filtroSelect = $('#filtro-cartas');
    const elegido = filtroSelect.value;
    filtroSelect.querySelectorAll('[data-grupo]').forEach((o) => o.remove());
    for (const g of grupos) filtroSelect.add(new Option(g, 'g:' + g));
    filtroSelect.querySelectorAll('option[value^="g:"]').forEach((o) => { o.dataset.grupo = ''; });
    filtroSelect.value = [...filtroSelect.options].some((o) => o.value === elegido) ? elegido : '';
    filtroSelect.hidden = !grupos.length && guardadas.every((c) => tipoDe(c) === 'natal');
    if (filtroSelect.hidden) filtroSelect.value = '';
    if (errorCartas) {
        $('#lista-cartas').innerHTML = '<li class="sin-cartas">No pudimos cargar tus cartas. <button type="button" class="boton-texto en-linea" data-reintentar>Reintentar</button></li>';
        return;
    }
    if (!guardadas.length) {
        $('#lista-cartas').innerHTML = '<li class="sin-cartas">Todavía no guardaste ninguna carta.</li>';
        return;
    }
    const filtro = $('#filtro-cartas').value;
    visibles = guardadas.filter((c) => !filtro || (filtro.startsWith('g:') ? c.grupo === filtro.slice(2) : tipoDe(c) === filtro));
    if (!visibles.length) {
        $('#lista-cartas').innerHTML = '<li class="sin-cartas">Ninguna carta de ese tipo.</li>';
        return;
    }
    $('#lista-cartas').innerHTML = visibles.map((c) => {
        const nombre = c.nombre || 'Sin nombre';
        const lugar = c.lugar.manual ? 'Coordenadas a mano' : c.lugar.nombre;
        // Antes de borrar, la fila misma pregunta (sin el confirm del
        // navegador, que algunos navegadores bloquean en silencio).
        if (c.id === porBorrar) {
            return `<li class="confirmar-borrado">
            <span class="pregunta-borrado">¿Borrar la carta de ${escapar(nombre)}?</span>
            <button type="button" class="boton-texto en-linea" data-borrar-si="${escapar(c.id)}">Borrar</button>
            <button type="button" class="boton-texto en-linea" data-borrar-no>Cancelar</button>
        </li>`;
        }
        return `<li>
            <button type="button" class="carta-guardada" data-abrir="${escapar(c.id)}">
                <span class="nombre">${escapar(nombre)}${tipoDe(c) !== 'natal' ? ` <span class="tipo-carta">${TIPOS[tipoDe(c)]}</span>` : ''}${c.grupo ? ` <span class="tipo-carta">${escapar(c.grupo)}</span>` : ''}</span>
                <span class="nota">${c.fecha.split('-').reverse().join('/')} · ${escapar(c.hora)} h · ${escapar(lugar)}</span>
            </button>
            <button type="button" class="quitar" data-quitar="${escapar(c.id)}" aria-label="Borrar la carta de ${escapar(nombre)}" title="Borrar"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 3h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>
        </li>`;
    }).join('');
    irABusqueda();
}

// El buscador no filtra: la lista salta adonde esta lo que se escribe
// (como en una agenda) y resalta las que coinciden; con errores de tipeo,
// va a lo mas parecido. Con Enter queda parada en la primera, y otro
// Enter la abre.
function irABusqueda(enfocar = false) {
    const lista = $('#lista-cartas');
    const items = [...lista.querySelectorAll(':scope > li')];
    const r = buscarEnLista(visibles.map((c) => c.nombre), $('#buscar-cartas').value);
    const marcadas = new Set(r.coinciden);
    items.forEach((li, i) => li.classList.toggle('coincide', marcadas.has(i)));
    const pista = $('#pista-busqueda');
    pista.textContent = r.como === 'parecido' ? 'No hay ninguna con ese nombre: te mostramos las más parecidas.'
        : r.como === 'orden' ? 'Ninguna carta con ese nombre.' : '';
    pista.hidden = !pista.textContent;
    const li = items[r.indice];
    if (r.como === 'vacio') lista.scrollTop = 0;
    else if (li) lista.scrollTop = li.offsetTop; // la lista es relative: offsetTop es dentro de ella
    if (enfocar && li && marcadas.size) li.querySelector('.carta-guardada').focus({ preventScroll: true });
}

// "Mis cartas" es un casillero que se despliega encima del formulario: el
// titulo (y su flecha) lo abre y lo cierra. Tambien se cierra al tocar
// afuera o con Escape.
document.addEventListener('click', (e) => {
    if ($('#mis-cartas').open && e.target.isConnected && !e.target.closest('#mis-cartas, #ventana-importar')) $('#mis-cartas').open = false;
});
// Mientras cargan, el titulo no despliega el casillero.
$('#titulo-mis-cartas').addEventListener('click', (e) => {
    if (esperandoCuenta) e.preventDefault();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#mis-cartas').open) $('#mis-cartas').open = false;
});

// ---------- Menu del sitio ----------

function abrirMenu(abrir) {
    $('#menu-sitio').hidden = !abrir;
    $('#boton-menu').setAttribute('aria-expanded', String(abrir));
}
$('#boton-menu').addEventListener('click', () => abrirMenu($('#menu-sitio').hidden));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#menu-sitio').hidden) {
        abrirMenu(false);
        $('#boton-menu').focus();
    }
});
document.addEventListener('click', (e) => {
    if (!$('#menu-sitio').hidden && !e.target.closest('#menu-sitio, #boton-menu')) abrirMenu(false);
});
document.querySelector('.comunidad').addEventListener('click', (e) => {
    const red = e.target.closest('[data-comunidad]')?.dataset.comunidad;
    if (red) evento('comunidad', { red });
});

$('#buscar-cartas').addEventListener('input', () => irABusqueda());
$('#buscar-cartas').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    irABusqueda(true);
});
$('#filtro-cartas').addEventListener('change', () => pintarListaCartas());

// ---------- Importar cartas (de Solar Fire; se lee en el navegador) ----------

let paraImportar = [];
// Importar es para quien tiene cuenta: las cartas quedan en su base de datos.
$('[data-importar]').addEventListener('click', () => {
    if (conCuenta()) {
        $('#nota-importar').hidden = true;
        $('#archivo-cartas').click();
        return;
    }
    $('#nota-importar').textContent = 'Para importar tus cartas, entrá con tu cuenta: quedan guardadas en ella y las ves desde cualquier dispositivo.';
    $('#nota-importar').hidden = false;
    abrirEntrar();
});
$('#archivo-cartas').addEventListener('change', async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    const formatos = new Set();
    let salteadas = 0;
    const problemas = [];
    paraImportar = [];
    for (const a of archivos) {
        const r = leerArchivoCartas(textoDeArchivo(await a.arrayBuffer()));
        // Las planillas (inscripciones) son una herramienta interna.
        if (r.formato === 'planilla' && !esAdmin()) continue;
        if (r.formato) formatos.add(r.formato);
        paraImportar.push(...r.cartas);
        salteadas += r.salteadas;
        problemas.push(...r.problemas);
    }
    // De una planilla llega el lugar escrito: se busca como en el formulario.
    let sinLugar = [];
    if (paraImportar.some((c) => c.lugarPorBuscar)) {
        pintarImportar([...formatos], salteadas, problemas, [], true);
        $('#ventana-importar').showModal();
        ({ cartas: paraImportar, sinLugar } = await completarLugares(paraImportar, buscarLugar));
    }
    pintarImportar([...formatos], salteadas, problemas, sinLugar);
    if (!$('#ventana-importar').open) $('#ventana-importar').showModal();
});

function pintarImportar(formatos, salteadas, problemas = [], sinLugar = [], buscando = false) {
    if (buscando) {
        $('#imp-resumen').textContent = `Buscando los lugares de ${paraImportar.length} cartas…`;
        $('#imp-lista').innerHTML = '';
        $('#imp-todas-caja').hidden = true;
        $('[data-imp="importar"]').hidden = true;
        return;
    }
    const hay = paraImportar.length > 0;
    const nombres = (l) => l.slice(0, 8).map((p) => p.nombre || 'Sin nombre').join(', ') + (l.length > 8 ? '…' : '');
    const cuantas = (t) => paraImportar.filter((c) => c.tipo === t).length;
    const otras = [
        [cuantas('revolucion'), 'revolución solar', 'revoluciones solares'],
        [cuantas('evento'), 'evento', 'eventos']
    ].filter(([n]) => n).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`);
    $('#imp-resumen').textContent = hay
        ? `Encontramos ${paraImportar.length} cartas (${formatos.join(', ')}).` +
          (problemas.length ? ` No se pudieron leer ${problemas.length} filas (les falta la fecha, la hora o el lugar): ${nombres(problemas)}.`
              : salteadas ? ` ${salteadas} renglones no se pudieron leer.` : '') +
          (sinLugar.length ? ` No encontramos el lugar de ${sinLugar.length}: ${nombres(sinLugar)}.` : '') +
          (formatos.includes('planilla') ? ' Revisá el lugar de cada una: lo buscamos por el nombre.'
              : ' Cada una usa el huso y las coordenadas del archivo, así da igual que en el programa de origen.') +
          ' El archivo no dice de qué tipo es cada carta: ' +
          (otras.length ? `reconocimos ${otras.join(' y ')}, y el resto quedó como natal.` : 'quedaron todas como natales.') +
          ' Podés cambiarlo en cada una.'
        : 'No encontramos cartas en ese archivo. Por ahora se pueden importar las exportaciones de Solar Fire (.txt o .dat).';
    $('#imp-todas-caja').hidden = !hay;
    $('#imp-todas').checked = true;
    $('#imp-lista').innerHTML = paraImportar.map((c, i) => `<li><label class="casilla">
        <input type="checkbox" data-i="${i}" checked>
        <span><span class="nombre">${escapar(c.nombre || 'Sin nombre')}</span>
        <span class="nota">${c.fecha.split('-').reverse().join('/')} · ${escapar(c.hora)} h · ${escapar(c.lugar.provincia ? descripcionLugar(c.lugar) : c.lugar.nombre)}</span></span>
    </label>
    <select data-tipo="${i}" aria-label="Tipo de carta de ${escapar(c.nombre || 'Sin nombre')}">
        ${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}"${k === c.tipo ? ' selected' : ''}>${v}</option>`).join('')}
    </select></li>`).join('');
    $('#imp-destino').textContent = hay ? 'Se guardan en tu cuenta: las vas a ver desde cualquier dispositivo.' : '';
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
    if (e.target.dataset.tipo != null) paraImportar[Number(e.target.dataset.tipo)].tipo = e.target.value;
    contarImportar();
});

$('#ventana-importar').addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-imp]')?.dataset.imp;
    if (accion === 'cerrar') {
        $('#ventana-importar').close();
    } else if (accion === 'importar') {
        if (!conCuenta()) return $('#ventana-importar').close();
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
    const si = e.target.closest('[data-borrar-si]')?.dataset.borrarSi;
    if (abrir) {
        await abrirGuardada(guardadas.find((x) => x.id === abrir));
    } else if (quitar) {
        porBorrar = quitar;
        pintarListaCartas();
        $('#lista-cartas [data-borrar-no]')?.focus();
    } else if (e.target.closest('[data-borrar-no]')) {
        porBorrar = null;
        pintarListaCartas();
    } else if (si) {
        // La fila se va enseguida (con muchas cartas en la cuenta, volver a
        // pedir la lista tarda); si el borrado falla, vuelve con un aviso.
        const antes = guardadas;
        porBorrar = null;
        guardadas = guardadas.filter((x) => x.id !== si);
        pintarListaCartas();
        try {
            await almacen.borrar(si);
            evento('carta_borrada', {});
        } catch (err) {
            console.error(err);
            guardadas = antes;
            pintarListaCartas();
            $('#pista-busqueda').textContent = 'No pudimos borrarla. Probá de nuevo.';
            $('#pista-busqueda').hidden = false;
        }
    } else if (e.target.closest('[data-reintentar]')) {
        await pintarMisCartas();
    }
});

// Abre una carta guardada. mismaVista: en la vista que se esta mirando
// (desde la pantalla completa); si no, en la elegida en el formulario.
async function abrirGuardada(c, { mismaVista = false } = {}) {
    if (!c) return;
    estado.datos = {
        nombre: c.nombre || '', fecha: c.fecha, hora: c.hora, lugar: c.lugar,
        correccion: c.correccion || null, eleccion: c.eleccion || 0, tipo: c.tipo, grupo: c.grupo
    };
    estado.seleccion = null;
    estado.corrigiendoHuso = false;
    if (mismaVista) {
        form.elements.tipo.value = estado.modo;
        estado.revolucion = null;
    }
    modoDelFormulario();
    evento('carta_abierta', { pantalla_completa: mismaVista });
    await calcular({ nueva: !mismaVista });
}

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
    } else if (accion === 'imprimir' || accion === 'descargar') {
        // Antes, que referencias van debajo de la rueda (planetas, signos,
        // grilla de aspectos).
        abrirAnexo(accion, e.target.closest('button'));
    } else if (accion === 'pantalla-completa') {
        if (!enCompleta()) pantallaCompleta(true);
    } else if (accion === 'ajustes') {
        const panel = $('#ajustes');
        panel.hidden = !panel.hidden;
        e.target.closest('button').setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

// ---------- Referencias debajo de la rueda (impresion e imagen) ----------
// Para quien no conoce los simbolos: tabla de planetas, tabla de signos y
// grilla de aspectos (ver anexo.js). Lo elegido queda en el dispositivo.
let incluirAnexo = { planetas: false, signos: false, aspectos: false };
try { incluirAnexo = { ...incluirAnexo, ...JSON.parse(localStorage.getItem('tucarta:anexo') || '{}') }; } catch {}
let pedidoAnexo = null;

function abrirAnexo(accion, boton) {
    pedidoAnexo = { accion, boton };
    const v = $('#ventana-anexo');
    v.querySelectorAll('[data-incluir]').forEach((c) => { c.checked = Boolean(incluirAnexo[c.dataset.incluir]); });
    // En la lunacion afuera estan solo el Sol y la Luna: las tablas de
    // planetas y de signos (con los nombres de los aspectos) no entran en la
    // hoja y tampoco hacen falta. Queda la grilla de los aspectos que hace.
    // Las casillas se esconden, no se destildan: la eleccion para las otras
    // vistas queda como estaba.
    for (const cual of ['planetas', 'signos']) {
        v.querySelector(`[data-incluir="${cual}"]`).closest('.casilla').hidden = esLN(estado.modo);
    }
    v.querySelector('[data-anexo="seguir"]').textContent = accion === 'imprimir' ? 'Imprimir' : 'Descargar imagen';
    v.showModal();
}

$('#ventana-anexo').addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-anexo]')?.dataset.anexo;
    if (!accion) return;
    const v = $('#ventana-anexo');
    if (accion === 'cerrar') return v.close();
    v.querySelectorAll('[data-incluir]').forEach((c) => { incluirAnexo[c.dataset.incluir] = c.checked; });
    try { localStorage.setItem('tucarta:anexo', JSON.stringify(incluirAnexo)); } catch {}
    v.close();
    const { accion: que, boton } = pedidoAnexo || {};
    const referencias = Object.keys(incluirAnexo).filter((k) => incluirAnexo[k]).join(',') || 'ninguna';
    if (que === 'imprimir') {
        evento('carta_impresa', { tipo: estado.modo, referencias });
        imprimirCarta();
    } else if (que === 'descargar') {
        if (boton) boton.disabled = true;
        try {
            await descargarImagen();
        } catch (err) {
            console.error(err);
            avisar('No pudimos armar la imagen. Probá de nuevo.');
        }
        if (boton) boton.disabled = false;
    }
});

// El anexo de la vista actual: en una carta sola, la grilla triangular de
// sus aspectos; en las dobles, la cuadrada de la de afuera a la natal.
function anexoActual() {
    const { sola, externa } = cartasVista();
    const transitos = transitosDeLaVista();
    const base = sola || estado.carta;
    const pts = (c) => [...c.puntos, ...c.angulos];
    const ids = (c) => pts(c).map((p) => p.id);
    let filas, columnas, aspectos, triangular, tituloGrilla = '';
    if (transitos) {
        filas = transitos.puntos.map((p) => p.id);
        columnas = ids(estado.carta);
        aspectos = transitos.aspectos;
        triangular = false;
        tituloGrilla = esLN(estado.modo) ? `${tituloLunacion()} a la natal` : 'Tránsitos a la natal';
    } else if (externa) {
        filas = ids(externa);
        columnas = ids(estado.carta);
        aspectos = esPR(estado.modo)
            ? (estado.progresion?.resultado?.aspectosNatal || [])
            : esDR(estado.modo) ? (estado.draconica?.aspectosNatal || [])
            : calcularAspectos(pts(externa), pts(estado.carta), { orbesPorAspecto: estado.ajustes.orbesTransito, menores: estado.ajustes.menores });
        triangular = false;
        tituloGrilla = `${etiquetaExterna().titulo} a la natal`;
    } else {
        filas = columnas = ids(base);
        aspectos = base.aspectos || [];
        triangular = true;
    }
    const incluir = esLN(estado.modo)
        ? { planetas: false, signos: false, aspectos: incluirAnexo.aspectos }
        : incluirAnexo;
    return dibujarAnexo({ incluir, puntos: columnas, nombres: NOMBRE_PUNTO, filas, columnas, aspectos, triangular, tituloGrilla });
}

function imprimirCarta() {
    const anexo = anexoActual();
    $('#anexo-impresion').innerHTML = anexo;
    document.body.classList.toggle('con-anexo', Boolean(anexo));
    window.print();
}
window.addEventListener('afterprint', () => {
    $('#anexo-impresion').innerHTML = '';
    document.body.classList.remove('con-anexo');
});

// ---------- Imagen para descargar ----------

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function descargarImagen() {
    // Rueda limpia, sin el planeta tocado, en un contenedor fuera de la vista.
    const caja = $('#para-imagen');
    const transitos = transitosDeLaVista();
    const { sola, externa } = cartasVista();
    const rs = esRS(estado.modo) && (sola || externa);
    const pr = esPR(estado.modo) && (sola || externa);
    const rl = esRL(estado.modo) && sola;
    const dr = esDR(estado.modo) && (sola || externa);
    caja.innerHTML = dibujarRueda(sola || estado.carta, { nombres: NOMBRE_PUNTO, clara: tema === 'claro', transitos, revolucion: externa }) + anexoActual();
    const cs = getComputedStyle(document.body);
    const color = (v) => cs.getPropertyValue(v).trim();
    const d = estado.datos;
    try {
        const ln = esLN(estado.modo) && laLunacion() ? momentoLunacionLocal() : null;
        const fechaT = ln ? ln.fecha.split('-').reverse().join('/')
            : transitos ? estado.transito.fecha.split('-').reverse().join('/') : '';
        const blob = await imagenCarta(caja.querySelector('svg.rueda'), {
            anexo: caja.querySelector('svg.anexo'),
            titulo: ln ? `${tituloLunacion()} del ${fechaT} en tu casa ${laLunacion().casa}`
                : transitos ? `Tránsitos del ${fechaT}`
                : rs ? `Revolución solar ${estado.revolucion.anio}`
                    : pr ? `Progresiones ${textoProgresion()[0]}`
                        : rl ? `Carta relocalizada en ${descripcionLugar(momentoReubicacionLocal().lugar)}`
                            : dr ? 'Carta dracónica' : $('#titulo-carta').textContent,
            datos: rs ? $('#nota-rs').textContent.replace(/^Revolución solar \d+: /, '')
                : transitos || pr || rl || dr ? `${$('#titulo-carta').textContent} · ${$('#resumen-datos').textContent}`
                    : $('#resumen-datos').textContent,
            colores: { fondo: color('--bg'), texto: color('--texto'), suave: color('--texto-suave') }
        });
        const archivo = ln
            ? `lunacion-${slug(d.nombre || 'natal') || 'natal'}-${ln.fecha}.png`
            : rs
            ? `revolucion-${slug(d.nombre || 'natal') || 'natal'}-${estado.revolucion.anio}.png`
            : pr
            ? `progresiones-${slug(d.nombre || 'natal') || 'natal'}-${estado.progresion.fecha}.png`
            : rl
            ? `relocalizada-${slug(d.nombre || 'natal') || 'natal'}-${slug(momentoReubicacionLocal().lugar.nombre || 'lugar') || 'lugar'}.png`
            : dr
            ? `draconica-${slug(d.nombre || 'natal') || 'natal'}-${d.fecha}.png`
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
// Impresa, siempre en fondo claro (sin cambiar lo que eligio la persona).
let temaAntesDeImprimir = null;
window.addEventListener('beforeprint', () => {
    if (tema === 'claro') return;
    temaAntesDeImprimir = tema;
    tema = 'claro';
    document.body.classList.add('tema-claro');
    if (estado.carta) pintarRueda();
});
window.addEventListener('afterprint', () => {
    if (!temaAntesDeImprimir) return;
    tema = temaAntesDeImprimir;
    temaAntesDeImprimir = null;
    document.body.classList.remove('tema-claro');
    if (estado.carta) pintarRueda();
});
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
        esperandoCuenta = false;
        pintarMisCartas();
        if (estado.carta) pintarBotonGuardar();
    }
});

// ---------- Cartas por enlace ----------
// Datos de nacimiento en la direccion, como base64url de
// { nombre, fecha 'AAAA-MM-DD', hora 'HH:MM', lugar { nombre, provincia,
// pais, paisNombre, lat, lon, zona } }:
//   - /cartas/#carta=...: abre esa carta natal, con los textos de Sol, Luna
//     y Ascendente desplegados. La usa el formulario de otras paginas del
//     sitio ("si no conocés tu Sol, Luna y Ascendente..."), que la abre en
//     una pestaña nueva.
//   - /cartas/#hoja=...: la deja lista para imprimir; avisa con
//     window.hojaLista (o window.hojaError). La usa la funcion que manda la
//     carta por mail a cada inscripto (la imprime a PDF en un Chrome del
//     servidor). No manda eventos.
function datosDeEnlace(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    const l = d.lugar || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || !/^\d{2}:\d{2}$/.test(d.hora) ||
        !Number.isFinite(l.lat) || !Number.isFinite(l.lon) || typeof l.zona !== 'string') throw new Error('datos incompletos');
    return {
        nombre: String(d.nombre || '').slice(0, 60), fecha: d.fecha, hora: d.hora,
        lugar: { nombre: l.nombre, provincia: l.provincia, pais: l.pais, paisNombre: l.paisNombre, lat: l.lat, lon: l.lon, zona: l.zona },
        correccion: null, eleccion: 0
    };
}

// La vista con la que abre un enlace: "#vista=lunacion" sola, o
// "&vista=..." detras de "#carta=". Una vista que no existe se ignora.
function vistaDelEnlace() {
    const m = /[#&]vista=([a-z-]+)/.exec(location.hash);
    return m && MODOS.includes(m[1]) ? m[1] : null;
}

// "#vista=lunacion" sin datos: desde una pagina del sitio ("mira donde cae
// en tu carta"). Queda elegida en el formulario y, si la persona ya habia
// calculado su carta en este navegador, se abre directo en esa vista.
async function abrirVista(vista) {
    history.replaceState(null, '', location.pathname + location.search);
    form.elements.tipo.value = vista;
    tipoElegido();
    const datos = leerFormulario();
    if (typeof datos === 'string') return; // sin carta previa: queda el formulario listo
    modoDelFormulario();
    estado.datos = datos;
    estado.seleccion = null;
    estado.corrigiendoHuso = false;
    await calcular({ nueva: true });
    evento('vista_desde_enlace', { vista });
}

async function abrirEnlace() {
    const vista = vistaDelEnlace();
    const m = /^#(hoja|carta)=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return vista ? abrirVista(vista) : undefined;
    const hoja = m[1] === 'hoja';
    if (hoja) window.gtag = () => {};
    try {
        estado.datos = datosDeEnlace(m[2]);
        // La carta queda en la calculadora: la direccion vuelve a ser la de siempre.
        if (!hoja) history.replaceState(null, '', location.pathname + location.search);
        // La hoja del mail es siempre la natal.
        form.elements.tipo.value = hoja ? 'natal' : vista || 'natal';
        modoDelFormulario();
        await calcular({ nueva: true });
        if (!estado.carta) throw new Error('no se pudo calcular');
        if (hoja) {
            // La hoja que se manda por mail lleva siempre las referencias de
            // planetas y signos: quien la recibe no conoce los glifos, y sin
            // la tabla con los nombres la rueda no se puede leer. La grilla de
            // aspectos no va: es para quien ya sabe mirarla.
            incluirAnexo = { planetas: true, signos: true, aspectos: false };
            $('#anexo-impresion').innerHTML = anexoActual();
            document.body.classList.add('con-anexo');
            await document.fonts.ready;
            window.hojaLista = true;
        } else {
            if (estado.modo === 'natal') $('.desplegable-interp').open = true;
            evento('carta_desde_enlace', { vista: estado.modo });
        }
    } catch (err) {
        if (hoja) window.hojaError = String(err?.message || err);
        else console.error(err);
    }
}
abrirEnlace();
