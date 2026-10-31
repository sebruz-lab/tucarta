// Eventos de GA4 con el gtag del sitio. Nunca se mandan fecha, hora ni
// lugar de nacimiento: solo datos de uso.

export function evento(nombre, params = {}) {
    try {
        if (typeof window.gtag === 'function') window.gtag('event', nombre, params);
    } catch {}
}
