// Hora local + zona IANA -> UTC, contra el huso que aplico Solar Fire en las
// cartas de referencia, y casos conocidos de la base IANA.
//
// Antes de 1970 una diferencia con Solar Fire no falla el test: se anota
// como tentativa en el informe del final.

import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localAUtc, cargarZona, configurarHusos } from '../time/tz.js';
import indice from '../time/zonas.json';

// En el navegador cada zona se baja cuando hace falta; aca se leen del
// disco y se cargan todas antes de empezar.
configurarHusos(async (archivo) =>
    JSON.parse(readFileSync(new URL(`../ui/public/husos/${archivo}`, import.meta.url), 'utf8')));
await Promise.all(indice.zonas.map((z) => cargarZona(z)));

const H = 3600;
const dir = fileURLToPath(new URL('./fixtures/solarfire/', import.meta.url));
const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => ({ archivo: f, ...JSON.parse(readFileSync(dir + f, 'utf8')) }));

const tentativas = [];
afterAll(() => {
    if (!tentativas.length) return;
    console.log('\nHusos tentativos (antes de 1970, distintos de Solar Fire):\n' +
        tentativas.map((t) => `  ${t.archivo}: IANA ${t.iana}, Solar Fire ${t.sf}`).join('\n'));
});

const horas = (seg) => (seg >= 0 ? '+' : '-') + Math.abs(seg / H);

describe('husos vs Solar Fire', () => {
    for (const f of fixtures) {
        it(f.archivo, () => {
            const r = localAUtc(f.local, f.lugar.zona);
            expect(r.estado).toBe('ok');
            const [signo, hh, mm] = f.offsetSolarFire.match(/([+-])(\d\d):(\d\d)/).slice(1);
            const sf = (signo === '-' ? -1 : 1) * (+hh * H + +mm * 60);
            const iana = r.opciones[0].total;
            if (iana !== sf && r.tentativo) {
                tentativas.push({ archivo: f.archivo, iana: horas(iana), sf: f.offsetSolarFire });
                return;
            }
            expect(r.opciones[0].utc).toMatchObject(f.utc);
        });
    }
});

