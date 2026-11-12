// Panel de ajustes: sistema de casas, orbes por punto y aspectos a los
// angulos. Se guarda en el dispositivo (localStorage).

import { SISTEMAS_CASAS, AJUSTES_POR_DEFECTO, ORBES_POR_DEFECTO, ORBES_MENORES, ORBES_TRANSITO, ORBES_SINASTRIA,
    ASPECTOS, ASPECTOS_POR_DEFECTO, ASPECTOS_TRANSITO_POR_DEFECTO, ORBES_ASPECTO, FACTORES_POR_DEFECTO,
    PUNTOS, PUNTOS_OPCIONALES, PUNTOS_ACTIVOS_POR_DEFECTO, PUNTOS_ASPECTADOS_POR_DEFECTO,
    enLaCarta } from '../engine/config.js';
import { NOMBRE_PUNTO, NOMBRE_ASPECTO } from './textos.js';
import { PUNTOS as G_PUNTOS, iconoSvg } from './glyphs.js';
import { METODOS_PROGRESION } from '../engine/progressions.js';

const CLAVE = 'tucarta:ajustes';

const distinto = (tabla, guardada) =>
    Object.entries(tabla).some(([k, v]) => guardada?.[k] !== undefined && guardada[k] !== v);

const tocoLosOrbes = (g) =>
    distinto(ORBES_POR_DEFECTO, g.orbes) || distinto(ORBES_MENORES, g.orbesMenores);

