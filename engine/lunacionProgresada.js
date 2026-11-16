// La luna nueva progresada: el momento en que el Sol y la Luna progresados se
// conjuntan. Es el arranque del ciclo de lunaciones progresadas, que dura un
// mes sinodico de tiempo progresado, o sea unos 29 anios y medio de vida.
//
// Dos vistas:
//   'prenatal'  la que abre el ciclo que estaba vigente al nacer. Cae ANTES
//               del nacimiento, hasta 29 anios y medio antes.
//   'actual'    la ultima ocurrida hasta el momento de referencia (hoy).
//
// No hace falta ninguna busqueda nueva. En las progresiones secundarias las
// posiciones progresadas de una fecha T son las posiciones REALES del dia
//   jdProg = jdNatal + (T - jdNatal) / ANIO_TROPICO
// (ver calcularProgresion). Asi que el Sol progresado se conjunta con la Luna
// progresada exactamente cuando en jdProg cae una luna nueva de verdad: se
// buscan las lunaciones reales en el tiempo progresado, con lunacionesEntre, y
// despues se vuelve la fecha al tiempo de la vida.

import { AJUSTES_POR_DEFECTO } from './config.js';
import { casaDe, diaJuliano } from './chart.js';
import { utcDeJd } from './solarReturn.js';
import { lunacionesEntre } from './lunaciones.js';
import { ANIO_TROPICO, calcularProgresion } from './progressions.js';

// Un mes sinodico son 29,53 dias: 31 de ventana siempre tiene una luna nueva.
const VENTANA = 31;

// La ultima luna nueva en jd o antes (dia juliano UT).
function ultimaLunaNueva(swe, jd) {
    const nuevas = lunacionesEntre(swe, { desde: jd - VENTANA, hasta: jd }).filter((l) => l.tipo === 'nueva');
    if (!nuevas.length) throw new Error('No se encontró la luna nueva progresada');
    return nuevas[nuevas.length - 1];
}

// cual: 'prenatal' | 'actual'. utc: el momento de referencia de la 'actual'.
export function calcularLunacionProgresada(swe, { natal, utc, cual = 'actual', ajustes = AJUSTES_POR_DEFECTO }) {
    const jdNatal = natal.meta.jd;
    const jdRef = cual === 'prenatal' ? jdNatal : diaJuliano(swe, utc);
    // El instante de referencia, en tiempo progresado (un dia por anio).
    const jdProgRef = jdNatal + (jdRef - jdNatal) / ANIO_TROPICO;
    const ln = ultimaLunaNueva(swe, jdProgRef);
    // Y la vuelta: el dia de la vida al que corresponde ese dia progresado.
    const jdObjetivo = jdNatal + (ln.jd - jdNatal) * ANIO_TROPICO;
    const prog = calcularProgresion(swe, { natal, jdObjetivo, ajustes });
    const casa = casaDe(ln.lon, natal.cusps.map((c) => c.lon));
    return {
        ...prog,
        lunacion: {
            ...ln,
            casa,
            cual,
            // El momento de la vida, que es el que se muestra.
            jdObjetivo,
            utcObjetivo: utcDeJd(jdObjetivo),
            // Quien tiene menos de 29 anios y medio sigue en el ciclo que
            // abrio la pre-natal: las dos vistas dan la misma carta, y eso se
            // dice en pantalla en vez de esconderlo.
            antesDeNacer: jdObjetivo < jdNatal
        }
    };
}
