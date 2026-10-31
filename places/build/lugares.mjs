// Arma el indice de lugares desde GeoNames (CC-BY 4.0):
//   - Argentina, Uruguay y España completos (todas las localidades).
//   - El resto del mundo: ciudades de mas de 1000 habitantes.
//
// Sale en ui/public/lugares/{clave}.json, un fragmento por cada prefijo de
// 3 letras de cada palabra del nombre ("villa cañas" -> vil, can), asi
// cada busqueda baja un archivo chico y no consulta a terceros. Los
// fragmentos grandes se parten (ver partidos.json).
//
// Uso: node places/build/lugares.mjs
//   Espera en places/build/raw/: AR.txt, UY.txt, ES.txt, cities1000.txt y
//   admin1CodesASCII.txt de https://download.geonames.org/export/dump/

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { normalizar, clavesDe } from '../normalizar.js';

const RAW = new URL('./raw/', import.meta.url);
const DESTINO = new URL('../../ui/public/lugares/', import.meta.url);
const COMPLETOS = ['AR', 'UY', 'ES'];

// En Argentina la zona IANA depende de la provincia (zone.tab), no de las
// coordenadas: se toma de aca y no de GeoNames, que la asigna por poligono.
const ZONA_AR = {
    '01': 'Buenos_Aires', '07': 'Buenos_Aires',
    '05': 'Cordoba', '21': 'Cordoba', '22': 'Cordoba', '03': 'Cordoba',
    '09': 'Cordoba', '14': 'Cordoba', '08': 'Cordoba', '06': 'Cordoba',
    '17': 'Salta', '11': 'Salta', '15': 'Salta', '16': 'Salta',
    '10': 'Jujuy', '24': 'Tucuman', '02': 'Catamarca', '04': 'Catamarca',
    '12': 'La_Rioja', '18': 'San_Juan', '13': 'Mendoza', '19': 'San_Luis',
    '20': 'Rio_Gallegos', '23': 'Ushuaia'
};

// Nombres de provincias y comunidades con tildes (GeoNames los da en ASCII
// o en ingles).
const PROVINCIA = {
    'AR.01': 'Buenos Aires', 'AR.07': 'Ciudad de Buenos Aires', 'AR.02': 'Catamarca',
    'AR.03': 'Chaco', 'AR.04': 'Chubut', 'AR.05': 'Córdoba', 'AR.06': 'Corrientes',
    'AR.08': 'Entre Ríos', 'AR.09': 'Formosa', 'AR.10': 'Jujuy', 'AR.11': 'La Pampa',
    'AR.12': 'La Rioja', 'AR.13': 'Mendoza', 'AR.14': 'Misiones', 'AR.15': 'Neuquén',
    'AR.16': 'Río Negro', 'AR.17': 'Salta', 'AR.18': 'San Juan', 'AR.19': 'San Luis',
    'AR.20': 'Santa Cruz', 'AR.21': 'Santa Fe', 'AR.22': 'Santiago del Estero',
    'AR.23': 'Tierra del Fuego', 'AR.24': 'Tucumán',
    'ES.51': 'Andalucía', 'ES.52': 'Aragón', 'ES.34': 'Asturias', 'ES.07': 'Islas Baleares',
    'ES.53': 'Canarias', 'ES.39': 'Cantabria', 'ES.54': 'Castilla-La Mancha',
    'ES.55': 'Castilla y León', 'ES.56': 'Cataluña', 'ES.60': 'Comunidad Valenciana',
    'ES.57': 'Extremadura', 'ES.58': 'Galicia', 'ES.29': 'Madrid', 'ES.31': 'Murcia',
    'ES.32': 'Navarra', 'ES.59': 'País Vasco', 'ES.27': 'La Rioja',
    'ES.CE': 'Ceuta', 'ES.ML': 'Melilla'
};

// Localidades descartadas: historicas, abandonadas, destruidas.
const DESCARTAR = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

