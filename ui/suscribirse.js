// Suscripcion a los contenidos por mail, adentro de la calculadora.
//
// ESTO ES UN PORT de `public/suscribirse.js` del sitio (repo privado): si
// cambia uno, mirar el otro. Lo que esta duplicado es solo la PRESENTACION.
// La parte que cuida que la direccion sea de verdad vive toda en el servidor
// (`exports.suscribir`): el captcha desde el primer envio, la trampa para
// bots, la deteccion de tipeos y la revision de los MX del dominio.
//
// Diferencias a proposito con el del sitio:
//   - Modulo ES, no un script global que se autoejecuta.
//   - Los estilos van en tucarta.css con los tokens del tema, porque aca el
//     fondo puede ser claro u oscuro. El del sitio tiene los colores a mano.
//   - El link de privacidad es absoluto: relativo no resuelve en el preview.
//   - Si no hay internet no intenta el envio: la app anda sin conexion, pero
//     esto no puede.
//
// NO HAY CASILLA, Y ES A PROPOSITO
//
// El consentimiento es apretar el boton, con los terminos escritos justo
// arriba: un acto deliberado e informado. Una casilla ya marcada no vale como
// consentimiento y produce suscriptores que no saben que se suscribieron, que
// es lo que termina en denuncias de spam. Sin casilla no hay nada que
// premarcar.
//
// Donde la suscripcion NO es el motivo de la visita (la cuenta de la
// calculadora) hay una casilla aparte y DESMARCADA. Ese no es este formulario.

import { evento } from './analytics.js';

const URL_SUSCRIBIR = 'https://us-central1-sebabru-e5563.cloudfunctions.net/suscribir';
const SITEKEY = '0x4AAAAAAFwEydZNkPMtSb8Q';
const URL_PRIVACIDAD = 'https://sebabru.com/privacidad/';

// A proposito no se promete un numero de mails por mes: la lista manda lo que
// el cielo vaya pidiendo, y un numero escrito es una promesa que despues hay
// que cumplir.
const TEXTO = 'Contenidos astrológicos gratuitos para mantenerte cerca del cielo y sus '
    + 'movimientos: los informes de cada luna, los textos de cada signo, el podcast de '
    + 'los tránsitos y lo que vaya apareciendo.';

// El captcha se carga recien cuando la persona toca el formulario: son unos
// 60 KB que no hacen falta para la gran mayoria de las visitas.
let cargaCaptcha = null;
function cargarCaptcha() {
    if (cargaCaptcha) return cargaCaptcha;
    cargaCaptcha = new Promise((listo, falla) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.defer = true;
        s.onload = () => listo();
        s.onerror = () => falla(new Error('no cargo el captcha'));
        document.head.appendChild(s);
    });
    return cargaCaptcha;
}

// Un token del captcha. `interaction-only` quiere decir que la persona solo ve
// algo si Cloudflare sospecha de ella; en el caso normal es invisible.
//
// El corte de 15 s es para TODO el flujo (cargar el script y conseguir el
// token): si una extension bloquea el captcha, o la red se corta a mitad, el
// script puede no cargar nunca y tampoco dar error. Sin esto el boton se queda
// apagado para siempre y la persona no entiende que paso. Con esto seguimos
// sin token, el servidor contesta captcha_requerido y abajo se le explica.
function pedirToken(estado) {
    let corte;
    const seRindio = new Promise((listo) => { corte = setTimeout(() => listo(''), 15000); });
    return Promise.race([pedirTokenAlCaptcha(estado), seRindio])
        .then((token) => { clearTimeout(corte); return token; });
}

function pedirTokenAlCaptcha(estado) {
    return cargarCaptcha().then(() => {
        if (estado.widget === null) {
            estado.widget = window.turnstile.render(estado.cajaCaptcha, {
                sitekey: SITEKEY,
                appearance: 'interaction-only',
                execution: 'execute',
                callback: (token) => estado.entregar(token),
                'error-callback': () => estado.entregar(''),
                'expired-callback': () => estado.entregar(''),
            });
        } else {
            window.turnstile.reset(estado.widget);
        }
        return new Promise((listo) => {
            estado.entregar = (token) => {
                estado.entregar = () => {};
                listo(token || '');
            };
            window.turnstile.execute(estado.widget);
        });
    }).catch(() => '');
}

