// Fecha escrita a mano: se lleva a DD/MM/AAAA desde lo que venga.
//
// Mientras se escribe (normalizarFecha):
//   - con solo digitos, la barra se pone sola: "010384" -> "01/03/84";
//   - "-", ".", "/" o un espacio cierran el dia o el mes y lo completan
//     con 0: "1-3-84" -> "01/03/84";
//   - la barra automatica se agrega solo mientras se escribe (escribiendo),
//     para que al borrar no vuelva a aparecer;
//   - si hay letras (un mes escrito), no se toca: se arregla al salir.
// Al salir del campo (completarFecha): de cualquier forma razonable a
// DD/MM/AAAA: "1 de marzo de 1984", "1 mar 84", "1984-03-01", "01031984",
// "010384"; el año de dos cifras se completa (hasta 40 es 20xx).
//
// Y la hora (completarHora), al salir del campo: "9", "930", "9.30",
// "9:30 pm", "21,15", "9 y media" -> HH:MM de 24 horas.
//
// El formulario de inscripcion del sitio lleva una copia de estas
// funciones (no puede importar el JS de la calculadora): si cambian aca,
// cambiarlas alla tambien.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dos = (n) => String(n).padStart(2, '0');

export function normalizarFecha(valor, escribiendo = true) {
    if (/[a-zñ]/i.test(sinTildes(String(valor)))) return valor;
    const campos = ['', '', ''];
    let i = 0;
    for (const c of String(valor)) {
        if (c >= '0' && c <= '9') {
            if (i < 2 && campos[i].length === 2) i++;
            if (i === 2 && campos[2].length === 4) break;
            campos[i] += c;
        } else if (/[\s./-]/.test(c) && i < 2 && campos[i]) {
            campos[i] = campos[i].padStart(2, '0');
            i++;
        }
    }
    let res = campos[0];
    if (i >= 1) res += '/' + campos[1];
    if (i >= 2) res += '/' + campos[2];
    if (escribiendo && i < 2 && campos[i].length === 2) res += '/';
    return res;
}

// Año de dos cifras: hasta 40 es 20xx, desde 41 es 19xx ("28" -> 2028,
// "61" -> 1961).
export function anioCompleto(texto) {
    return texto.replace(/^(\d{1,2}\/\d{1,2}\/)(\d{2})$/, (_, dm, aa) => dm + (+aa <= 40 ? '20' : '19') + aa);
}

// Lo que se pueda entender, como DD/MM/AAAA; si no, el texto como vino
// (la validacion de cada formulario avisa).
export function completarFecha(texto) {
    let t = sinTildes(String(texto)).trim();
    if (!t) return '';
    // Mes en letras: "1 de marzo de 1984", "marzo 1, 1984", "1-mar-84".
    const mes = MESES.findIndex((m) => new RegExp(`(^|[^a-z])${m}[a-z]*`).test(t)) + 1
        || (/(^|[^a-z])set[a-z]*/.test(t) ? 9 : 0);
    if (mes) {
        const nums = t.replace(/[a-z]+/g, ' ').match(/\d+/g) || [];
        const anio = nums.find((n) => n.length === 4) || (nums.length > 1 ? nums[nums.length - 1] : '');
        const dia = nums.find((n) => n !== anio && n.length <= 2);
        if (!dia || !anio) return texto.trim();
        return anioCompleto(`${dos(dia)}/${dos(mes)}/${anio}`);
    }
    // Candidatos en orden: los numeros como vinieron (con el año adelante,
    // "1984-03-01", o al final) y, si no da una fecha, todos los digitos
    // juntos como DDMMAAAA, AAAAMMDD o DDMMAA (al escribir "1984-03-01"
    // tecla por tecla las barras automaticas lo dejan "19/84/0301").
    const nums = t.match(/\d+/g) || [];
    const dig = t.replace(/\D/g, '');
    const candidatos = [];
    if (nums.length >= 3) candidatos.push(nums[0].length === 4 ? [nums[2], nums[1], nums[0]] : nums.slice(0, 3));
    if (dig.length === 8) candidatos.push([dig.slice(0, 2), dig.slice(2, 4), dig.slice(4)], [dig.slice(6), dig.slice(4, 6), dig.slice(0, 4)]);
    if (dig.length === 6) candidatos.push([dig.slice(0, 2), dig.slice(2, 4), dig.slice(4)]);
    const sirve = ([d, m, a]) => d.length <= 2 && m.length <= 2 && (a.length === 2 || a.length === 4) &&
        +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31;
    const elegido = candidatos.find(sirve);
    if (!elegido) return normalizarFecha(texto, false);
    const [d, m, a] = elegido;
    return anioCompleto(`${dos(d)}/${dos(m)}/${a}`);
}

// Hora escrita a mano, al salir del campo: lo que se entienda, como HH:MM
// de 24 horas; si no, el texto como vino (cada formulario avisa).
//
//   "9" -> 09:00        "930" -> 09:30       "0930" -> 09:30
//   "9:30" "9.30" "9,30" "9 30" "9h30" -> 09:30
//   "2115" -> 21:15     "9 pm" -> 21:00      "12 am" -> 00:00
//   "9 y media" -> 09:30    "9 de la noche" -> 21:00
export function completarHora(texto) {
    const t = sinTildes(String(texto)).trim();
    if (!t) return '';

    // Mediodia y medianoche, que no traen numero.
    if (/mediodia/.test(t)) return '12:00';
    if (/medianoche/.test(t)) return '00:00';

    const tarde = /(^|[^a-z])(pm|p\.m|tarde|noche)/.test(t);
    const manana = /(^|[^a-z])(am|a\.m|manana|madrugada)/.test(t);
    const media = /(y\s*)?media/.test(t) && !/mediodia|medianoche/.test(t);
    const cuarto = /(y\s*)?cuarto/.test(t);

    const nums = t.match(/\d+/g) || [];
    if (!nums.length) return texto.trim();

    let h;
    let m = 0;
    if (nums.length >= 2) {
        h = +nums[0];
        m = +nums[1];
    } else {
        const d = nums[0];
        // Pegado: 4 digitos son HHMM y 3 son HMM ("2115", "930").
        if (d.length === 4) { h = +d.slice(0, 2); m = +d.slice(2); }
        else if (d.length === 3) { h = +d.slice(0, 1); m = +d.slice(1); }
        else { h = +d; }
    }
    if (media && !m) m = 30;
    if (cuarto && !m) m = 15;

    if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59) return texto.trim();
    if (tarde && h < 12) h += 12;
    if (manana && h === 12) h = 0;
    if (h > 23) return texto.trim();

    return `${dos(h)}:${dos(m)}`;
}
