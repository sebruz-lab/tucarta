// La grilla del mes y la agenda. Todo lo de calendarioMes.js es puro, asi
// que no hace falta ni DOM ni efemerides: se le pasan eventos a mano.
//
// Lo que mas importa de aca es el armado de los dias: un evento se agrupa
// por su fecha **local**, no por el dia juliano, que corta al mediodia UT.

import { describe, it, expect } from 'vitest';
import { claveDia, horaDeJd, porDia, semanasDelMes, tituloMes, cuerpoEvento, lineaEvento, grillaMes, agendaDias, bloqueDeUnDia } from '../ui/calendarioMes.js';
import { jdDeFecha } from '../ui/calendario.js';

// Un dia juliano a partir de una fecha y hora LOCALES, que es como los lee
// quien mira el calendario.
const jdLocal = (a, m, d, h = 0, mi = 0) => jdDeFecha(new Date(a, m - 1, d, h, mi));

describe('claveDia y horaDeJd', () => {
    it('agrupan por el dia local, no por el juliano', () => {
        // Las 22:00 del 23 son el dia 23. Por dia juliano serian el 24, que
        // es el error que esto existe para no cometer.
        expect(claveDia(jdLocal(2026, 12, 23, 22, 0))).toBe('2026-12-23');
        expect(claveDia(jdLocal(2026, 12, 23, 1, 30))).toBe('2026-12-23');
        expect(claveDia(jdLocal(2026, 1, 5, 0, 0))).toBe('2026-01-05');
    });

    it('truncan la hora al minuto, como Solar Fire', () => {
        expect(horaDeJd(jdLocal(2026, 12, 8, 21, 51) + 59 / 86400)).toBe('21:51');
        expect(horaDeJd(jdLocal(2026, 12, 8, 7, 5))).toBe('07:05');
        expect(horaDeJd(jdLocal(2026, 12, 8, 0, 0))).toBe('00:00');
    });
});

describe('semanasDelMes', () => {
    it('empieza en domingo y completa con celdas vacias', () => {
        // Diciembre de 2026 arranca martes y tiene 31 dias.
        const s = semanasDelMes(2026, 11);
        expect(s[0].slice(0, 2)).toEqual([null, null]);
        expect(s[0][2]).toBe(1);
        expect(s.every((f) => f.length === 7)).toBe(true);
        expect(s.flat().filter((d) => d != null)).toHaveLength(31);
    });

    it('un mes que arranca domingo no lleva huecos adelante', () => {
        // Noviembre de 2026 arranca domingo.
        expect(semanasDelMes(2026, 10)[0][0]).toBe(1);
    });

    it('febrero de un bisiesto que arranca domingo entra justo en cuatro semanas', () => {
        const s = semanasDelMes(2032, 1);   // 29 dias, arranca domingo
        expect(s).toHaveLength(5);
        expect(s.flat().filter((d) => d != null)).toHaveLength(29);
    });
});

describe('tituloMes', () => {
    it('va en castellano y con mayuscula', () => {
        expect(tituloMes(2026, 11)).toBe('Diciembre 2026');
        expect(tituloMes(2027, 0)).toBe('Enero 2027');
    });
});

const ASPECTO_TR = { tipo: 'aspecto-tr', jd: jdLocal(2026, 12, 2, 17, 16), a: 'luna', b: 'neptuno', aspecto: 'quincuncio', menor: true };
const ASPECTO_NA = { tipo: 'aspecto-na', jd: jdLocal(2026, 12, 2, 2, 38), a: 'saturno', b: 'sol', aspecto: 'trigono', menor: false };
const INGRESO = { tipo: 'ingreso', jd: jdLocal(2026, 12, 2, 17, 3), punto: 'luna', signo: 'libra', retro: false };
const ESTACION = { tipo: 'estacion', jd: jdLocal(2026, 12, 12, 21, 56), punto: 'jupiter', sentido: 'SR' };
const FASE = { tipo: 'fase', jd: jdLocal(2026, 12, 8, 21, 51), fase: 'nueva', lon: 256.94, signo: 'sagitario', grado: 16, minuto: 56 };
const TODOS = [ASPECTO_NA, INGRESO, ASPECTO_TR, FASE, ESTACION];

describe('cuerpoEvento', () => {
    it('describe cada tipo en castellano', () => {
        expect(cuerpoEvento(ASPECTO_TR).texto).toBe('Luna quincuncio Neptuno');
        expect(cuerpoEvento(ASPECTO_NA).texto).toBe('Saturno trígono Sol natal');
        expect(cuerpoEvento(INGRESO).texto).toBe('Luna entra en Libra');
        expect(cuerpoEvento({ ...INGRESO, punto: 'mercurio', retro: true }).texto)
            .toBe('Mercurio entra en Libra, retrógrado');
        expect(cuerpoEvento(ESTACION).texto).toBe('Júpiter se hace retrógrado');
        expect(cuerpoEvento({ ...ESTACION, sentido: 'SD' }).texto).toBe('Júpiter se hace directo');
        expect(cuerpoEvento(FASE).texto).toBe("Luna nueva a 16°56' de Sagitario");
    });

    it('un angulo no tiene glifo: sale como AC o MC', () => {
        const { html, texto } = cuerpoEvento({ ...ASPECTO_NA, b: 'asc' });
        expect(html).toContain('>AC<');
        expect(texto).toBe('Saturno trígono Ascendente natal');
    });
});