// Lo que tipeo la persona no puede entrar crudo a innerHTML: el regex de
// validacion del mail permite < y >, asi que sin esto se podia inyectar HTML
// en el propio navegador.
const limpiar = (txt) => String(txt == null ? '' : txt).replace(/[<>&"]/g, '');

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Monta el formulario adentro de `caja`. `mail` es la direccion de la cuenta,
// si hay sesion, para no hacerla tipear de nuevo.
export function montarSuscripcion(caja, { origen = 'cartas', mail = '' } = {}) {
    const textoBoton = 'Suscribirme';

    caja.classList.add('suscribirse');
    caja.innerHTML = `<p class="sus-intro">${TEXTO}</p>
        <p class="sus-error" role="alert" hidden></p>
        <form novalidate>
            <div class="sus-campo">
                <label for="sus-email">Tu mail</label>
                <input type="email" id="sus-email" maxlength="200" autocomplete="email"
                    inputmode="email" placeholder="nombre@correo.com" required>
            </div>
            <div class="sus-campo">
                <label for="sus-nombre">Nombre <span class="sus-opcional">(opcional)</span></label>
                <input type="text" id="sus-nombre" maxlength="100" autocomplete="given-name">
            </div>
            <div class="sus-trampa" aria-hidden="true">
                <label for="sus-hp">No completar</label>
                <input type="text" id="sus-hp" name="website" tabindex="-1" autocomplete="off">
            </div>
            <p class="sus-canje">Al anotarte te empiezan a llegar los contenidos astrológicos
                por mail. <a href="${URL_PRIVACIDAD}" target="_blank" rel="noopener">Cómo cuidamos
                tus datos</a>.</p>
            <div class="sus-captcha"></div>
            <button type="submit" class="boton boton-principal">${textoBoton}</button>
        </form>`;

    const form = caja.querySelector('form');
    const error = caja.querySelector('.sus-error');
    const email = caja.querySelector('#sus-email');
    const nombre = caja.querySelector('#sus-nombre');
    // La trampa para los bots: no se ve, no se puede tabular hasta ella y el
    // navegador no la autocompleta. Si viene con algo, el servidor contesta
    // que salio bien y no hace nada, asi el bot no aprende que lo descubrieron.
    const trampa = caja.querySelector('#sus-hp');
    const boton = caja.querySelector('button[type="submit"]');

    if (mail) email.value = mail;

    const estado = {
        widget: null,
        cajaCaptcha: caja.querySelector('.sus-captcha'),
        entregar: () => {},
    };

    // Precargar el captcha en cuanto la persona muestra intencion de escribir,
    // asi no espera nada al apretar el boton.
    email.addEventListener('focus', () => { cargarCaptcha().catch(() => {}); }, { once: true });

    const avisar = (mensaje, html) => {
        error.innerHTML = html || '';
        if (!html) error.textContent = mensaje;
        error.hidden = false;
    };
    const limpiarAviso = () => { error.hidden = true; error.innerHTML = ''; };

    const mostrarListo = (estadoAlta, direccion) => {
        const textos = {
            suscrito: `Listo, ya estás en la lista, con la dirección <strong>${limpiar(direccion)}</strong>.`
                + '<br>Si es tu primera vez acá, te llega un mail de bienvenida.'
                + '<span class="sus-nota">Si no lo ves, mirá en spam o en promociones.</span>',
            demorado: 'Te anotamos. El mail de bienvenida puede demorar un rato en llegar.'
                + '<span class="sus-nota">Si no llega, escribinos a info@sebabru.com.</span>',
            // El servidor ya no devuelve este estado: contestaba distinto segun
            // si la direccion estaba o no en la lista, y con eso se podia
            // averiguar si un mail ajeno estaba suscrito. Queda de respaldo.
            ya_suscrito: 'Ya estabas en la lista. Nos vemos en el próximo mail.',
        };
        caja.innerHTML = `<p class="sus-listo">${textos[estadoAlta] || textos.suscrito}</p>`;
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        limpiarAviso();

        const direccion = email.value.trim().toLowerCase();
        if (!EMAIL_VALIDO.test(direccion)) {
            email.focus();
            return avisar('Revisá el mail: parece que falta algo.');
        }
        // La calculadora anda sin internet; esto no. Mejor decirlo antes que
        // dejarla esperando un envio que no va a salir.
        if (!navigator.onLine) {
            return avisar('Para anotarte hace falta internet. Probá cuando tengas conexión.');
        }

        boton.disabled = true;
        boton.textContent = 'Enviando...';
        const terminar = () => {
            boton.disabled = false;
            boton.textContent = textoBoton;
        };

        pedirToken(estado).then((token) => fetch(URL_SUSCRIBIR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: direccion,
                nombre: nombre.value.trim(),
                origen,
                consentimiento: true,
                captchaToken: token,
                hp: trampa.value,
                utm: (window.sbOrigen && window.sbOrigen()) || null,
            }),
        })).then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok, status: r.status, data })))
            .then((resp) => {
                if (resp.ok && resp.data.ok) {
                    evento('suscripcion', { origen });
                    return mostrarListo(resp.data.estado, direccion);
                }

                terminar();
                const fallo = resp.data.error;

                if (fallo === 'email_sospechoso' && resp.data.sugerencia) {
                    const sugerida = limpiar(resp.data.sugerencia);
                    avisar('', 'Puede que haya un error de tipeo. ¿Quisiste decir '
                        + `<strong>${sugerida}</strong>?<br><button type="button">Sí, usar ese</button>`);
                    error.querySelector('button').addEventListener('click', () => {
                        email.value = sugerida;
                        limpiarAviso();
                        form.dispatchEvent(new Event('submit', { cancelable: true }));
                    });
                    return;
                }
                if (fallo === 'captcha_requerido') {
                    return avisar('No pudimos verificar que no sos un robot. Recargá la página y probá de nuevo.');
                }
                if (fallo === 'consentimiento_requerido') {
                    // Este formulario manda el consentimiento siempre (los
                    // terminos estan arriba del boton, no hay casilla). Si el
                    // servidor igual lo rechaza es un problema nuestro, asi que
                    // el mensaje tiene que ser algo que la persona pueda hacer.
                    return avisar('No pudimos registrar tu consentimiento. Recargá la página y probá de nuevo.');
                }
                if (fallo === 'email_invalido') {
                    return avisar('Revisá el mail: parece que falta algo.');
                }
                if (fallo === 'dominio_sin_correo') {
                    // El servidor no encontro servidores de correo en ese
                    // dominio: casi siempre es un tipeo despues de la arroba.
                    return avisar('No encontramos ese dominio de correo. Revisá lo que va después de la arroba.');
                }
                if (fallo === 'no_configurado') {
                    // El formulario esta publicado pero el mailing todavia no
                    // quedo configurado. El pedido no se pierde, pero no le
                    // prometemos un mail que no va a salir.
                    return avisar('Todavía no tenemos la suscripción abierta. Escribinos a info@sebabru.com y te anotamos a mano.');
                }
                if (resp.status === 429) {
                    return avisar(resp.data.error || 'Probá de nuevo en unos minutos.');
                }
                avisar('No pudimos anotarte ahora. Probá de nuevo en un rato, o escribinos a info@sebabru.com.');
            }).catch(() => {
                terminar();
                avisar('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
            });
    });
}

// Quien ya dijo que si en su cuenta no tiene que volver a anotarse.
export function yaEstaEnLaLista(caja) {
    caja.classList.remove('suscribirse');
    caja.innerHTML = '<p class="sus-listo">Ya estás en la lista: te llegan los contenidos '
        + 'por mail.<span class="sus-nota">Podés darte de baja desde cualquiera de los mails.</span></p>';
}
