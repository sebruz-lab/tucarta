// Web Worker del calculo: carga Swiss Ephemeris (WASM) una sola vez y
// calcula cartas sin trabar la interfaz.

import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularTransitos } from '../engine/transits.js';
import { calendarioTransitos } from '../engine/calendar.js';
import { calcularRevolucion } from '../engine/solarReturn.js';
import { calcularProgresion } from '../engine/progressions.js';

const swe = cargarSwe(() =>
    fetch(import.meta.env.BASE_URL + 'ephe/seas_18.se1').then((r) => {
        if (!r.ok) throw new Error('No se pudo bajar la efeméride de Quirón');
        return r.arrayBuffer();
    }));

self.onmessage = async ({ data }) => {
    const { id, pedido } = data;
    try {
        const calculos = { transitos: calcularTransitos, calendario: calendarioTransitos, revolucion: calcularRevolucion, progresion: calcularProgresion };
        const carta = (calculos[pedido.tipo] || calcularCarta)(await swe, pedido);
        self.postMessage({ id, carta });
    } catch (e) {
        self.postMessage({ id, error: e.message });
    }
};
