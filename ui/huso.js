// Panel del huso horario: muestra siempre el huso base y el horario de
// verano usados, avisa si es anterior a 1970 o si la hora es ambigua o no
// existio, y deja corregir a mano.

import { VERSION_TZ, ANIO_TENTATIVO } from '../time/tz.js';
import { utcTexto, duracionTexto, escapar } from './textos.js';
import { ENGRANAJE } from './iconos.js';

function veranoTexto(o) {
    if (o.verano === null) return 'no se sabe por separado: el huso de arriba ya lo incluye';
    if (o.verano === 0) return 'no';
    return `sí (+${duracionTexto(o.verano)})`;
}

// La roldanita que abre el corrector y lleva la pantalla hasta él. Es la
// misma que está en la esquina de la rueda, al lado del huso: conviene que
// se reconozca como la misma cosa en los dos lados. Cada aviso la cierra
// con sus propias palabras.
const ROLDANITA = '<button type="button" class="rueda-huso" data-accion="corregir-huso"'
    + ' title="Corregir el huso a mano" aria-label="Corregir el huso a mano">'
    + `${ENGRANAJE(15)}</button>`;

const fuenteTexto = (o) =>
    (o.verano === null ? 'la base horaria IANA de tu navegador' : `la base horaria IANA ${VERSION_TZ}`);

// Los avisos que le corresponden a esta lectura del huso, en orden. Puede
// devolver dos: el 1/4/1991 en Santiago del Estero lleva el de la hora
// oficial y el de la provincia. Vacío es el caso normal, y entonces no hay
// nada que avisar: el renglón de la zona no es un aviso.
//
// Salen en dos lugares a la vez: como párrafos en el panel del huso, y
// dentro del globo del triangulito de la esquina de la rueda. El panel
// está oculto hasta que alguien lo abre, así que el triángulo es lo único
// que se ve sin hacer nada.
export function avisosDelHuso(resultado, eleccion) {
    const o = resultado.opciones[eleccion] || resultado.opciones[0];
    const avisos = [];

    if (resultado.estado === 'manual') {
        return [{ clase: 'aviso', html: 'Usás un huso corregido a mano.' }];
    }

    if (o.correccion === 1) {
        // Donde la base IANA no coincide con la hora legal argentina
        // usamos la oficial, que es la que marcaban los relojes de quienes
        // anotaron esos nacimientos. Conviene decirlo: otras páginas y
        // otros programas, que siguen a IANA sin más, van a dar otra hora.
        avisos.push({ clase: 'nota', html: `Para esta fecha usamos la <strong>hora oficial argentina</strong>, la que fijó el
            Servicio de Hidrografía Naval y marcaban los relojes acá. La base horaria IANA ${VERSION_TZ} (la que usan
            la mayoría de las páginas de cartas astrales, que son de otros países) estima otro huso para esta
            provincia en estos meses, así que es probable que en otro lado te den una carta distinta. Si vos sabés
            fehacientemente que el huso horario era otro, corregilo manualmente acá ${ROLDANITA}` });
    } else if (o.correccion === 2) {
        // El caso opuesto al de arriba: acá la que se aparta de la hora
        // oficial es la provincia. En esos veranos el país quedó partido y
        // los relojes no coincidían ni dentro de una misma provincia, así
        // que lo único honesto es decirlo y dejar la corrección a mano.
        avisos.push({ clase: 'nota', html: `Para esta fecha usamos el huso de la provincia, que
            <strong>no adhirió al horario de verano</strong> de ese año: el país adelantaba una hora y acá los relojes
            no se movieron. La base horaria IANA ${VERSION_TZ} (la que usan la mayoría de las páginas de cartas
            astrales, que son de otros países) le aplica el horario de verano nacional, así que en otro lado es
            probable que te den la carta una hora corrida. En ese verano, la adhesión fue provincia por provincia y
            hubo lugares que no siguieron a su propia provincia: si sabés que la hora era otra,
            corregila acá ${ROLDANITA}` });
    } else if (o.provincial) {
        // Una hora provincial que no corregimos nosotros: ya viene así en
        // la base IANA (Mendoza por su ley 5566, las del oeste en 2004,
        // las exceptuadas del decreto 1705/2008, San Luis hasta 2010).
        // Acá no hay discrepancia con nadie, pero conviene avisarlo: es
        // una hora que no figura en ninguna tabla nacional.
        avisos.push({ clase: 'nota', html: `Para esta fecha esta provincia tenía un <strong>horario propio</strong>,
            distinto de la hora oficial argentina: usamos el provincial, que es el que marcaban los relojes del lugar.
            Si buscás esa fecha en una tabla de la hora oficial del país te va a dar otro huso. Si sabés que la hora
            era otra, corregila acá ${ROLDANITA}` });
    }

    // Una provincia de esta zona tuvo otra hora y tzdata no le da zona
    // propia, así que no se puede calcular: solo avisar. Va además del
    // aviso de arriba, no en su lugar.
    if (o.aviso) {
        avisos.push({ clase: 'aviso', html: `${escapar(o.aviso.texto)} ${ROLDANITA}` });
    }
    return avisos;
}

// El triangulito que abre el globo con los avisos. Es un <details> y no el
// emergente del navegador para que también se abra con el dedo, donde no
// hay mouse que apoyar, y para que cierre solo al volver a tocarlo.
export function trianguloHuso(resultado, eleccion) {
    const avisos = avisosDelHuso(resultado, eleccion);
    if (!avisos.length) return '';
    return `<details class="alerta-huso"><summary aria-label="Hay algo que saber sobre este huso"
        title="Hay algo que saber sobre este huso"><svg viewBox="0 0 24 24" width="13" height="13"
        aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
        stroke-linejoin="round"><path d="M12 3.6 1.9 20.4h20.2L12 3.6Z"/><path d="M12 9.6v4.6"/><path
        d="M12 17.3h.01"/></svg></summary><div class="globo-huso">${avisos
        .map((a) => `<p>${a.html}</p>`).join('')}</div></details>`;
}

export function panelHuso(resultado, eleccion) {
    const o = resultado.opciones[eleccion] || resultado.opciones[0];
    const partes = [];

    partes.push(`<dl class="huso-datos">
        <dt>Huso</dt><dd>${utcTexto(o.base)}</dd>
        <dt>Horario de verano</dt><dd>${veranoTexto(o)}</dd>
        <dt>Total aplicado</dt><dd><strong>${utcTexto(o.total)}</strong></dd>
    </dl>`);

    // Los avisos van acá, entre el huso declarado y el corrector. Los
    // mismos salen en el globo del triangulito de la esquina de la rueda,
    // que es lo único que se ve sin abrir este panel.
    const avisos = avisosDelHuso(resultado, eleccion);
    if (avisos.length) partes.push(avisos.map((a) => `<p class="${a.clase}">${a.html}</p>`).join(''));
    else partes.push(`<p class="nota">Zona ${escapar(resultado.zona)}, según ${fuenteTexto(o)}.</p>`);

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

    // El corrector va siempre desplegado, sin un boton que lo abra: el
    // panel entero ya esta detras de un <details>, asi que quien lo abrio
    // vino a mirar el huso y lo mas probable es que quiera tocarlo.
    partes.push(formCorreccion(o));
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
    </div>`;
}
