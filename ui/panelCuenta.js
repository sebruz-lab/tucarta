// Interfaz de la cuenta: boton de la cabecera, ventana para entrar o crear
// la cuenta, aviso de privacidad y panel "Tu cuenta" dentro de Mis cartas.
//
// Avisa a app.js que almacen usar: el del dispositivo o el de la cuenta.

import { almacenLocal } from './miscartas.js';
import { escapar } from './textos.js';
import { evento } from './analytics.js';

const $ = (sel) => document.querySelector(sel);

// estado: 'cargando' | 'fuera' | 'sin-aceptar' | 'adentro'
const cuenta = { estado: 'cargando', email: '', novedades: false, datos: null, admin: false };
let mod = null;           // cuenta.js, cuando termina de cargar
let alCambiar = () => {};
let pedirAjustes = null;  // lo pone app.js: abre la ventana de ajustes
let quiereUsarla = false; // entro desde la ventana: seguir al aviso
let cuentaNueva = false;  // la ultima entrada con Google creo la cuenta

export const conCuenta = () => cuenta.estado === 'adentro';
export const sesionIniciada = () => cuenta.estado === 'adentro' || cuenta.estado === 'sin-aceptar';
// Las cuentas de Seba (las mismas que administran la escuela): ven las
// herramientas internas, como importar la planilla de inscripciones. La
// lista de admins vive solo en el servidor (functions/index.js); acá no se
// compara ningún email, solo se confirma lo que dijo chequearAdmin().
export const esAdmin = () => conCuenta() && cuenta.admin === true;

// Para el formulario de suscripcion del pie: a quien ya dijo que si en su
// cuenta no se le vuelve a preguntar, y a quien entro pero no dijo nada se le
// ahorra tipear el mail. `avisarmeDeLaCuenta` repite el aviso cada vez que la
// sesion cambia, porque el formulario se monta antes de que Firebase conteste.
export const estadoDeNovedades = () => ({
    dentro: conCuenta(),
    mail: cuenta.email || '',
    novedades: Boolean(cuenta.novedades),
});
const oyentesDeCuenta = new Set();
export const avisarmeDeLaCuenta = (fn) => { oyentesDeCuenta.add(fn); };

// alCambiarAlmacen(almacen): se llama cada vez que cambia donde se guardan
// las cartas.
export function conectarCuenta({ alCambiarAlmacen, alPedirAjustes }) {
    alCambiar = alCambiarAlmacen;
    pedirAjustes = alPedirAjustes;
    pintar();
    // Firebase Auth pesa: se baja despues de mostrar la calculadora.
    import('./cuenta.js').then((m) => {
        mod = m;
        m.alCambiarSesion(sesionCambiada);
    }).catch((e) => {
        console.error(e);
        cuenta.estado = 'fuera';
        pintar();
        alCambiar(almacenLocal);
    });
}

// Pista para la proxima visita: habia sesion (asi "Mis cartas" se muestra
// cargando desde el arranque, sin esperar a Firebase).
function pistaSesion(hay) {
    try {
        if (hay) localStorage.setItem('tucarta:sesion', '1');
        else localStorage.removeItem('tucarta:sesion');
    } catch {}
}

async function sesionCambiada(usuario) {
    pistaSesion(Boolean(usuario));
    if (!usuario) {
        Object.assign(cuenta, { estado: 'fuera', email: '', datos: null, admin: false });
        pintar();
        alCambiar(almacenLocal);
        return;
    }
    cuenta.email = usuario.email || '';
    cuenta.admin = await mod.chequearAdmin(usuario);
    cuenta.datos = mod.datosDeCuenta(usuario);
    let perfil = null;
    try { perfil = await cuenta.datos.perfil(); } catch (e) { console.error(e); }
    if (perfil) {
        Object.assign(cuenta, { estado: 'adentro', novedades: Boolean(perfil.novedades) });
        cerrarVentana();
        pintar();
        alCambiar(cuenta.datos.almacen);
    } else {
        cuenta.estado = 'sin-aceptar';
        pintar();
        alCambiar(almacenLocal);
        if (quiereUsarla) mostrarPaso('aceptar');
    }
}

// ---------- Ventana ----------

const ventana = () => $('#ventana-cuenta');

export function abrirEntrar() {
    quiereUsarla = true;
    if (cuenta.estado === 'sin-aceptar') mostrarPaso('aceptar');
    else mostrarPaso('entrar');
    if (!ventana().open) ventana().showModal();
}

function cerrarVentana() {
    if (ventana().open) ventana().close();
}

