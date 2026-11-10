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
//   1 = usamos la hora oficial argentina donde IANA estima otro huso.
//   2 = esa provincia no adhirio al horario de verano nacional.
//
// Son casos opuestos y conviene no confundirlos: en el 1 IANA se aparta
// de la hora legal nacional, y en el 2 la que se aparta es la provincia.

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
        // Lo que si esta documentado (Mendoza por su ley 5566, las
        // provincias del oeste en 2004, San Luis en 2008-09, y las once
        // exceptuadas por el decreto 1705/2008) se deja como esta tzdata.
        zonas: ['America/Argentina/Cordoba'],
        codigo: 1,
        desde: utc(1991, 3, 3, 2),
        hasta: utc(1991, 10, 20, 4),
        periodos: [
            [utc(1991, 3, 3, 2), -3 * H, 0],
            // El verano arranca a las 0 h del 20/10 segun el reloj que
            // regia (-3), no segun el -4 que suponia tzdata.
            [utc(1991, 10, 20, 3), -2 * H, H]
        ],
        motivo: 'La hora oficial argentina entre el 3/3/1991 y el 19/10/1991 fue UTC-3.',
        fuentes: [
            FUENTE_SHN,
            FUENTE_WIKI,
            'Atlas de ACS via Solar Fire: Parana 31/3/1991 y 1/6/1991 en UTC-3'
        ]
    },
    {
        // El mismo bloque, las otras tres zonas. En el fuente de tzdata
        // (southamerica) las lineas de Cordoba, Salta, Tucuman y Catamarca
        // son identicas para este tramo: un solo dato de Shanks aplicado
        // en paralelo a cuatro zonas. Corregimos una y quedaban tres con
        // el mismo -4 que ya sabiamos malo.
        //
        // El atlas de ACS, consultado con Solar Fire, da -3 el 11/6/1991
        // en Salta, Tucuman, Catamarca y Chubut.
        //
        // Ojo con el alcance: la zona Salta tambien cubre La Pampa,
        // Neuquen y Rio Negro, y la zona Catamarca cubre Chubut. Corregir
        // la zona las mueve a todas.
        zonas: [
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
            'Atlas de ACS via Solar Fire: Salta, Tucuman, Catamarca y Chubut el 11/6/1991 en UTC-3',
            'tzdata southamerica: las lineas de Cordoba, Salta, Tucuman y Catamarca son identicas para este tramo'
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
        zonas: [
            'America/Argentina/Salta',
            'America/Argentina/Tucuman',
            'America/Argentina/Catamarca'
        ],
        codigo: 2,
        // El tramo arranca donde tzdata hacia empezar el verano en estas
        // zonas (0 h del 20/10 con el -4 que suponia, o sea 4 h UTC).
        desde: utc(1991, 10, 20, 4),
        hasta: utc(1992, 3, 1, 2),
        periodos: [[utc(1991, 10, 20, 4), -3 * H, 0]],
        motivo: 'Salta, Tucuman, Catamarca y Chubut no adhirieron al horario de verano 1991-92.',
        fuentes: [FUENTE_SHN, FUENTE_WIKI, 'Atlas de ACS via Solar Fire: 11/12/1991 en UTC-3']
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
        // Jujuy queda afuera a proposito: su lectura del 11/12/1992 se
        // contradice a si misma (la sigla que muestra Solar Fire, BZ2D, es
        // la del horario de verano, -2, y el offset dice -3) y choca con
        // la unica lista de adherentes que tenemos, que la incluye. Una
        // lectura que se contradice no es testimonio de ningun reloj:
        // queda pendiente volver a mirarla.
        zonas: [
            'America/Argentina/Salta',
            'America/Argentina/Tucuman',
            'America/Argentina/Catamarca',
            'America/Argentina/La_Rioja',
            'America/Argentina/San_Juan'
        ],
        codigo: 2,
        desde: utc(1992, 10, 18, 3),
        hasta: utc(1993, 3, 7, 2),
        periodos: [[utc(1992, 10, 18, 3), -3 * H, 0]],
        motivo: 'Estas provincias no adhirieron al horario de verano 1992-93.',
        fuentes: [FUENTE_SHN, FUENTE_WIKI, 'Atlas de ACS via Solar Fire: 11/12/1992 en UTC-3']
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
            ...c.periodos.map((p) => [...p, c.codigo])
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
