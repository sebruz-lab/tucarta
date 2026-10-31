// Lectura de Firestore por la API REST (sin el SDK de Firebase, que pesa
// ~100 KB y aca solo hacen falta unas pocas lecturas publicas).
//
// Colecciones (base "cursos" del proyecto sebabru-e5563), lectura publica:
//   tucarta_textos/{sol-aries...}  { titulo, texto, publicado }
//   tucarta_config/general         { linkSeba, linkEgresadxs }

const PROYECTO = 'sebabru-e5563';
const BASE = 'cursos';
const API_KEY = 'AIzaSyD4MOeUZGrlbwrqSnTjRY9BT_-x8L6Hn3s'; // clave web publica del sitio
const RAIZ = `projects/${PROYECTO}/databases/${BASE}/documents`;
const URL_API = `https://firestore.googleapis.com/v1/${RAIZ}`;

function valor(v) {
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    return null;
}

const plano = (doc) => Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, valor(v)]));

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
