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
// entre comillas puede tener saltos de linea (nombres partidos). El
// separador es la coma, o el que se pase (punto y coma, tabulacion).
function filasCsv(texto, sep = ',') {
    const filas = [];
    let fila = [];
    const s = sep === '\t' ? '\\t' : sep;
    const blanco = sep === '\t' ? ' ' : ' \\t';
    const re = new RegExp(`[${blanco}]*(?:"((?:[^"]|"")*)"|([^${s}\\r\\n]*))[${blanco}]*(${s}|\\r?\\n|$)`, 'g');
    for (let m; (m = re.exec(texto));) {
        fila.push(m[1] != null ? m[1].replace(/""/g, '"') : m[2]);
        if (m[3] !== sep) {
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

// ---------- Planilla (CSV de Google Sheets o de Excel) ----------
//
// Una fila de titulos y una carta por fila. Las columnas se reconocen por
// el titulo, en cualquier orden: nombre (y apellido, si va aparte), fecha,
// hora, y el lugar (ciudad; provincia y pais, si van aparte). El lugar se
// busca por el nombre, como en el formulario (completarLugares).

// Que columna es cada titulo. El orden importa: "lugar de nacimiento" es
// lugar y no fecha, "nombre y apellido" es el nombre completo.
const COLUMNAS = [
    ['ignorar', /marca temporal|timestamp|inscripcion|mail|correo|telefono|whatsapp/],
    ['lugar', /lugar|ciudad|localidad|pueblo|city|place/],
    ['provincia', /provincia|estado|region|departamento|state/],
    ['pais', /pais|country/],
    ['hora', /hora|time/],
    ['fecha', /fecha|date|nacimiento|naciste|birth/],
    ['nombre', /nombre y apellido|nombre completo|full name/],
    ['apellido', /apellido|surname|last name/],
    ['nombre', /nombre|name/]
];

function columnasDe(titulos) {
    const col = {};
    titulos.forEach((t, i) => {
        const n = sinTildes(t);
        const tipo = COLUMNAS.find(([, re]) => re.test(n))?.[0];
        if (tipo && tipo !== 'ignorar' && col[tipo] == null) col[tipo] = i;
    });
    return col;
}

const separadorDe = (linea) => [',', ';', '\t'].map((s) => [s, linea.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
const primeraLinea = (t) => t.split(/\r?\n/).find((l) => l.trim()) || '';

// "15/05/1979", "15-5-79", "1979-05-15" (y lo que siga, por ejemplo la
// hora). Con dia/mes ambiguo va primero el dia; si el segundo numero pasa
// de 12, la planilla viene en formato de Estados Unidos (mes/dia).
export function fechaPlanilla(t) {
    const s = String(t).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    let a, mes, d;
    if (m) {
        [a, mes, d] = [m[1], m[2], m[3]].map(Number);
    } else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/))) {
        [d, mes, a] = [m[1], m[2], m[3]].map(Number);
        if (m[3].length === 2) a += a > new Date().getFullYear() % 100 ? 1900 : 2000;
        if (mes > 12 && d <= 12) [d, mes] = [mes, d];
    } else {
        return null;
    }
    const f = new Date(Date.UTC(a, mes - 1, d));
    if (a < 1000 || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
    return { fecha: `${a}-${dos(mes)}-${dos(d)}`, resto: s.slice(m[0].length) };
}

// "13:15", "13.15", "13:15:00", "1:15 p. m.", "13 hs".
export function horaPlanilla(t) {
    const s = String(t).trim().toLowerCase();
    const m = s.match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2}))?(?::\d{2})?\s*(hs?|horas?)?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/);
    if (!m || (m[2] == null && !m[3] && !m[4])) return null;
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (m[4]) {
        if (h < 1 || h > 12) return null;
        h = (h % 12) + (m[4].startsWith('p') ? 12 : 0);
    }
    if (h > 23 || min > 59) return null;
    return `${dos(h)}:${dos(min)}`;
}

