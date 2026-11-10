// Correcciones a la base IANA, declaradas una por una y con su fuente.
//
// La regla de la casa es seguir tzdata y no tocar nada: es la mejor base
// que hay y se revisa sola. Se corrige solo donde la propia tzdata avisa
// que su dato no esta verificado Y hay fuentes mejores que la contradicen.
// Cada correccion dice que reemplaza, por que, y con que se comprobo.
//
// Formato de cada periodo, igual que en ui/public/husos/: [desde (UTC en
// segundos), offset total, cuanto de eso es horario de verano]. Los
// periodos que pone una correccion llevan un cuarto campo en 1: con eso la
// carta avisa que ahi usamos la hora oficial argentina y no la de IANA.

const utc = (a, m, d, h) => Date.UTC(a, m - 1, d, h) / 1000;
const H = 3600;

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
            'Servicio de Hidrografia Naval, tabla de la hora oficial argentina: https://www.hidro.gov.ar/observatorio/LaHora.asp?op=3',
            'https://es.wikipedia.org/wiki/Hora_oficial_argentina',
            'Atlas de ACS via Solar Fire: Parana 31/3/1991 y 1/6/1991 en UTC-3'
        ]
    }
];

// Los periodos de una zona con las correcciones aplicadas. Sin
// correcciones para esa zona, devuelve los mismos periodos.
export function corregir(zona, periodos) {
    const mias = CORRECCIONES.filter((c) => c.zonas.includes(zona));
    if (!mias.length) return periodos;
    let out = periodos;
    for (const c of mias) {
        out = [
            ...out.filter((p) => p[0] < c.desde || p[0] >= c.hasta),
            ...c.periodos.map((p) => [...p, 1])
        ].sort((a, b) => a[0] - b[0]);
    }
    // Une periodos consecutivos con el mismo huso, como hace el generador.
    // Si el primero de los dos viene de una correccion, la marca queda.
    return out.filter((p, i) => i === 0 || p[1] !== out[i - 1][1] || p[2] !== out[i - 1][2]);
}

// Los tramos corregidos de una zona, donde no tiene sentido comparar con
// Intl (que usa tzdata tal cual).
export const tramosCorregidos = (zona) =>
    CORRECCIONES.filter((c) => c.zonas.includes(zona)).map((c) => [c.desde, c.hasta]);

export const estaCorregido = (zona, seg) =>
    tramosCorregidos(zona).some(([a, b]) => seg >= a && seg < b);
