// Web Worker del calculo: carga Swiss Ephemeris (WASM) una sola vez y
// calcula cartas sin trabar la interfaz.

import { cargarSwe } from '../engine/ephe.js';
import { calcularCarta } from '../engine/chart.js';
import { calcularTransitos } from '../engine/transits.js';
import { calendarioTransitos } from '../engine/calendar.js';
import { calcularRevolucion } from '../engine/solarReturn.js';
import { calcularProgresion } from '../engine/progressions.js';
import { efemeridesGraficas } from '../engine/efemerides.js';
import { calcularDraconica } from '../engine/draconica.js';
import { calcularCompuesta } from '../engine/composite.js';
import { calcularLunacion } from '../engine/lunaciones.js';
import { PUNTOS_OPCIONALES } from '../engine/config.js';

const swe = cargarSwe(() =>
    fetch(import.meta.env.BASE_URL + 'ephe/seas_18.se1').then((r) => {
        if (!r.ok) throw new Error('No se pudo bajar la efeméride de Quirón');
        return r.arrayBuffer();
    }));

// Los puntos que traen su propia efemeride (Sedna, Eris) se bajan la
// primera vez que alguien los prende, no en la precarga. Si falla la
// bajada se sigue igual: chart.js saltea el punto que no puede calcular.
async function asegurarEfemerides(motor, ajustes) {
    const elegidos = ajustes?.puntos;
    if (!elegidos) return;
    for (const p of PUNTOS_OPCIONALES) {
        if (!p.archivo || !elegidos[p.id] || motor.tiene(p.archivo)) continue;
        try {
            const r = await fetch(import.meta.env.BASE_URL + 'ephe/' + p.archivo);
            if (!r.ok) throw new Error(r.status);
            motor.montar(p.archivo, await r.arrayBuffer());
        } catch (e) {
            console.error('No se pudo bajar la efeméride de ' + p.nombre, e);
        }
    }
}

self.onmessage = async ({ data }) => {
    const { id, pedido } = data;
    try {
        const calculos = { transitos: calcularTransitos, calendario: calendarioTransitos, revolucion: calcularRevolucion, progresion: calcularProgresion, efemerides: efemeridesGraficas, draconica: calcularDraconica, compuesta: calcularCompuesta, lunacion: calcularLunacion };
        const motor = await swe;
        await asegurarEfemerides(motor, pedido.ajustes);
        const carta = (calculos[pedido.tipo] || calcularCarta)(motor, pedido);
        self.postMessage({ id, carta });
    } catch (e) {
        self.postMessage({ id, error: e.message });
    }
};
