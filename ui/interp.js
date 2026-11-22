// Las interpretaciones de la carta: un desplegable por posicion, con el texto
// de Seba y el enlace a la pagina del sitio donde ese texto vive.
//
// Los textos los escribe Seba y NO viven en este repositorio. Llegan por fetch
// desde sebabru.com/textos/ (ver interpretaciones.js, que explica por que no se
// piden mas a Firestore). Si no hay texto publicado, se muestra el aviso.
//
// POR QUE EL TEXTO NUNCA SE ESCRIBE EN EL HTML
//
// /textos/ esta en Disallow en el robots.txt del sitio a proposito: Googlebot
// no puede bajar esos JSON, asi que no existe una segunda copia de los textos
// compitiendo con las 196 paginas de /carta-natal/. Como aca el texto entra por
// fetch, el HTML que sirve /cartas/ no lo tiene y esa propiedad se mantiene.
// Si alguna vez estos textos terminan en el HTML servido, se crea justo la
// duplicacion que ese diseno evita, y encima contra las paginas que queremos
// posicionar.
//
// LOS ID DEL MOTOR NO SON LOS DEL SITIO
//
// Cuatro no coinciden, y son la parte que mas facil se rompe:
//
//   motor      texto               pagina
//   luna    -> luna-<signo>     -> /carta-natal/lunas/      (plural)
//   asc     -> asc-<signo>      -> /carta-natal/ascendente/
//   nodo    -> nodonorte-...    -> /carta-natal/nodonorte/
//   lilith  -> lunanegra-...    -> /carta-natal/lunanegra/  (OJO: no /lilith/,
//                                  que en el sitio es otra cosa)
//
// Por eso la tabla de abajo es explicita y tiene test propio.

import { NOMBRE_SIGNO, escapar } from './textos.js';

export const PROXIMAMENTE = 'PROXIMAMENTE: Un texto';

export const SITIO = 'https://sebabru.com';

// Las 12 casas (el signo en cada cuspide) quedan afuera hasta que esten los 36
// textos que faltan: las 12 casas en capricornio, acuario y piscis. El resto
// del camino ya esta hecho; ver la seccion 2 de PLAN-SEO.md en el repo del
// sitio.
export const INCLUIR_CASAS = false;

// motor:   el id que usa engine/config.js
// texto:   el id del archivo de texto en el sitio
// carpeta: la carpeta de la pagina en /carta-natal/
// nombre:  como lo nombra el sitio (Luna Negra, no Lilith)
// largo:   true  -> /textos/<texto>-<signo>.json         (el texto completo)
//          false -> /textos/signos/<texto>-<signo>.json  (el texto corto)
// angulo:  true  -> esta en carta.angulos, no en carta.puntos
export const POSICIONES = [
    { motor: 'sol',      texto: 'sol',       carpeta: 'sol',        nombre: 'Sol',        largo: true },
    { motor: 'luna',     texto: 'luna',      carpeta: 'lunas',      nombre: 'Luna',       largo: true },
    { motor: 'asc',      texto: 'asc',       carpeta: 'ascendente', nombre: 'Ascendente', largo: true, angulo: true },
    { motor: 'mercurio', texto: 'mercurio',  carpeta: 'mercurio',   nombre: 'Mercurio' },
    { motor: 'venus',    texto: 'venus',     carpeta: 'venus',      nombre: 'Venus' },
    { motor: 'marte',    texto: 'marte',     carpeta: 'marte',      nombre: 'Marte' },
    { motor: 'jupiter',  texto: 'jupiter',   carpeta: 'jupiter',    nombre: 'Júpiter' },
    { motor: 'saturno',  texto: 'saturno',   carpeta: 'saturno',    nombre: 'Saturno' },
    { motor: 'quiron',   texto: 'quiron',    carpeta: 'quiron',     nombre: 'Quirón' },
    { motor: 'urano',    texto: 'urano',     carpeta: 'urano',      nombre: 'Urano' },
    { motor: 'neptuno',  texto: 'neptuno',   carpeta: 'neptuno',    nombre: 'Neptuno' },
    { motor: 'pluton',   texto: 'pluton',    carpeta: 'pluton',     nombre: 'Plutón' },
    { motor: 'nodo',     texto: 'nodonorte', carpeta: 'nodonorte',  nombre: 'Nodo Norte' },
    { motor: 'lilith',   texto: 'lunanegra', carpeta: 'lunanegra',  nombre: 'Luna Negra' },
];

// La ruta del texto, con subcarpeta cuando es uno de los cortos. Es tambien la
// clave de la cache: tiene que llevar la carpeta, porque /textos/sol-aries.json
// y /textos/signos/sol-aries.json son dos textos distintos.
export const rutaTexto = (pos, signo) =>
    pos.largo ? `${pos.texto}-${signo}` : `signos/${pos.texto}-${signo}`;

export const urlPagina = (pos, signo) => `${SITIO}/carta-natal/${pos.carpeta}/${signo}/`;

// Las posiciones de una carta, en orden de carta. Una posicion que el motor no
// calculo (los puntos opcionales se pueden apagar en los ajustes) no entra.
export function posicionesInterpretacion(carta) {
    return POSICIONES.map((pos) => {
        const donde = pos.angulo ? carta.angulos : carta.puntos;
        const p = donde?.find((x) => x.id === pos.motor);
        if (!p?.signo) return null;
        return {
            ruta: rutaTexto(pos, p.signo),
            pagina: urlPagina(pos, p.signo),
            titulo: `${pos.nombre} en ${NOMBRE_SIGNO[p.signo]}`,
            punto: pos.motor,
            signo: p.signo,
        };
    }).filter(Boolean);
}

// Separa el texto en parrafos; no se interpreta HTML.
const parrafos = (t) => t.split(/\n\s*\n/).map((p) => `<p>${escapar(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

// Un <details> por posicion. El cuerpo arranca vacio y lo llena app.js cuando
// la persona lo abre: con 14 posiciones, pedir los 14 textos de entrada seria
// pedir catorce cosas que casi nadie va a leer.
export function bloquesInterpretacion(carta) {
    return posicionesInterpretacion(carta).map((pos) => `
        <details class="interpretacion" data-texto="${escapar(pos.ruta)}" data-pagina="${escapar(pos.pagina)}">
            <summary>${escapar(pos.titulo)}</summary>
            <div class="interpretacion-cuerpo"><p class="buscando-texto">Buscando el texto...</p></div>
        </details>`).join('');
}

// El contenido de un desplegable ya abierto. `t` es lo que devolvio
// textosInterpretacion para esa ruta: null si todavia no hay texto publicado.
export function cuerpoInterpretacion(pos, t) {
    const cuerpo = t?.texto ? parrafos(t.texto) : `<p class="proximamente">${PROXIMAMENTE}</p>`;
    const enlace = `<p class="nota leer-pagina"><a href="${escapar(pos.pagina)}" target="_blank" rel="noopener"`
        + ` data-posicion="${escapar(pos.ruta)}">Leer la página completa de ${escapar(pos.titulo)}</a></p>`;
    return cuerpo + enlace;
}
