# Pendientes

Lo que Seba pidió y todavía no está hecho. Se van tachando a medida que salen.

## Husos horarios

- Mendoza y San Luis el 11/6 de 1990, 1991 y 1992, para confirmar la ley 5566.
- Las seis provincias de la zona Córdoba sin consultar (Santa Fe, Santiago del
  Estero, Chaco, Corrientes, Formosa y Misiones) en el verano 90-91: es el único
  tramo que quedó resuelto por pronóstico y no por lectura.
- La respuesta de IANA al primer mail, con el borrador listo en
  `notas/mail-iana-argentina-2.txt`.

## El anillo de afuera de la revolución

Dos cosas que quedaron distintas del resto de las ruedas, porque ahí no entra:

- La R de retrógrado va al lado de los minutos y no como una fila más de la
  columna (`COLUMNA_EXTERNA` no tiene `retroPaso`): una fila más le pegaría a
  los números de casa.
- Para subirle el anillo de casas hubo que juntar sus columnas de 64 a 58 de
  profundidad. Si alguna vez hay que darle más aire, el límite es el borde de
  la carta de adentro, en 182,3.

---

# Lo que salió en v1.20.0 (2026-11-13)

Publicado y verificado por contenido en sebabru.com/cartas. Va de v1.19.1 a
v1.20.0 y no a v1.19.2 porque además de los arreglos entran dos cosas nuevas:
la suscripción por mail y poder instalar la calculadora.

El orden salió bien: los 36 textos ya estaban servidos desde el sitio, después
`functions:suscribir` con el origen `cartas`, y la calculadora al final.

## Compartir y descargar son dos botones

El botón decía "Descargar imagen" y en el celular abría el menú de compartir
del sistema: decía una cosa y hacía otra, y desde una computadora no había
manera de probarlo. Ahora son dos botones separados, los dos siempre visibles,
en la barra de la carta y en la de las efemérides.

El compartir va con el enlace, no solo con la imagen: quien recibía la carta
por WhatsApp no tenía nada para apretar. Lleva
`?utm_source=compartir&utm_medium=imagen`, que lo lee `origen.js` del sitio, así
que ahora se puede medir si las cartas compartidas traen gente. Donde el sistema
no comparte archivos (Firefox y Safari de escritorio) copia el enlace al
portapapeles.

El evento de GA4 sigue llamándose `imagen_descargada` para no cortar la serie
histórica; el parámetro `modo` distingue descargar de compartir.

## Los textos los sirve el sitio, no Firestore

`ui/interpretaciones.js` reemplaza a `textosInterpretacion` de `firestore.js`:
los 36 textos se piden a `sebabru.com/textos/<id>.json`, un archivo por texto,
generados por `paginas-textos.js` desde la misma colección `tucarta_textos`.

El motivo: la lectura de Firestore era pública y la clave web viaja en el
bundle, así que cualquiera podía clonar `/cartas` en otro dominio y seguir
mostrando los textos de Seba. Pedidos al sitio eso se corta sin candado
ninguno, porque un fetch desde otro dominio lo bloquea la política de mismo
origen. No esconde nada (el texto completo está en las 36 páginas del sitio),
pero la copia queda sin los textos.

De paso baja lo que se descarga: tres archivos de ~2,7 KB en vez de un
`batchGet` a `firestore.googleapis.com`, y en desarrollo un proxy de Vite los
trae del sitio publicado.

**Orden de publicación: primero el sitio, después la calculadora.** Si sale al
revés, la calculadora pide textos que todavía no existen y muestra el aviso de
próximamente.

## Suscripción por mail, y afuera Telegram

La sección de comunidad ofrecía WhatsApp y Telegram y no había forma de
anotarse al mailing, que desde el 2026-11-12 es el canal principal. Ahora el
formulario de mail está adentro de la calculadora (`ui/suscribirse.js`) y
Telegram salió; WhatsApp queda como segunda opción.

`ui/suscribirse.js` es un **port de `public/suscribirse.js`** del repo del
sitio: si cambia uno, mirar el otro. Lo único duplicado es la presentación. El
captcha desde el primer envío, la trampa para bots, la detección de tipeos y la
revisión de los MX del dominio viven todos en `exports.suscribir`, del lado del
servidor. A diferencia del original, los estilos usan los tokens del tema
(`ui/tucarta.css`) porque acá el fondo puede ser claro u oscuro.

A quien ya dijo que sí en su cuenta no se le vuelve a preguntar, y a quien entró
pero no dijo nada se le ahorra tipear el mail: `estadoDeNovedades` y
`avisarmeDeLaCuenta` en `ui/panelCuenta.js`.

**Hace falta que `functions` esté deployado con el origen `cartas`** en
`ORIGENES_SUSCRIPCION` (ya commiteado en el repo del sitio). Sin eso el alta
funciona igual, pero entra como `otro` y se pierde de dónde salió.

