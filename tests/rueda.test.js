import { describe, it, expect } from 'vitest';
import { ubicarEnCasas, repartir, dibujarRueda } from '../ui/wheel.js';
import { casaDe } from '../engine/chart.js';

const cusps = [62, 93, 128, 163, 195, 220, 242, 273, 308, 343, 15, 40];
const conCasa = (lons) => lons.map((lon) => ({ lon, casa: casaDe(lon, cusps) }));

describe('ubicarEnCasas', () => {
    it('ningún glifo sale de su casa', () => {
        const puntos = conCasa([341.3, 335.2, 339, 329.4, 314.1, 342.9, 344, 250, 252, 255]);
        ubicarEnCasas(puntos, cusps).forEach((u, i) => {
            expect(casaDe(u.lon, cusps)).toBe(puntos[i].casa);
        });
    });

    it('mantiene el orden y la separación dentro de la casa', () => {
        const puntos = conCasa([310, 311, 312]);
        const u = ubicarEnCasas(puntos, cusps).map((x) => x.lon);
        expect(u[1] - u[0]).toBeGreaterThanOrEqual(9.99);
        expect(u[2] - u[1]).toBeGreaterThanOrEqual(9.99);
    });

    it('si no entran ni apretados, desbordan lo mínimo y mantienen 6° entre sí', () => {
        // Casa 11 (15° a 40°): seis planetas entre 20° y 24°.
        const puntos = conCasa([20, 21, 22, 23, 24, 24.5]);
        const u = ubicarEnCasas(puntos, cusps).map((x) => x.lon);
        for (let k = 1; k < u.length; k++) expect(u[k] - u[k - 1]).toBeGreaterThanOrEqual(5.99);
        expect(u[0]).toBeGreaterThan(15 - 5);
    });

    it('un planeta solo no se mueve si no está pegado a la cúspide', () => {
        const u = ubicarEnCasas(conCasa([290]), cusps);
        expect(u[0].lon).toBeCloseTo(290);
    });
});

describe('repartir (anillo de tránsitos)', () => {
    const sep = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

    it('no mueve lo que ya está separado', () => {
        expect(repartir([10, 100, 200], 6)).toEqual([10, 100, 200]);
    });

    it('separa un grupo apretado alrededor de su centro, también cruzando 0°', () => {
        for (const lons of [[50, 51, 52, 200], [358, 359, 1, 2, 120]]) {
            const pos = repartir(lons, 6);
            for (let i = 0; i < pos.length; i++) {
                for (let j = i + 1; j < pos.length; j++) expect(sep(pos[i], pos[j])).toBeGreaterThanOrEqual(6 - 1e-9);
            }
        }
        const p = repartir([50, 51, 52, 200], 6);
        expect((p[0] + p[1] + p[2]) / 3).toBeCloseTo(51, 6);
    });
});

// Una carta de mentira, lo mínimo que dibujarRueda necesita: así el
// dibujo se puede mirar sin arrancar las efemérides.
const SIGNO_DE = (lon) => ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo',
    'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'][Math.floor((lon % 360) / 30)];
const pos = (lon) => ({ lon, signo: SIGNO_DE(lon), grado: Math.floor(lon % 30), minuto: 30 });
const CARTA = {
    puntos: [
        { id: 'sol', ...pos(15), casa: 1, vel: 1, retro: false },
        { id: 'mercurio', ...pos(100), casa: 2, vel: -1, retro: true }
    ],
    angulos: [{ id: 'asc', ...pos(0) }, { id: 'mc', ...pos(270) }],
    cusps: Array.from({ length: 12 }, (_, i) => ({ casa: i + 1, ...pos(i * 30) })),
    aspectos: []
};