describe('base y horario de verano por separado', () => {
    const caso = (zona, fecha, hora) => localAUtc({ fecha, hora }, zona).opciones[0];

    it('Buenos Aires 1966: base -4 con verano +1', () => {
        expect(caso('America/Argentina/Buenos_Aires', '1966-11-28', '05:30')).toMatchObject({ base: -4 * H, verano: H });
    });
    it('Buenos Aires 1991: base -3 con verano +1', () => {
        expect(caso('America/Argentina/Buenos_Aires', '1991-02-01', '21:33')).toMatchObject({ base: -3 * H, verano: H });
    });
    // tzdata da -4 para las ocho provincias de la zona Córdoba entre
    // marzo y octubre de 1991. La hora oficial argentina fue -3, y el
    // atlas de ACS (el que usa Solar Fire) también da -3 para todas
    // ellas: ver time/correcciones.js.
    it('Córdoba entre marzo y octubre de 1991: -3, la hora oficial', () => {
        expect(caso('America/Argentina/Cordoba', '1991-06-15', '12:00'))
            .toMatchObject({ base: -3 * H, verano: 0, correccion: 1 });
    });
    it('Paraná, el 31/3/1991 a las 06:45, igual que Solar Fire', () => {
        const r = localAUtc({ fecha: '1991-03-31', hora: '06:45' }, 'America/Argentina/Cordoba');
        expect(r.opciones[0].total).toBe(-3 * H);
        expect(r.opciones[0].utc).toMatchObject({ anio: 1991, mes: 3, dia: 31, hora: 9, minuto: 45 });
    });
    it('la corrección empieza y termina donde dice la hora oficial', () => {
        // Hasta las 24 h del 2/3/1991 rige el verano -2; desde las 0 h del
        // 3/3, -3. Y desde el 20/10 sigue en -3, porque esta zona tampoco
        // adhirió al horario de verano 91-92: ahí ya no hay cambio de hora.
        expect(caso('America/Argentina/Cordoba', '1991-03-02', '23:30').total).toBe(-2 * H);
        expect(caso('America/Argentina/Cordoba', '1991-03-03', '00:30').total).toBe(-3 * H);
        expect(caso('America/Argentina/Cordoba', '1991-10-19', '23:30').total).toBe(-3 * H);
        expect(caso('America/Argentina/Cordoba', '1991-10-20', '01:30'))
            .toMatchObject({ total: -3 * H, correccion: 2 });
    });
    it('Buenos Aires y Jujuy no se tocan', () => {
        expect(caso('America/Argentina/Buenos_Aires', '1991-06-15', '12:00'))
            .toMatchObject({ base: -3 * H, verano: 0, correccion: 0 });
        expect(caso('America/Argentina/Jujuy', '1991-06-30', '13:00'))
            .toMatchObject({ base: -4 * H, verano: 0, correccion: 0 });
    });

    // El mismo bloque de Shanks que el de Córdoba: en el fuente de tzdata
    // las líneas de Córdoba, Salta, Tucumán y Catamarca son idénticas para
    // este tramo. Solar Fire da -3 en las cuatro el 11/6/1991.
    const ZONAS_91 = ['America/Argentina/Salta', 'America/Argentina/Tucuman', 'America/Argentina/Catamarca'];

    it('Salta, Tucumán y Catamarca en el invierno del 91: -3, la hora oficial', () => {
        for (const z of ZONAS_91) {
            expect(caso(z, '1991-06-11', '12:00'), z)
                .toMatchObject({ base: -3 * H, verano: 0, correccion: 1 });
        }
    });

    // Los veranos son el caso opuesto: la hora oficial nacional adelantaba
    // a -2 y estas provincias se quedaron en -3, así que la marca es 2.
    it('los tres veranos sin horario de verano en Salta, Tucumán y Catamarca', () => {
        for (const z of ZONAS_91) {
            for (const fecha of ['1990-12-11', '1991-12-11', '1992-12-11']) {
                expect(caso(z, fecha, '12:00'), `${z} ${fecha}`)
                    .toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
            }
        }
    });

    it('La Rioja: los tres veranos en -3, pero el -4 de marzo a mayo del 91 queda', () => {
        const z = 'America/Argentina/La_Rioja';
        for (const fecha of ['1990-12-11', '1991-12-11', '1992-12-11']) {
            expect(caso(z, fecha, '12:00'), fecha).toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
        }
        // Ventana corta y con fechas propias: parece un decreto provincial
        // real y no hay lectura adentro que la contradiga.
        expect(caso(z, '1991-04-01', '12:00')).toMatchObject({ base: -4 * H, verano: 0, correccion: 0 });
    });

    it('San Juan adhirió en el verano 90-91 y no en los dos siguientes', () => {
        const z = 'America/Argentina/San_Juan';
        expect(caso(z, '1990-12-11', '12:00')).toMatchObject({ total: -2 * H, correccion: 0 });
        expect(caso(z, '1991-12-11', '12:00')).toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
        expect(caso(z, '1992-12-11', '12:00')).toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
    });

    it('los bordes de los veranos corregidos', () => {
        const z = 'America/Argentina/Salta';
        // El país adelantaba a -2 a las 0 h del 21/10/1990 y acá los
        // relojes no se movieron, así que a los dos lados del borde va -3.
        expect(caso(z, '1990-10-20', '23:30').total).toBe(-3 * H);
        expect(caso(z, '1990-10-21', '01:30')).toMatchObject({ total: -3 * H, correccion: 2 });
        // El verano 92-93 termina el 6/3/1993: desde el 7 vuelve a regir el
        // -3 nacional y ya no hay nada corregido.
        expect(caso(z, '1993-03-06', '12:00')).toMatchObject({ total: -3 * H, correccion: 2 });
        expect(caso(z, '1993-03-08', '12:00')).toMatchObject({ total: -3 * H, correccion: 0 });
    });

    it('la marca sale del tramo de la fecha, no de un tramo vecino', () => {
        // Los husos candidatos se juntan por offset total, y acá hay tres
        // tramos seguidos en -3 con marcas distintas (verano corregido,
        // invierno, verano corregido). Si la marca se tomara del último
        // huso probado, a un día y medio de un borde la carta avisaría de
        // menos o de más.
        const z = 'America/Argentina/Salta';
        expect(caso(z, '1992-02-28', '12:00').correccion).toBe(2);   // verano 91-92
        expect(caso(z, '1992-03-02', '12:00').correccion).toBe(0);   // invierno del 92
        expect(caso(z, '1992-10-17', '12:00').correccion).toBe(0);
        expect(caso(z, '1992-10-19', '12:00').correccion).toBe(2);   // verano 92-93
    });

    it('lo documentado no se toca: Mendoza y San Luis', () => {
        // Mendoza por su ley 5566 (invierno -4, verano -3).
        expect(caso('America/Argentina/Mendoza', '1991-06-11', '12:00'))
            .toMatchObject({ base: -4 * H, verano: 0, correccion: 0 });
        expect(caso('America/Argentina/San_Luis', '1990-06-11', '12:00'))
            .toMatchObject({ base: -4 * H, verano: 0, correccion: 0 });
        // Y los inviernos del 90 y del 91 en Jujuy, que Solar Fire confirma
        // en -4 y tzdata ya tiene con sus fechas propias.
        expect(caso('America/Argentina/Jujuy', '1990-06-11', '12:00'))
            .toMatchObject({ total: -4 * H, correccion: 0 });
        expect(caso('America/Argentina/Jujuy', '1991-06-11', '12:00'))
            .toMatchObject({ total: -4 * H, correccion: 0 });
    });

    it('la zona Córdoba no adhirió en el 91-92 ni en el 92-93', () => {
        // Córdoba y Paraná, las dos puntas de la zona que pudimos leer,
        // coinciden en -3 en esos dos veranos.
        const z = 'America/Argentina/Cordoba';
        expect(caso(z, '1991-12-11', '12:00')).toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
        expect(caso(z, '1992-12-11', '12:00')).toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
    });

    it('el verano 90-91 parte la zona Córdoba: queda en -2 y avisa', () => {
        // Ahí las lecturas se separan: Córdoba en -3 (no adhirió) y Paraná
        // en -2 (sí). No hay un valor correcto para las dos, así que la zona
        // se queda en el -2 nacional, que es el mejor pronóstico para las
        // seis provincias que no pudimos consultar, y se avisa por Córdoba.
        const z = 'America/Argentina/Cordoba';
        const r = localAUtc({ fecha: '1990-12-11', hora: '12:00' }, z, null, 'Córdoba').opciones[0];
        expect(r).toMatchObject({ total: -2 * H, correccion: 0 });
        expect(r.aviso?.provincia).toBe('Córdoba');
        // Entre Ríos sí adhirió, así que para Paraná el -2 es correcto y no
        // lleva aviso ninguno.
        expect(localAUtc({ fecha: '1990-12-11', hora: '12:00' }, z, null, 'Entre Ríos').opciones[0].aviso)
            .toBeNull();
        // Fuera de ese verano no avisa por Córdoba.
        expect(localAUtc({ fecha: '1991-12-11', hora: '12:00' }, z, null, 'Córdoba').opciones[0].aviso)
            .toBeNull();
    });

    it('La Rioja volvió a la hora oficial el 18/5/1991, no el 7/5', () => {
        const z = 'America/Argentina/La_Rioja';
        // Los once días que tzdata se come. No llevan aviso propio: ese -4
        // difiere de la hora oficial, así que avisa el de horario provincial.
        expect(caso(z, '1991-05-10', '12:00'))
            .toMatchObject({ total: -4 * H, correccion: 0, provincial: true });
        expect(caso(z, '1991-05-17', '23:30').total).toBe(-4 * H);
        expect(caso(z, '1991-05-18', '01:30'))
            .toMatchObject({ total: -3 * H, correccion: 0, provincial: false });
        // Volver a la hora oficial es adelantar el reloj, así que la primera
        // hora del 18/5 no existió: la app tiene que decirlo y no elegir sola.
        expect(localAUtc({ fecha: '1991-05-18', hora: '00:30' }, z).estado).toBe('inexistente');
        // San Juan sí volvió el 7/5, y no se toca.
        expect(caso('America/Argentina/San_Juan', '1991-05-10', '12:00'))
            .toMatchObject({ total: -3 * H, correccion: 0 });
    });

    it('Jujuy tampoco adhirió en el verano 92-93', () => {
        expect(caso('America/Argentina/Jujuy', '1992-12-11', '12:00'))
            .toMatchObject({ base: -3 * H, verano: 0, correccion: 2 });
        // Y las que sí adhirieron siguen en -2.
        for (const z of ['America/Argentina/Buenos_Aires', 'America/Argentina/Rio_Gallegos',
            'America/Argentina/Ushuaia']) {
            for (const f of ['1990-12-11', '1991-12-11', '1992-12-11']) {
                expect(caso(z, f, '12:00').total, `${z} ${f}`).toBe(-2 * H);
            }
        }
    });

    // El aviso sale solo en la provincia afectada, no en toda la zona.
    const enProvincia = (zona, fecha, hora, provincia) =>
        localAUtc({ fecha, hora }, zona, null, provincia).opciones[0];

    it('Santiago del Estero: no se puede calcular aparte, pero se avisa', () => {
        const z = 'America/Argentina/Cordoba';
        // Del 1 al 28 de abril del 91 esa provincia estuvo en -4 y el resto
        // de la zona en -3. No tiene zona propia en tzdata, así que la hora
        // sale la de Córdoba y el aviso lo dice.
        const r = enProvincia(z, '1991-04-10', '12:00', 'Santiago del Estero');
        expect(r.aviso?.provincia).toBe('Santiago del Estero');
        expect(r.total).toBe(-3 * H);
        // Las otras siete provincias de la zona no ven nada: para ellas la
        // hora que calculamos es la correcta.
        for (const p of ['Córdoba', 'Santa Fe', 'Entre Ríos', 'Chaco']) {
            expect(enProvincia(z, '1991-04-10', '12:00', p).aviso, p).toBeNull();
        }
        // Fuera de la ventana tampoco.
        expect(enProvincia(z, '1991-03-20', '12:00', 'Santiago del Estero').aviso).toBeNull();
        expect(enProvincia(z, '1991-05-10', '12:00', 'Santiago del Estero').aviso).toBeNull();
        // Alcanza a los alias de la zona.
        expect(enProvincia('America/Rosario', '1991-04-10', '12:00', 'Santiago del Estero').aviso?.provincia)
            .toBe('Santiago del Estero');
        // Sin provincia (coordenadas a mano) no se avisa: no sabríamos si
        // el lugar es de esa provincia y nombraríamos una que no es.
        expect(caso(z, '1991-04-10', '12:00').aviso).toBeNull();
    });

    it('la provincia se compara sin acentos ni mayúsculas', () => {
        // Por si una carta vieja guardó el nombre de otra manera.
        const z = 'America/Argentina/Cordoba';
        for (const p of ['Córdoba', 'cordoba', 'CÓRDOBA', ' Cordoba ']) {
            expect(enProvincia(z, '1990-12-11', '12:00', p).aviso?.provincia, p).toBe('Córdoba');
        }
    });

    // Toda hora distinta de la oficial argentina se avisa, la hayamos
    // corregido nosotros o venga asi de la base IANA.
    it('el horario provincial se marca', () => {
        // Mendoza por su ley 5566: invierno -4 cuando el pais estaba en -3.
        expect(caso('America/Argentina/Mendoza', '1991-06-11', '12:00'))
            .toMatchObject({ total: -4 * H, correccion: 0, provincial: true });
        // Y en verano -3 cuando el pais estaba en -2.
        expect(caso('America/Argentina/Mendoza', '1992-01-15', '12:00'))
            .toMatchObject({ total: -3 * H, provincial: true });
        // Las exceptuadas del decreto 1705/2008 y San Luis hasta 2010.
        expect(caso('America/Argentina/Mendoza', '2009-01-15', '12:00')).toMatchObject({ provincial: true });
        expect(caso('America/Argentina/San_Luis', '2009-01-15', '12:00')).toMatchObject({ provincial: true });
        // Las del oeste en 2004.
        expect(caso('America/Argentina/San_Juan', '2004-06-15', '12:00')).toMatchObject({ provincial: true });
    });

    it('lo que coincide con la hora oficial no se marca como provincial', () => {
        // Buenos Aires es la referencia: nunca es provincial.
        expect(caso('America/Argentina/Buenos_Aires', '1991-06-15', '12:00')).toMatchObject({ provincial: false });
        expect(caso('America/Buenos_Aires', '2009-01-15', '12:00')).toMatchObject({ provincial: false });
        // Parana en el 91 lo corregimos justamente para que coincida con la
        // oficial, asi que lleva el aviso 1 y no el de provincial.
        expect(caso('America/Argentina/Cordoba', '1991-06-15', '12:00'))
            .toMatchObject({ correccion: 1, provincial: false });
        // Un dia cualquiera, sin ninguna desviacion.
        expect(caso('America/Argentina/Mendoza', '2020-06-15', '12:00')).toMatchObject({ provincial: false });
        // Antes del 5/10/1969 no hay con que comparar.
        expect(caso('America/Argentina/Mendoza', '1950-06-15', '12:00')).toMatchObject({ provincial: false });
        // Fuera de la Argentina, nunca.
        expect(caso('Europe/Madrid', '1991-06-15', '12:00')).toMatchObject({ provincial: false });
    });

    it('las provincias que no adhirieron llevan las dos cosas', () => {
        // Salta en el verano 91-92: la corregimos nosotros (marca 2) y
        // ademas difiere de la oficial, asi que es provincial.
        expect(caso('America/Argentina/Salta', '1991-12-11', '12:00'))
            .toMatchObject({ total: -3 * H, correccion: 2, provincial: true });
    });

    it('los alias salen corregidos igual que su zona real', () => {
        // El generador emite un archivo por alias: America/Rosario sale de
        // America/Argentina/Cordoba y tiene que llevar la corrección.
        for (const z of ['America/Rosario', 'America/Cordoba']) {
            expect(caso(z, '1991-06-15', '12:00'), z)
                .toMatchObject({ base: -3 * H, verano: 0, correccion: 1 });
        }
        for (const z of ['America/Catamarca', 'America/Argentina/ComodRivadavia']) {
            expect(caso(z, '1991-06-11', '12:00'), z)
                .toMatchObject({ base: -3 * H, verano: 0, correccion: 1 });
        }
    });
    it('Mendoza 1992: verano sobre base -4', () => {
        expect(caso('America/Argentina/Mendoza', '1992-01-15', '12:00')).toMatchObject({ base: -4 * H, verano: H });
    });
    it('Mendoza en el verano 2008-09: -3 sin verano', () => {
        expect(caso('America/Argentina/Mendoza', '2009-01-15', '12:00')).toMatchObject({ base: -3 * H, verano: 0 });
    });
    it('San Luis en el verano 2008-09: verano sobre base -4', () => {
        expect(caso('America/Argentina/San_Luis', '2009-01-15', '12:00')).toMatchObject({ base: -4 * H, verano: H });
    });
    // Desde que se empaqueta el mundo entero, Tokio tiene detalle propio:
    // 9 horas de base y cero de verano (Japon no mueve el reloj).
    it('ahora tambien el resto del mundo tiene detalle', () => {
        expect(caso('Asia/Tokyo', '1990-01-01', '12:00')).toMatchObject({ total: 9 * H, base: 9 * H, verano: 0 });
        expect(caso('Australia/Sydney', '1990-01-15', '12:00')).toMatchObject({ verano: H });
        expect(caso('Africa/Cairo', '1990-01-01', '12:00')).toMatchObject({ total: 2 * H, verano: 0 });
    });

    // Las zonas que el generador descarto por no coincidir con Intl (Rusia
    // y Asia central, por los cambios sovieticos del 91) siguen saliendo
    // por Intl: offset total correcto, sin separar base y verano.
    it('zona sin detalle: solo offset total', () => {
        expect(caso('Europe/Moscow', '1990-01-01', '12:00')).toMatchObject({ total: 3 * H, verano: null });
    });
});