function mostrarPaso(paso) {
    ventana().querySelectorAll('[data-paso]').forEach((p) => { p.hidden = p.dataset.paso !== paso; });
    error('');
    if (paso === 'aceptar') {
        // Con que cuenta entro: si se acaba de crear hay que decirlo, porque
        // si ya tenia otra sus cartas no estan ahi.
        const aviso = $('#aviso-cuenta');
        aviso.hidden = !cuenta.email;
        aviso.textContent = !cuenta.email ? ''
            : cuentaNueva
                ? `Creamos una cuenta nueva con ${cuenta.email}. Si ya tenías otra, cerrá esta y volvé a entrar con ese mail.`
                : `Entraste con ${cuenta.email}.`;
        almacenLocal.listar().then((l) => {
            $('#pasar-locales').hidden = !l.length;
            $('#pasar-locales').textContent = l.length === 1
                ? 'También pasamos a tu cuenta la carta que tenés guardada en este dispositivo.'
                : `También pasamos a tu cuenta las ${l.length} cartas que tenés guardadas en este dispositivo.`;
        });
    }
    if (!ventana().open) ventana().showModal();
}

function error(texto) {
    $('#error-cuenta').textContent = texto;
    $('#error-cuenta').hidden = !texto;
}

let modoCrear = false;
function pintarModo() {
    const f = $('#form-cuenta');
    f.querySelector('[type="submit"]').textContent = modoCrear ? 'Crear cuenta' : 'Entrar';
    f.elements.pass.autocomplete = modoCrear ? 'new-password' : 'current-password';
    f.querySelector('[data-cuenta="modo"]').textContent = modoCrear
        ? '¿Ya tenés cuenta? Entrá'
        : '¿No tenés cuenta? Creala';
    f.querySelector('[data-cuenta="olvide"]').hidden = modoCrear;
    $('#titulo-cuenta').textContent = modoCrear ? 'Creá tu cuenta' : 'Entrá con tu cuenta';
}

async function intentar(fn) {
    error('');
    try {
        await fn();
    } catch (e) {
        error(mod.mensajeError(e));
    }
}

function conectarVentana() {
    const v = ventana();
    v.addEventListener('click', async (e) => {
        if (e.target === v) return cerrarVentana(); // toque afuera del recuadro
        const accion = e.target.closest('[data-cuenta]')?.dataset.cuenta;
        if (!accion || !mod) return;
        const f = $('#form-cuenta');
        if (accion === 'google') {
            await intentar(async () => { cuentaNueva = (await mod.entrarConGoogle()).nueva; });
        } else if (accion === 'modo') {
            modoCrear = !modoCrear;
            pintarModo();
        } else if (accion === 'olvide') {
            const email = f.elements.email.value.trim().toLowerCase();
            if (!email) return error('Escribí tu mail arriba y volvé a tocar "¿Olvidaste tu contraseña?".');
            try {
                await mod.recuperarClave(email);
            } catch {}
            // Mismo mensaje haya o no cuenta con ese mail.
            error('');
            $('#info-cuenta').textContent = 'Si hay una cuenta con ese mail, te llega un correo para cambiar la contraseña.';
            $('#info-cuenta').hidden = false;
        } else if (accion === 'aceptar') {
            await aceptar();
        } else if (accion === 'no-aceptar' || accion === 'cerrar') {
            quiereUsarla = false;
            cerrarVentana();
        }
    });
    $('#form-cuenta').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!mod) return;
        const f = e.target;
        const email = f.elements.email.value.trim().toLowerCase();
        const pass = f.elements.pass.value;
        const boton = f.querySelector('[type="submit"]');
        boton.disabled = true;
        await intentar(() => modoCrear ? mod.crearCuenta(email, pass) : mod.entrarConMail(email, pass));
        boton.disabled = false;
        if (modoCrear && !$('#error-cuenta').hidden) return;
        if (modoCrear) evento('cuenta_creada', {});
    });
    pintarModo();
}

async function aceptar() {
    const novedades = $('#acepta-novedades').checked;
    const boton = ventana().querySelector('[data-cuenta="aceptar"]');
    boton.disabled = true;
    try {
        await cuenta.datos.aceptar(novedades);
        // Las cartas del dispositivo pasan a la cuenta.
        const locales = await almacenLocal.listar();
        for (const c of locales) await cuenta.datos.almacen.guardar(c);
        await almacenLocal.borrarTodas();
        Object.assign(cuenta, { estado: 'adentro', novedades });
        evento('cuenta_aceptada', { novedades, cartas_pasadas: locales.length });
        quiereUsarla = false;
        cerrarVentana();
        pintar();
        alCambiar(cuenta.datos.almacen);
    } catch (e) {
        console.error(e);
        error('No pudimos guardar. Probá de nuevo en un rato.');
    }
    boton.disabled = false;
}

// ---------- Cabecera y panel en Mis cartas ----------

