// Avisos que no cambian la hora.
//
// tzdata agrupa provincias enteras en una sola zona, y a veces una de
// ellas tuvo una hora distinta del resto. Donde esa provincia no tiene
// zona propia no hay forma de calcularle bien el huso: la zona es un dato
// fijo del lugar y darle una nueva significaria inventar un nombre que no
// existe en IANA, migrar las cartas ya guardadas y parchear el indice de
// lugares, que se genera aparte.
//
// Lo que si se puede es avisar, para que quien nacio ahi corrija el huso a
// mano (queda guardado con la carta). Es un error de una hora, que mueve
// el Ascendente unos 15 grados: mejor que quede dicho y no escondido.
//
// El aviso sale solo en la provincia afectada, no en toda la zona: el
// indice de lugares guarda la provincia de cada lugar y las cartas
// tambien (ver CAMPOS_LUGAR en ui/miscartas.js). Para las otras siete
// provincias de la zona la hora que calculamos es la correcta y no hay
// nada que avisar.
//
// Las dos cosas que harian falta para sacar un aviso de aca: que IANA le
// de zona propia a esa provincia, o que decidamos inventarsela.

const utc = (a, m, d, h) => Date.UTC(a, m - 1, d, h) / 1000;

// Sin acentos ni mayusculas, por si una carta vieja guardo el nombre de
// la provincia de otra manera.
const llano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const AVISOS_DE_ZONA = [
    {
        // Verano 90-91: la zona se parte. El atlas de ACS da Cordoba en -3
        // (no adhirio al horario de verano) y Parana en -2 (si adhirio).
        // La zona queda en el -2 nacional, que es lo que dice la lectura de
        // Parana y el mejor pronostico para las seis provincias que no
        // pudimos consultar: no adherir requeria un acto provincial. Para
        // quien nacio en Cordoba, el aviso.
        zonas: ['America/Argentina/Cordoba', 'America/Cordoba', 'America/Rosario'],
        provincia: 'Córdoba',
        desde: utc(1990, 10, 21, 3),
        hasta: utc(1991, 3, 3, 2),
        texto: 'Acá tenemos que reconocer una falla: ese no era el horario real de los relojes. La base de datos '
            + 'que usamos tiene este error y no lo podemos arreglar, pero sabemos que es una hora menos, porque '
            + 'Córdoba no adhirió al horario de verano de 1990-91. Te pedimos que lo corrijas a mano acá:'
    },
    {
        // La zona Cordoba cubre ocho provincias. Santiago del Estero paso a
        // UTC-4 el 1/4/1991 y volvio a UTC-3 el 28/4 (tzdata, citando a
        // Shanks, dice el 26), mientras el resto de la zona seguia en -3.
        // Los nombres de zona van todos porque el generador emite un
        // archivo por alias y aca no hay de donde sacar la zona real.
        zonas: ['America/Argentina/Cordoba', 'America/Cordoba', 'America/Rosario'],
        provincia: 'Santiago del Estero',
        desde: utc(1991, 4, 1, 3),
        hasta: utc(1991, 4, 28, 4),
        texto: 'Acá tenemos que reconocer una falla: ese no era el horario real de los relojes. La base de datos '
            + 'que usamos tiene este error y no lo podemos arreglar, pero sabemos que el huso de Santiago del '
            + 'Estero era UTC-4 entre el 1 y el 28 de abril de 1991. Te pedimos que lo corrijas a mano acá:'
    }
];

// El aviso que corresponde a esa zona y esa provincia en ese instante, o
// null. Sin provincia (coordenadas cargadas a mano) no se avisa: no hay
// con que saber si el lugar es de la provincia afectada, y el aviso
// nombraria una provincia que puede no ser la suya.
export const avisoDeZona = (zona, utcSeg, provincia) => (provincia
    ? AVISOS_DE_ZONA.find((a) => a.zonas.includes(zona)
        && llano(a.provincia) === llano(provincia)
        && utcSeg >= a.desde && utcSeg < a.hasta) || null
    : null);
