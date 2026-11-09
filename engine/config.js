// Configuracion por defecto de la carta. Todo lo que el panel de ajustes
// deja cambiar sale de aca; el motor nunca tiene valores escondidos.

// Puntos calculados. `swe` es el numero de cuerpo de Swiss Ephemeris
// (SE_SUN = 0 ... SE_PLUTO = 9, SE_MEAN_APOG = 12, SE_TRUE_NODE = 11,
// SE_CHIRON = 15).
export const PUNTOS = [
    { id: 'sol',      nombre: 'Sol',        swe: 0,  grupo: 'luminar' },
    { id: 'luna',     nombre: 'Luna',       swe: 1,  grupo: 'luminar' },
    { id: 'mercurio', nombre: 'Mercurio',   swe: 2,  grupo: 'personal' },
    { id: 'venus',    nombre: 'Venus',      swe: 3,  grupo: 'personal' },
    { id: 'marte',    nombre: 'Marte',      swe: 4,  grupo: 'personal' },
    { id: 'jupiter',  nombre: 'Júpiter',    swe: 5,  grupo: 'personal' },
    { id: 'saturno',  nombre: 'Saturno',    swe: 6,  grupo: 'personal' },
    { id: 'urano',    nombre: 'Urano',      swe: 7,  grupo: 'transpersonal' },
    { id: 'neptuno',  nombre: 'Neptuno',    swe: 8,  grupo: 'transpersonal' },
    { id: 'pluton',   nombre: 'Plutón',     swe: 9,  grupo: 'transpersonal' },
    { id: 'nodo',     nombre: 'Nodo Norte', swe: 11, grupo: 'transpersonal' },
    { id: 'lilith',   nombre: 'Lilith',     swe: 12, grupo: 'transpersonal' },
    { id: 'quiron',   nombre: 'Quirón',     swe: 15, grupo: 'transpersonal' }
];

// Puntos que la persona puede sumar desde los ajustes. Ninguno viene
// prendido. `swe` es el cuerpo de Swiss Ephemeris; los que no lo tienen se
// calculan a partir de otros (el Nodo Sur es el Norte mas 180, la Tierra es
// el punto opuesto al Sol, y la Parte de Fortuna sale del Ascendente, el
// Sol y la Luna).
//
// Ceres, Palas, Juno y Vesta salen de seas_18.se1, el archivo que ya viaja
// por Quiron. Sedna y Eris necesitan el suyo, que se baja al prenderlas.
export const PUNTOS_OPCIONALES = [
    { id: 'ceres',   nombre: 'Ceres',  swe: 17, grupo: 'asteroide' },
    { id: 'palas',   nombre: 'Palas',  swe: 18, grupo: 'asteroide' },
    { id: 'juno',    nombre: 'Juno',   swe: 19, grupo: 'asteroide' },
    { id: 'vesta',   nombre: 'Vesta',  swe: 20, grupo: 'asteroide' },
    { id: 'sedna',   nombre: 'Sedna',  swe: 10000 + 90377,  archivo: 'se90377.se1', grupo: 'lejano' },
    { id: 'eris',    nombre: 'Eris',   swe: 10000 + 136199, archivo: 's136199.se1', grupo: 'lejano' },
    { id: 'nodosur', nombre: 'Nodo Sur',          calculado: true, grupo: 'punto' },
    { id: 'tierra',  nombre: 'Tierra',            calculado: true, grupo: 'punto' },
    { id: 'fortuna', nombre: 'Parte de Fortuna',  calculado: true, grupo: 'punto' }
];

// Ninguno viene prendido: la carta sale como siempre hasta que se elijan.
export const PUNTOS_ACTIVOS_POR_DEFECTO =
    Object.fromEntries(PUNTOS_OPCIONALES.map((p) => [p.id, false]));

export const ANGULOS = [
    { id: 'asc', nombre: 'Ascendente' },
    { id: 'mc',  nombre: 'Medio Cielo' }
];

// Codigos de sistema de casas de swe_houses (caracter ASCII).
export const SISTEMAS_CASAS = [
    { id: 'P', nombre: 'Placidus' },
    { id: 'K', nombre: 'Koch' },
    { id: 'E', nombre: 'Iguales' },
    { id: 'W', nombre: 'Enteras' },
    { id: 'R', nombre: 'Regiomontanus' },
    { id: 'C', nombre: 'Campanus' },
    { id: 'O', nombre: 'Porfirio' }
];

