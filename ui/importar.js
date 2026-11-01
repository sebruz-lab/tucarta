// Importacion de cartas desde archivos de otros programas. Todo se lee en
// el navegador: el archivo no se sube a ningun lado.
//
// Cada lector recibe el texto y devuelve { cartas, salteadas }, con cartas
// en el formato de los datos del formulario: { nombre, fecha 'AAAA-MM-DD',
// hora 'HH:MM' (sin segundos), lugar, correccion, eleccion }. La correccion es el huso
// que uso el programa de origen, asi la carta da igual que alla.

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
        const [d, mes, a, h, min] = [m[1], MESES[m[2]], m[3], m[4], m[5]];
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
            eleccion: 0
        });
        fin = i + 101;
        fecha.lastIndex = fin;
    }
    return { cartas, salteadas };
}

// Formatos conocidos. Para sumar otro (AAF, CSV...), un lector mas.
const LECTORES = [
    { nombre: 'Solar Fire', reconoce: (t) => /\d{1,2} [A-Z][a-z]{2} \d{4} +\d{1,2}:\d{2}.{0,30}[+-]\d{1,2}:\d{2}/.test(t), leer: leerSolarFire }
];

export function leerArchivoCartas(texto) {
    const lector = LECTORES.find((l) => l.reconoce(texto));
    if (!lector) return { formato: null, cartas: [], salteadas: 0 };
    return { formato: lector.nombre, ...lector.leer(texto) };
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
