// Interpretaciones de Sol, Luna y Ascendente. Los textos los escribe Seba y
// viven en Firestore (tucarta_textos/{sol-aries, luna-tauro, asc-geminis...}),
// fuera de este repositorio. Si no hay texto publicado, se muestra el aviso.

import { NOMBRE_SIGNO, NOMBRE_PUNTO, escapar } from './textos.js';

export const PROXIMAMENTE = 'PROXIMAMENTE: Un texto';

export function idsInterpretacion(carta) {
    const sol = carta.puntos.find((p) => p.id === 'sol');
    const luna = carta.puntos.find((p) => p.id === 'luna');
    const asc = carta.angulos.find((p) => p.id === 'asc');
    return [
        { id: `sol-${sol.signo}`, punto: 'sol', signo: sol.signo },
        { id: `luna-${luna.signo}`, punto: 'luna', signo: luna.signo },
        { id: `asc-${asc.signo}`, punto: 'asc', signo: asc.signo }
    ];
}

// Separa el texto en parrafos; no se interpreta HTML.
const parrafos = (t) => t.split(/\n\s*\n/).map((p) => `<p>${escapar(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

export function bloquesInterpretacion(carta, textos) {
    return idsInterpretacion(carta).map(({ id, punto, signo }) => {
        const t = textos[id];
        const titulo = t?.titulo || `${NOMBRE_PUNTO[punto]} en ${NOMBRE_SIGNO[signo]}`;
        const cuerpo = t?.texto ? parrafos(t.texto) : `<p class="proximamente">${PROXIMAMENTE}</p>`;
        return `<article class="interpretacion" data-texto="${id}"><h3>${escapar(titulo)}</h3>${cuerpo}</article>`;
    }).join('');
}
