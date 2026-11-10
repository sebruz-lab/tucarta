// Genera time/zonas.json desde el fuente oficial de IANA (tzdata), con el
// huso base y el horario de verano de cada periodo. El navegador (Intl) da
// el offset total pero no distingue "UTC-3 de base" de "UTC-4 + 1 h de
// verano", que es lo que la app muestra y deja corregir.
//
// Uso: node time/build/zonas.mjs [version]
//   Espera el fuente descomprimido en time/build/raw/ (ver README de time/).

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { archivoDeZona } from '../archivo.js';
import { corregir, tramosCorregidos } from '../correcciones.js';

const RAW = new URL('./raw/', import.meta.url);
const ARCHIVOS = ['southamerica', 'europe', 'africa', 'northamerica', 'asia', 'australasia', 'antarctica',
    'etcetera', 'backward'];

// Se empaqueta el mundo entero: una zona por archivo en ui/public/husos/,
// que el navegador baja recien cuando la persona elige su lugar (1,5 KB
// promedio). Antes iban 23 zonas en un solo JSON y el resto se resolvia
// con Intl, que da el offset total pero no separa el huso base del
// horario de verano: por eso a medio mundo le salia el cartel de "no
// tenemos el detalle historico".
const ZONAS_PREFERIDAS = [
    'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba',
    'America/Argentina/Salta', 'America/Argentina/Jujuy',
    'America/Argentina/Tucuman', 'America/Argentina/Catamarca',
    'America/Argentina/La_Rioja', 'America/Argentina/San_Juan',
    'America/Argentina/Mendoza', 'America/Argentina/San_Luis',
    'America/Argentina/Rio_Gallegos', 'America/Argentina/Ushuaia',
    'America/Montevideo', 'Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary',
    'America/Santiago', 'America/Asuncion', 'America/Sao_Paulo',
    'America/La_Paz', 'America/Lima', 'America/Bogota', 'America/Mexico_City'
];

const DESDE = Date.UTC(1800, 0, 1) / 1000;
const HASTA_ANIO = 2037; // reglas "max" se expanden hasta aca

const MESES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DIAS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "-3:53:48" -> segundos
function segundos(s) {
    if (s === '-' || s === '0') return 0;
    const neg = s.startsWith('-');
    const [h, m = 0, x = 0] = s.replace(/^[-+]/, '').split(':').map(Number);
    return (neg ? -1 : 1) * (h * 3600 + m * 60 + x);
}

// "2:00s" -> { seg, tipo: 'w' | 's' | 'u' }
function hora(s = '0') {
    const m = s.match(/^([-\d:]+)([wsugz]?)$/);
    const tipo = { '': 'w', w: 'w', s: 's', u: 'u', g: 'u', z: 'u' }[m[2]];
    return { seg: segundos(m[1]), tipo };
}

const mes = (s) => MESES.indexOf(s.slice(0, 3).toLowerCase());

// Dia del mes segun "15", "lastSun", "Sun>=8", "Sun<=25". Puede caer en el
// mes siguiente o anterior: Date.UTC lo normaliza.
function dia(anio, m, on) {
    if (/^\d+$/.test(on)) return +on;
    const ds = (d) => new Date(Date.UTC(anio, m, d)).getUTCDay();
    let r;
    if ((r = on.match(/^last(\w{3})/))) {
        const objetivo = DIAS.indexOf(r[1].toLowerCase());
        let d = new Date(Date.UTC(anio, m + 1, 0)).getUTCDate();
        while (ds(d) !== objetivo) d--;
        return d;
    }
    r = on.match(/^(\w{3})([<>]=)(\d+)$/);
    const objetivo = DIAS.indexOf(r[1].toLowerCase());
    let d = +r[3];
    while (ds(d) !== objetivo) d += r[2] === '>=' ? 1 : -1;
    return d;
}

// Fecha local en segundos "como si fuera UTC" (se corrige despues).
const local = (anio, m, d, seg) => Date.UTC(anio, m, d) / 1000 + seg;

