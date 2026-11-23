// El calendario del cielo contra la captura de Solar Fire que mandó Seba el
// 23/11/2026: diciembre de 2026 en Argentina.
//
// Dos cosas que hay que saber para leer este archivo:
//
// 1. **La captura está en UTC−3**, aunque el encabezado diga "BZT2 +3:00".
//    Se despejó comparando las cuatro fases de la Luna, que coinciden al
//    minuto con el huso negativo y quedan seis horas afuera con el positivo.
// 2. **Solar Fire va unos 18 segundos antes** que nosotros, porque usa
//    ΔT = 87 s para 2026 y el medido es ~69 s. Es la misma diferencia que ya
//    estaba medida en la revolución solar. Por eso la tolerancia es de un
//    minuto y no de cero: un evento a las 01:34:5x es 01:34 para Solar Fire
//    y 01:35 para nosotros, y los dos están bien.
//
// Los planetas salen de Moshier, no de los archivos de Swiss Ephemeris. En
// un par lento (Júpiter con Quirón se acercan a 0,1° por día) medio segundo
// de arco son dos minutos de reloj, así que acá no se fija ninguna hora de
// un aspecto entre planetas lentos. Lo que sí se fija son los ingresos, las
// estaciones de los planetas y las fases, que es lo que se lee de un
// calendario.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { eventosDelCielo, PUNTOS_CIELO } from '../engine/eventos.js';
import { fasesEntre, lunacionesEntre } from '../engine/lunaciones.js';

let swe;
beforeAll(async () => {
    swe = await cargarSwe(() => readFileSync(new URL('../ui/public/ephe/seas_18.se1', import.meta.url)));
}, 60000);

const HUSO = 3 / 24;                       // UTC-3
const jdUtc = (y, m, d) => swe.julday(y, m, d, 0);
const desde = () => jdUtc(2026, 12, 1) + HUSO;
const hasta = () => jdUtc(2027, 1, 1) + HUSO;