// Orbe segun los puntos: ORBES_POR_DEFECTO para los mayores, ORBES_MENORES
// para los menores. Los menores se pueden activar o no.
export const ASPECTOS = [
    { id: 'conjuncion',       nombre: 'Conjunción',       angulo: 0 },
    { id: 'semisextil',       nombre: 'Semisextil',       angulo: 30,  menor: true },
    { id: 'semicuadratura',   nombre: 'Semicuadratura',   angulo: 45,  menor: true },
    { id: 'sextil',           nombre: 'Sextil',           angulo: 60 },
    { id: 'cuadratura',       nombre: 'Cuadratura',       angulo: 90 },
    { id: 'trigono',          nombre: 'Trígono',          angulo: 120 },
    { id: 'sesquicuadratura', nombre: 'Sesquicuadratura', angulo: 135, menor: true },
    { id: 'quincuncio',       nombre: 'Quincuncio',       angulo: 150, menor: true },
    { id: 'oposicion',        nombre: 'Oposición',        angulo: 180 }
];

// Menores activos por defecto: semisextil y quincuncio.
export const MENORES_POR_DEFECTO = {
    semisextil: true, quincuncio: true, semicuadratura: false, sesquicuadratura: false
};

// Orbe por punto. Entre dos puntos se usa el mayor de los dos.
export const ORBES_POR_DEFECTO = {
    sol: 9, luna: 9,
    mercurio: 7, venus: 7, marte: 7, jupiter: 7, saturno: 7,
    urano: 5, neptuno: 5, pluton: 5, quiron: 5, nodo: 5, lilith: 5,
    asc: 5, mc: 5,
    // Los opcionales entran con orbe chico: son puntos finos.
    ceres: 3, palas: 3, juno: 3, vesta: 3, sedna: 3, eris: 3,
    nodosur: 5, tierra: 5, fortuna: 3
};

// Lo mismo para los aspectos menores.
export const ORBES_MENORES = {
    sol: 7, luna: 7,
    mercurio: 5, venus: 5, marte: 5, jupiter: 5, saturno: 5,
    urano: 3, neptuno: 3, pluton: 3, quiron: 3, nodo: 3, lilith: 3,
    asc: 3, mc: 3,
    ceres: 2, palas: 2, juno: 2, vesta: 2, sedna: 2, eris: 2,
    nodosur: 3, tierra: 3, fortuna: 2
};

// Transitos: transitan todos los puntos de la carta, con orbe por
// aspecto y no por punto. Los menores activos son los mismos de la natal.
export const PUNTOS_TRANSITO = PUNTOS.map((p) => p.id);
export const ORBES_TRANSITO = {
    conjuncion: 3, oposicion: 3, trigono: 2, cuadratura: 2, sextil: 2, menor: 1
};

// Sinastria: los aspectos entre las dos cartas, tambien con orbe por
// aspecto. Mas amplios que los de transito, porque aca se cruzan dos
// cartas enteras y no un cielo de paso.
export const ORBES_SINASTRIA = {
    conjuncion: 7, oposicion: 7, trigono: 5, cuadratura: 5, sextil: 4, menor: 2
};

// Que puntos entran en el juego de aspectos. Todos, salvo el Ascendente y
// el Medio Cielo, que muchos prefieren no aspectar.
export const PUNTOS_ASPECTADOS_POR_DEFECTO = {
    ...Object.fromEntries(PUNTOS.map((p) => [p.id, true])),
    ...Object.fromEntries(PUNTOS_OPCIONALES.map((p) => [p.id, true])),
    asc: false, mc: false
};

export const AJUSTES_POR_DEFECTO = {
    casas: 'P',
    orbes: ORBES_POR_DEFECTO,
    aspectosAngulos: false,
    menores: MENORES_POR_DEFECTO,
    orbesMenores: ORBES_MENORES,
    orbesTransito: ORBES_TRANSITO,
    orbesSinastria: ORBES_SINASTRIA,
    metodoProgresion: 'arco-long',
    nodoDraconica: 'real',
    // Que puntos opcionales se suman a la carta.
    puntos: PUNTOS_ACTIVOS_POR_DEFECTO,
    // La Parte de Fortuna cambia de formula entre el dia y la noche.
    fortunaNocturna: true,
    // Que puntos participan de los aspectos.
    puntosAspectados: PUNTOS_ASPECTADOS_POR_DEFECTO
};
