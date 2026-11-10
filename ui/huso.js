// Panel del huso horario: muestra siempre el huso base y el horario de
// verano usados, avisa si es anterior a 1970 o si la hora es ambigua o no
// existio, y deja corregir a mano.

import { VERSION_TZ, ANIO_TENTATIVO } from '../time/tz.js';
import { utcTexto, duracionTexto, escapar } from './textos.js';

function veranoTexto(o) {
    if (o.verano === null) return 'no se sabe por separado: el huso de arriba ya lo incluye';
    if (o.verano === 0) return 'no';
    return `sí (+${duracionTexto(o.verano)})`;
}

export function panelHuso(resultado, eleccion, corrigiendo) {
    const o = resultado.opciones[eleccion] || resultado.opciones[0];
    const partes = [];

    partes.push(`<dl class="huso-datos">
        <dt>Huso</dt><dd>${utcTexto(o.base)}</dd>
        <dt>Horario de verano</dt><dd>${veranoTexto(o)}</dd>
        <dt>Total aplicado</dt><dd><strong>${utcTexto(o.total)}</strong></dd>
    </dl>`);

    if (resultado.estado === 'manual') {
        partes.push('<p class="aviso">Usás un huso corregido a mano.</p>');
    } else if (o.correccion === 1) {
        // Donde la base IANA no coincide con la hora legal argentina
        // usamos la oficial, que es la que marcaban los relojes de quienes
        // anotaron esos nacimientos. Conviene decirlo: otras páginas y
        // otros programas, que siguen a IANA sin más, van a dar otra hora.
        partes.push(`<p class="nota">Para esta fecha usamos la <strong>hora oficial argentina</strong>, la que fijó el
            Servicio de Hidrografía Naval y marcaban los relojes acá. La base horaria IANA ${VERSION_TZ} (la que usan
            la mayoría de las páginas y los programas) estima otro huso para esta provincia en estos meses, así que
            es probable que en otro lado te den una carta distinta. Si sabés que la hora era otra, corregila acá abajo.</p>`);
    } else if (o.correccion === 2) {
        // El caso opuesto al de arriba: acá la que se aparta de la hora
        // oficial es la provincia. En esos veranos el país quedó partido y
        // los relojes no coincidían ni dentro de una misma provincia, así
        // que lo único honesto es decirlo y dejar la corrección a mano.
        partes.push(`<p class="nota">Para esta fecha usamos el huso de la provincia, que
            <strong>no adhirió al horario de verano</strong> de ese año: el país adelantaba una hora y acá los relojes
            no se movieron. La base horaria IANA ${VERSION_TZ} (la que usan la mayoría de las páginas y los programas)
            le aplica el horario de verano nacional, así que en otro lado es probable que te den la carta una hora
            corrida. En esos veranos la adhesión fue provincia por provincia y hubo lugares que no siguieron a su
            propia provincia: si sabés que la hora era otra, corregila acá abajo.</p>`);
    } else if (o.provincial) {
        // Una hora provincial que no corregimos nosotros: ya viene así en
        // la base IANA (Mendoza por su ley 5566, las del oeste en 2004,
        // las exceptuadas del decreto 1705/2008, San Luis hasta 2010).
        // Acá no hay discrepancia con nadie, pero conviene avisarlo: es
        // una hora que no figura en ninguna tabla nacional.
        partes.push(`<p class="nota">Para esta fecha esta provincia tenía un <strong>horario propio</strong>,
            distinto de la hora oficial argentina: usamos el provincial, que es el que marcaban los relojes del lugar.
            Si buscás esa fecha en una tabla de la hora oficial del país te va a dar otro huso. Si sabés que la hora
            era otra, corregila acá abajo.</p>`);
    } else {
        const fuente = o.verano === null ? 'la base horaria IANA de tu navegador' : `la base horaria IANA ${VERSION_TZ}`;
        partes.push(`<p class="nota">Zona ${escapar(resultado.zona)}, según ${fuente}.</p>`);
    }

    if (resultado.tentativo) {
        partes.push(`<p class="aviso">Para nacimientos anteriores a ${ANIO_TENTATIVO} el huso es aproximado: ` +
            'los registros de esa época no siempre son exactos. Si sabés que el horario era otro, corregilo.</p>');
    }

    if (resultado.estado === 'ambigua' || resultado.estado === 'inexistente') {
        const intro = resultado.estado === 'ambigua'
            ? 'Esa hora pasó dos veces ese día, por el cambio de horario. ¿Cuál fue?'
            : 'Esa hora no existió ese día: los relojes se adelantaron. ¿Con qué horario la anotaron?';
        const etiqueta = (x, i) => {
            const verano = x.verano === null ? '' : x.verano ? 'con horario de verano, ' : 'sin horario de verano, ';
            const orden = resultado.estado === 'ambigua' ? (i === 0 ? 'La primera vez: ' : 'La segunda vez: ') : '';
            return `${orden}${verano}${utcTexto(x.total)}`;
        };
        partes.push(`<fieldset class="eleccion"><legend>${intro}</legend>${resultado.opciones.map((x, i) => `
            <label><input type="radio" name="eleccion-huso" value="${i}" ${i === eleccion ? 'checked' : ''}> ${etiqueta(x, i)}</label>`).join('')}
        </fieldset>`);
    }

    partes.push(corrigiendo ? formCorreccion(o) :
        '<button type="button" class="boton-texto" data-accion="corregir-huso">Corregir el huso a mano</button>');
    if (resultado.estado === 'manual') {
        partes.push('<button type="button" class="boton-texto" data-accion="huso-iana">Volver al huso de la base IANA</button>');
    }
    return partes.join('');
}

function formCorreccion(o) {
    const opciones = [];
    for (let m = -12 * 60; m <= 14 * 60; m += 15) {
        const s = m * 60;
        opciones.push(`<option value="${s}" ${s === o.base ? 'selected' : ''}>${utcTexto(s)}</option>`);
    }
    const veranos = [[0, 'No'], [1800, 'Sí, +30 min'], [3600, 'Sí, +1 h'], [7200, 'Sí, +2 h']];
    const v = o.verano || 0;
    return `<div class="correccion">
        <label>Huso <select name="huso-base">${opciones.join('')}</select></label>
        <label>Horario de verano <select name="huso-verano">${veranos.map(([s, t]) =>
            `<option value="${s}" ${s === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <button type="button" class="boton" data-accion="aplicar-huso">Recalcular</button>
        <button type="button" class="boton-texto" data-accion="cancelar-huso">Cancelar</button>
    </div>`;
}
