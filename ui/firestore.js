// Lectura de Firestore por la API REST (sin el SDK de Firebase, que pesa
// ~100 KB y aca solo hacen falta unas pocas lecturas publicas).
//
// Colecciones (base "cursos" del proyecto sebabru-e5563), lectura publica:
//   tucarta_textos/{sol-aries...}  { titulo, texto, publicado }
//   tucarta_config/general         { linkSeba, linkEgresadxs }
// Con sesion iniciada, solo la persona duena (ver firestore.rules del sitio):
//   tucarta_usuarios/{uid}               { email, novedades, aceptado }
//   tucarta_usuarios/{uid}/cartas/{id}   carta guardada (ver miscartas.js)

const PROYECTO = 'sebabru-e5563';
const BASE = 'cursos';
const API_KEY = 'AIzaSyD4MOeUZGrlbwrqSnTjRY9BT_-x8L6Hn3s'; // clave web publica del sitio
const RAIZ = `projects/${PROYECTO}/databases/${BASE}/documents`;
const URL_API = `https://firestore.googleapis.com/v1/${RAIZ}`;

export function valor(v) {
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('mapValue' in v) return desdeCampos(v.mapValue.fields);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
    if ('timestampValue' in v) return v.timestampValue;
    return null;
}
const desdeCampos = (campos = {}) => Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, valor(v)]));
const plano = (doc) => desdeCampos(doc.fields);

// Al reves: un valor de JS al formato de la API. Los undefined se omiten.
export function aValor(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(aValor) } };
    return { mapValue: { fields: aCampos(v) } };
}
export const aCampos = (o) => Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, aValor(v)]));

// Varios documentos en una sola llamada. Devuelve { id: datos } con los
// que existen.
export async function leerDocumentos(coleccion, ids) {
    const r = await fetch(`${URL_API}:batchGet?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: ids.map((id) => `${RAIZ}/${coleccion}/${id}`) })
    });
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const res = {};
    for (const item of await r.json()) {
        if (item.found) res[item.found.name.split('/').pop()] = plano(item.found);
    }
    return res;
}

// Cache por sesion: cada texto se pide una vez por visita.
const CLAVE = 'tucarta:textos';
export async function textosInterpretacion(ids) {
    let cache = {};
    try { cache = JSON.parse(sessionStorage.getItem(CLAVE)) || {}; } catch {}
    const faltan = ids.filter((id) => !(id in cache));
    if (faltan.length) {
        try {
            const nuevos = await leerDocumentos('tucarta_textos', faltan);
            for (const id of faltan) cache[id] = nuevos[id]?.publicado ? nuevos[id] : null;
            try { sessionStorage.setItem(CLAVE, JSON.stringify(cache)); } catch {}
        } catch {
            // Sin conexion o sin permisos: se muestra el aviso de proximamente.
        }
    }
    return Object.fromEntries(ids.map((id) => [id, cache[id] || null]));
}

export async function configRemota() {
    try {
        return (await leerDocumentos('tucarta_config', ['general'])).general || {};
    } catch {
        return {};
    }
}

// ---------- Con sesion iniciada ----------

// token: funcion async que devuelve el ID token de Firebase Auth. Las
// reglas de Firestore deciden que puede leer y escribir cada cuenta.
export function firestoreConSesion(token) {
    const pedir = async (ruta, opciones = {}) => {
        const r = await fetch(`${URL_API}/${ruta}`, {
            ...opciones,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }
        });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Firestore ${r.status}`);
        return r.json();
    };
    return {
        async leer(ruta) {
            const doc = await pedir(ruta);
            return doc ? plano(doc) : null;
        },
        // Reemplaza el documento entero (lo crea si no existe).
        async escribir(ruta, datos) {
            await pedir(ruta, { method: 'PATCH', body: JSON.stringify({ fields: aCampos(datos) }) });
        },
        async borrar(ruta) {
            await pedir(ruta, { method: 'DELETE' });
        },
        // Todos los documentos de una coleccion: [{ id, ...datos }].
        async listar(ruta) {
            const res = [];
            let pagina = '';
            do {
                const r = await pedir(`${ruta}?pageSize=300${pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''}`);
                for (const doc of r?.documents || []) res.push({ ...plano(doc), id: doc.name.split('/').pop() });
                pagina = r?.nextPageToken;
            } while (pagina);
            return res;
        }
    };
}
