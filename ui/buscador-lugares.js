// Buscador de lugares para otras paginas del sitio (por ejemplo, los
// formularios de inscripcion): el mismo de la calculadora, con su lista de
// sugerencias. Se publica sin hash en /cartas/buscador-lugares.js; quien lo
// use lo importa con ?v=<version> para no quedar con uno viejo en cache.
export { conectarBuscador, descripcionLugar } from './form.js';
