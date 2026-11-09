import { describe, it, expect } from 'vitest';
import { dibujarRueda } from '../ui/wheel.js';
import { calcularAspectos } from '../engine/aspects.js';
import { ORBES_SINASTRIA, ORBES_TRANSITO } from '../engine/config.js';
import { enSigno, casaDe } from '../engine/chart.js';

// Dos cartas de juguete, con la forma que devuelve calcularCarta: alcanza
// para la rueda y para los aspectos, que no tocan las efemerides.
const cartaDe = (lonsPorId, asc) => {
    const cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
    const puntos = Object.entries(lonsPorId).map(([id, lon]) => ({
        id, lon, vel: 1, retro: false, casa: casaDe(lon, cusps), ...enSigno(lon)
    }));
    return {
        meta: {},
        puntos,
        angulos: [{ id: 'asc', lon: asc, ...enSigno(asc) }, { id: 'mc', lon: (asc + 270) % 360, ...enSigno((asc + 270) % 360) }],
        cusps: cusps.map((lon, i) => ({ casa: i + 1, lon, ...enSigno(lon) })),
        aspectos: []
    };
};

const A = cartaDe({ sol: 10, luna: 100, venus: 200 }, 0);
const B = cartaDe({ sol: 190, luna: 101, venus: 44 }, 60);
const pts = (c) => [...c.puntos, ...c.angulos];

describe('aspectos de sinastría', () => {
    const aspectos = calcularAspectos(pts(B), pts(A), { orbesPorAspecto: ORBES_SINASTRIA });

    it('cruza las dos cartas: el punto a es el de afuera y el b el de adentro', () => {
        const o = aspectos.find((x) => x.a === 'sol' && x.b === 'sol');
        expect(o.aspecto).toBe('oposicion');
        expect(o.orbe).toBeCloseTo(0, 6);
        const c = aspectos.find((x) => x.a === 'luna' && x.b === 'luna');
        expect(c.aspecto).toBe('conjuncion');
    });

    it('con los orbes de sinastría entra lo que con los de tránsito no', () => {
        // Venus de afuera a 44° y Sol de adentro a 10°: 34° de la
        // cuadratura menos 4... el sextil cae a 16° de distancia.
        const conSinastria = calcularAspectos(pts(B), pts(A), { orbesPorAspecto: ORBES_SINASTRIA });
        const conTransito = calcularAspectos(pts(B), pts(A), { orbesPorAspecto: ORBES_TRANSITO });
        expect(conSinastria.length).toBeGreaterThanOrEqual(conTransito.length);
    });

    it('los orbes de sinastría son más amplios que los de tránsito', () => {
        for (const k of Object.keys(ORBES_TRANSITO)) {
            expect(ORBES_SINASTRIA[k]).toBeGreaterThan(ORBES_TRANSITO[k]);
        }
    });
});

describe('rueda de sinastría', () => {
    const aspectos = calcularAspectos(pts(B), pts(A), { orbesPorAspecto: ORBES_SINASTRIA });

    it('la rueda doble completa sin aspectos cruzados no dibuja aspectos', () => {
        const svg = dibujarRueda(A, { revolucion: B });
        expect(svg).not.toMatch(/class="asp-/);
    });

    it('con aspectos cruzados dibuja las líneas en el centro', () => {
        const svg = dibujarRueda(A, { revolucion: B, aspectosCruzados: aspectos });
        // La oposición Sol-Sol se dibuja (las conjunciones no llevan línea).
        expect(svg).toMatch(/class="asp-tenso"/);
    });

    it('resalta el punto elegido de la carta de afuera', () => {
        const svg = dibujarRueda(A, { revolucion: B, aspectosCruzados: aspectos, seleccion: 'r-sol' });
        expect(svg).toContain('data-punto="r-sol"');
    });
});
