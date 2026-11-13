// Instalar la calculadora como app.
//
// La app ya era una PWA desde la v1.14.0 (manifest y service worker, anda sin
// internet), pero no habia nada que invitara a instalarla ni que explicara
// como. Quien no sabe que las PWA existen no se la instala nunca.
//
// Dos lugares:
//   - Una seccion al pie, siempre, con el boton nativo cuando lo hay y el paso
//     a mano del dispositivo de quien esta mirando.
//   - Un aviso chico, que NO sale en frio: recien cuando alguien ya calculo una
//     carta y dio una segunda senal de que le sirve (otra carta, compartir o
//     guardar). Decision de Seba: no pedirle instalar a quien recien llego.
//
// Safari de iPhone es el caso que hay que cuidar: ahi el boton de instalar NO
// EXISTE, por mas que la pagina lo quiera. Un boton que diga "Instalar" en un
// iPhone es una promesa que el navegador no puede cumplir, asi que ahi se
// muestra el paso a mano y nada mas.

import { evento } from './analytics.js';

// `beforeinstallprompt` se dispara al cargar la pagina, mucho antes de que
// queramos mostrar algo: hay que atajarlo al arranque y guardarlo para
// despues. Si nunca llega, no hay boton nativo y quedan las instrucciones.
let promptNativo = null;
const alCambiar = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptNativo = e;
    alCambiar.forEach((f) => f());
});

window.addEventListener('appinstalled', () => {
    promptNativo = null;
    evento('instalar', { paso: 'instalada', plataforma: plataforma() });
    alCambiar.forEach((f) => f());
});

// Ya instalada: se abre en su propia ventana, sin barra del navegador.
export function estaInstalada() {
    try {
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    } catch {}
    // El iOS viejo no soporta display-mode.
    return Boolean(window.navigator.standalone);
}

// Que dispositivo es, para decir el paso correcto. Un iPad moderno se declara
// Mac, asi que se lo distingue por el tacto.
export function plataforma() {
    const ua = navigator.userAgent || '';
    const tactil = (navigator.maxTouchPoints || 0) > 1;
    if (/iPhone|iPod/.test(ua)) return 'ios';
    if (/iPad/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Macintosh/.test(ua)) return tactil ? 'ios' : 'mac';
    if (/Windows/.test(ua)) return 'windows';
    return 'otro';
}

const esFirefox = () => /Firefox\//.test(navigator.userAgent || '');
const esSafari = () => {
    const ua = navigator.userAgent || '';
    return /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
};

// El paso a mano de cada lado. `nativo` dice si en ese dispositivo el boton de
// instalar puede llegar a existir: en iOS nunca.
const PASOS = {
    windows: {
        nombre: 'Windows',
        nativo: true,
        pasos: [
            'Tocá el botón de acá arriba.',
            'Si no aparece: en Chrome o Edge, mirá el ícono de instalar en la barra de direcciones, a la derecha.',
            'O entrá al menú de los tres puntos y buscá "Instalar".',
        ],
    },
    android: {
        nombre: 'Android',
        nativo: true,
        pasos: [
            'Tocá el botón de acá arriba.',
            'Si no aparece: entrá al menú de los tres puntos, arriba a la derecha.',
            'Elegí "Instalar app" o "Agregar a pantalla principal".',
        ],
    },
    ios: {
        nombre: 'iPhone o iPad',
        nativo: false,
        pasos: [
            'Tiene que ser desde Safari.',
            'Tocá el botón de compartir, abajo en el medio: el cuadrado con la flecha para arriba.',
            'Bajá en la lista y elegí "Agregar a inicio".',
            'Tocá "Agregar", arriba a la derecha.',
        ],
    },
    mac: {
        nombre: 'Mac',
        nativo: true,
        pasos: [
            'En Safari: menú Archivo → "Agregar al Dock".',
            'En Chrome o Edge: tocá el botón de acá arriba, o mirá el ícono de instalar en la barra de direcciones.',
        ],
    },
};

const ORDEN = ['windows', 'android', 'ios', 'mac'];

function listaDePasos(clave) {
    const p = PASOS[clave];
    return `<ol class="instalar-pasos">${p.pasos.map((x) => `<li>${x}</li>`).join('')}</ol>`;
}

