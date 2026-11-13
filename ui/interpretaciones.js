// Los textos de Sol, Luna y Ascendente que escribe Seba, leidos del sitio.
//
// Un archivo por texto en https://sebabru.com/textos/<id>.json, con
// { titulo, texto }. Los genera paginas-textos.js (en herramientas-sebabru)
// desde la coleccion tucarta_textos de Firestore, que sigue siendo la fuente:
// el texto se edita ahi y despues se vuelve a correr el generador, que de
// paso escribe las 36 paginas de /sol/, /lunas/ y /ascendente/.
//
// POR QUE NO SE PIDEN MAS A FIRESTORE
//
// La lectura de tucarta_textos es publica y la hacia la API REST con la clave
// web del proyecto, que viaja en este bundle. Cualquiera podia clonar /cartas
// en otro dominio y seguir mostrando los 36 textos de Seba como propios.
//
// Pedidos al sitio eso se corta sin candado ninguno: un fetch desde otro
// dominio lo bloquea la politica de mismo origen, porque sebabru.com no manda
// access-control-allow-origin en los archivos estaticos. El clon calcula
// cartas (el motor es libre, es AGPL) pero se queda sin los textos.
//
// No es esconderlos: el texto completo esta publicado en las 36 paginas del
// sitio y en el libro. Es que no se los lleve la copia.
//
// Un texto sin publicar no tiene archivo: 404, y se muestra el aviso de
// proximamente, igual que cuando estaba en Firestore.

// De la base de la app a la carpeta de los textos, que esta un nivel arriba:
//   /cartas/  -> /textos/     en produccion
//   /         -> /textos/     en desarrollo (lo atiende el proxy de vite)
export function urlTexto(id, base = import.meta.env.BASE_URL, origen = globalThis.location?.href) {
    const carpeta = new URL('../textos/', new URL(base, origen || 'http://localhost/'));
    return new URL(`${encodeURIComponent(id)}.json`, carpeta).href;
}

// Cache por sesion: cada texto se pide una vez por visita.
const CLAVE = 'tucarta:textos';

// Devuelve { id: { titulo, texto } | null }. El null es "no hay texto":
// o no esta publicado, o no se pudo leer.
export async function textosInterpretacion(ids) {
    let cache = {};
    try { cache = JSON.parse(sessionStorage.getItem(CLAVE)) || {}; } catch {}

    const faltan = ids.filter((id) => !(id in cache));
    if (faltan.length) {
        const leidos = await Promise.all(faltan.map(async (id) => {
            try {
                const r = await fetch(urlTexto(id));
                if (r.ok) return [id, await r.json()];
                // 404 es una respuesta: ese texto todavia no esta publicado.
                if (r.status === 404) return [id, null];
            } catch {
                // Sin internet, o el servidor fallo: no se guarda nada, asi
                // la proxima carta de esta misma visita vuelve a intentar.
            }
            return null;
        }));
        let hubo = false;
        for (const par of leidos) {
            if (!par) continue;
            cache[par[0]] = par[1];
            hubo = true;
        }
        if (hubo) {
            try { sessionStorage.setItem(CLAVE, JSON.stringify(cache)); } catch {}
        }
    }

    return Object.fromEntries(ids.map((id) => [id, cache[id] || null]));
}