describe('cambios de hora', () => {
    it('hora ambigua: 15/3/2008 23:30 en Buenos Aires pasó dos veces', () => {
        const r = localAUtc({ fecha: '2008-03-15', hora: '23:30' }, 'America/Argentina/Buenos_Aires');
        expect(r.estado).toBe('ambigua');
        expect(r.opciones.map((o) => o.total)).toEqual([-2 * H, -3 * H]);
    });
    it('hora inexistente: 30/12/2007 00:30 en Buenos Aires', () => {
        const r = localAUtc({ fecha: '2007-12-30', hora: '00:30' }, 'America/Argentina/Buenos_Aires');
        expect(r.estado).toBe('inexistente');
        expect(r.opciones).toHaveLength(2);
    });
    it('corrección manual', () => {
        const r = localAUtc({ fecha: '1965-11-21', hora: '07:50' }, 'Atlantic/Reykjavik', { base: -H, verano: 0 });
        expect(r.estado).toBe('manual');
        expect(r.opciones[0].utc).toMatchObject({ anio: 1965, mes: 11, dia: 21, hora: 8, minuto: 50 });
    });
    it('antes de 1970 es tentativo', () => {
        expect(localAUtc({ fecha: '1969-12-31', hora: '12:00' }, 'Europe/Madrid').tentativo).toBe(true);
        expect(localAUtc({ fecha: '1970-01-01', hora: '12:00' }, 'Europe/Madrid').tentativo).toBe(false);
    });
});
