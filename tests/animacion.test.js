import { describe, it, expect } from 'vitest';
import { PASOS, pasosDesde, avanzar, momentoLocal, fechaDeMomento, textoMomento, horaValida } from '../ui/animacion.js';

const m = (fecha, hora) => ({ fecha, hora });

describe('animacion: avanzar el momento', () => {
    it('los minutos cruzan la hora y el dia', () => {
        expect(avanzar(m('2026-11-05', '12:16'), 'min-15')).toEqual(m('2026-11-05', '12:31'));
        expect(avanzar(m('2026-11-05', '23:50'), 'min-15')).toEqual(m('2026-11-06', '00:05'));
        expect(avanzar(m('2026-11-06', '00:05'), 'min-15', -1)).toEqual(m('2026-11-05', '23:50'));
    });

    it('las horas y los dias se mueven como se espera', () => {
        expect(avanzar(m('2026-11-05', '12:16'), 'hora-4')).toEqual(m('2026-11-05', '16:16'));
        expect(avanzar(m('2026-11-05', '22:16'), 'hora-4')).toEqual(m('2026-11-06', '02:16'));
        expect(avanzar(m('2026-11-30', '12:00'), 'dia-1')).toEqual(m('2026-12-01', '12:00'));
        expect(avanzar(m('2026-11-05', '12:00'), 'dia-7')).toEqual(m('2026-11-12', '12:00'));
    });

    it('el paso de mes no desborda el fin de mes', () => {
        expect(avanzar(m('2026-01-31', '12:00'), 'mes-1')).toEqual(m('2026-02-28', '12:00'));
        expect(avanzar(m('2024-01-31', '12:00'), 'mes-1')).toEqual(m('2024-02-29', '12:00'));
        expect(avanzar(m('2026-03-31', '12:00'), 'mes-1', -1)).toEqual(m('2026-02-28', '12:00'));
        expect(avanzar(m('2026-01-15', '08:30'), 'mes-1')).toEqual(m('2026-02-15', '08:30'));
    });

    it('el 29 de febrero de un bisiesto cae en el 28 del año siguiente', () => {
        expect(avanzar(m('2024-02-29', '12:00'), 'anio-1')).toEqual(m('2025-02-28', '12:00'));
        expect(avanzar(m('2024-02-29', '12:00'), 'anio-1', 1, 4)).toEqual(m('2028-02-29', '12:00'));
    });

    it('ir y volver con el mismo paso deja el momento igual', () => {
        for (const p of PASOS) {
            const ida = avanzar(m('2026-11-05', '12:16'), p.id, 1);
            expect(avanzar(ida, p.id, -1)).toEqual(m('2026-11-05', '12:16'));
        }
    });

    it('veces salta varios pasos de una', () => {
        expect(avanzar(m('2026-11-05', '12:00'), 'dia-1', 1, 10)).toEqual(m('2026-11-15', '12:00'));
        expect(avanzar(m('2026-11-05', '12:00'), 'dia-1', -1, 10)).toEqual(m('2026-10-26', '12:00'));
    });

    it('un paso desconocido usa el de por defecto (un día)', () => {
        expect(avanzar(m('2026-11-05', '12:00'), 'no-existe')).toEqual(m('2026-11-06', '12:00'));
    });
});

describe('animacion: utilidades', () => {
    it('momentoLocal y fechaDeMomento son inversas', () => {
        const d = new Date(2026, 10, 5, 12, 16);
        expect(momentoLocal(d)).toEqual(m('2026-11-05', '12:16'));
        expect(fechaDeMomento(m('2026-11-05', '12:16')).getTime()).toBe(d.getTime());
    });

    it('sin hora, fechaDeMomento toma la medianoche', () => {
        expect(fechaDeMomento({ fecha: '2026-11-05' }).getHours()).toBe(0);
    });

    it('el texto del momento va en DD/MM/AAAA', () => {
        expect(textoMomento(m('2026-11-05', '12:16'))).toBe('05/11/2026 12:16');
    });

    it('pasosDesde recorta las unidades mas chicas', () => {
        expect(pasosDesde('dia').every((p) => ['dia', 'mes', 'anio'].includes(p.unidad))).toBe(true);
        expect(pasosDesde('anio').map((p) => p.id)).toEqual(['anio-1']);
        expect(pasosDesde('min')).toHaveLength(PASOS.length);
    });
});

describe('animacion: hora escrita a mano', () => {
    it('entiende la hora con y sin los dos puntos', () => {
        expect(horaValida('12:16')).toBe('12:16');
        expect(horaValida('1216')).toBe('12:16');
        expect(horaValida('905')).toBe('09:05');
        expect(horaValida('9:5')).toBe('09:05');
        expect(horaValida('00:00')).toBe('00:00');
        expect(horaValida('23:59')).toBe('23:59');
    });

    it('la hora que no existe o que está a medio escribir no vale', () => {
        expect(horaValida('24:00')).toBe(null);
        expect(horaValida('12:60')).toBe(null);
        expect(horaValida('99:99')).toBe(null);
        expect(horaValida('12')).toBe(null);
        expect(horaValida('')).toBe(null);
        expect(horaValida('hola')).toBe(null);
    });
});
