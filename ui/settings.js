// Panel de ajustes: sistema de casas, orbes por punto y aspectos a los
// angulos. Se guarda en el dispositivo (localStorage).

import { SISTEMAS_CASAS, AJUSTES_POR_DEFECTO, ORBES_POR_DEFECTO, ORBES_MENORES, MENORES_POR_DEFECTO, ORBES_TRANSITO, ORBES_SINASTRIA,
    PUNTOS, PUNTOS_OPCIONALES, PUNTOS_ACTIVOS_POR_DEFECTO, PUNTOS_ASPECTADOS_POR_DEFECTO } from '../engine/config.js';
import { NOMBRE_PUNTO, NOMBRE_ASPECTO } from './textos.js';
import { PUNTOS as G_PUNTOS, iconoSvg } from './glyphs.js';
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
            orbesTransito: { ...ORBES_TRANSITO, ...g.orbesTransito },
            orbesSinastria: { ...ORBES_SINASTRIA, ...g.orbesSinastria },
            puntos: { ...PUNTOS_ACTIVOS_POR_DEFECTO, ...g.puntos },
            puntosAspectados: { ...PUNTOS_ASPECTADOS_POR_DEFECTO, ...g.puntosAspectados }
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
    Object.entries(ORBES_TRANSITO).some(([k, v]) => a.orbesTransito[k] !== v) ||
    Object.entries(ORBES_SINASTRIA).some(([k, v]) => a.orbesSinastria[k] !== v);

const NOMBRE_ORBE_TRANSITO = {
    conjuncion: 'Conjunción', oposicion: 'Oposición', trigono: 'Trígono',
    cuadratura: 'Cuadratura', sextil: 'Sextil', menor: 'Aspectos menores'
};