export function leerAjustes() {
    try {
        const g = JSON.parse(localStorage.getItem(CLAVE));
        if (g) return {
            ...AJUSTES_POR_DEFECTO, ...g,
            orbes: { ...ORBES_POR_DEFECTO, ...g.orbes },
            // Los ajustes guardados antes de que se pudieran apagar los
            // aspectos mayores solo nombran a los menores: de ahi sale la
            // lista entera.
            aspectos: { ...ASPECTOS_POR_DEFECTO, ...g.menores, ...g.aspectos },
            aspectosTransito: { ...ASPECTOS_TRANSITO_POR_DEFECTO, ...g.menores, ...g.aspectosTransito },
            orbesAspecto: { ...ORBES_ASPECTO, ...g.orbesAspecto },
            factores: { ...FACTORES_POR_DEFECTO, ...g.factores },
            // Quien ya habia tocado sus orbes por punto se queda con ese
            // modo: su carta no cambia sola. El resto estrena el nuevo.
            modoOrbes: g.modoOrbes || (tocoLosOrbes(g) ? 'punto' : 'factor'),
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
    a.modoOrbes !== AJUSTES_POR_DEFECTO.modoOrbes ||
    Object.entries(ORBES_POR_DEFECTO).some(([k, v]) => a.orbes[k] !== v) ||
    Object.entries(ORBES_MENORES).some(([k, v]) => a.orbesMenores[k] !== v) ||
    Object.entries(ASPECTOS_POR_DEFECTO).some(([k, v]) => a.aspectos[k] !== v) ||
    Object.entries(ASPECTOS_TRANSITO_POR_DEFECTO).some(([k, v]) => a.aspectosTransito[k] !== v) ||
    Object.entries(ORBES_ASPECTO).some(([k, v]) => a.orbesAspecto[k] !== v) ||
    Object.entries(FACTORES_POR_DEFECTO).some(([k, v]) => a.factores[k] !== v) ||
    Object.entries(ORBES_TRANSITO).some(([k, v]) => a.orbesTransito[k] !== v) ||
    Object.entries(ORBES_SINASTRIA).some(([k, v]) => a.orbesSinastria[k] !== v);

const NOMBRE_ORBE_TRANSITO = {
    conjuncion: 'Conjunción', oposicion: 'Oposición', trigono: 'Trígono',
    cuadratura: 'Cuadratura', sextil: 'Sextil', menor: 'Aspectos menores'
};

export function panelAjustes(a) {
    const campo = (nombre, valor, etiqueta) =>
        `<span class="valor"><input type="number" name="${nombre}" min="0" max="15" step="0.5" inputmode="decimal" value="${valor}" aria-label="${etiqueta}">°</span>`;
    // El factor se escribe como porcentaje (80), que se lee mejor que 0,8.
    const campoFactor = (nombre, valor, etiqueta) =>
        `<span class="valor"><input type="number" name="${nombre}" min="0" max="200" step="5" inputmode="numeric" value="${Math.round((valor ?? 0) * 100)}" aria-label="${etiqueta}">%</span>`;
    const orbes = Object.keys(ORBES_POR_DEFECTO).filter((id) => id !== 'sol' && id !== 'luna').map((id) => `
        <div class="orbe">
            <span>${NOMBRE_PUNTO[id]}</span>
            ${campo('orbe-' + id, a.orbes[id], `Orbe mayor de ${NOMBRE_PUNTO[id]}`)}
            ${campo('orbe-menor-' + id, a.orbesMenores[id], `Orbe menor de ${NOMBRE_PUNTO[id]}`)}
        </div>`).join('');

    // Los que pueden aspectar: los puntos que esten en la carta y los dos
    // angulos. El que esta apagado no aparece aca.
    const aspectables = [
        ...[...PUNTOS, ...PUNTOS_OPCIONALES].filter((x) => enLaCarta(a, x.id)).map((x) => x.id),
        'asc', 'mc'
    ];
    const aspecta = (id) => (a.puntosAspectados?.[id] !== false);
    // Un aspecto mayor va salvo que lo apaguen; un menor, solo si lo
    // prenden. Es lo mismo que mira el motor.
    const activo = (id) => (ASPECTOS.find((x) => x.id === id)?.menor
        ? Boolean(a.aspectos?.[id]) : a.aspectos?.[id] !== false);
    const porFactor = a.modoOrbes !== 'punto';
    const enTransito = (id) => (ASPECTOS.find((x) => x.id === id)?.menor
        ? Boolean(a.aspectosTransito?.[id]) : a.aspectosTransito?.[id] !== false);
    // El Sol y la Luna no entran en la tabla de abajo: su orbe es el del
    // aspecto, que es justamente lo que dice la lista de arriba.
    const elResto = aspectables.filter((id) => id !== 'sol' && id !== 'luna');
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
            <summary>Puntos de la carta</summary>
            <p class="nota">Cualquier punto se puede sacar del gráfico, incluso el Sol.</p>
            <div class="atajos">
                <button type="button" class="boton-texto" data-marcar="punto:siempre">Puntos más frecuentes</button>
                <button type="button" class="boton-texto" data-marcar="punto:todos">Todos</button>
                <button type="button" class="boton-texto" data-marcar="punto:ninguno">Ninguno</button>
                <button type="button" class="boton-texto" data-marcar="punto:asteroides">Solo asteroides</button>
            </div>
            <div class="grilla-puntos">${PUNTOS.map((o) =>
                casilla('punto-' + o.id, o.id, enLaCarta(a, o.id), NOMBRE_PUNTO[o.id] || o.nombre)).join('')}
            </div>
            <p class="rotulo-puntos">Otros puntos</p>
            <div class="grilla-puntos">${PUNTOS_OPCIONALES.map((o) =>
                casilla('punto-' + o.id, o.id, enLaCarta(a, o.id), o.nombre)).join('')}
            </div>
            <label class="casilla"><input type="checkbox" name="fortuna-nocturna" ${a.fortunaNocturna !== false ? 'checked' : ''}>
                Parte de Fortuna: dar vuelta la fórmula en las cartas nocturnas</label>
        </details>

        <details class="desplegable-ajustes" id="ajustes-aspectos">
            <summary>Aspectos</summary>

            <details class="desplegable-ajustes anidado" id="ajustes-cuales">
                <summary>Aspectos y orbes</summary>
                <p class="rotulo-puntos primero">Orbes para las luminarias</p>
                ${atajos('aspecto')}
                <div class="grilla-orbes">${ASPECTOS.map((x) => `
                    <div class="orbe simple ${activo(x.id) ? '' : 'apagado'}">
                        <label class="menor"><input type="checkbox" name="aspecto-${x.id}" ${activo(x.id) ? 'checked' : ''}>
                            <span>${NOMBRE_ASPECTO[x.id]}</span></label>
                        ${campo('orbe-asp-' + x.id, a.orbesAspecto[x.id], `Orbe de ${NOMBRE_ASPECTO[x.id]}`)}
                    </div>`).join('')}
                </div>
                <p class="rotulo-puntos">El resto de los puntos</p>
                <label class="campo">Cómo se determina
                    <select name="modo-orbes">
                        <option value="factor" ${porFactor ? 'selected' : ''}>Un porcentaje de estos orbes</option>
                        <option value="punto" ${porFactor ? '' : 'selected'}>Lo elijo a mano</option>
                    </select>
                </label>
                ${porFactor ? `
                <p class="nota">Cada punto se lleva el porcentaje que diga esta tabla; entre dos puntos manda el más grande.</p>
                <div class="grilla-orbes">${elResto.map((id) => `
                    <div class="orbe simple">
                        <span>${NOMBRE_PUNTO[id]}</span>
                        ${campoFactor('factor-' + id, a.factores[id], `Porcentaje del orbe de ${NOMBRE_PUNTO[id]}`)}
                    </div>`).join('')}
                </div>` : `
                <p class="nota">Un orbe para los aspectos mayores y otro para los menores. Entre dos puntos
                    se usa el mayor de los dos.</p>
                <div class="grilla-orbes">
                    <div class="orbe encabezado"><span></span><span class="valor">Mayores</span><span class="valor">Menores</span></div>
                    ${orbes}
                </div>`}
            </details>

            <details class="desplegable-ajustes anidado" id="ajustes-aspectados">
                <summary>Puntos aspectados</summary>
                ${atajos('aspecta')}
                <div class="grilla-puntos">${aspectables.map((id) =>
                    casilla('aspecta-' + id, id, aspecta(id), NOMBRE_PUNTO[id])).join('')}
                </div>
            </details>

            <details class="desplegable-ajustes anidado" id="ajustes-orbes">
                <summary>Tránsitos y sinastría</summary>
                <label class="campo">En la rueda doble se dibujan
                    <select name="grafica-transitos">
                        <option value="transito" ${a.graficaTransitos === 'natal' ? '' : 'selected'}>Los aspectos del tránsito a la carta</option>
                        <option value="natal" ${a.graficaTransitos === 'natal' ? 'selected' : ''}>Los aspectos de la carta</option>
                    </select>
                </label>
                <p class="rotulo-puntos">Qué aspectos se miran en los tránsitos</p>
                ${atajos('tr')}
                <div class="grilla-orbes">${ASPECTOS.map((x) => `
                    <div class="orbe simple ${enTransito(x.id) ? '' : 'apagado'}">
                        <label class="menor"><input type="checkbox" name="tr-${x.id}" ${enTransito(x.id) ? 'checked' : ''}>
                            <span>${NOMBRE_ASPECTO[x.id]}</span></label>
                    </div>`).join('')}
                </div>
                <p class="nota">Quién recibe los tránsitos sale de <em>Puntos aspectados</em>: si el Ascendente
                    no está prendido ahí, tampoco se le marcan tránsitos.</p>
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
    // El campo puede no estar en pantalla: cada modo de orbe muestra su
    // tabla y esconde la otra. Lo que no esta, no se toca.
    const leer = (nombre) => parseFloat((form.elements[nombre]?.value ?? '').replace(',', '.'));
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
    // Que aspectos se miran y, si el orbe sale del aspecto, cuanto mide
    // cada uno.
    const aspectos = { ...previos.aspectos };
    const orbesAspecto = { ...previos.orbesAspecto };
    for (const x of ASPECTOS) {
        const c = form.elements['aspecto-' + x.id];
        if (c) aspectos[x.id] = c.checked;
        const v = leer('orbe-asp-' + x.id);
        if (valido(v)) orbesAspecto[x.id] = v;
    }
    // El factor se escribe en porcentaje y se guarda como fraccion.
    const factores = { ...previos.factores };
    for (const id of Object.keys(FACTORES_POR_DEFECTO)) {
        const v = leer('factor-' + id);
        if (Number.isFinite(v) && v >= 0 && v <= 200) factores[id] = v / 100;
    }
    const modoOrbes = form.elements['modo-orbes']?.value === 'punto' ? 'punto' : 'factor';
    // Los aspectos de los transitos van aparte de los de la carta.
    const aspectosTransito = { ...previos.aspectosTransito };
    for (const x of ASPECTOS) {
        const c = form.elements['tr-' + x.id];
        if (c) aspectosTransito[x.id] = c.checked;
    }
    const graficaTransitos = form.elements['grafica-transitos']?.value === 'natal' ? 'natal' : 'transito';
    // Todos los puntos, los de siempre incluidos: cualquiera se puede
    // apagar. Lo que no este en pantalla conserva lo que tenia.
    const puntos = { ...previos.puntos };
    for (const o of [...PUNTOS, ...PUNTOS_OPCIONALES]) {
        const c = form.elements['punto-' + o.id];
        if (c) puntos[o.id] = Boolean(c.checked);
    }
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
        aspectos, aspectosTransito, graficaTransitos, modoOrbes, orbesAspecto, factores,
        orbes, orbesMenores, orbesTransito, orbesSinastria
    };
}