Ojo al probar en local: `localhost:4174` no está en `ALLOWED_ORIGINS` de la
función, así que el envío falla por CORS. El formulario se prueba publicado.

## Instalar la calculadora

Era una PWA completa desde la v1.14.0 pero no había una sola línea que invitara
a instalarla ni que explicara cómo. `ui/instalar.js` agrega una sección al pie
con el botón nativo (cuando el navegador lo da) y el paso a mano del dispositivo
de quien está mirando, con los otros tres atrás de un detalle. El botón de
guardar los lugares se mudó ahí, que es donde tiene sentido.

**En Safari de iPhone el botón no existe**, por más que la página lo quiera: ahí
va el paso a mano (Compartir → Agregar a inicio) y nada más. En Firefox de
escritorio tampoco se promete una instalación que no existe.

El aviso **no sale en frío** (decisión de Seba): hacen falta dos señales, la
primera carta y después otra carta, compartir o guardar. Se muestra una sola
vez y si lo cierran no vuelve. En el modo `#hoja=` (el PDF que sale por mail) no
se monta nada de esto.

El manifest llevó `id: '/cartas/'`, para que cambiar `start_url` alguna vez no la
haga pasar por otra app. Queda pendiente, si Seba pasa las capturas:
`screenshots` (una `narrow` y una `wide`), que es lo que hace que Chrome en
Android muestre el cuadro de instalación rico en vez del mini banner.

---

# Lo que salió en v1.19.1 (2026-11-12)

Publicado y verificado por contenido en sebabru.com/cartas.

## Cambiar la carta visualizada

El menú de la cabecera se abría vacío: la ventana de la otra persona usa la
clase `lista-cambiar` para su estilo (`ui/index.html:166`) y está antes en el
documento, así que `$('.lista-cambiar')` devolvía esa lista y las cartas se
pintaban ahí adentro, oculta. Ahora todo ese menú se busca dentro de
`#cambiar-carta` (`enCambiarCarta` en `ui/app.js`).

`tests/selectores.test.js` controla que ningún `$('.clase')` de `ui/` apunte a
una clase que esté más de una vez en el HTML, que es lo que escondía el error.

## Un solo color por familia de aspecto

Las líneas se dibujaban más transparentes cuanto más abierto el orbe (de 1 a
0,5), así que dos trígonos se veían de dos azules distintos. Ahora van todas al
100% y lo único que atenúa es elegir un punto (`ui/wheel.js`, el `op` de las
líneas de aspecto). Decisión de Seba del 2026-11-12: un solo tono, parejo.

El semisextil sigue compartiendo el azul de los armónicos, distinguido por el
punteado: también es decisión suya.

## Las casillas de novedades

Decían "novedades de Seba Bru", que no dice nada de lo que llega. Ahora dicen
"contenido astrológico gratuito, regalos y descuentos para talleres y
formaciones", el mismo texto que el resto del sitio y el modal de la escuela.

---

# Lo que salió en v1.19.0 (2026-11-12)

Publicado y verificado por contenido en sebabru.com/cartas.

- **La rueda**: anillo de signos al 80% (294→262), anillo de casas pegado al
  zodíaco (262→244) con los números y los grados de cada cúspide adentro,
  planetas corridos hacia afuera (el glifo a 13 del borde, antes 26) y círculo
  central de 140 a 156. Lo mismo en tránsitos y revolución.
- **La R de retrógrado**: el dibujo de Seba (`notas/retrogrado.svg`,
  vectorizado en `RETROGRADO` de `ui/glyphs.js`), como una fila más de la
  columna después de los minutos.
- **Los palitos**: uno por planeta, hacia adentro del círculo de aspectos y del
  color de cada uno (`data-punto` es lo que le da el color).
- **Orbes**: cada aspecto se elige y tiene su orbe, que es el de las luminarias;
  los demás puntos se llevan un porcentaje de ese orbe (nuevo, por defecto) o un
  orbe a mano para mayores y menores (lo de antes). Ver `orbeDe` en
  `engine/aspects.js`.
- **Puntos**: cualquiera se puede sacar de la carta. Ver `enLaCarta` en
  `engine/config.js`.
- **Aplicativo/separativo para todos**: el Ascendente y el Medio Cielo traen
  velocidad (se los mide un minuto después) y los derivados heredan la de lo que
  los define. La compuesta dejó de decir "separativo" en todo.
- **Tránsitos**: lista propia de aspectos, elección de qué aspectos dibuja la
  rueda doble, y los ángulos reciben tránsitos solo si están en "Puntos
  aspectados" (antes los recibían siempre).
- **Textos en neutro**: "la carta", "por la casa 1". Quedó en segunda persona lo
  que sí es de quien usa la calculadora (su cuenta, sus cartas, su dispositivo)
  y la descripción de la página para buscadores y WhatsApp.
- **Impresión**: la rueda a 200mm, 5mm de margen de cada lado.
