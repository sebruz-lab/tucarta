// Orquesta la pagina: formulario -> huso -> calculo (worker) -> rueda,
// tablas, interpretaciones y llamado a consultar.

import { localAUtc } from '../time/tz.js';
import { dibujarRueda } from './wheel.js';
import {
    tablaPosiciones, tablaAspectos, tablaCasas, detallePunto,
    tablaPosicionesTransito, tablaAspectosTransito, detalleTransito, detalleNatalConTransitos
} from './tables.js';
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
import { conectarCuenta, sesionIniciada } from './panelCuenta.js';

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
    modo: 'natal',      // 'natal' | 'transitos'
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

// Que calcular: la carta natal sola o con transitos (y, mas adelante,
// revolucion solar). Con transitos se pide tambien la fecha, hoy por defecto.
function tipoElegido() {
    const tipo = form.elements.tipo.value;
    $('#campos-transito').hidden = tipo !== 'transitos';
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
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = leerFormulario();
    if (typeof datos === 'string') return mostrarError(datos);
    if (form.elements.tipo.value === 'transitos' && form.elements.fechaT.value.trim() && !fechaIso(form.elements.fechaT.value.trim())) {
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
    $('#tabla-posiciones').innerHTML = conTransitos ? tablaPosicionesTransito(estado.transitos) : tablaPosiciones(carta);
    $('#tabla-aspectos').innerHTML = conTransitos ? tablaAspectosTransito(estado.transitos) : tablaAspectos(carta);
    $('#tabla-casas').innerHTML = tablaCasas(carta);
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
    const lugar = l.manual ? ['Coordenadas', 'a mano'] : [l.nombre, l.provincia, l.paisNombre].filter(Boolean);
    const renglon = (t, clase = '') => t ? `<span class="${clase}">${escapar(t)}</span>` : '';
    $('#esquina-izq').innerHTML = [
        renglon(`${dia}/${m}/${a}`, 'principal'), renglon(`${d.hora} h`, 'principal'), ...lugar.map((t) => renglon(t))
    ].join('');
    const verano = o.verano === null ? '' : o.verano ? `verano +${duracionTexto(o.verano)}` : 'sin horario de verano';
    $('#esquina-der').innerHTML = [
        renglon([utcTexto(o.total), d.correccion ? 'corregido a mano' : verano].filter(Boolean).join(' · '), 'principal'),
        renglon(`${coordTexto(l.lat, 'N', 'S')} ${coordTexto(l.lon, 'E', 'O')}`),
        renglon(sistema),
        estado.motivoHuso
            ? '<span class="aviso-esquina">ADVERTENCIA</span><button type="button" data-accion="editar-huso">Revisar huso</button>'
            : '<button type="button" data-accion="editar-huso">Editar huso horario</button>'
    ].join('');
}

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

function pintarRueda() {
    const transitos = estado.modo === 'transitos' ? estado.transitos : null;
    $('#rueda').innerHTML = dibujarRueda(estado.carta, {
        nombres: NOMBRE_PUNTO, seleccion: estado.seleccion,
        clara: tema === 'claro', transitos
    });
    const s = estado.seleccion;
    $('#detalle-punto').innerHTML = !s
        ? (transitos ? 'Tocá un planeta natal o en tránsito para ver sus aspectos.' : 'Tocá un planeta para ver dónde está y con quién se relaciona.')
        : s.startsWith('t-') ? detalleTransito(transitos, s)
            : transitos ? detalleNatalConTransitos(estado.carta, transitos, s)
                : detallePunto(estado.carta, s);
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
    document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.modo === estado.modo)));
    formTransito.hidden = !enTransitos;
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

document.querySelector('.modo-carta').addEventListener('click', async (e) => {
    const modo = e.target.closest('[data-modo]')?.dataset.modo;
    if (!modo || modo === estado.modo) return;
    estado.modo = modo;
    estado.seleccion = null;
    if (modo === 'transitos') {
        await calcularTransitos();
        evento('transitos_vistos', {});
    }
    pintar();
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
    if (!guardadas.length) {
        $('#lista-cartas').innerHTML = '<li class="sin-cartas">Todavía no guardaste ninguna carta.</li>';
        return;
    }
    $('#lista-cartas').innerHTML = guardadas.map((c) => {
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
    caja.innerHTML = dibujarRueda(estado.carta, { nombres: NOMBRE_PUNTO, clara: tema === 'claro', transitos });
    const cs = getComputedStyle(document.body);
    const color = (v) => cs.getPropertyValue(v).trim();
    const d = estado.datos;
    try {
        const fechaT = transitos ? estado.transito.fecha.split('-').reverse().join('/') : '';
        const blob = await imagenCarta(caja.querySelector('svg'), {
            titulo: transitos ? `Tránsitos del ${fechaT}` : $('#titulo-carta').textContent,
            datos: transitos
                ? `${$('#titulo-carta').textContent} · ${$('#resumen-datos').textContent}`
                : $('#resumen-datos').textContent,
            colores: { fondo: color('--bg'), texto: color('--texto'), suave: color('--texto-suave') }
        });
        const archivo = transitos
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

let tema = 'oscuro';
try { tema = localStorage.getItem('tucarta:tema') === 'claro' ? 'claro' : 'oscuro'; } catch {}

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
    try { if (localStorage.getItem('tucarta:tipo') === 'transitos') form.elements.tipo.value = 'transitos'; } catch {}
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