function parsear() {
    const reglas = {};
    const zonas = {};
    const links = {};
    let actual = null;
    for (const archivo of ARCHIVOS) {
        for (let linea of readFileSync(new URL(archivo, RAW), 'utf8').split('\n')) {
            linea = linea.replace(/#.*/, '');
            if (!linea.trim()) continue;
            const c = linea.trim().split(/\s+/);
            if (c[0] === 'Rule') {
                actual = null;
                const [, nombre, from, to, , in_, on, at, save] = c;
                const desde = +from;
                const hasta = to === 'only' ? desde : to === 'max' ? HASTA_ANIO : +to;
                (reglas[nombre] ||= []).push({ desde, hasta, mes: mes(in_), on, at: hora(at), save: segundos(save) });
            } else if (c[0] === 'Link') {
                actual = null;
                links[c[2]] = c[1];
            } else if (c[0] === 'Zone') {
                actual = zonas[c[1]] = [];
                actual.push(lineaZona(c.slice(2)));
            } else if (actual && /^\s/.test(linea)) {
                actual.push(lineaZona(c));
            }
        }
    }
    return { reglas, zonas, links };
}

function lineaZona([stdoff, rules, , ...until]) {
    let hasta = null;
    if (until.length) {
        const [anio, m = 'Jan', on = '1', at = '0'] = until;
        hasta = { anio: +anio, mes: mes(m), on, at: hora(at) };
    }
    const fijo = /^-?\d/.test(rules);
    return { stdoff: segundos(stdoff), reglas: rules === '-' || fijo ? null : rules, save: fijo ? segundos(rules) : 0, hasta };
}

// Instante UTC de una hora local, segun como este expresada.
function aUtc(seg, tipo, stdoff, save) {
    if (tipo === 'u') return seg;
    if (tipo === 's') return seg - stdoff;
    return seg - stdoff - save;
}

// Lista de periodos [desde (s UTC), utoff (s), save (s)] de una zona.
function periodos(lineas, reglas) {
    const out = [];
    let inicio = DESDE;
    for (const z of lineas) {
        let cambios = [];
        const utoffAnterior = out.length ? out[out.length - 1][1] : z.stdoff;
        if (z.reglas) {
            const anioIni = new Date(inicio * 1000).getUTCFullYear() - 1;
            const anioFin = z.hasta ? z.hasta.anio : HASTA_ANIO;
            const candidatos = [];
            for (const r of reglas[z.reglas]) {
                for (let a = Math.max(r.desde, anioIni); a <= Math.min(r.hasta, anioFin); a++) {
                    candidatos.push({ loc: local(a, r.mes, dia(a, r.mes, r.on), r.at.seg), tipo: r.at.tipo, save: r.save });
                }
            }
            candidatos.sort((x, y) => x.loc - y.loc);
            let prev = 0;
            for (const c of candidatos) {
                // vigente: la regla ya regia al empezar la linea. Se mide con
                // la hora que corria justo antes (como zic): una regla que
                // cae en el mismo instante local que el cambio de linea vale.
                const enInicio = c.tipo === 'w' ? c.loc - utoffAnterior : aUtc(c.loc, c.tipo, z.stdoff, 0);
                cambios.push({ utc: aUtc(c.loc, c.tipo, z.stdoff, prev), save: c.save, vigente: enInicio <= inicio });
                prev = c.save;
            }
        }

        // Save vigente al empezar esta linea: el de la ultima regla anterior.
        let save = z.save;
        if (z.reglas) {
            save = 0;
            for (const c of cambios) if (c.vigente) save = c.save;
            cambios = cambios.filter((c) => !c.vigente);
        }

        // Fin de la linea (UNTIL), en la hora vigente justo antes del cambio.
        let fin = Infinity;
        if (z.hasta) {
            const h = z.hasta;
            const loc = local(h.anio, h.mes, dia(h.anio, h.mes, h.on), h.at.seg);
            let s = save;
            for (const c of cambios) if (c.utc < aUtc(loc, h.at.tipo, z.stdoff, s)) s = c.save;
            fin = aUtc(loc, h.at.tipo, z.stdoff, s);
        }

        out.push([inicio, z.stdoff + save, save]);
        for (const c of cambios) {
            if (c.utc > inicio && c.utc < fin) out.push([c.utc, z.stdoff + c.save, c.save]);
        }
        inicio = fin;
    }

    // Une periodos consecutivos iguales.
    return out.filter((p, i) => i === 0 || p[1] !== out[i - 1][1] || p[2] !== out[i - 1][2]);
}


const { reglas, zonas, links } = parsear();
const version = readFileSync(new URL('version', RAW), 'utf8').trim();

// Todas las zonas de tzdata, mas los alias (links) que apuntan a ellas:
// el buscador de lugares devuelve cualquiera de los dos nombres.
const todas = [...new Set([...ZONAS_PREFERIDAS, ...Object.keys(zonas), ...Object.keys(links)])].sort();

const salida = new URL('../../ui/public/husos/', import.meta.url);
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

// Solo se publica lo que se puede probar. Cada zona se compara con Intl
// (el ICU de Node trae la misma tzdata) cada 6 horas desde 1900 y alrededor
// de cada cambio de hora. La que no coincide no se publica: esa zona sigue
// resolviendose con Intl en el navegador, que es lo que hacia hasta ahora,
// asi nunca mostramos una hora que no podemos sostener.
const DESDE_CONTROL = Date.UTC(1900, 0, 1) / 1000;
const HASTA_CONTROL = Date.UTC(2030, 0, 1) / 1000;
const fmtIntl = {};
function offsetIntl(zona, seg) {
    fmtIntl[zona] ||= new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'longOffset' });
    const t = fmtIntl[zona].formatToParts(new Date(seg * 1000)).find((x) => x.type === 'timeZoneName').value;
    const m = t.match(/GMT([+-])(\d\d):(\d\d)(?::(\d\d))?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (+m[2] * 3600 + +m[3] * 60 + +(m[4] || 0));
}
function coincideConIntl(zona, periodos, real) {
    const offset = (seg) => {
        let r = periodos[0];
        for (const p of periodos) if (p[0] <= seg) r = p; else break;
        return r[1];
    };
    // Donde corregimos a mano la base IANA (ver time/correcciones.js) no
    // hay nada que comparar: Intl usa tzdata tal cual. El control sigue
    // valiendo para todo el resto de la historia de la zona.
    const tramos = tramosCorregidos(zona, real);
    const corregido = (seg) => tramos.some(([a, b]) => seg >= a && seg < b);
    for (let seg = DESDE_CONTROL; seg < HASTA_CONTROL; seg += 6 * 3600) {
        if (corregido(seg)) continue;
        if (offsetIntl(zona, seg) !== offset(seg)) return false;
    }
    for (const [cambio] of periodos) {
        if (cambio < DESDE_CONTROL || cambio > HASTA_CONTROL) continue;
        for (const seg of [cambio - 1, cambio, cambio + 1]) {
            if (corregido(seg)) continue;
            if (offsetIntl(zona, seg) !== offset(seg)) return false;
        }
    }
    return true;
}

