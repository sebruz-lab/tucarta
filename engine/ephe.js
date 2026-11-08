// Carga del modulo WASM de Swiss Ephemeris. No toca el DOM: quien lo
// llama pasa una funcion que devuelve los bytes de seas_18.se1 (fetch en
// el navegador, fs en Node), asi el mismo motor corre en los tests.

import crearSwe from './swisseph/build/swe.js';

const RUTA_EPHE = '/ephe';
let promesa = null;

export function cargarSwe(leerArchivoQuiron) {
    if (!promesa) promesa = iniciar(leerArchivoQuiron);
    return promesa;
}

async function iniciar(leerArchivoQuiron) {
    const [M, bytesQuiron] = await Promise.all([crearSwe(), leerArchivoQuiron()]);
    M.FS.mkdir(RUTA_EPHE);
    M.FS.writeFile(RUTA_EPHE + '/seas_18.se1', new Uint8Array(bytesQuiron));
    const montados = new Set(['seas_18.se1']);
    M.ccall('tc_set_ephe_path', null, ['string'], [RUTA_EPHE]);

    const buffer = M.ccall('tc_buffer', 'number', [], []) / 8;
    const leer = (n) => Array.from(M.HEAPF64.subarray(buffer, buffer + n));
    const calc = M.cwrap('tc_calc', 'number', ['number', 'number', 'number']);
    const houses = M.cwrap('tc_houses', 'number', ['number', 'number', 'number', 'number']);
    const error = () => M.ccall('tc_error', 'string', [], []);

    return {
        // Sedna y Eris tienen su propio archivo y se bajan recien cuando
        // alguien las prende: se montan aca, al lado del de Quiron.
        montar(nombre, bytes) {
            if (montados.has(nombre)) return;
            M.FS.writeFile(RUTA_EPHE + '/' + nombre, new Uint8Array(bytes));
            montados.add(nombre);
        },
        tiene: (nombre) => montados.has(nombre),

        julday: M.cwrap('tc_julday', 'number', ['number', 'number', 'number', 'number']),

        // -> { lon, lat, dist, velLon, velLat, velDist }
        calc(jdUT, ipl, flags) {
            const r = calc(jdUT, ipl, flags);
            if (r < 0) throw new Error('Swiss Ephemeris: ' + error());
            const [lon, lat, dist, velLon, velLat, velDist] = leer(6);
            return { lon, lat, dist, velLon, velLat, velDist, flags: r };
        },

        // -> { cusps[12], asc, mc, armc, vertex }
        houses(jdUT, lat, lon, sistema) {
            const r = houses(jdUT, lat, lon, sistema.charCodeAt(0));
            if (r < 0) throw new Error('Swiss Ephemeris (casas): ' + error());
            const v = leer(16);
            return { cusps: v.slice(0, 12), asc: v[12], mc: v[13], armc: v[14], vertex: v[15] };
        }
    };
}
