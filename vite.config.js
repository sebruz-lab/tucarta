import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

// La app vive en sebabru.com/cartas: el build sale con esa base y
// nombres con hash, porque el sitio cachea JS y CSS 30 dias. El buscador
// de lugares para otras paginas del sitio sale sin hash (buscador-lugares.js).
export default defineConfig({
    root: 'ui',
    base: '/cartas/',
    plugins: [
        // La app anda sin internet: el calculo ya era local (Swiss Ephemeris
        // compilado a WASM), asi que solo faltaba guardar los archivos.
        //
        // Se precarga la app entera (unos 2 MB con el motor, las efemerides y
        // las fuentes) pero NO el indice de lugares: son 6.751 archivos y 33 MB,
        // y meterlos en el precache haria el service worker gigante y la primera
        // visita eterna. Los lugares quedan guardados a medida que se usan, y
        // hay un boton para bajarlos todos de una.
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['ephe/seas_18.se1', 'fonts/*.woff2'],
            manifest: {
                name: 'Calculadora de Cartas Astrales · Seba Bru',
                short_name: 'Cartas',
                description: 'Cartas natales, revoluciones solares, tránsitos y progresiones.',
                // `id` fija la identidad de la app instalada: sin esto, cambiar
                // `start_url` alguna vez la haria pasar por otra app distinta.
                id: '/cartas/',
                start_url: '/cartas/',
                scope: '/cartas/',
                display: 'standalone',
                background_color: '#f6f9f6',
                theme_color: '#f6f9f6',
                lang: 'es',
                icons: [
                    { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'icono-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                // El WASM y las efemerides son el motor: sin eso no calcula nada.
                globPatterns: ['**/*.{js,css,html,woff2,wasm,se1,png,svg}'],
                // Sedna y Eris traen su propia efemeride: no van en la
                // precarga, se bajan recien cuando alguien las prende.
                globIgnores: ['lugares/**', 'husos/**', 'ephe/se90377.se1', 'ephe/s136199.se1'],
                // El .wasm pasa los 2 MB que Workbox permite por defecto.
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                navigateFallback: '/cartas/index.html',
                runtimeCaching: [
                    {
                        // Los fragmentos del indice: una vez bajados no cambian
                        // hasta la proxima version, asi que se sirven del disco.
                        urlPattern: ({ url }) => url.pathname.startsWith('/cartas/lugares/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'lugares',
                            expiration: { maxEntries: 8000, maxAgeSeconds: 180 * 24 * 60 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Las efemerides de Sedna y Eris: una vez bajadas no
                        // cambian, y quedan guardadas para andar sin internet.
                        urlPattern: ({ url }) => url.pathname.startsWith('/cartas/ephe/') || url.pathname.startsWith('/cartas/husos/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'efemerides',
                            expiration: { maxEntries: 700, maxAgeSeconds: 365 * 24 * 60 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Los textos de las interpretaciones: los sirve el
                        // sitio, fuera de /cartas/ (ver interpretaciones.js).
                        // Estan fuera del precache, asi que si hay internet se
                        // piden de nuevo y si no vale lo ultimo que se leyo.
                        urlPattern: ({ url }) => url.pathname.startsWith('/textos/'),
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'textos',
                            networkTimeoutSeconds: 5,
                            expiration: { maxEntries: 60, maxAgeSeconds: 90 * 24 * 60 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // La config (links de consulta) y las cartas
                        // guardadas: si hay internet se piden de nuevo, y si
                        // no, vale lo ultimo que se vio.
                        urlPattern: ({ url }) => url.hostname === 'firestore.googleapis.com',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'firestore',
                            networkTimeoutSeconds: 5,
                            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
            devOptions: { enabled: false },
        }),
    ],
    // Los textos de las interpretaciones viven en el sitio, no en este repo.
    // En desarrollo se piden al sitio publicado para poder verlos de verdad;
    // en produccion es el mismo dominio y no hay proxy ninguno.
    server: {
        proxy: {
            '/textos/': { target: 'https://sebabru.com', changeOrigin: true },
        },
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'ui/index.html'),
                'buscador-lugares': resolve(__dirname, 'ui/buscador-lugares.js')
            },
            preserveEntrySignatures: 'exports-only',
            output: {
                entryFileNames: (c) => (c.name === 'buscador-lugares' ? '[name].js' : 'assets/[name]-[hash].js')
            }
        }
    },
    test: {
        root: '.',
        include: ['tests/**/*.test.js']
    }
});