let bytes = 0;
const nombres = [];
const descartadas = [];
const usados = new Map();
for (const nombre of todas) {
    const real = zonas[nombre] ? nombre : links[nombre];
    if (!zonas[real]) continue; // alias colgado
    const archivo = archivoDeZona(nombre);
    if (usados.has(archivo)) throw new Error(`Dos zonas con el mismo archivo: ${usados.get(archivo)} y ${nombre} -> ${archivo}`);
    usados.set(archivo, nombre);
    const ps = corregir(nombre, periodos(zonas[real], reglas), real);
    if (!coincideConIntl(nombre, ps, real)) { descartadas.push(nombre); continue; }
    const json = JSON.stringify(ps);
    writeFileSync(new URL(archivo, salida), json);
    bytes += json.length;
    nombres.push(nombre);
}

// El indice: la version de tzdata y que zonas tienen detalle. Es lo unico
// que viaja en la precarga.
const indice = { version, zonas: nombres };
writeFileSync(new URL('../zonas.json', import.meta.url), JSON.stringify(indice));
console.log(`tzdata ${version}: ${nombres.length} zonas, ${(bytes / 1024).toFixed(0)} KB en total`);
console.log(`indice: ${(JSON.stringify(indice).length / 1024).toFixed(1)} KB`);
if (descartadas.length) {
    console.log(`descartadas por no coincidir con Intl (siguen con Intl en el navegador): ${descartadas.length}`);
    console.log('  ' + descartadas.join(', '));
}
