// Panel de ajustes: sistema de casas, orbes por punto y aspectos a los
// angulos. Se guarda en el dispositivo (localStorage).

import { SISTEMAS_CASAS, AJUSTES_POR_DEFECTO, ORBES_POR_DEFECTO, ORBES_MENORES, MENORES_POR_DEFECTO, ORBES_TRANSITO } from '../engine/config.js';
import { NOMBRE_PUNTO, NOMBRE_ASPECTO } from './textos.js';
import { METODOS_PROGRESION } from '../engine/progressions.js';

const CLAVE = 'tucarta:ajustes';

export function leerAjustes() {
    try {
        const g = JSON.parse(localStorage.getItem(CLAVE));
        if (g) return {
            ...AJUSTES_POR_DEFECTO, ...g,
            orbes: { ...ORBES_POR_DEFECTO, ...g.orbes },
            menores: { ...MENORES_POR_DEFECTO, ...g.menores },
            orbesMenores: { ...ORBES_MENORES, ...g.orbesMenores },
            orbesTransito: { ...ORBES_TRANSITO, ...g.orbesTransito }
        };
    } catch {}
    return structuredClone(AJUSTES_POR_DEFECTO);
}

export function guardarAjustes(a) {
    try { localStorage.setItem(CLAVE, JSON.stringify(a)); } catch {}
}

export const orbesModificados = (a) =>
    Object.entries(ORBES_POR_DEFECTO).some(([k, v]) => a.orbes[k] !== v) ||
    Object.entries(ORBES_MENORES).some(([k, v]) => a.orbesMenores[k] !== v) ||
    Object.entries(MENORES_POR_DEFECTO).some(([k, v]) => a.menores[k] !== v) ||
    Object.entries(ORBES_TRANSITO).some(([k, v]) => a.orbesTransito[k] !== v);

const NOMBRE_ORBE_TRANSITO = {
    conjuncion: 'Conjunción', oposicion: 'Oposición', trigono: 'Trígono',
    cuadratura: 'Cuadratura', sextil: 'Sextil', menor: 'Aspectos menores'
};

export function panelAjustes(a) {
    const campo = (nombre, valor, etiqueta) =>
        `<span class="valor"><input type="number" name="${nombre}" min="0" max="15" step="0.5" inputmode="decimal" value="${valor}" aria-label="${etiqueta}">°</span>`;
    const orbes = Object.keys(ORBES_POR_DEFECTO).map((id) => `
        <div class="orbe ${(id === 'asc' || id === 'mc') && !a.aspectosAngulos ? 'apagado' : ''}">
            <span>${NOMBRE_PUNTO[id]}</span>
            ${campo('orbe-' + id, a.orbes[id], `Orbe mayor de ${NOMBRE_PUNTO[id]}`)}
            ${campo('orbe-menor-' + id, a.orbesMenores[id], `Orbe menor de ${NOMBRE_PUNTO[id]}`)}
        </div>`).join('');
    return `
        <label class="campo">Sistema de casas
            <select name="casas">${SISTEMAS_CASAS.map((s) =>
                `<option value="${s.id}" ${s.id === a.casas ? 'selected' : ''}>${s.nombre}</option>`).join('')}</select>
        </label>
        <label class="campo">Progresiones: cómo avanzan el Ascendente y el Medio Cielo
            <select name="metodo-progresion">${METODOS_PROGRESION.map((m) =>
                `<option value="${m.id}" ${m.id === a.metodoProgresion ? 'selected' : ''}>${m.nombre}</option>`).join('')}</select>
        </label>
        <label class="casilla"><input type="checkbox" name="aspectos-angulos" ${a.aspectosAngulos ? 'checked' : ''}>
            Calcular aspectos al Ascendente y al Medio Cielo</label>
        <fieldset class="orbes"><legend>Aspectos menores</legend>
            <div class="grilla-menores">${Object.keys(MENORES_POR_DEFECTO).map((id) => `
                <label class="menor">
                    <input type="checkbox" name="menor-${id}" ${a.menores[id] ? 'checked' : ''}>
                    <span>${NOMBRE_ASPECTO[id]}</span>
                </label>`).join('')}
            </div>
        </fieldset>
        <fieldset class="orbes"><legend>Orbes</legend>
            <p class="nota">Entre dos puntos se usa el orbe mayor de los dos.</p>
            <div class="grilla-orbes">
                <div class="orbe encabezado"><span></span><span class="valor">Mayores</span><span class="valor">Menores</span></div>
                ${orbes}
            </div>
        </fieldset>
        <fieldset class="orbes"><legend>Orbes de los tránsitos</legend>
            <p class="nota">En los tránsitos el orbe depende del aspecto.</p>
            <div class="grilla-orbes">${Object.keys(ORBES_TRANSITO).map((id) => `
                <div class="orbe">
                    <span>${NOMBRE_ORBE_TRANSITO[id]}</span>
                    ${campo('orbe-tr-' + id, a.orbesTransito[id], `Orbe de tránsito: ${NOMBRE_ORBE_TRANSITO[id]}`)}
                </div>`).join('')}
            </div>
        </fieldset>
        <button type="button" class="boton-texto" data-accion="ajustes-defecto">Volver a los valores por defecto</button>`;
}

// Lee el formulario del panel y devuelve los ajustes nuevos.
export function ajustesDesde(form, previos) {
    const leer = (nombre) => parseFloat(form.elements[nombre].value.replace(',', '.'));
    const valido = (v) => Number.isFinite(v) && v >= 0 && v <= 15;
    const orbes = { ...previos.orbes };
    const orbesMenores = { ...previos.orbesMenores };
    for (const id of Object.keys(ORBES_POR_DEFECTO)) {
        const v = leer('orbe-' + id);
        if (valido(v)) orbes[id] = v;
        const m = leer('orbe-menor-' + id);
        if (valido(m)) orbesMenores[id] = m;
    }
    const orbesTransito = { ...previos.orbesTransito };
    for (const id of Object.keys(ORBES_TRANSITO)) {
        const v = leer('orbe-tr-' + id);
        if (valido(v)) orbesTransito[id] = v;
    }
    const menores = {};
    for (const id of Object.keys(MENORES_POR_DEFECTO)) menores[id] = form.elements['menor-' + id].checked;
    return {
        casas: form.elements.casas.value,
        metodoProgresion: form.elements['metodo-progresion'].value,
        aspectosAngulos: form.elements['aspectos-angulos'].checked,
        orbes, menores, orbesMenores, orbesTransito
    };
}
