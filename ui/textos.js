// Nombres para mostrar y formatos compartidos por la interfaz.

export const NOMBRE_SIGNO = {
    aries: 'Aries', tauro: 'Tauro', geminis: 'Géminis', cancer: 'Cáncer',
    leo: 'Leo', virgo: 'Virgo', libra: 'Libra', escorpio: 'Escorpio',
    sagitario: 'Sagitario', capricornio: 'Capricornio', acuario: 'Acuario', piscis: 'Piscis'
};

export const NOMBRE_PUNTO = {
    sol: 'Sol', luna: 'Luna', mercurio: 'Mercurio', venus: 'Venus', marte: 'Marte',
    jupiter: 'Júpiter', saturno: 'Saturno', urano: 'Urano', neptuno: 'Neptuno',
    pluton: 'Plutón', nodo: 'Nodo Norte', lilith: 'Lilith', quiron: 'Quirón',
    asc: 'Ascendente', mc: 'Medio Cielo'
};

export const NOMBRE_ASPECTO = {
    conjuncion: 'Conjunción', sextil: 'Sextil', cuadratura: 'Cuadratura',
    trigono: 'Trígono', oposicion: 'Oposición', semisextil: 'Semisextil',
    quincuncio: 'Quincuncio', semicuadratura: 'Semicuadratura', sesquicuadratura: 'Sesquicuadratura'
};

export const gradoMin = (p) => `${p.grado}°${String(p.minuto).padStart(2, '0')}'`;

export function orbeTexto(orbe) {
    const g = Math.floor(orbe + 1e-9);
    const m = Math.floor((orbe - g) * 60 + 1e-9);
    return `${g}°${String(m).padStart(2, '0')}'`;
}

// -34.65, 'N', 'S' -> "34°39'S"
export function coordTexto(v, positivo, negativo) {
    const a = Math.abs(v);
    let g = Math.floor(a);
    let m = Math.round((a - g) * 60);
    if (m === 60) { g += 1; m = 0; }
    return `${g}°${String(m).padStart(2, '0')}'${v < 0 ? negativo : positivo}`;
}

// -10800 -> "UTC−3"; 19800 -> "UTC+5:30"
export function utcTexto(seg) {
    const signo = seg < 0 ? '−' : '+';
    const a = Math.abs(seg);
    const h = Math.floor(a / 3600);
    const m = Math.round((a % 3600) / 60);
    return `UTC${signo}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

export function duracionTexto(seg) {
    if (seg % 3600 === 0) return `${seg / 3600} h`;
    return `${Math.round(seg / 60)} min`;
}

export const escapar = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
