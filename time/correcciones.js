// Correcciones a la base IANA, declaradas una por una y con su fuente.
//
// La regla de la casa es seguir tzdata y no tocar nada: es la mejor base
// que hay y se revisa sola. Se corrige solo donde la propia tzdata avisa
// que su dato no esta verificado Y hay fuentes mejores que la contradicen.
// Cada correccion dice que reemplaza, por que, y con que se comprobo.
//
// El criterio no es ser fiel a una fuente sino llegar a lo que marcaban
// los relojes de quienes anotaron esos nacimientos. Ni tzdata ni el atlas
// de ACS son registros: son compilaciones. Lo que le da peso al atlas en
// la Argentina de estos anos es que tzdata lo cita como su fuente para
// todo lo anterior a 1992 y despues lo simplifico, metiendo provincias
// enteras en una zona sola. Donde difieren, el atlas es la version sin
// simplificar de la misma fuente.
//
// Formato de cada periodo, igual que en ui/public/husos/: [desde (UTC en
// segundos), offset total, cuanto de eso es horario de verano]. Los
// periodos que pone una correccion llevan un cuarto campo con el codigo
// de la correccion, que es lo que la carta usa para avisar en pantalla:
//
//   0 = sin aviso propio (el de horario provincial ya salta solo).
//   1 = usamos la hora oficial argentina donde IANA estima otro huso.
//   2 = esa provincia no adhirio al horario de verano nacional.
//
// El 1 y el 2 son casos opuestos y conviene no confundirlos: en el 1 IANA
// se aparta de la hora legal nacional, y en el 2 la que se aparta es la
// provincia.

const utc = (a, m, d, h) => Date.UTC(a, m - 1, d, h) / 1000;
const H = 3600;

// La hora oficial nacional de estos veranos, segun el Servicio de
// Hidrografia Naval: -2 del 21/10/1990 al 2/3/1991, -3 hasta el 19/10/1991,
// -2 hasta el 29/2/1992, -3 hasta el 17/10/1992 y -2 hasta el 6/3/1993.
// Las correcciones de abajo calzan con esos instantes.

const FUENTE_SHN = 'Servicio de Hidrografia Naval, tabla de la hora oficial argentina: https://www.hidro.gov.ar/observatorio/LaHora.asp?op=3';
const FUENTE_WIKI = 'https://es.wikipedia.org/wiki/Hora_oficial_argentina';