function pintar() {
    oyentesDeCuenta.forEach((f) => { try { f(estadoDeNovedades()); } catch (e) { console.error(e); } });
    const b = $('#boton-cuenta');
    b.hidden = cuenta.estado === 'cargando';
    b.textContent = sesionIniciada() ? 'Mi cuenta' : 'Entrar';

    const nota = $('#nota-mis-cartas');
    const email = `<strong>${escapar(cuenta.email)}</strong>`;
    if (cuenta.estado === 'adentro') {
        nota.innerHTML = `Guardadas en tu cuenta (${email}): las ves desde cualquier dispositivo.`;
    } else if (cuenta.estado === 'sin-aceptar') {
        nota.innerHTML = `Guardadas en este dispositivo. Entraste como ${email}:
            <button type="button" class="boton-texto en-linea" data-cuenta-panel="usar">guardalas en tu cuenta</button>
            para tenerlas en cualquier dispositivo.
            <button type="button" class="boton-texto" data-cuenta-panel="salir">Salir de mi cuenta</button>`;
    } else {
        nota.innerHTML = `Guardadas en este dispositivo.
            <button type="button" class="boton-texto en-linea" data-cuenta-panel="entrar">Entrá con tu cuenta</button>
            para tenerlas en cualquier dispositivo.`;
    }
}

// Con sesion, "Mi cuenta" despliega un menu: administrar la cuenta y salir.
function abrirOpciones(abrir) {
    $('#opciones-cuenta').hidden = !abrir;
    $('#boton-cuenta').setAttribute('aria-expanded', String(abrir));
}

function abrirMiCuenta() {
    $('#mail-mi-cuenta').textContent = `Entraste como ${cuenta.email}.`;
    $('#cambiar-novedades').checked = Boolean(cuenta.novedades);
    // Sin aceptar el aviso todavia no hay nada que administrar.
    const adentro = cuenta.estado === 'adentro';
    $('#cambiar-novedades').closest('label').hidden = !adentro;
    $('[data-mi-cuenta="borrar-todo"]').hidden = !adentro;
    $('#ventana-mi-cuenta').showModal();
}

function conectarPanel() {
    $('#boton-cuenta').addEventListener('click', () => {
        if (sesionIniciada()) abrirOpciones($('#opciones-cuenta').hidden);
        else abrirEntrar();
    });
    $('#opciones-cuenta').addEventListener('click', async (e) => {
        const accion = e.target.closest('[data-cuenta-menu]')?.dataset.cuentaMenu;
        if (!accion) return;
        abrirOpciones(false);
        if (accion === 'administrar') abrirMiCuenta();
        else if (accion === 'ajustes') pedirAjustes?.();
        else if (accion === 'salir') await mod?.salir();
    });
    document.addEventListener('click', (e) => {
        if (!$('#opciones-cuenta').hidden && !e.target.closest('.menu-cuenta')) abrirOpciones(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('#opciones-cuenta').hidden) {
            abrirOpciones(false);
            $('#boton-cuenta').focus();
        }
    });
    $('#nota-mis-cartas').addEventListener('click', async (e) => {
        const accion = e.target.closest('[data-cuenta-panel]')?.dataset.cuentaPanel;
        if (accion === 'entrar' || accion === 'usar') abrirEntrar();
        else if (accion === 'salir') await mod?.salir();
    });
    $('#ventana-mi-cuenta').addEventListener('click', async (e) => {
        const accion = e.target.closest('[data-mi-cuenta]')?.dataset.miCuenta;
        if (accion === 'cerrar') $('#ventana-mi-cuenta').close();
        else if (accion === 'salir') {
            $('#ventana-mi-cuenta').close();
            await mod?.salir();
        } else if (accion === 'borrar-todo') {
            if (!confirm('Se borran todas las cartas guardadas en tu cuenta y tus preferencias de la calculadora. Tu cuenta de la escuela sigue igual. ¿Seguimos?')) return;
            try {
                await cuenta.datos.borrarTodo();
                evento('cuenta_borrada', {});
                Object.assign(cuenta, { estado: 'sin-aceptar', novedades: false });
                $('#ventana-mi-cuenta').close();
                pintar();
                alCambiar(almacenLocal);
            } catch (err) {
                console.error(err);
                alert('No pudimos borrarlas. Probá de nuevo en un rato.');
            }
        }
    });
    $('#cambiar-novedades').addEventListener('change', async (e) => {
        try {
            await cuenta.datos.cambiarNovedades(e.target.checked);
            cuenta.novedades = e.target.checked;
            oyentesDeCuenta.forEach((g) => { try { g(estadoDeNovedades()); } catch (err2) { console.error(err2); } });
        } catch (err) {
            console.error(err);
            e.target.checked = cuenta.novedades;
        }
    });
}

conectarVentana();
conectarPanel();
