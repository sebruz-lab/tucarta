// Los avisos del panel del huso. Salen en dos lugares a la vez (el panel y
// el globo del triangulito de la esquina de la rueda), asi que se arman
// una sola vez en avisosDelHuso.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { localAUtc, cargarZona, configurarHusos } from '../time/tz.js';
import { avisosDelHuso, trianguloHuso } from '../ui/huso.js';
import { ENGRANAJE } from '../ui/iconos.js';
import indice from '../time/zonas.json';

configurarHusos(async (archivo) =>
    JSON.parse(readFileSync(new URL(`../ui/public/husos/${archivo}`, import.meta.url), 'utf8')));
await Promise.all(indice.zonas.map((z) => cargarZona(z)));

const lectura = (fecha, zona, provincia = null, correccion = null) =>
    localAUtc({ fecha, hora: '12:00' }, zona, correccion, provincia);
const avisos = (...args) => avisosDelHuso(lectura(...args), 0);

const CORDOBA = 'America/Argentina/Cordoba';

describe('avisosDelHuso', () => {
    it('una carta cualquiera no tiene ningún aviso', () => {
        expect(avisos('2010-06-15', 'America/Argentina/Buenos_Aires')).toEqual([]);
        expect(avisos('1984-03-20', 'Europe/Madrid')).toEqual([]);
    });

    it('la hora oficial argentina', () => {
        const a = avisos('1991-06-15', CORDOBA);
        expect(a).toHaveLength(1);
        expect(a[0].html).toContain('hora oficial argentina');
    });

    it('la provincia que no adhirió al horario de verano', () => {
        const a = avisos('1991-12-11', 'America/Argentina/Salta');
        expect(a).toHaveLength(1);
        expect(a[0].html).toContain('no adhirió al horario de verano');
    });

    it('el horario propio de la provincia', () => {
        const a = avisos('1991-06-11', 'America/Argentina/Mendoza');
        expect(a).toHaveLength(1);
        expect(a[0].html).toContain('horario propio');
    });

    it('dos avisos juntos: la hora oficial y la provincia que no podemos calcular', () => {
        // El 1/4/1991 la zona Córdoba está corregida a la hora oficial, y
        // además Santiago del Estero tenía otra hora que no sabemos darle.
        const a = avisos('1991-04-10', CORDOBA, 'Santiago del Estero');
        expect(a).toHaveLength(2);
        expect(a[0].html).toContain('hora oficial argentina');
        expect(a[1].html).toContain('Santiago del Estero');
    });

    it('el aviso de provincia solo le sale a esa provincia', () => {
        expect(avisos('1990-12-11', CORDOBA, 'Córdoba')).toHaveLength(1);
        expect(avisos('1990-12-11', CORDOBA, 'Entre Ríos')).toEqual([]);
        // Sin provincia (coordenadas a mano) tampoco.
        expect(avisos('1990-12-11', CORDOBA)).toEqual([]);
    });

    it('el huso corregido a mano reemplaza a todo lo demás', () => {
        const a = avisosDelHuso(lectura('1991-06-15', CORDOBA, null, { base: -4 * 3600, verano: 0 }), 0);
        expect(a).toHaveLength(1);
        expect(a[0].html).toContain('corregido a mano');
    });

    it('la roldanita es el mismo engranaje que el de la esquina de la rueda', () => {
        // Y no un dibujo propio: tiene que reconocerse como la misma cosa
        // en los dos lugares.
        const [a] = avisos('1991-06-15', CORDOBA);
        expect(a.html).toContain(ENGRANAJE(15));
    });

    it('todos invitan a corregir con la roldanita', () => {
        for (const a of [...avisos('1991-06-15', CORDOBA),
            ...avisos('1991-12-11', 'America/Argentina/Salta'),
            ...avisos('1991-06-11', 'America/Argentina/Mendoza'),
            ...avisos('1990-12-11', CORDOBA, 'Córdoba')]) {
            expect(a.html).toContain('data-accion="corregir-huso"');
        }
    });
});

describe('trianguloHuso', () => {
    it('no sale cuando no hay nada que avisar', () => {
        expect(trianguloHuso(lectura('2010-06-15', 'America/Argentina/Buenos_Aires'), 0)).toBe('');
    });

    it('sale con el globo y los avisos adentro', () => {
        const h = trianguloHuso(lectura('1991-04-10', CORDOBA, 'Santiago del Estero'), 0);
        expect(h).toContain('<details class="alerta-huso">');
        expect(h).toContain('globo-huso');
        // Los dos avisos, cada uno en su párrafo.
        expect(h.match(/<p>/g)).toHaveLength(2);
        expect(h).toContain('Santiago del Estero');
    });
});
