// Nombre del archivo de cada zona horaria. Lo usan el generador
// (time/build/zonas.mjs) y el navegador (time/tz.js): tienen que coincidir
// exactamente, por eso vive en un modulo aparte que no importa nada.
//
// Minusculas y guiones. El "+" de las zonas Etc/GMT+N se escribe "mas",
// porque si no Etc/GMT+1 y Etc/GMT-1 caerian en el mismo archivo.
export const archivoDeZona = (zona) =>
    zona.toLowerCase().replace(/\//g, '-').replace(/\+/g, 'mas').replace(/[^a-z0-9_-]/g, '') + '.json';
