import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// La app vive en sebabru.com/cartas: el build sale con esa base y
// nombres con hash, porque el sitio cachea JS y CSS 30 dias. El buscador
// de lugares para otras paginas del sitio sale sin hash (buscador-lugares.js).
export default defineConfig({
    root: 'ui',
    base: '/cartas/',
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