export function panelAjustes(a) {
    const campo = (nombre, valor, etiqueta) =>
        `<span class="valor"><input type="number" name="${nombre}" min="0" max="15" step="0.5" inputmode="decimal" value="${valor}" aria-label="${etiqueta}">°</span>`;
    const orbes = Object.keys(ORBES_POR_DEFECTO).map((id) => `
        <div class="orbe">
            <span>${NOMBRE_PUNTO[id]}</span>
            ${campo('orbe-' + id, a.orbes[id], `Orbe mayor de ${NOMBRE_PUNTO[id]}`)}
            ${campo('orbe-menor-' + id, a.orbesMenores[id], `Orbe menor de ${NOMBRE_PUNTO[id]}`)}
        </div>`).join('');

    // Los que pueden aspectar: los de siempre, los opcionales que esten
    // prendidos, y los dos angulos.
    const aspectables = [
        ...PUNTOS.map((x) => x.id),
        ...PUNTOS_OPCIONALES.filter((x) => a.puntos?.[x.id]).map((x) => x.id),
        'asc', 'mc'
    ];
    const aspecta = (id) => (a.puntosAspectados?.[id] !== false);
    const casilla = (nombre, id, marcada, texto) => `
        <label class="punto-opcional">
            <input type="checkbox" name="${nombre}" ${marcada ? 'checked' : ''}>
            <span class="glifo-opcional" data-punto="${id}">${G_PUNTOS[id] ? iconoSvg(G_PUNTOS[id], 18, texto) : ''}</span>
            <span>${texto}</span>
        </label>`;
    const atajos = (que) => `
        <div class="atajos">
            <button type="button" class="boton-texto" data-marcar="${que}:todos">Todos</button>
            <button type="button" class="boton-texto" data-marcar="${que}:ninguno">Ninguno</button>
        </div>`;

    return `
        <div class="campo campo-tema">
            <span>Fondo</span>
            <div class="selector-tema" role="group" aria-label="Fondo">
                <button type="button" data-tema="oscuro" aria-pressed="false">Oscuro</button>
                <button type="button" data-tema="claro" aria-pressed="true">Claro</button>
            </div>
        </div>

        <details class="desplegable-ajustes" id="ajustes-casas">
            <summary>Sistema de casas</summary>
            <label class="campo">Cómo se dividen las casas
                <select name="casas">${SISTEMAS_CASAS.map((x) =>
                    `<option value="${x.id}" ${x.id === a.casas ? 'selected' : ''}>${x.nombre}</option>`).join('')}</select>
            </label>
        </details>

        <details class="desplegable-ajustes" id="ajustes-puntos">
            <summary>Otros puntos</summary>
            <div class="atajos">
                <button type="button" class="boton-texto" data-marcar="punto:todos">Todos</button>
                <button type="button" class="boton-texto" data-marcar="punto:ninguno">Ninguno</button>
                <button type="button" class="boton-texto" data-marcar="punto:asteroides">Solo asteroides</button>
            </div>
            <div class="grilla-puntos">${PUNTOS_OPCIONALES.map((o) =>
                casilla('punto-' + o.id, o.id, a.puntos?.[o.id], o.nombre)).join('')}
            </div>
            <label class="casilla"><input type="checkbox" name="fortuna-nocturna" ${a.fortunaNocturna !== false ? 'checked' : ''}>
                Parte de Fortuna: dar vuelta la fórmula en las cartas nocturnas</label>
        </details>

        <details class="desplegable-ajustes" id="ajustes-aspectos">
            <summary>Aspectos</summary>

            <details class="desplegable-ajustes anidado" id="ajustes-cuales">
                <summary>Aspectos a considerar</summary>
                <p class="nota">La conjunción, el sextil, la cuadratura, el trígono y la oposición van siempre.</p>
                ${atajos('menor')}
                <div class="grilla-menores">${Object.keys(MENORES_POR_DEFECTO).map((id) => `
                    <label class="menor">
                        <input type="checkbox" name="menor-${id}" ${a.menores[id] ? 'checked' : ''}>
                        <span>${NOMBRE_ASPECTO[id]}</span>
                    </label>`).join('')}
                </div>
            </details>

            <details class="desplegable-ajustes anidado" id="ajustes-aspectados">
                <summary>Puntos aspectados</summary>
                ${atajos('aspecta')}
                <div class="grilla-puntos">${aspectables.map((id) =>
                    casilla('aspecta-' + id, id, aspecta(id), NOMBRE_PUNTO[id])).join('')}
                </div>
            </details>

            <details class="desplegable-ajustes anidado" id="ajustes-orbes">
                <summary>Orbes</summary>
                <p class="nota">Entre dos puntos se usa el orbe mayor de los dos.</p>
                <div class="grilla-orbes">
                    <div class="orbe encabezado"><span></span><span class="valor">Mayores</span><span class="valor">Menores</span></div>
                    ${orbes}
                </div>
                <p class="nota">En los tránsitos el orbe depende del aspecto, no del punto.</p>
                <div class="grilla-orbes">${Object.keys(ORBES_TRANSITO).map((id) => `
                    <div class="orbe">
                        <span>${NOMBRE_ORBE_TRANSITO[id]}</span>
                        ${campo('orbe-tr-' + id, a.orbesTransito[id], `Orbe de tránsito: ${NOMBRE_ORBE_TRANSITO[id]}`)}
                    </div>`).join('')}
                </div>
                <p class="nota">En la sinastría, los aspectos entre las dos cartas.</p>
                <div class="grilla-orbes">${Object.keys(ORBES_SINASTRIA).map((id) => `
                    <div class="orbe">
                        <span>${NOMBRE_ORBE_TRANSITO[id]}</span>
                        ${campo('orbe-sin-' + id, a.orbesSinastria[id], `Orbe de sinastría: ${NOMBRE_ORBE_TRANSITO[id]}`)}
                    </div>`).join('')}
                </div>
            </details>
        </details>

        <details class="desplegable-ajustes" id="ajustes-otras">
            <summary>Progresiones y dracónica</summary>
            <label class="campo">Progresiones: cómo avanzan el Ascendente y el Medio Cielo
                <select name="metodo-progresion">${METODOS_PROGRESION.map((m) =>
                    `<option value="${m.id}" ${m.id === a.metodoProgresion ? 'selected' : ''}>${m.nombre}</option>`).join('')}</select>
            </label>
            <label class="campo">Carta dracónica: desde qué Nodo
                <select name="nodo-draconica">
                    <option value="real" ${a.nodoDraconica !== 'medio' ? 'selected' : ''}>Nodo real</option>
                    <option value="medio" ${a.nodoDraconica === 'medio' ? 'selected' : ''}>Nodo medio</option>
                </select>
            </label>
        </details>

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
    const orbesSinastria = { ...previos.orbesSinastria };
    for (const id of Object.keys(ORBES_SINASTRIA)) {
        const v = leer('orbe-sin-' + id);
        if (valido(v)) orbesSinastria[id] = v;
    }
    const menores = {};
    for (const id of Object.keys(MENORES_POR_DEFECTO)) menores[id] = form.elements['menor-' + id].checked;
    const puntos = {};
    for (const o of PUNTOS_OPCIONALES) puntos[o.id] = Boolean(form.elements['punto-' + o.id]?.checked);
    // Los aspectados: solo los que estan en pantalla; los opcionales
    // apagados no aparecen y conservan lo que tenian.
    const puntosAspectados = { ...previos.puntosAspectados };
    for (const id of Object.keys(PUNTOS_ASPECTADOS_POR_DEFECTO)) {
        const c = form.elements['aspecta-' + id];
        if (c) puntosAspectados[id] = c.checked;
    }
    return {
        puntos,
        puntosAspectados,
        fortunaNocturna: Boolean(form.elements['fortuna-nocturna']?.checked),
        casas: form.elements.casas.value,
        metodoProgresion: form.elements['metodo-progresion'].value,
        nodoDraconica: form.elements['nodo-draconica'].value,
        aspectosAngulos: Boolean(puntosAspectados.asc || puntosAspectados.mc),
        orbes, menores, orbesMenores, orbesTransito, orbesSinastria
    };
}