export const CORRECCIONES = [
    {
        // tzdata mete ocho provincias en America/Argentina/Cordoba y les
        // da UTC-4 del 3/3/1991 al 20/10/1991. Ninguna de las fuentes que
        // pudimos consultar sostiene ese -4 para esas provincias:
        //
        // - La hora oficial argentina fue -3 todo ese periodo, sin
        //   distincion por provincia (Servicio de Hidrografia Naval, que
        //   es quien lleva y difunde la hora legal).
        // - El propio southamerica de tzdata dice que sus datos hasta 1992
        //   salen de Shanks & Pottenger, y anota, "which we haven't
        //   verified", que Formosa, Misiones y Chaco pasaron a -3 entre
        //   diciembre de 1990 y enero de 1991, y que Santiago del Estero
        //   estuvo en -4 solo del 1 al 26 de abril de 1991. Es decir: la
        //   misma fuente dice que al menos cuatro de las ocho no
        //   compartieron ese -4.
        // - El atlas de ACS (el mismo Shanks), consultado con Solar Fire,
        //   da -3 para Parana (Entre Rios), Cordoba, Santa Fe, Misiones,
        //   Corrientes, Chaco, Formosa y Santiago del Estero el 1/6/1991,
        //   mientras da -4 para Jujuy el 30/6/1991. O sea que distingue
        //   entre esas provincias y las que si estuvieron en -4.
        //
        // Y el mismo -4 esta en las lineas de Salta, Tucuman y Catamarca,
        // identicas a las de Cordoba para este tramo: es un solo dato de
        // Shanks aplicado en paralelo a cuatro zonas. El atlas de ACS da
        // -3 el 11/6/1991 en Salta, Tucuman, Catamarca y Chubut.
        //
        // Ojo con el alcance: la zona Salta tambien cubre La Pampa,
        // Neuquen y Rio Negro, y la zona Catamarca cubre Chubut.
        //
        // Lo que si esta documentado (Mendoza por su ley 5566, las
        // provincias del oeste en 2004, San Luis en 2008-09, y las once
        // exceptuadas por el decreto 1705/2008) se deja como esta tzdata.
        zonas: [
            'America/Argentina/Cordoba',
            'America/Argentina/Salta',
            'America/Argentina/Tucuman',
            'America/Argentina/Catamarca'
        ],
        codigo: 1,
        desde: utc(1991, 3, 3, 2),
        hasta: utc(1991, 10, 20, 4),
        periodos: [[utc(1991, 3, 3, 2), -3 * H, 0]],
        motivo: 'La hora oficial argentina entre el 3/3/1991 y el 19/10/1991 fue UTC-3.',
        fuentes: [
            FUENTE_SHN,
            FUENTE_WIKI,
            'Atlas de ACS via Solar Fire: Parana 31/3/1991 y 1/6/1991 en UTC-3',
            'Atlas de ACS via Solar Fire: Salta, Tucuman, Catamarca y Chubut el 11/6/1991 en UTC-3',
            'tzdata southamerica: las lineas de Cordoba, Salta, Tucuman y Catamarca son identicas para este tramo'
        ]
    },
    {
        // Cordoba tampoco adhirio al horario de verano. La zona cubre ocho
        // provincias (Cordoba, Santa Fe, Entre Rios, Corrientes, Misiones,
        // Chaco, Formosa y Santiago del Estero), asi que hubo que mirar si
        // iban todas juntas. El atlas de ACS da, el 11 de diciembre:
        //
        //           88   89   90   91   92
        //   Cordoba           -3   -3   -3
        //   Parana    -2   -2   -2   -3   -3
        //
        // En el verano 91-92 y en el 92-93 las dos coinciden en -3, asi que
        // la zona va corregida: es lo que se corrige aca. En el 90-91 se
        // separaron (Cordoba no adhirio y Entre Rios si), y ahi la zona
        // queda como esta tzdata, en el -2 nacional, que es lo que dice la
        // lectura de Parana y lo que vale para las seis provincias que no
        // pudimos consultar. Para Cordoba, en ese verano, queda un aviso
        // en pantalla (ver time/avisos.js).
        //
        // La lectura de Parana del 92-93 contradice a Wikipedia, que pone a
        // Entre Rios entre las siete provincias que adhirieron ese verano.
        // Pesa mas la lectura, que es por provincia y por fecha.
        // Las cuatro zonas van juntas: tzdata hacia empezar el verano en
        // todas a las 0 h del 20/10 con el -4 que suponia, o sea 4 h UTC.
        zonas: [
            'America/Argentina/Cordoba',
            'America/Argentina/Salta',
            'America/Argentina/Tucuman',
            'America/Argentina/Catamarca'
        ],
        codigo: 2,
        desde: utc(1991, 10, 20, 4),
        hasta: utc(1992, 3, 1, 2),
        periodos: [[utc(1991, 10, 20, 4), -3 * H, 0]],
        motivo: 'Estas zonas no adhirieron al horario de verano 1991-92.',
        fuentes: [
            FUENTE_SHN, FUENTE_WIKI,
            'Atlas de ACS via Solar Fire: Cordoba, Parana, Salta, Tucuman, Catamarca y Chubut, 11/12/1991 en UTC-3'
        ]
    },
    {
        // La Rioja volvio a la hora oficial el 18/5/1991 y no el 7/5, que
        // es lo que tiene tzdata (y lo que efectivamente hizo San Juan, ya
        // comprobado). Once dias mas de -4.
        //
        // Va sin codigo: no hace falta un aviso propio, porque ese -4 es
        // distinto de la hora oficial argentina y el aviso de horario
        // provincial ya salta solo (ver esProvincial en time/tz.js).
        zonas: ['America/Argentina/La_Rioja'],
        codigo: 0,
        desde: utc(1991, 5, 7, 4),
        hasta: utc(1991, 5, 18, 4),
        periodos: [
            [utc(1991, 5, 7, 4), -4 * H, 0],
            // El 18/5 a las 0 h segun el reloj que regia (-4).
            [utc(1991, 5, 18, 4), -3 * H, 0]
        ],
        motivo: 'La Rioja estuvo en UTC-4 hasta el 18/5/1991, no hasta el 7/5.',
        fuentes: [
            FUENTE_SHN,
            'Atlas de ACS via Solar Fire: La Rioja vuelve a -3 el 18/5/1991; San Juan, el 7/5'
        ]
    },
    {
        // Los veranos. Aca pasa lo contrario que arriba: la hora oficial
        // nacional adelantaba a -2 y estas provincias se quedaban en -3.
        // tzdata les aplica el horario de verano nacional a todas; el
        // atlas de ACS, consultado con Solar Fire, las da en -3 el
        // 11/12/1990, el 11/12/1991 y el 11/12/1992.
        //
        // Wikipedia respalda el cuadro general (para el verano 91-92
        // nombra reacias a Tucuman, La Rioja, La Pampa y Rio Negro, entre
        // otras, y dice que en el 92-93 la mayoria no adhirio), aunque se
        // contradice al listar a Tucuman y Catamarca entre las adherentes
        // del 92-93. Pesa mas la lectura por provincia y por fecha, que es
        // coherente en los tres veranos, y el precedente de las mismas
        // provincias en 2004 y en el decreto 1705/2008.
        zonas: [
            'America/Argentina/Salta',
            'America/Argentina/Tucuman',
            'America/Argentina/Catamarca'
        ],
        codigo: 2,
        desde: utc(1990, 10, 21, 3),
        hasta: utc(1991, 3, 3, 2),
        periodos: [[utc(1990, 10, 21, 3), -3 * H, 0]],
        motivo: 'Salta, Tucuman, Catamarca y Chubut no adhirieron al horario de verano 1990-91.',
        fuentes: [FUENTE_SHN, FUENTE_WIKI, 'Atlas de ACS via Solar Fire: 11/12/1990 en UTC-3']
    },
    {
        // La Rioja se queda en -3 los tres veranos, pero conserva el -4
        // del 1/3 al 7/5/1991: esa ventana es corta y con fechas propias
        // (igual que Santiago del Estero, -4 solo del 1 al 26 de abril),
        // tiene pinta de decreto provincial real y no hay ninguna lectura
        // adentro que la contradiga. Por eso el verano 90-91 se corta el
        // 1/3 y no el 3/3.
        zonas: ['America/Argentina/La_Rioja'],
        codigo: 2,
        desde: utc(1990, 10, 21, 3),
        hasta: utc(1991, 3, 1, 2),
        periodos: [[utc(1990, 10, 21, 3), -3 * H, 0]],
        motivo: 'La Rioja no adhirio al horario de verano 1990-91.',
        fuentes: [FUENTE_SHN, FUENTE_WIKI, 'Atlas de ACS via Solar Fire: 11/12/1990 en UTC-3']
    },
    {
        // San Juan si adhirio en el 90-91 (el atlas la da en -2 el
        // 11/12/1990), asi que entra recien desde el verano siguiente.
        zonas: ['America/Argentina/La_Rioja', 'America/Argentina/San_Juan'],
        codigo: 2,
        desde: utc(1991, 10, 20, 3),
        hasta: utc(1992, 3, 1, 2),
        periodos: [[utc(1991, 10, 20, 3), -3 * H, 0]],
        motivo: 'La Rioja y San Juan no adhirieron al horario de verano 1991-92.',
        fuentes: [FUENTE_SHN, FUENTE_WIKI, 'Atlas de ACS via Solar Fire: 11/12/1991 en UTC-3']
    },
    {
        // El ultimo verano con horario de verano hasta 2007. Wikipedia
        // dice que la mayoria de las provincias no adhirio.
        //
        // Jujuy entra: la primera lectura del 11/12/1992 se contradecia a
        // si misma (la sigla decia BZ2D, que es la del horario de verano,
        // y el offset decia -3), asi que no la usamos. Releida, da BZT2
        // -3: la sigla de invierno y el offset coinciden. Contradice la
        // lista de adherentes de Wikipedia, que incluye a Jujuy, pero esa
        // lista no esta citada y la provincia ya se habia autoexcluido del
        // horario de verano en 2008 para seguir a Salta.
        // Cordoba entra con las demas: el atlas da -3 el 11/12/1992 tanto
        // en Cordoba como en Parana, las dos puntas de la zona que pudimos
        // consultar. Contradice la lista de adherentes de Wikipedia, que
        // incluye a Entre Rios, pero esa lista no esta citada por
        // provincia y las lecturas si son por provincia y por fecha.
        zonas: [
            'America/Argentina/Salta',
            'America/Argentina/Tucuman',
            'America/Argentina/Catamarca',
            'America/Argentina/La_Rioja',
            'America/Argentina/San_Juan',
            'America/Argentina/Jujuy',
            'America/Argentina/Cordoba'
        ],
        codigo: 2,
        desde: utc(1992, 10, 18, 3),
        hasta: utc(1993, 3, 7, 2),
        periodos: [[utc(1992, 10, 18, 3), -3 * H, 0]],
        motivo: 'Estas provincias no adhirieron al horario de verano 1992-93.',
        fuentes: [
            FUENTE_SHN, FUENTE_WIKI,
            'Atlas de ACS via Solar Fire: 11/12/1992 en UTC-3 (Jujuy releida, BZT2 -3)',
            'Atlas de ACS via Solar Fire: Buenos Aires, Santa Cruz y Tierra del Fuego si adhirieron (BZ2D -2 el 11/12 de 1990, 1991 y 1992)'
        ]
    }
];

