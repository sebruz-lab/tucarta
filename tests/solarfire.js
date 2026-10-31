// Lectura de posiciones con el formato que imprime Solar Fire:
// "21Pi47", "21°Pi47'", "21 Pis 47" o "21°47' Piscis", con segundos opcionales
// ("21Pi47'12\""). Tambien acepta un numero (longitud decimal).

const ABREV = {
    ar: 0, ari: 0, aries: 0,
    ta: 1, tau: 1, tauro: 1,
    ge: 2, gem: 2, geminis: 2,
    cn: 3, can: 3, cancer: 3,
    le: 4, leo: 4,
    vi: 5, vir: 5, virgo: 5,
    li: 6, lib: 6, libra: 6,
    sc: 7, sco: 7, esc: 7, escorpio: 7,
    sg: 8, sag: 8, sagitario: 8,
    cp: 9, cap: 9, capricornio: 9,
    aq: 10, aqu: 10, acu: 10, acuario: 10,
    pi: 11, pis: 11, piscis: 11
};

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function parsearPosicion(pos) {
    if (typeof pos === 'number') return pos;
    const s = sinTildes(pos);
    let m = s.match(/^(\d+)\D*?([a-z]+)\D*?(\d+)(?:\D+(\d+))?/); // 21Pi47'12"
    let grado, signo, minuto, segundo;
    if (m) {
        [, grado, signo, minuto, segundo] = m;
    } else {
        m = s.match(/^(\d+)\D+(\d+)(?:\D+(\d+))?\D*?([a-z]+)/); // 21°47' Piscis
        if (!m) throw new Error('Posición ilegible: ' + pos);
        [, grado, minuto, segundo, signo] = m;
    }
    const n = ABREV[signo];
    if (n === undefined) throw new Error('Signo desconocido en: ' + pos);
    return n * 30 + +grado + +minuto / 60 + (+segundo || 0) / 3600;
}

// Diferencia en minutos de arco, por el camino corto.
export function diferenciaMinutos(a, b) {
    const d = Math.abs(a - b) % 360;
    return (d > 180 ? 360 - d : d) * 60;
}