// "DD HH:MM" en UTC-3, truncado al minuto como Solar Fire.
function enArgentina(jd) {
    const d = new Date((jd - 2440587.5) * 864e5 - 3 * 3600e3);
    const dos = (n) => String(n).padStart(2, '0');
    return `${dos(d.getUTCDate())} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}

// Cuanto puede separarse lo nuestro de lo que imprime Solar Fire: los ~18
// segundos de la diferencia de ΔT, mas el minuto entero que se pierde al
// truncar (Solar Fire escribe 01:34 para cualquier instante entre 01:34:00
// y 01:34:59, y el nuestro cae unos segundos mas tarde). Un minuto y medio
// sigue siendo exacto para lo que un calendario tiene que decir.
const TOLERANCIA = 1.5;

// Minutos entre lo nuestro y lo que imprime Solar Fire.
function minutosDeDiferencia(jd, esperado) {
    const [dia, hora] = esperado.split(' ');
    const [h, mi] = hora.split(':').map(Number);
    const objetivo = jdUtc(2026, 12, Number(dia)) + HUSO + (h * 60 + mi) / 1440;
    return Math.abs(jd - objetivo) * 1440;
}

let todo;
beforeAll(() => {
    todo = eventosDelCielo(swe, { desde: desde(), hasta: hasta(), puntos: PUNTOS_CIELO });
});

const soloTipo = (t) => todo.filter((e) => e.tipo === t);

describe('eventosDelCielo: diciembre de 2026 contra Solar Fire', () => {
    it('las cuatro fases de la Luna, con su grado', () => {
        const esperadas = [
            ['01 03:08', 'menguante', 'virgo', 9, 3],
            ['08 21:51', 'nueva', 'sagitario', 16, 56],
            ['17 02:42', 'creciente', 'piscis', 25, 17],
            ['23 22:27', 'llena', 'cancer', 2, 13],
            ['30 15:59', 'menguante', 'libra', 9, 5]
        ];
        const fases = soloTipo('fase');
        expect(fases).toHaveLength(esperadas.length);
        fases.forEach((f, i) => {
            const [cuando, cual, signo, grado, minuto] = esperadas[i];
            expect([f.fase, f.signo, f.grado, f.minuto]).toEqual([cual, signo, grado, minuto]);
            expect(minutosDeDiferencia(f.jd, cuando)).toBeLessThanOrEqual(TOLERANCIA);
        });
    });

    it('los ingresos de la Luna, los trece', () => {
        const esperados = [
            ['02 17:03', 'libra'], ['05 01:34', 'escorpio'], ['07 12:06', 'sagitario'],
            ['10 00:08', 'capricornio'], ['12 13:05', 'acuario'], ['15 01:35', 'piscis'],
            ['17 11:34', 'aries'], ['19 17:29', 'tauro'], ['21 19:26', 'geminis'],
            ['23 18:58', 'cancer'], ['25 18:11', 'leo'], ['27 19:12', 'virgo'],
            ['29 23:26', 'libra']
        ];
        const ing = soloTipo('ingreso').filter((e) => e.punto === 'luna');
        expect(ing.map((e) => e.signo)).toEqual(esperados.map(([, s]) => s));
        ing.forEach((e, i) => {
            expect(minutosDeDiferencia(e.jd, esperados[i][0])).toBeLessThanOrEqual(TOLERANCIA);
            expect(e.retro).toBe(false);   // la Luna nunca retrograda
        });
    });

    it('las estaciones de los planetas, con su sentido', () => {
        const esperadas = [
            ['10 20:30', 'saturno', 'SD'],
            ['12 19:17', 'neptuno', 'SD'],
            ['12 21:56', 'jupiter', 'SR']
        ];
        // El Nodo verdadero queda afuera a propósito: ver el test de abajo.
        const est = soloTipo('estacion').filter((e) => e.punto !== 'nodo');
        expect(est.map((e) => [e.punto, e.sentido])).toEqual(esperadas.map(([, p, s]) => [p, s]));
        est.forEach((e, i) => expect(minutosDeDiferencia(e.jd, esperadas[i][0])).toBeLessThanOrEqual(TOLERANCIA));
    });

    it('el Nodo verdadero estaciona los mismos días, con la hora floja', () => {
        // Su velocidad es una libración casi plana alrededor del cero, así
        // que el error de ~47" que Moshier tiene en el Nodo (está anotado en
        // CLAUDE.md) se traduce en horas de reloj. El día sale bien; la hora
        // puede irse un par de horas, y eso no se arregla sin sumar
        // semo_18.se1, que son 1,3 MB que Seba decidió no cargar.
        const dias = soloTipo('estacion').filter((e) => e.punto === 'nodo')
            .map((e) => enArgentina(e.jd).slice(0, 2));
        expect(dias).toEqual(['01', '14', '17', '27', '30']);
    });

    it('los ingresos de los planetas', () => {
        const ing = soloTipo('ingreso').filter((e) => e.punto !== 'luna');
        expect(ing.map((e) => [e.punto, e.signo])).toEqual([
            ['venus', 'escorpio'], ['mercurio', 'sagitario'],
            ['sol', 'capricornio'], ['mercurio', 'capricornio']
        ]);
        // El solsticio: el Sol entra en Capricornio el 21.
        expect(enArgentina(ing[2].jd).slice(0, 2)).toBe('21');
    });
});

describe('eventosDelCielo: carriles', () => {
    it('cada carril trae lo suyo y nada más', () => {
        const natal = calcularCarta(swe, {
            utc: { anio: 1977, mes: 6, dia: 12, hora: 14, minuto: 30, segundo: 0 },
            lat: -31.42, lon: -64.18
        });
        const opciones = { desde: desde(), hasta: hasta(), natal };
        const tipos = (carriles) => new Set(eventosDelCielo(swe, { ...opciones, carriles }).map((e) => e.tipo));
        expect(tipos({ entrePlanetas: true, aLaCarta: false, cielo: false })).toEqual(new Set(['aspecto-tr']));
        expect(tipos({ entrePlanetas: false, aLaCarta: true, cielo: false })).toEqual(new Set(['aspecto-na']));
        expect(tipos({ entrePlanetas: false, aLaCarta: false, cielo: true }))
            .toEqual(new Set(['ingreso', 'estacion', 'fase']));
    });

    it('sin carta no hay carril a la carta, y no se rompe', () => {
        const ev = eventosDelCielo(swe, { desde: desde(), hasta: hasta() });
        expect(ev.some((e) => e.tipo === 'aspecto-na')).toBe(false);
        expect(ev.some((e) => e.tipo === 'aspecto-tr')).toBe(true);
    });

    it('sacar la Luna saca sus eventos y deja los demás', () => {
        const sinLuna = eventosDelCielo(swe, {
            desde: desde(), hasta: hasta(), puntos: PUNTOS_CIELO.filter((id) => id !== 'luna')
        });
        expect(sinLuna.some((e) => e.punto === 'luna' || e.a === 'luna' || e.b === 'luna')).toBe(false);
        // Las fases no dependen de qué puntos transitan: son de la Luna
        // siempre, y son las que marcan el mes.
        expect(sinLuna.filter((e) => e.tipo === 'fase')).toHaveLength(5);
    });

    it('todo sale ordenado por fecha y con su utc', () => {
        for (let i = 1; i < todo.length; i++) expect(todo[i].jd).toBeGreaterThanOrEqual(todo[i - 1].jd);
        expect(todo.every((e) => e.utc && e.utc.anio === 2026)).toBe(true);
    });

    it('nada se escapa del periodo pedido', () => {
        expect(todo.every((e) => e.jd >= desde() && e.jd <= hasta())).toBe(true);
    });
});

describe('fasesEntre', () => {
    it('da para la nueva y la llena exactamente lo que ya daba lunacionesEntre', () => {
        // El control más barato de que el buscador nuevo no se corrió:
        // lunacionesEntre está validada desde la v1.17 y no se tocó.
        const periodo = { desde: desde(), hasta: hasta() };
        const viejas = lunacionesEntre(swe, periodo).map((l) => l.jd);
        const nuevas = fasesEntre(swe, periodo)
            .filter((f) => f.fase === 'nueva' || f.fase === 'llena').map((f) => f.jd);
        expect(nuevas).toHaveLength(viejas.length);
        nuevas.forEach((jd, i) => expect(jd).toBeCloseTo(viejas[i], 8));
    });

    it('las cuatro fases salen en orden y se repiten cada mes sinódico', () => {
        const fases = fasesEntre(swe, { desde: desde(), hasta: desde() + 90 });
        const orden = ['nueva', 'creciente', 'llena', 'menguante'];
        for (let i = 1; i < fases.length; i++) {
            const anterior = orden.indexOf(fases[i - 1].fase);
            expect(fases[i].fase).toBe(orden[(anterior + 1) % 4]);
            // Un cuarto de mes sinódico, con el margen de la órbita real.
            expect(fases[i].jd - fases[i - 1].jd).toBeGreaterThan(5.9);
            expect(fases[i].jd - fases[i - 1].jd).toBeLessThan(9.2);
        }
    });
});
