// Cuenta de la persona: la misma de la escuela de sebabru.com (Firebase
// Auth, mismo proyecto y mismo origen, asi que si ya entro en la escuela
// aca tambien aparece con la sesion iniciada).
//
// Se carga aparte (import dinamico) para no demorar la calculadora.
//
// Con la cuenta, las cartas se guardan en tucarta_usuarios/{uid}/cartas.
// Antes de usarla la persona acepta el aviso de privacidad; eso queda en
// tucarta_usuarios/{uid} junto con si quiere recibir novedades.

import { initializeApp } from 'firebase/app';
import {
    getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from 'firebase/auth';
import { firestoreConSesion } from './firestore.js';
import { datosDeCarta, mismaCarta } from './miscartas.js';
import { conSincro } from './sincro.js';

// La configuracion web del sitio (es publica: va en todas las paginas).
const app = initializeApp({
    apiKey: 'AIzaSyD4MOeUZGrlbwrqSnTjRY9BT_-x8L6Hn3s',
    authDomain: 'sebabru-e5563.firebaseapp.com',
    projectId: 'sebabru-e5563',
    appId: '1:485871026732:web:9083310f93687055f4c789'
});
const auth = getAuth(app);
auth.languageCode = 'es';

export const alCambiarSesion = (fn) => onAuthStateChanged(auth, fn);

// Por defecto Google entra sola con la sesion que ya esta abierta en el
// navegador, sin preguntar: en una compu compartida, o cuando la persona
// tiene dos mails, eso termina en la cuenta equivocada. Con
// prompt=select_account siempre aparece la lista para elegir.
// Devuelve { usuario, nueva }: `nueva` es true cuando ese mail de Google
// todavia no tenia cuenta y se acaba de crear.
export async function entrarConGoogle() {
    const proveedor = new GoogleAuthProvider();
    proveedor.setCustomParameters({ prompt: 'select_account' });
    const r = await signInWithPopup(auth, proveedor);
    const marcas = r.user.metadata || {};
    // Recien creada: Firebase pone la misma marca de tiempo en las dos.
    return { usuario: r.user, nueva: Boolean(marcas.creationTime) && marcas.creationTime === marcas.lastSignInTime };
}
export const entrarConMail = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const crearCuenta = (email, pass) => createUserWithEmailAndPassword(auth, email, pass);
export const recuperarClave = (email) => sendPasswordResetEmail(auth, email);
export const salir = () => signOut(auth);

const FUNCIONES = 'https://us-central1-sebabru-e5563.cloudfunctions.net';

// Confirma del lado del servidor si esta cuenta es admin (la lista de
// emails vive en functions/index.js, no acá) y, si lo es, deja puesto el
// custom claim para la próxima vez. Ante cualquier error de red devuelve
// false -- nunca desbloquea nada "por las dudas".
export async function chequearAdmin(usuario) {
    try {
        const idToken = await usuario.getIdToken();
        const r = await fetch(`${FUNCIONES}/fijarClaimsAdmin`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!r.ok) return false;
        const { admin } = await r.json();
        if (admin) await usuario.getIdToken(true); // refresca el token con el claim nuevo
        return Boolean(admin);
    } catch (e) {
        console.error(e);
        return false;
    }
}

// Mensajes sin el codigo crudo de Firebase: no confirman si un mail ya
// tiene cuenta (igual que en la escuela).
export function mensajeError(e) {
    const c = e?.code || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'auth/weak-password') return 'La contraseña tiene que tener al menos 6 caracteres.';
    if (c === 'auth/invalid-email') return 'Revisá que el mail esté bien escrito.';
    if (c === 'auth/too-many-requests') return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (c === 'auth/network-request-failed') return 'No hay conexión. Probá de nuevo en un rato.';
    if (c === 'auth/popup-blocked') return 'El navegador bloqueó la ventana de Google. Permitila y probá de nuevo.';
    if (c === 'auth/email-already-in-use') return 'No pudimos crear la cuenta. Si ya tenés una, entrá con tu mail y contraseña.';
    return 'Mail o contraseña incorrectos.';
}

// Todo lo que se guarda en Firestore para una cuenta.
export function datosDeCuenta(usuario) {
    const fs = firestoreConSesion(() => usuario.getIdToken());
    const raiz = `tucarta_usuarios/${usuario.uid}`;

    const almacen = {
        async listar() {
            const lista = await fs.listar(`${raiz}/cartas`);
            return lista.sort((a, b) => (b.guardada || '').localeCompare(a.guardada || ''));
        },
        async guardar(datos) {
            const previa = (await almacen.listar()).find((c) => mismaCarta(c, datos));
            const id = previa?.id || (crypto.randomUUID?.() || String(Date.now()));
            const carta = { ...datosDeCarta(datos), guardada: new Date().toISOString() };
            await fs.escribir(`${raiz}/cartas/${id}`, carta);
            return { ...carta, id };
        },
        // Guardar en un id ya decidido: lo usa la sincronizacion para subir
        // lo que se guardo sin internet.
        async escribirId(id, carta) {
            await fs.escribir(`${raiz}/cartas/${id}`, carta);
        },
        async borrar(id) {
            await fs.borrar(`${raiz}/cartas/${id}`);
        },
        async borrarTodas() {
            for (const c of await almacen.listar()) await fs.borrar(`${raiz}/cartas/${c.id}`);
        },
        // Muchas de una vez (importacion): se lista una sola vez y se
        // escriben de a varias en paralelo. alAvanzar(hechas, total).
        async guardarVarias(lista, alAvanzar = () => {}) {
            const existentes = await almacen.listar();
            const ahora = new Date().toISOString();
            const tareas = [];
            for (const d of lista) {
                const previa = existentes.find((c) => mismaCarta(c, d));
                const id = previa?.id || (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));
                const carta = { ...datosDeCarta(d), guardada: ahora };
                if (!previa) existentes.push({ ...carta, id });
                tareas.push(() => fs.escribir(`${raiz}/cartas/${id}`, carta));
            }
            let hechas = 0;
            const trabajar = async () => {
                while (tareas.length) {
                    await tareas.shift()();
                    alAvanzar(++hechas, lista.length);
                }
            };
            await Promise.all(Array.from({ length: 6 }, trabajar));
            return hechas;
        }
    };

    // Las cartas se leen de una copia en este dispositivo y se suben cuando
    // hay internet: asi la app sirve igual sin conexion.
    const almacenSincronizado = conSincro(almacen, usuario.uid, {
        alCambiar: () => document.dispatchEvent(new CustomEvent('tucarta:cartas-al-dia')),
    });

    return {
        almacen: almacenSincronizado,
        // null si todavia no acepto el aviso.
        perfil: () => fs.leer(raiz),
        aceptar: (novedades) => fs.escribir(raiz, {
            email: usuario.email, novedades: Boolean(novedades), aceptado: new Date().toISOString()
        }),
        cambiarNovedades: async (novedades) => {
            const p = await fs.leer(raiz);
            await fs.escribir(raiz, { ...p, email: usuario.email, novedades: Boolean(novedades) });
        },
        // Borra las cartas y el perfil. La cuenta en si queda: es la misma
        // de la escuela.
        async borrarTodo() {
            await almacen.borrarTodas();
            await fs.borrar(raiz);
        }
    };
}