// Las correcciones que le tocan a una zona. Hay que mirar tambien la zona
// real: el generador emite un archivo por alias (America/Rosario sale de
// America/Argentina/Cordoba), y si solo buscaramos por el nombre pedido
// los alias saldrian sin corregir.
const mias = (zona, real) =>
    CORRECCIONES.filter((c) => c.zonas.includes(zona) || (real && c.zonas.includes(real)));

// Los periodos de una zona con las correcciones aplicadas. Sin
// correcciones para esa zona, devuelve los mismos periodos.
export function corregir(zona, periodos, real) {
    const cs = mias(zona, real);
    if (!cs.length) return periodos;
    let out = periodos;
    for (const c of cs) {
        out = [
            ...out.filter((p) => p[0] < c.desde || p[0] >= c.hasta),
            // Cada periodo lleva el codigo de su correccion, y con codigo 0
            // no lleva nada: ese tramo no necesita un aviso propio.
            ...c.periodos.map((p) => (c.codigo ? [...p, c.codigo] : [...p]))
        ].sort((a, b) => a[0] - b[0]);
    }
    // Une periodos consecutivos con el mismo huso, como hace el generador.
    // La marca cuenta como parte del periodo: dos tramos con el mismo huso
    // pero distinta marca no se unen, porque si no el aviso de la carta se
    // perderia o se derramaria a fechas que no corregimos.
    return out.filter((p, i) => i === 0
        || p[1] !== out[i - 1][1] || p[2] !== out[i - 1][2] || (p[3] || 0) !== (out[i - 1][3] || 0));
}

// Los tramos corregidos de una zona, donde no tiene sentido comparar con
// Intl (que usa tzdata tal cual).
export const tramosCorregidos = (zona, real) =>
    mias(zona, real).map((c) => [c.desde, c.hasta]);

export const estaCorregido = (zona, seg, real) =>
    tramosCorregidos(zona, real).some(([a, b]) => seg >= a && seg < b);