export function leerPlanilla(texto) {
    const sep = separadorDe(primeraLinea(texto));
    const [titulos = [], ...filas] = filasCsv(texto, sep).filter((f) => f.some((x) => x.trim()));
    const col = columnasDe(titulos);
    const de = (f, k) => (col[k] == null ? '' : (f[col[k]] || '').replace(/\s+/g, ' ').trim());
    const cartas = [];
    const problemas = [];
    filas.forEach((f, i) => {
        const nombre = [de(f, 'nombre'), de(f, 'apellido')].filter(Boolean).join(' ').slice(0, 60);
        const fecha = fechaPlanilla(de(f, 'fecha'));
        // La hora puede venir en su columna o junto con la fecha.
        const hora = horaPlanilla(de(f, 'hora') || fecha?.resto.replace(/^[\sT,]+/, '') || '');
        const lugar = [de(f, 'lugar'), de(f, 'provincia'), de(f, 'pais')].filter(Boolean);
        const falta = [!fecha && 'la fecha', !hora && 'la hora', !de(f, 'lugar') && 'el lugar'].filter(Boolean);
        if (falta.length) {
            problemas.push({ fila: i + 2, nombre, motivo: `falta ${falta.join(', ').replace(/, ([^,]*)$/, ' y $1')}` });
            return;
        }
        cartas.push({ nombre, fecha: fecha.fecha, hora, lugar: null, lugarPorBuscar: lugar, correccion: null, eleccion: 0 });
    });
    return { cartas, salteadas: problemas.length, problemas };
}

// Busca el lugar de cada carta de una planilla con `buscar` (el buscador de
// lugares del formulario): primero con todo (ciudad, provincia, pais),
// despues solo ciudad y pais, despues solo la ciudad. Devuelve las cartas
// con lugar y la lista de las que no se encontraron.
export async function completarLugares(cartas, buscar) {
    const cache = new Map();
    const encontrar = async (partes) => {
        const intentos = [partes, [partes[0], partes[partes.length - 1]], [partes[0]]];
        for (const p of intentos) {
            const k = p.join(' ');
            if (!cache.has(k)) cache.set(k, buscar(k, { limite: 1 }).then((r) => r[0] || null, () => null));
            const r = await cache.get(k);
            if (r) return r;
        }
        return null;
    };
    const listas = [];
    const sinLugar = [];
    for (const c of cartas) {
        if (!c.lugarPorBuscar) {
            listas.push(c);
            continue;
        }
        const { lugarPorBuscar, ...resto } = c;
        const l = await encontrar(lugarPorBuscar);
        if (l) listas.push({ ...resto, lugar: { nombre: l.nombre, provincia: l.provincia, pais: l.pais, paisNombre: l.paisNombre, lat: l.lat, lon: l.lon, zona: l.zona } });
        else sinLugar.push({ nombre: c.nombre, lugar: lugarPorBuscar.join(', ') });
    }
    return { cartas: listas, sinLugar };
}

// Formatos conocidos. Para sumar otro (AAF...), un lector mas.
const LECTORES = [
    { nombre: 'Solar Fire', reconoce: (t) => /^"[^"\r\n]*",\d{1,4},\d{1,2},\d{1,2},\d{1,2},\d{1,2},\d{1,2},/m.test(t), leer: leerSolarFireDat },
    { nombre: 'Solar Fire', reconoce: (t) => /\d{1,2} [A-Z][a-z]{2} \d{4} +\d{1,2}:\d{2}.{0,30}[+-]\d{1,2}:\d{2}/.test(t), leer: leerSolarFire },
    {
        nombre: 'planilla',
        reconoce: (t) => {
            const l = primeraLinea(t);
            const col = columnasDe(filasCsv(l, separadorDe(l))[0] || []);
            return col.fecha != null && col.lugar != null;
        },
        leer: leerPlanilla
    }
];

export function leerArchivoCartas(texto) {
    const lector = LECTORES.find((l) => l.reconoce(texto));
    if (!lector) return { formato: null, cartas: [], salteadas: 0, problemas: [] };
    const { cartas, salteadas, problemas = [] } = lector.leer(texto);
    return { formato: lector.nombre, cartas: clasificar(cartas), salteadas, problemas };
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
