// Importacion de cartas desde archivos de otros programas. Todo se lee en
// el navegador: el archivo no se sube a ningun lado.
//
// Cada lector recibe el texto y devuelve { cartas, salteadas }, con cartas
// en el formato de los datos del formulario: { nombre, fecha 'AAAA-MM-DD',
// hora 'HH:MM' (sin segundos), lugar, correccion, eleccion, tipo }. La
// correccion es el huso que uso el programa de origen, asi la carta da
// igual que alla.

const MESES = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const dos = (n) => String(n).padStart(2, '0');

// Zona horaria para mostrar horas locales de ese lugar (por ejemplo, el
// momento de la revolucion). El calculo de la carta usa el huso del archivo.
const ZONA_PAIS = {
    argentina: 'America/Argentina/Buenos_Aires', uruguay: 'America/Montevideo', chile: 'America/Santiago',
    paraguay: 'America/Asuncion', bolivia: 'America/La_Paz', peru: 'America/Lima', ecuador: 'America/Guayaquil',
    colombia: 'America/Bogota', venezuela: 'America/Caracas', mexico: 'America/Mexico_City',
    brasil: 'America/Sao_Paulo', brazil: 'America/Sao_Paulo', espana: 'Europe/Madrid', spain: 'Europe/Madrid',
    france: 'Europe/Paris', italy: 'Europe/Rome', germany: 'Europe/Berlin', switzerland: 'Europe/Zurich',
    england: 'Europe/London', 'united kingdom': 'Europe/London', israel: 'Asia/Jerusalem'
};
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Huso fijo de IANA para un desfasaje (en segundos al este de UTC), si es
// de horas enteras.
const zonaFija = (seg) => (seg % 3600 === 0 ? (seg === 0 ? 'Etc/UTC' : `Etc/GMT${seg > 0 ? '-' : '+'}${Math.abs(seg / 3600)}`) : 'Etc/UTC');

// "34S36" o "32N42 55" (grados, letra, minutos, segundos opcionales).
function coordenada(t) {
    const m = t.trim().match(/^(\d{1,3})([NSEW])(\d{2})(?:\s+(\d{2}))?$/);
    if (!m) return null;
    const v = Number(m[1]) + Number(m[3]) / 60 + Number(m[4] || 0) / 3600;
    return m[2] === 'S' || m[2] === 'W' ? -v : v;
}

