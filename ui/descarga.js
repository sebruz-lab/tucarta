// Imagen de la carta para descargar o compartir: un PNG de 1080x1350 con
// el titulo, los datos, la rueda y la firma. Se arma en el navegador.
//
// La rueda toma sus colores del CSS de la pagina, que no viaja con el SVG:
// antes de convertirla se copian los estilos ya calculados a cada elemento
// y se incrusta la fuente.

const ANCHO = 1080;
const ALTO = 1350;
const PROPIEDADES = [
    'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
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
async function svgAutonomo(svg, ancho, alto = ancho) {
    const copia = svg.cloneNode(true);
    const originales = [svg, ...svg.querySelectorAll('*')];
    const copias = [copia, ...copia.querySelectorAll('*')];
    originales.forEach((el, i) => {
        const cs = getComputedStyle(el);
        const estilo = PROPIEDADES.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
        copias[i].setAttribute('style', estilo);
    });
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', ancho);
    copia.setAttribute('height', alto);
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
// anexo: el <svg> de las referencias (planetas, signos, grilla de aspectos),
// si se eligieron: va debajo de la rueda y la imagen se alarga.
export async function imagenCarta(svg, { titulo, datos, colores, anexo = null }) {
    const lado = 940;
    const img = await cargarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await svgAutonomo(svg, lado)));
    let imgAnexo = null;
    let altoAnexo = 0;
    if (anexo) {
        const [, , vw, vh] = anexo.getAttribute('viewBox').split(' ').map(Number);
        altoAnexo = Math.round(lado * vh / vw);
        imgAnexo = await cargarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await svgAutonomo(anexo, lado, altoAnexo)));
    }
    const alto = ALTO + (imgAnexo ? altoAnexo + 30 : 0);
    await document.fonts.load('300 40px Outfit');

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colores.fondo;
    ctx.fillRect(0, 0, ANCHO, alto);
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
    if (imgAnexo) ctx.drawImage(imgAnexo, (ANCHO - lado) / 2, 228 + lado + 20, lado, altoAnexo);

    ctx.fillStyle = colores.suave;
    ctx.font = '300 26px Outfit, sans-serif';
    ctx.fillText('sebabru.com/cartas', ANCHO / 2, alto - 40);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Imagen de las efemerides graficas: apaisada, con el titulo, el periodo
// y el grafico a lo ancho.
export async function imagenEfemerides(svg, { titulo, datos, colores }) {
    const [, , vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    const ancho = 2400;
    const w = ancho - 120;
    const h = Math.round(w * vh / vw);
    const alto = h + 260;
    const img = await cargarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await svgAutonomo(svg, w, h)));
    await document.fonts.load('300 40px Outfit');
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colores.fondo;
    ctx.fillRect(0, 0, ancho, alto);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = colores.texto;
    ctx.font = '300 52px Outfit, sans-serif';
    ctx.fillText(titulo, 60, 96);
    ctx.fillStyle = colores.suave;
    ctx.font = '300 30px Outfit, sans-serif';
    ctx.fillText(datos, 60, 146);
    ctx.drawImage(img, 60, 190, w, h);
    ctx.textAlign = 'right';
    ctx.font = '300 26px Outfit, sans-serif';
    ctx.fillText('sebabru.com/cartas', ancho - 60, alto - 30);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// La imagen lleva "sebabru.com/cartas" impreso, pero el texto impreso no se
// toca: quien recibia la carta por WhatsApp no tenia nada para apretar. Asi
// que el compartir va ademas con el enlace, y con utm para poder medir si las
// cartas compartidas traen gente (lo lee /origen.js en el sitio).
export const ENLACE_COMPARTIR = 'https://sebabru.com/cartas/?utm_source=compartir&utm_medium=imagen';
const INVITACION = 'Calcula tu carta natal gratis:';

// Abre el menu de compartir del sistema con la imagen, el texto y el enlace.
//
// Son dos acciones separadas y dos botones separados a proposito. Antes habia
// un solo boton que decia "Descargar imagen" y en el celular abria el menu de
// compartir: decia una cosa y hacia otra, y encima no habia forma de probarlo
// desde una computadora.
//
// Devuelve 'compartida', 'cancelada', 'enlace-copiado' o 'sin-soporte'.
export async function compartirImagen(blob, nombreArchivo, titulo) {
    const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
    if (navigator.canShare) {
        // Primero con el enlace. Si la plataforma no acepta archivo + texto +
        // url juntos, se comparte solo la imagen: nunca menos que antes.
        const intentos = [
            { files: [archivo], title: titulo, text: INVITACION, url: ENLACE_COMPARTIR },
            { files: [archivo], title: titulo }
        ];
        for (const envio of intentos) {
            if (!navigator.canShare(envio)) continue;
            try {
                await navigator.share(envio);
                return 'compartida';
            } catch (e) {
                if (e.name === 'AbortError') return 'cancelada';
                // Otro error: se prueba el envio mas simple.
            }
        }
    }
    // Sin menu de compartir (Firefox y Safari de escritorio no comparten
    // archivos): al menos que se lleve el enlace.
    try {
        await navigator.clipboard.writeText(`${INVITACION} ${ENLACE_COMPARTIR}`);
        return 'enlace-copiado';
    } catch {
        return 'sin-soporte';
    }
}

// Descarga el archivo. Siempre descarga: el boton dice eso.
export async function entregarImagen(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'descargada';
}
