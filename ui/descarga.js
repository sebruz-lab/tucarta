// Imagen de la carta para descargar o compartir: un PNG de 1080x1350 con
// el titulo, los datos, la rueda y la firma. Se arma en el navegador.
//
// La rueda toma sus colores del CSS de la pagina, que no viaja con el SVG:
// antes de convertirla se copian los estilos ya calculados a cada elemento
// y se incrusta la fuente.

const ANCHO = 1080;
const ALTO = 1350;
const PROPIEDADES = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
    'opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing',
    'text-anchor', 'dominant-baseline'
];

let fuenteBase64 = null;
async function fuente() {
    if (!fuenteBase64) {
        const datos = await (await fetch(import.meta.env.BASE_URL + 'fonts/outfit-latin.woff2')).arrayBuffer();
        let bin = '';
        new Uint8Array(datos).forEach((b) => { bin += String.fromCharCode(b); });
        fuenteBase64 = btoa(bin);
    }
    return fuenteBase64;
}

// svg: un <svg> ya insertado en la pagina (hace falta para leer sus estilos).
async function svgAutonomo(svg, lado) {
    const copia = svg.cloneNode(true);
    const originales = [svg, ...svg.querySelectorAll('*')];
    const copias = [copia, ...copia.querySelectorAll('*')];
    originales.forEach((el, i) => {
        const cs = getComputedStyle(el);
        const estilo = PROPIEDADES.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
        copias[i].setAttribute('style', estilo);
    });
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', lado);
    copia.setAttribute('height', lado);
    copia.insertAdjacentHTML('afterbegin',
        `<style>@font-face{font-family:'Outfit';font-weight:300 600;src:url(data:font/woff2;base64,${await fuente()}) format('woff2');}</style>`);
    return new XMLSerializer().serializeToString(copia);
}

function cargarImagen(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

// Corta un texto en renglones que entren en `ancho`.
function renglones(ctx, texto, ancho) {
    const res = [];
    let linea = '';
    for (const palabra of texto.split(' ')) {
        const prueba = linea ? linea + ' ' + palabra : palabra;
        if (linea && ctx.measureText(prueba).width > ancho) {
            res.push(linea);
            linea = palabra;
        } else linea = prueba;
    }
    if (linea) res.push(linea);
    return res;
}

// colores: { fondo, texto, suave } de la pagina en el momento de descargar.
export async function imagenCarta(svg, { titulo, datos, colores }) {
    const lado = 940;
    const img = await cargarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await svgAutonomo(svg, lado)));
    await document.fonts.load('300 40px Outfit');

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO;
    canvas.height = ALTO;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colores.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = colores.texto;
    ctx.font = '300 52px Outfit, sans-serif';
    ctx.fillText(titulo, ANCHO / 2, 104);
    ctx.fillStyle = colores.suave;
    ctx.font = '300 28px Outfit, sans-serif';
    renglones(ctx, datos, ANCHO - 120).slice(0, 2).forEach((r, i) => ctx.fillText(r, ANCHO / 2, 152 + i * 38));

    // La rueda dibuja los rotulos AC/MC algo por fuera de su caja.
    ctx.drawImage(img, (ANCHO - lado) / 2, 228, lado, lado);

    ctx.fillStyle = colores.suave;
    ctx.font = '300 26px Outfit, sans-serif';
    ctx.fillText('sebabru.com/tucarta', ANCHO / 2, ALTO - 40);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// En el celular abre el menu de compartir (WhatsApp, galeria...); en la
// compu, o si no se puede compartir, descarga el archivo.
export async function entregarImagen(blob, nombreArchivo, titulo) {
    const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
    const celular = matchMedia('(pointer: coarse)').matches;
    if (celular && navigator.canShare?.({ files: [archivo] })) {
        try {
            await navigator.share({ files: [archivo], title: titulo });
            return 'compartida';
        } catch (e) {
            if (e.name === 'AbortError') return 'cancelada';
        }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'descargada';
}