// Solar Fire escribe el huso como horas al oeste: "+3:00" es UTC-3,
// "-1:00" es UTC+1. Devuelve segundos al este de UTC.
function husoSolarFire(t) {
    const m = t.trim().match(/^([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const seg = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] || 0);
    return m[1] === '+' ? -seg : seg;
}

// Exportacion de texto de Solar Fire: un renglon por carta, en columnas de
// ancho fijo (nombre 30, fecha 14, hora 10, zona 5, huso 8, lugar 20, pais
// 20, latitud 12, longitud 12). Cada carta se ubica por su fecha y hora,
// asi se leen bien los nombres cortados, pegados a la fecha o partidos en
// dos renglones.
export function leerSolarFire(texto) {
    const fecha = /(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) +(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    const cartas = [];
    let salteadas = 0;
    let fin = 0;
    for (let m; (m = fecha.exec(texto));) {
        const i = m.index;
        // La fecha tiene que caer al principio de su columna (despues de
        // un nombre de hasta 30 caracteres).
        const nombre = texto.slice(fin, i).replace(/\s+/g, ' ').trim();
        const campo = (desde, largo) => texto.slice(i + desde, i + desde + largo);
        const huso = husoSolarFire(campo(29, 8));
        const lat = coordenada(campo(77, 12));
        const lon = coordenada(campo(89, 12));
        if (huso == null || lat == null || lon == null) {
            salteadas++;
            fecha.lastIndex = i + 1;
            continue;
        }
        const [d, mes, a, h, min, seg] = [m[1], MESES[m[2]], m[3], m[4], m[5], m[6]];
        const lugar = campo(37, 20).trim();
        const pais = campo(57, 20).trim();
        cartas.push({
            nombre: nombre.slice(0, 60),
            fecha: `${a}-${dos(mes)}-${dos(d)}`,
            hora: `${dos(h)}:${min}`, // los segundos no hacen falta
            lugar: {
                nombre: lugar || 'Lugar sin nombre', paisNombre: pais || undefined, lat, lon,
                zona: ZONA_PAIS[sinTildes(pais)] || zonaFija(huso)
            },
            correccion: { base: huso, verano: 0 },
            eleccion: 0,
            // Pista para clasificarla (los segundos no se guardan).
            conSegundos: Boolean(seg)
        });
        fin = i + 101;
        fecha.lastIndex = fin;
    }
    return { cartas, salteadas };
}

// Tipo de cada carta importada: 'natal', 'revolucion', 'progresion' o
// 'evento'. Los archivos no lo dicen; se deduce (las progresadas no se
// distinguen: se marcan a mano):
//   - evento: por el nombre (transitos, eventos, lunaciones, eclipses).
//   - revolucion: hora con segundos (los programas la calculan al segundo)
//     y fecha en el cumpleanios (mismo dia y mes, +-1) de una carta anterior
//     de la misma persona (mismo nombre, o uno empieza con el otro).
//   - natal: el resto.
// La persona lo puede corregir antes de importar.
const EVENTO = /(?<![a-zà-ÿ])(transits?|tr[aá]nsitos?|events?|eventos?|luna (llena|nueva)|eclipses?)\b/i;
const clave = (s) => sinTildes(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const mismaPersona = (a, b) => {
    const x = clave(a);
    const y = clave(b);
    return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
};
const diaDelAnio = (f) => {
    const [, m, d] = f.split('-').map(Number);
    return Date.UTC(2001, m - 1, d) / 864e5;
};

export function clasificar(cartas) {
    return cartas.map((c) => {
        if (EVENTO.test(c.nombre)) return { ...c, tipo: 'evento' };
        if (c.conSegundos) {
            const esRevolucion = cartas.some((o) => o !== c && o.fecha < c.fecha && mismaPersona(o.nombre, c.nombre) &&
                Math.min(Math.abs(diaDelAnio(o.fecha) - diaDelAnio(c.fecha)), 365 - Math.abs(diaDelAnio(o.fecha) - diaDelAnio(c.fecha))) <= 1);
            if (esRevolucion) return { ...c, tipo: 'revolucion' };
        }
        return { ...c, tipo: 'natal' };
    }).map(({ conSegundos, ...c }) => c);
}

// Renglones CSV con comillas dobles ("" adentro es una comilla). Un campo
// entre comillas puede tener saltos de linea (nombres partidos).
function filasCsv(texto) {
    const filas = [];
    let fila = [];
    const re = /[ \t]*(?:"((?:[^"]|"")*)"|([^,\r\n]*))[ \t]*(,|\r?\n|$)/g;
    for (let m; (m = re.exec(texto));) {
        fila.push(m[1] != null ? m[1].replace(/""/g, '"') : m[2]);
        if (m[3] !== ',') {
            filas.push(fila);
            fila = [];
            if (!m[3]) break;
        }
    }
    return filas;
}

// Archivo .dat de Solar Fire (formato de Jigsaw): un renglon CSV por carta,
// "nombre",anio,mes,dia,hora,min,seg,0,3,"zona",huso,"lugar, pais",
// longitud,latitud,... El huso va en horas al oeste (con decimales para la
// hora media local) y la longitud es positiva al oeste.
export function leerSolarFireDat(texto) {
    const cartas = [];
    let salteadas = 0;
    for (const c of filasCsv(texto)) {
        if (c.every((x) => !x.trim())) continue;
        const [a, mes, d, h, min, seg] = c.slice(1, 7).map(Number);
        const horas = Number(c[10]);
        const lon = -Number(c[12]);
        const lat = Number(c[13]);
        const ok = c.length >= 14 && [a, mes, d, h, min, seg].every(Number.isInteger) &&
            mes >= 1 && mes <= 12 && d >= 1 && d <= 31 && h <= 23 && min <= 59 &&
            c[10] !== '' && c[12] !== '' && c[13] !== '' &&
            Number.isFinite(horas) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
        if (!ok) {
            salteadas++;
            continue;
        }
        const huso = -Math.round(horas * 3600);
        const partes = c[11].split(',').map((s) => s.trim()).filter(Boolean);
        const pais = partes.length > 1 ? partes.pop() : '';
        cartas.push({
            nombre: c[0].replace(/\s+/g, ' ').trim().slice(0, 60),
            fecha: `${String(a).padStart(4, '0')}-${dos(mes)}-${dos(d)}`,
            hora: `${dos(h)}:${dos(min)}`, // los segundos no hacen falta
            lugar: {
                nombre: partes.join(', ') || 'Lugar sin nombre', paisNombre: pais || undefined, lat, lon,
                zona: ZONA_PAIS[sinTildes(pais)] || zonaFija(huso)
            },
            correccion: { base: huso, verano: 0 },
            eleccion: 0,
            conSegundos: seg > 0
        });
    }
    return { cartas, salteadas };
}

// Formatos conocidos. Para sumar otro (AAF, CSV...), un lector mas.
const LECTORES = [
    { nombre: 'Solar Fire', reconoce: (t) => /^"[^"\r\n]*",\d{1,4},\d{1,2},\d{1,2},\d{1,2},\d{1,2},\d{1,2},/m.test(t), leer: leerSolarFireDat },
    { nombre: 'Solar Fire', reconoce: (t) => /\d{1,2} [A-Z][a-z]{2} \d{4} +\d{1,2}:\d{2}.{0,30}[+-]\d{1,2}:\d{2}/.test(t), leer: leerSolarFire }
];

export function leerArchivoCartas(texto) {
    const lector = LECTORES.find((l) => l.reconoce(texto));
    if (!lector) return { formato: null, cartas: [], salteadas: 0 };
    const { cartas, salteadas } = lector.leer(texto);
    return { formato: lector.nombre, cartas: clasificar(cartas), salteadas };
}

// Texto de un archivo: UTF-8 si es valido; si no, Windows-1252 (el de las
// exportaciones de Solar Fire, con las tildes en un solo byte).
export function textoDeArchivo(buffer) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder('windows-1252').decode(buffer);
    }
}