describe('lineaEvento', () => {
    it('lleva el indice, la hora y el texto para quien no ve los glifos', () => {
        const li = lineaEvento(ASPECTO_TR, 7);
        expect(li).toContain('data-ev="7"');
        expect(li).toContain('>17:16<');
        expect(li).toContain('Luna quincuncio Neptuno');
    });

    it('las siglas de carril van solo cuando los dos carriles estan prendidos', () => {
        expect(lineaEvento(ASPECTO_TR, 0)).not.toContain('Tr-Tr');
        expect(lineaEvento(ASPECTO_TR, 0, { conCarril: true })).toContain('Tr-Tr');
        expect(lineaEvento(ASPECTO_NA, 0, { conCarril: true })).toContain('Tr-Na');
        // Un ingreso no es de ningun carril: no lleva sigla.
        expect(lineaEvento(INGRESO, 0, { conCarril: true })).not.toContain('cal-carril');
    });
});

describe('porDia', () => {
    it('ordena por hora adentro de cada dia y conserva el indice original', () => {
        const dias = porDia(TODOS);
        expect([...dias.keys()].sort()).toEqual(['2026-12-02', '2026-12-08', '2026-12-12']);
        const dos = dias.get('2026-12-02');
        expect(dos.map((x) => x.ev.jd)).toEqual([...dos.map((x) => x.ev.jd)].sort((a, b) => a - b));
        // El indice es la posicion en el arreglo que se paso, no la del dia.
        expect(dos.map((x) => x.i)).toEqual([0, 1, 2]);
    });
});

describe('grillaMes', () => {
    it('arma una tabla de siete columnas con el dia de cada evento', () => {
        const html = grillaMes(TODOS, { anio: 2026, mes: 11 });
        expect((html.match(/<th scope="col">/g) || [])).toHaveLength(7);
        expect(html).toContain('>Diciembre 2026<');
        // Los 31 dias del mes, cada uno con su numero.
        expect((html.match(/class="cal-num"/g) || [])).toHaveLength(31);
        expect((html.match(/data-ev="/g) || [])).toHaveLength(TODOS.length);
    });

    it('lo que pasa el tope abre el dia en una ventana, y sigue en el documento', () => {
        const muchos = Array.from({ length: 10 }, (_, k) => ({ ...ASPECTO_TR, jd: jdLocal(2026, 12, 2, 1 + k, 0) }));
        const html = grillaMes(muchos, { anio: 2026, mes: 11, tope: 6 });
        expect(html).toContain('data-cal-dia="2026-12-02"');
        expect(html).toContain('+4 más');
        // Los cuatro de mas no se tiran: el celular y el papel los muestran.
        expect(html).toContain('cal-ocultos');
        expect((html.match(/data-ev="/g) || [])).toHaveLength(10);
    });

    it('sin eventos de mas no hay boton ni lista oculta', () => {
        const html = grillaMes([ASPECTO_TR], { anio: 2026, mes: 11, tope: 6 });
        expect(html).not.toContain('cal-mas');
        expect(html).not.toContain('cal-ocultos');
    });

    it('la fase va en su propia linea al pie, y esa linea esta en todos los dias', () => {
        const html = grillaMes(TODOS, { anio: 2026, mes: 11 });
        // Una linea de fase por dia del mes, tenga fase o no: es lo que
        // mantiene la fase siempre en el mismo lugar de la celda.
        expect((html.match(/class="cal-evs cal-linea-fase"/g) || [])).toHaveLength(31);
        // Y la fase esta ahi adentro, no mezclada entre los demas eventos.
        const dia8 = html.slice(html.indexOf('>8<'), html.indexOf('>9<'));
        expect(dia8.indexOf('cal-ev-fase')).toBeGreaterThan(dia8.indexOf('cal-linea-fase'));
    });

    it('el tope no cuenta la fase: no le saca lugar a los demas', () => {
        const muchos = Array.from({ length: 6 }, (_, k) => ({ ...ASPECTO_TR, jd: jdLocal(2026, 12, 8, 1 + k, 0) }));
        const html = grillaMes([...muchos, FASE], { anio: 2026, mes: 11, tope: 6 });
        expect(html).not.toContain('cal-mas');
        expect((html.match(/data-ev="/g) || [])).toHaveLength(7);
    });

    it('sin eventos lo dice en vez de dibujar una grilla vacia', () => {
        expect(grillaMes([], { anio: 2026, mes: 11 })).toContain('No hay eventos');
    });
});

describe('bloqueDeUnDia', () => {
    it('trae el dia entero, con la fecha completa', () => {
        const { titulo, html } = bloqueDeUnDia(TODOS, '2026-12-02');
        expect(titulo).toBe('mié 2 de diciembre de 2026');
        expect((html.match(/data-ev="/g) || [])).toHaveLength(3);
        // Los indices son los del arreglo entero, que es lo que app.js usa
        // para llevar la rueda al instante del evento.
        expect(html).toContain('data-ev="2"');
    });

    it('un dia sin eventos no revienta', () => {
        expect(bloqueDeUnDia(TODOS, '2026-12-03').html).toContain('No hay eventos');
    });
});

describe('agendaDias', () => {
    it('hace un bloque por dia con eventos, con la fecha en castellano', () => {
        const html = agendaDias(TODOS);
        expect((html.match(/class="cal-dia-agenda"/g) || [])).toHaveLength(3);
        expect(html).toContain('de diciembre');
        expect((html.match(/data-ev="/g) || [])).toHaveLength(TODOS.length);
        // A diferencia de la grilla, no pliega nada.
        expect(html).not.toContain('cal-mas');
    });

    it('sin eventos dice lo mismo que la grilla', () => {
        expect(agendaDias([])).toContain('No hay eventos');
    });
});