const admin1 = {};
for (const l of readFileSync(new URL('admin1CodesASCII.txt', RAW), 'utf8').split('\n')) {
    const [codigo, nombre] = l.split('\t');
    if (codigo) admin1[codigo] = nombre;
}

function* filas(archivo) {
    for (const l of readFileSync(new URL(archivo, RAW), 'utf8').split('\n')) {
        const c = l.split('\t');
        if (c.length < 19 || c[6] !== 'P' || DESCARTAR.has(c[7])) continue;
        yield {
            id: c[0], nombre: c[1], lat: +c[4], lon: +c[5], codigo: c[7],
            pais: c[8], admin1: c[10], poblacion: +c[14] || 0, zona: c[17]
        };
    }
}

const lugares = new Map(); // id GeoNames -> lugar (sin repetir entre archivos)
for (const archivo of [...COMPLETOS.map((p) => p + '.txt'), 'cities1000.txt']) {
    for (const f of filas(archivo)) {
        if (lugares.has(f.id)) continue;
        if (archivo === 'cities1000.txt' && COMPLETOS.includes(f.pais)) continue;
        let zona = f.zona;
        if (f.pais === 'AR') {
            if (!ZONA_AR[f.admin1]) continue; // Antartida, sin provincia
            zona = 'America/Argentina/' + ZONA_AR[f.admin1];
        }
        if (!zona) continue;
        const clave = `${f.pais}.${f.admin1}`;
        lugares.set(f.id, [
            f.nombre, PROVINCIA[clave] || admin1[clave] || '', f.pais,
            Math.round(f.lat * 1e4) / 1e4, Math.round(f.lon * 1e4) / 1e4,
            zona, f.poblacion
        ]);
    }
}

// Fragmentos: clave de 3 letras; si pesa mas de MAX_BYTES se parte con una
// letra mas, hasta 6. El fragmento partido conserva los MAX_ADELANTO mas
// poblados, para cuando la persona escribio solo esas letras.
const MAX_BYTES = 60000;
const MAX_ADELANTO = 150;
const fragmentos = {};
const partidos = [];

function agregar(clave, lista) {
    const json = JSON.stringify(lista);
    if (json.length <= MAX_BYTES || clave.length >= 6) {
        fragmentos[clave] = lista;
        return;
    }
    partidos.push(clave);
    fragmentos[clave] = lista.slice(0, MAX_ADELANTO);
    const hijos = {};
    for (const l of lista) {
        for (const p of normalizar(l[0]).split(' ')) {
            if (p.startsWith(clave) && p.length > clave.length) {
                const h = (hijos[p.slice(0, clave.length + 1)] ||= new Set());
                h.add(l);
            }
        }
    }
    for (const [k, set] of Object.entries(hijos)) agregar(k, [...set]);
}

const porClave = {};
for (const l of lugares.values()) {
    for (const k of clavesDe(l[0])) (porClave[k] ||= []).push(l);
}
for (const [k, lista] of Object.entries(porClave)) {
    lista.sort((a, b) => b[6] - a[6]);
    agregar(k, lista);
}

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
let bytes = 0;
let mayor = ['', 0];
for (const [k, lista] of Object.entries(fragmentos)) {
    lista.sort((a, b) => b[6] - a[6]);
    const json = JSON.stringify(lista);
    bytes += json.length;
    if (json.length > mayor[1]) mayor = [k, json.length];
    writeFileSync(new URL(k + '.json', DESTINO), json);
}
writeFileSync(new URL('partidos.json', DESTINO), JSON.stringify(partidos.sort()));
console.log(`${lugares.size} lugares, ${Object.keys(fragmentos).length} fragmentos ` +
    `(${partidos.length} partidos), ${(bytes / 1e6).toFixed(1)} MB; ` +
    `el mayor: ${mayor[0]} (${(mayor[1] / 1e3).toFixed(0)} KB)`);
