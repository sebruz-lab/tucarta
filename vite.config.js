import { defineConfig } from 'vite';

// La app vive en sebabru.com/tucarta: el build sale con esa base y
// nombres con hash, porque el sitio cachea JS y CSS 30 dias.
export default defineConfig({
    root: 'ui',
    base: '/tucarta/',
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    test: {
        root: '.',
        include: ['tests/**/*.test.js']
    }
});