describe('la R de retrógrado', () => {
    const svg = dibujarRueda(CARTA, {});

    it('solo la lleva el que está retrógrado, y es el dibujo y no una letra', () => {
        expect(svg.match(/class="glifo retro"/g)).toHaveLength(1);
        expect(svg).not.toContain('<tspan class="retro"');
    });

    it('va después de los minutos, una fila más adentro, esté donde esté el planeta', () => {
        // El error que tenía: la R se corría en x, así que a la derecha de
        // la rueda caía para afuera de los minutos en vez de para adentro.
        const aLosDosLados = { ...CARTA, puntos: [
            { id: 'marte', ...pos(95), casa: 4, vel: -1, retro: true },
            { id: 'venus', ...pos(275), casa: 10, vel: -1, retro: true }
        ] };
        const dibujo = dibujarRueda(aLosDosLados, {});
        const radio = (x, y) => Math.hypot(Number(x), Number(y));
        const minutos = [...dibujo.matchAll(/<text class="grado-punto minuto"[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)]
            .map((m) => radio(m[1], m[2]));
        // El glifo se ubica por la esquina de su caja: el centro es la
        // esquina más medio tamaño.
        const erres = [...dibujo.matchAll(/<g class="glifo retro"\s*transform="translate\((-?[\d.]+) (-?[\d.]+)\)/g)]
            .map((m) => radio(Number(m[1]) + 9.3 / 2, Number(m[2]) + 9.3 / 2));
        expect(minutos).toHaveLength(2);
        expect(erres).toHaveLength(2);
        for (const r of erres) {
            expect(r).toBeLessThan(Math.min(...minutos));   // más adentro que los minutos
            expect(r).toBeGreaterThan(150);                 // pero no dentro del círculo de aspectos
        }
    });
});

describe('el color de los aspectos', () => {
    // Dos trigonos del mismo color: uno casi exacto y otro bien abierto.
    const conAspectos = {
        ...CARTA,
        puntos: [
            { id: 'sol', ...pos(15), casa: 1, vel: 1, retro: false },
            { id: 'luna', ...pos(135.2), casa: 5, vel: 13, retro: false },
            { id: 'marte', ...pos(250), casa: 9, vel: 0.5, retro: false }
        ],
        aspectos: [
            { a: 'sol', b: 'luna', aspecto: 'trigono', menor: false, orbe: 0.2, orbeMax: 9 },
            { a: 'sol', b: 'marte', aspecto: 'trigono', menor: false, orbe: 5, orbeMax: 9 }
        ]
    };
    const lineas = (svg) => svg.match(/<line class="asp-[^>]*>/g) || [];

    it('un solo tono: ninguna linea se degrada por el orbe', () => {
        const l = lineas(dibujarRueda(conAspectos, {}));
        expect(l.length).toBeGreaterThan(0);
        expect(l.filter((x) => x.includes('opacity'))).toEqual([]);
    });

    it('al elegir un punto, lo que no le toca se atenua', () => {
        const l = lineas(dibujarRueda(conAspectos, { seleccion: 'marte' }));
        const atenuadas = l.filter((x) => x.includes('opacity="0.08"'));
        expect(atenuadas.length).toBeGreaterThan(0);
        expect(atenuadas.length).toBeLessThan(l.length);
    });
});

describe('los palitos de cada planeta', () => {
    const svg = dibujarRueda(CARTA, {});
    const marcas = [...svg.matchAll(
        /<line class="marca-punto"([^>]*)x1="(-?[\d.]+)" y1="(-?[\d.]+)" x2="(-?[\d.]+)" y2="(-?[\d.]+)"/g)];

    it('hay uno por planeta y ninguno en el anillo de las casas', () => {
        expect(marcas).toHaveLength(CARTA.puntos.length);
    });

    it('van hacia adentro del círculo de adentro', () => {
        for (const m of marcas) {
            const desde = Math.hypot(Number(m[2]), Number(m[3]));
            const hasta = Math.hypot(Number(m[4]), Number(m[5]));
            expect(desde).toBeCloseTo(156, 0);   // el círculo de aspectos
            expect(hasta).toBeLessThan(desde);   // y el palito entra
        }
    });

    it('cada uno dice de qué planeta es, que es de donde saca el color', () => {
        expect(marcas.map((m) => m[1].trim())).toEqual(CARTA.puntos.map((p) => `data-punto="${p.id}"`));
    });
});

describe('los anillos de la rueda', () => {
    const svg = dibujarRueda(CARTA, {});
    const radio = (m) => Math.hypot(Number(m[1]), Number(m[2]));
    const circulos = [...svg.matchAll(/<circle class="(?:borde|fino)" r="([\d.]+)"/g)].map((m) => Number(m[1]));

    it('de afuera hacia adentro: signos, casas, planetas y el centro', () => {
        // El anillo de signos mide 32 (el 80% de los 40 de antes) y el de
        // casas 18 (el 80% de 22), pegado al zodíaco.
        expect(circulos).toEqual([294, 262, 244, 156]);
    });

    it('los números de casa y los grados de las cúspides comparten el anillo de casas', () => {
        const cusp = [...svg.matchAll(/<text class="rotulo-cuspide"[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map(radio);
        const num = [...svg.matchAll(/<text class="num-casa"[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map(radio);
        expect(cusp).toHaveLength(24); // dos por cúspide: el grado y el minuto
        expect(num).toHaveLength(12);
        for (const r of [...cusp, ...num]) {
            expect(r).toBeGreaterThan(244); // dentro del anillo de casas
            expect(r).toBeLessThan(262);
        }
    });

    it('las casas se numeran del 1 al 12', () => {
        const num = [...svg.matchAll(/<text class="num-casa"[^>]*>([^<]+)</g)].map((m) => m[1]);
        expect(num).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    });

    it('en las superposiciones las casas también van pegadas al zodíaco', () => {
        // Tránsitos y revolución: cada rueda tiene su anillo de casas
        // justo debajo de su zodíaco, con los números y los grados de las
        // cúspides adentro.
        const vistas = {
            transitos: { transitos: { puntos: [{ id: 'sol', ...pos(100) }], aspectos: [] } },
            revolucion: { revolucion: CARTA }
        };
        for (const [nombre, opciones] of Object.entries(vistas)) {
            const dibujo = dibujarRueda(CARTA, opciones);
            const radios = (re) => [...dibujo.matchAll(re)].map((m) => Math.hypot(Number(m[1]), Number(m[2])));
            const textos = [
                ...radios(/<text class="num-casa"[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g),
                ...radios(/<text class="rotulo-cuspide"[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"/g)
            ];
            const circulos = [...dibujo.matchAll(/<circle class="(?:borde|fino)" r="([\d.]+)"/g)]
                .map((m) => Number(m[1])).sort((x, y) => x - y);
            // Cada número cae entre dos círculos consecutivos que están a
            // menos de 35 de distancia: el anillo de casas, el más angosto.
            for (const r of textos) {
                const abajo = Math.max(...circulos.filter((c) => c < r));
                const arriba = Math.min(...circulos.filter((c) => c > r));
                expect(arriba - abajo, `${nombre}: ${r}`).toBeLessThan(35);
            }
        }
    });

    it('ninguna cúspide vuelve para atrás, ni con los planetas apretados', () => {
        // Diez planetas encimados obligan a las cúspides a quebrarse para
        // pasar entre las columnas: ahí es donde los radios se podrían
        // cruzar.
        const ids = ['sol', 'luna', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'];
        const apretada = { ...CARTA,
            puntos: ids.map((id, i) => ({ id, ...pos(26 + i * 1.2), casa: 26 + i * 1.2 < 30 ? 1 : 2, vel: 1, retro: false })) };
        for (const opciones of [{}, { transitos: { puntos: [{ id: 'sol', ...pos(100) }], aspectos: [] } },
            { revolucion: apretada }]) {
            const polis = [...dibujarRueda(apretada, opciones)
                .matchAll(/<polyline class="(?:cuspide|eje[^"]*)" fill="none" points="([^"]+)"/g)];
            // La revolución dibuja las dos ruedas: la de afuera y la natal.
            expect(polis.length).toBe(opciones.revolucion ? 24 : 12);
            let quebradas = 0;
            for (const m of polis) {
                const rs = m[1].split(' ').map((q) => { const [x, y] = q.split(',').map(Number); return Math.hypot(x, y); });
                if (rs.length > 2) quebradas++;
                for (let i = 1; i < rs.length; i++) expect(rs[i]).toBeGreaterThanOrEqual(rs[i - 1] - 0.01);
            }
            expect(quebradas).toBeGreaterThan(0);
        }
    });
});
