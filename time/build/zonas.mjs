// Genera time/zonas.json desde el fuente oficial de IANA (tzdata), con el
// huso base y el horario de verano de cada periodo. El navegador (Intl) da
// el offset total pero no distingue "UTC-3 de base" de "UTC-4 + 1 h de
// verano", que es lo que la app muestra y deja corregir.
//
// Uso: node time/build/zonas.mjs [version]
//   Espera el fuente descomprimido en time/build/raw/ (ver README de time/).

import { readFileSync, writeFileSync } from 'node:fs';

const RAW = new URL('./raw/', import.meta.url);
const ARCHIVOS = ['southamerica', 'europe', 'africa', 'northamerica'];

// Zonas que se empaquetan: el publico de la v1 (Argentina, Uruguay,
// España) y vecinos. Las demas usan Intl, sin separar base y verano.
const ZONAS = [
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
const res = { version, zonas: {} };
for (const nombre of ZONAS) {
    const real = zonas[nombre] ? nombre : links[nombre];
    if (!zonas[real]) throw new Error('Zona no encontrada: ' + nombre);
    res.zonas[nombre] = periodos(zonas[real], reglas);
}
const destino = new URL('../zonas.json', import.meta.url);
writeFileSync(destino, JSON.stringify(res));
console.log(`tzdata ${version}: ${ZONAS.length} zonas, ${JSON.stringify(res).length} bytes`);