// Monta la seccion del pie. `caja` es donde van las instrucciones y el boton.
export function montarInstalar(seccion) {
    if (!seccion) return;
    if (estaInstalada()) { seccion.hidden = true; return; }
    seccion.hidden = false;

    const yo = plataforma();
    const mia = PASOS[yo];
    const otras = ORDEN.filter((k) => k !== yo);

    const boton = mia && mia.nativo
        ? '<button type="button" class="boton boton-principal" data-instalar="ahora">Instalar la calculadora</button>'
        : '';

    // Firefox de escritorio no instala PWA. No prometerselo: lo que si le
    // sirve es guardar los lugares para usar sin internet.
    const sinInstalar = esFirefox() && (yo === 'windows' || yo === 'mac')
        ? '<p class="nota">Firefox no instala aplicaciones web. Podés abrirla en Chrome o Edge para '
          + 'instalarla, o guardar los lugares acá abajo y usarla sin internet igual.</p>'
        : '';

    const caja = seccion.querySelector('.instalar-cuerpo');
    caja.innerHTML = `${boton}
        <p class="nota" data-instalar-aviso role="status" hidden></p>
        ${sinInstalar}
        ${mia ? `<div class="instalar-mio"><h3>En ${mia.nombre}</h3>${listaDePasos(yo)}</div>` : ''}
        <details class="instalar-otras">
            <summary>¿La querés en otro dispositivo?</summary>
            ${otras.map((k) => `<div class="instalar-otra"><h3>En ${PASOS[k].nombre}</h3>${listaDePasos(k)}</div>`).join('')}
        </details>`;

    const avisar = (txt) => {
        const a = caja.querySelector('[data-instalar-aviso]');
        a.hidden = !txt;
        a.textContent = txt || '';
    };

    // El boton nativo solo sirve si el navegador nos dio el prompt. Mientras no
    // llegue queda apagado, porque apretarlo no haria nada.
    const refrescar = () => {
        const b = caja.querySelector('[data-instalar="ahora"]');
        if (!b) return;
        b.disabled = !promptNativo;
        if (estaInstalada()) seccion.hidden = true;
    };
    alCambiar.add(refrescar);
    refrescar();

    caja.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-instalar="ahora"]')) return;
        const r = await pedirInstalar();
        if (r === 'sin-prompt') {
            avisar('Tu navegador no ofrece el botón. Mirá los pasos de acá abajo.');
        } else if (r === 'dismissed') {
            avisar('Cuando quieras, está acá.');
        }
    });
}

// Dispara el prompt nativo. Devuelve 'accepted', 'dismissed' o 'sin-prompt'.
export async function pedirInstalar() {
    if (!promptNativo) {
        evento('instalar', { paso: 'sin-prompt', plataforma: plataforma() });
        return 'sin-prompt';
    }
    evento('instalar', { paso: 'pedido', plataforma: plataforma() });
    try {
        await promptNativo.prompt();
        const { outcome } = await promptNativo.userChoice;
        // El prompt se usa una sola vez.
        promptNativo = null;
        alCambiar.forEach((f) => f());
        evento('instalar', { paso: outcome, plataforma: plataforma() });
        return outcome;
    } catch {
        return 'dismissed';
    }
}

export const hayPromptNativo = () => Boolean(promptNativo);

// ---------- El aviso, que no sale en frio ----------
// Dos condiciones: que ya haya calculado una carta Y que haya dado una segunda
// senal de que le sirve (otra carta, compartir o guardar). Y una sola vez: si
// lo cierran, no vuelve.

const CLAVE_SENALES = 'tucarta:instalar-senales';
const CLAVE_VISTO = 'tucarta:instalar-visto';

const leerNum = (clave) => {
    try { return Number(localStorage.getItem(clave)) || 0; } catch { return 0; }
};
const guardarNum = (clave, n) => {
    try { localStorage.setItem(clave, String(n)); } catch {}
};

let avisoCaja = null;

export function prepararAviso(caja) {
    avisoCaja = caja;
    if (!caja) return;
    caja.addEventListener('click', async (e) => {
        if (e.target.closest('[data-instalar="cerrar"]')) {
            caja.hidden = true;
            guardarNum(CLAVE_VISTO, 1);
            evento('instalar', { paso: 'aviso-cerrado', plataforma: plataforma() });
            return;
        }
        if (e.target.closest('[data-instalar="aviso"]')) {
            caja.hidden = true;
            guardarNum(CLAVE_VISTO, 1);
            if (hayPromptNativo()) {
                await pedirInstalar();
                return;
            }
            // Sin prompt (iPhone y compania): llevarla a los pasos.
            const seccion = document.querySelector('.instalar');
            if (seccion) {
                seccion.hidden = false;
                seccion.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    });
}

// La llama app.js cuando pasa algo que muestra que la calculadora le sirve.
// `cual` es solo para medir.
export function senal(cual) {
    if (!avisoCaja || estaInstalada()) return;
    if (leerNum(CLAVE_VISTO)) return;

    const n = leerNum(CLAVE_SENALES) + 1;
    guardarNum(CLAVE_SENALES, n);
    // La primera carta no alcanza: hace falta la segunda senal.
    if (n < 2) return;
    if (!avisoCaja.hidden) return;

    const yo = plataforma();
    // En un navegador que no instala, el aviso seria una promesa vacia.
    if (!hayPromptNativo() && yo !== 'ios') return;

    const texto = yo === 'ios'
        ? 'Podés tener la calculadora en tu pantalla de inicio y usarla sin internet.'
        : 'Podés instalar la calculadora y usarla sin internet.';
    avisoCaja.querySelector('[data-instalar-texto]').textContent = texto;
    avisoCaja.querySelector('[data-instalar="aviso"]').textContent = yo === 'ios' ? 'Cómo se hace' : 'Instalar';
    avisoCaja.hidden = false;
    evento('instalar', { paso: 'aviso-visto', plataforma: yo, senal: cual });
}
