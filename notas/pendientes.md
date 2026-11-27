# Pendientes

Lo que Seba pidió y todavía no está hecho. Se van tachando a medida que salen.

## Husos horarios

- Mendoza y San Luis el 11/6 de 1990, 1991 y 1992, para confirmar la ley 5566.
- Las seis provincias de la zona Córdoba sin consultar (Santa Fe, Santiago del
  Estero, Chaco, Corrientes, Formosa y Misiones) en el verano 90-91: es el único
  tramo que quedó resuelto por pronóstico y no por lectura.
- La respuesta de IANA al primer mail, con el borrador listo en
  `notas/mail-iana-argentina-2.txt`.

## Para la próxima que se toque la rueda

- `ubicarEnCasas` (`ui/wheel.js`) está exportada y tiene cuatro tests, pero no
  la usa nadie: la rueda dibuja con `ubicarColumnas` desde la v1.6. Borrarla
  con sus tests cuando no haya nada a mitad de camino.

## Las casas en las interpretaciones

`INCLUIR_CASAS` en `ui/interp.js` está en `false`. El camino ya está hecho; lo
único que falta son **36 textos**: las 12 casas en capricornio, acuario y
piscis. Los escribe Seba. Ojo con dos cosas cuando se encienda: el texto es el
signo en la **cúspide** de cada casa (no en qué casa cae un planeta), y la
página es por casa (`/carta-natal/casas/casa-N/`), no por signo, así que el
enlace es más grueso que el texto.

---

# Sin publicar todavía (26/11/2026)

Cuatro pedidos de Seba del 26/11/2026, en tres tandas. Falta que los mire
y que se etiqueten; cuando salgan, esta sección se parte en las tres.

## Tanda 1: el Nodo Sur y las efemérides al ancho

**Los puntos extra se dibujan, pero no aspectan hasta que se los marque.**
Los nueve opcionales nacían en `true` en `PUNTOS_ASPECTADOS_POR_DEFECTO`,
así que prenderlos en "Puntos de la carta" los metía también en los
aspectos, con su casilla de "Puntos aspectados" ya marcada sin que nadie
la hubiera tocado. Con el Nodo Sur y la Tierra es peor que con los
asteroides: son el punto opuesto de otro, así que duplican cada aspecto
del Nodo Norte y del Sol, dados vuelta.

No alcanzaba con cambiar la tabla de defectos: el panel ya los había
guardado en `true` uno por uno (`ajustesDesde` escribe todo lo que ve en
pantalla) y lo guardado le gana al defecto. Por eso hay una **migración de
un solo paso**, `ESQUEMA_AJUSTES` / el campo `v` de los ajustes. Si alguna
vez hay que volver a corregir un valor por omisión que ya está en el
dispositivo de la gente, ese es el mecanismo.

**Había una segunda fuga, aparte**: `progressions.js` era el único motor
que ignoraba "Puntos aspectados" por completo (usaba la clave vieja
`aspectosAngulos`). En esa vista un punto destildado seguía marcando
aspectos y los ángulos entraban siempre. El filtro estaba copiado en diez
lugares; ahora vive una sola vez, en `participantes()` de
`engine/aspects.js`.

**Las efemérides gráficas ocupan la pantalla entera.** El tope de 1180 px
no está más. El límite pasa a ser el **alto**: con la relación 1200/700 del
viewBox, una pantalla de 2500 px daría un gráfico de 1460 de alto y habría
que scrollear para ver el año completo. Los controles y el detalle se
quedan en la columna de 720: son texto.

## Tanda 2: figuras de aspectos

Dos caminos para lo mismo, y comparten toda la maquinaria.

**A mano:** la selección de la rueda pasa de ser un punto a ser un grupo.
Con ctrl (o cmd) al hacer clic se suma al grupo en vez de reemplazarlo; en
el teléfono lo hace el botón **+** de debajo de la rueda y del panel de
pantalla completa. La regla del resaltado cambia según cuántos haya: con
uno se encienden todos sus aspectos, como siempre; con dos o más, **solo
los que van de un elegido a otro**, que es exactamente mirar una figura.

**Solas:** `engine/figuras.js` lee `carta.aspectos` y encuentra stellium,
gran trígono, T cuadrada, yod, gran cruz, cometa y rectángulo místico.
Salen como chapas debajo de la rueda; tocar una elige sus puntos y de ahí
en más es una selección de varias como cualquier otra.

Tres cosas que conviene no deshacer:

1. **La figura contenida no se lista.** Una gran cruz trae cuatro T
   cuadradas adentro y un cometa trae su gran trígono: sin la poda, la
   misma figura aparece cinco veces.
2. **No se inventa ningún aspecto.** Lo que está apagado en los ajustes no
   está en `carta.aspectos`, así que sin quincuncio no hay yod. Está bien
   que sea así.
3. **Las chapas solo salen donde la rueda dibuja los aspectos de esa carta
   consigo misma.** En una doble el centro tiene los cruzados, y resaltar
   una figura de la de adentro no encendería nada.

## Tanda 3: superponer 3 cálculos

La natal fija adentro, con sus casas y sus columnas, y dos anillos
elegibles por fuera: **como la rueda de tres de astro.com**, glifo y grado
(y la R si va retrógrado), sin casas propias. El AC y el MC de cada anillo
van anotados en la esquina derecha, no dibujados.

**No se dibujan líneas de aspecto entre anillos**, decisión de Seba: con
tres cartas el centro se vuelve ilegible. En el centro van los aspectos de
la natal consigo misma, y lo cruzado se lee en las dos grillas de abajo
(una por anillo) y en las tablas.

Los cuatro anillos elegibles son tránsitos, progresiones, revolución solar
y dracónica. La lunación y la carta de la otra persona quedaron afuera
porque sus controles (la fecha de referencia, el botón de invertir) están
atados a su propia vista: sumarlas es desatarlos primero.

Dos cosas del armado:

- **Cada anillo reusa el cálculo que ya existe y sus controles de
  siempre.** No hay un motor nuevo: `usaAnillo(cual)` es lo que hace que
  el formulario del tránsito o el de la progresión también se muestren en
  esta vista.
- **La instantánea de cada anillo se toma apenas termina su cálculo**, y
  los dos corren uno después del otro. Dos cálculos pueden compartir el
  mismo lugar en `estado` (los tránsitos y la lunación escriben los dos en
  `estado.transitos`), así que en paralelo se pisarían.

Y **la lista de vistas quedó en un solo lugar**, que era el pendiente de
la v1.21.1: `VISTAS` en `ui/app.js`, con los `optgroup` que pidió Seba el
16/11/2026 (Tu carta / El cielo de ahora / Tu año / Tus ciclos / Con otra
persona / Superponer). Los tres `<select>` del HTML nacen vacíos y los
llena `opcionesDeVista()`. Hay un test que lo cuida.

---

# Lo que salió en v1.24.0 (2026-11-23): el calendario del cielo

Pedido de Seba el 23/11/2026, a partir de una captura del calendario de
Solar Fire.

## Calendario de tránsitos, tres formatos

La vista `calendario` era una lista de períodos: los siete planetas lentos
sobre la natal, con cuándo entra en orbe cada tránsito, cuándo es exacto y
cuándo sale. Eso sigue, ahora como el formato **Períodos**, y al lado hay
dos formatos nuevos que son otra cosa: los **instantes exactos**, como los
que Solar Fire pone adentro de cada día del mes.

- **Mes**: la grilla de siete columnas de la captura.
- **Día a día**: la misma información en una agenda. En pantallas de menos
  de 760 px la grilla se desarma sola en esto, por CSS, sin recalcular.

Y tres carriles, que es lo que Seba pidió poder elegir: los aspectos
**entre dos planetas en tránsito** (`Tr-Tr`), los **del tránsito a la carta
abierta** (`Tr-Na`), o los dos. Con los dos prendidos cada renglón lleva su
sigla, las mismas dos de Solar Fire. Aparte va lo que no depende de ninguna
carta: ingresos de signo, retrogradaciones y las cuatro fases de la Luna.
Lo elegido queda en `localStorage` (`tucarta:calendario`).

El vacío de curso queda afuera: Seba lo descartó. Se armaría con las mismas
piezas (la Luna sin aspecto mayor hasta cambiar de signo).

## El motor: un buscador de cruces, y cuatro cálculos que no existían

`engine/eventos.js` es nuevo y hace cinco cosas, de las cuales **cuatro no
estaban**: aspectos entre tránsitos, ingresos con fecha (antes sólo se
dibujaban, sin fecha, en las efemérides gráficas), estaciones (SR/SD) y los
cuartos lunares. La única que ya existía era la luna nueva y la llena.

Las cuatro primeras son el mismo problema —una función del tiempo que pasa
por cero— y ahora lo resuelve `cruces` en `engine/raices.js`, que es el
descarte del salto de ±180 que estaba copiado a mano en `calendar.js` y en
`lunaciones.js`.

Tres cosas que no son obvias y conviene no deshacer:

1. **Se muestrea cada 6 horas, no cada día.** La Luna avanza 13° por día:
   con paso diario entra y sale de un blanco entre dos muestras y se pierden
   aspectos enteros. Hay un test que lo falla a propósito con paso 1.
2. **La bisección baja al segundo, no al minuto.** Con la precisión por
   defecto (un minuto) se devuelve el medio del intervalo, y la mitad de los
   eventos caía un minuto después del que imprime Solar Fire.
3. **La hora se redondea al segundo antes de truncar al minuto.** El día
   juliano es un flotante: las 17:16 llegan como 17:15:59,999 y truncar las
   mostraba un minuto antes.

`fasesEntre` se agregó al lado de `lunacionesEntre` en vez de cambiarla: su
`centrar()` descarta a propósito el salto de los cuartos, que es justo lo
que hacía falta. `lunacionesEntre` está validada y la usan la vista de
lunación y la luna nueva progresada. El test más barato de que el buscador
nuevo no se corrió es que las dos den los mismos instantes para la nueva y
la llena.

## El huso de la captura, y hasta dónde coincide

La captura dice `BZT2 +3:00` y es **UTC−3**: se despejó con las cuatro fases
de la Luna, que coinciden al minuto con el huso negativo y quedan seis horas
afuera con el positivo.

Solar Fire va unos **18 segundos antes** que nosotros, porque usa ΔT = 87 s
para 2026 y el medido es ~69 s. Es la misma diferencia que ya estaba medida
en la revolución solar. Sumado al truncado, la tolerancia del test es de un
minuto y medio, y con eso coinciden las cinco fases, los trece ingresos de
la Luna, los cuatro de los planetas y las tres estaciones de planetas de
diciembre de 2026.

**Lo que no coincide es la hora de las estaciones del Nodo verdadero**, que
se puede ir un par de horas (el día sale bien). Su velocidad es una
libración casi plana alrededor del cero, así que el error de ~47" que
Moshier tiene en el Nodo —anotado en `CLAUDE.md`— se traduce en horas de
reloj. No se arregla sin sumar `semo_18.se1`, que son 1,3 MB que Seba
decidió no cargar. Está escrito en el test para que no parezca un error.

## Costo

Un mes con los dos carriles y la Luna prendida: ~870 ms y 460 eventos. La
vista de Períodos, que ya estaba, tarda 2,2 s porque recorre ±2 años de
margen. Corre en el worker, con el cartel de cargando.

## Y lo demás del mismo pedido

- **Qué aspectos dibuja la rueda doble**, debajo de los datos de la esquina
  derecha. Mirando la rueda no se distingue (las líneas salen iguales) y la
  única manera de saberlo era abrir los ajustes y acordarse de lo que decía
  el selector. El "Cambialo acá" abre el desplegable que corresponde:
  `abrirAjustes(seccion)` abre también los que lo contienen, porque los de
  aspectos están anidados y abrir sólo el de adentro no muestra nada.
- **"Carta Natal + lunación" pasa a llamarse "Carta Natal + Luna Nueva o
  Llena"**, y abajo de la nota hay un **"Ver la carta de la Luna Nueva"**.
  La rueda de esa vista es la natal con el Sol y la Luna afuera, o sea la
  lunación *sobre* la carta; la carta de la lunación misma, con sus casas y
  sus ángulos, es la del cielo de ese instante, y eso ya lo hace "Los astros
  ahora": el botón le pasa el instante y no hizo falta ninguna vista nueva.
- **La luna nueva progresada actual mostraba la pre-natal.** Era un `||=`:
  `calcularLunacionProgresada` sólo fijaba `cual` si `estado.lunacionProgresada`
  era falsy, así que al **cambiar de vista** se quedaba con el de la vista
  anterior. Entrar por la pre-natal (que está primera en la lista) y pasar a
  la actual seguía dando la pre-natal. Ahora `cual` sale siempre del modo.
- **La fase de la Luna tiene una línea propia al pie de cada día** de la
  grilla, vacía los días que no tienen. Es el renglón más largo (lleva la
  palabra entera) y mezclado con los demás empujaba la hora encima de los
  glifos del de al lado. En la agenda y en la ventana del día va donde le
  toca por hora, que ahí hay ancho de sobra.
- **"Luna Nueva o Llena" es una vista más de la lista**: el cielo entero del
  instante de la lunación, con sus casas y sus ángulos. Por dentro **es la
  carta de un momento**, la misma que "Tránsitos actuales" (entra por
  `esAhora`), con el instante corrido a la lunación más cercana a la fecha
  elegida. Se corre **una sola vez, al entrar**: después la fecha y la
  animación mueven el cielo como en cualquier otra, sin volver a saltar. El
  botón de la vista de lunación lleva ahí, y no re-busca nada porque ya
  tiene el instante.
- **"Los astros ahora" pasa a llamarse "Tránsitos actuales"** en las tres
  listas y en la esquina de la rueda. El título de la sección de la primera
  página (`#titulo-ahora-inicio`) quedó como estaba: es texto de la home.
- **La actual lleva "ciclo anterior / La última / ciclo siguiente"**, como la
  revolución solar. `calcularLunacionProgresada` recibe `salto`, que cuenta
  ciclos desde la de referencia; cada paso se calcula desde esa y no de a uno
  por vez, así que el error del mes sinódico medio no se acumula entre clics.

---

# Lo que salió en v1.22.0 (2026-11-17)

Dos cosas de una captura que mandó Seba el 16/11/2026, las dos en
`ui/wheel.js`.

## Mercurio no puede aparecer antes que Saturno

`ubicarColumnas` acomoda **una casa por vez**, y la casa que no entra
desborda su cúspide. Ese desborde no miraba lo que había del otro lado, así
que le pasaba por encima al planeta de la casa vecina y lo dibujaba antes
que él. `repartir` tampoco lo arreglaba: ordenaba por la posición **ya
corrida**, así que repartía la inversión tal cual venía.

Ahora `repartir` recibe un tercer argumento, `orden`, con las longitudes
reales: ordena y corta el círculo por ahí, y desenrolla cada posición a
continuación de la anterior por su camino más corto. La que quedó detrás
entra con hueco negativo, así que su grupo la vuelve a su lugar. El
desborde **empuja** al vecino en vez de cruzarlo, y la cúspide se quiebra
para marcarlo, como ya hacía.

Sin `orden` se comporta igual que antes, que es lo que necesita el anillo
de tránsitos (ahí las posiciones ya son las longitudes).

Los dos tests nuevos de `tests/rueda.test.js` fallan con el código viejo:
el caso de la captura y 150 cartas al azar, rueda sola y superposición.

## El anillo de afuera usa el lugar que tenía libre

Sus columnas estaban juntadas de 64 a 58 de profundidad de cuando los
números de casa iban abajo. Desde la v1.19.0 van en la cajita pegada al
zodíaco, así que la columna baja hasta la carta de adentro:

```
            antes   ahora
glifo        232     238
grado        218     224
signo        206     212
minuto       194     200
R          al lado   190
```

Con eso **la R vuelve a ser una fila más**, como en el resto de las ruedas.
`retroPaso` es 62 y no 64 porque el codo de la cúspide quebrada sale 3 por
debajo de la R, y con 64 cae adentro de la carta de adentro (182,3).

De yapa, la separación mínima entre columnas la fija la fila más de
adentro, que ahora está más arriba: pasa de 5,25° a 5,11°, así que los
planetas se corren un poco menos.

---

# Lo que salió en v1.21.1 (2026-11-16)

Un parche de la v1.21.0, el mismo día. La lista de cálculos está escrita
**tres veces a mano** en `ui/index.html` (el formulario, `#selector-modo` y
`.selector-completa`), y al agregar las dos lunas nuevas progresadas quedaron
duplicadas en el formulario y faltando en el de arriba de la rueda. Faltando
es peor que de más: `aplicarModo` hace
`$('#selector-modo').value = estado.modo`, y con un valor que el selector no
tiene queda **en blanco** en cuanto se entra en una de las dos vistas, sin
manera de volver a elegirlas desde ahí.

Seba pidió el 16/11/2026 **agrupar la lista con `optgroup`** (Tu carta / El
cielo de ahora / Tu año / Tus ciclos / Con otra persona), para cuando se
agreguen más cálculos. Cuando se haga, que la lista salga de **un solo
arreglo en JS** y no de las tres copias a mano: es la causa de este parche.
`optgroup` no se anida ni se colapsa; un desplegable propio que sí lo haga
perdería la rueda nativa del celular.

---

# Lo que salió en v1.21.0 (2026-11-16)

Pedido de Seba el 15/11/2026. Publicado y verificado por contenido en
sebabru.com/cartas.

## Las dos lunas nuevas progresadas

Dos vistas nuevas debajo de "Carta Natal + Progresiones", las dos una rueda
sola (decisión de Seba): la **pre-natal**, que abre el ciclo que estaba vigente
al nacer, y la **actual**, la última cumplida. No piden ninguna fecha: salen
del nacimiento y de hoy.

La cuenta sale en cuatro líneas porque en progresiones secundarias las
posiciones progresadas de una fecha son las posiciones **reales** del día
`jdNatal + (T - jdNatal) / ANIO_TROPICO`. O sea que el Sol progresado se
conjunta con la Luna progresada exactamente cuando en ese día cae una luna
nueva **de verdad**: `engine/lunacionProgresada.js` busca las lunaciones reales
con el `lunacionesEntre` que ya existía, en tiempo progresado, y después
devuelve la fecha al tiempo de la vida. La carta es la progresión a ese día.

La pre-natal progresa a una fecha **anterior al nacimiento**, y ahí salieron
dos cosas mal de `engine/progressions.js`: `norm(raP - raN)` daba +355° donde
iban −5° (método `arco-ra`), y lo mismo el `arco` que devuelve. Los dos pasaron
a `dif`, que es con signo. Con una edad normal `norm` y `dif` dan lo mismo, así
que no se movió nada de lo validado contra Solar Fire.

**Quien tiene menos de 29 años y medio todavía no cumplió ninguna luna nueva
progresada**: las dos vistas le dan la misma carta. Es correcto, y se dice
abajo de la rueda en vez de esconderlo.

## Instalar, donde se está mirando

La v1.20.0 dejó la explicación al pie, abajo de todo, y nadie baja hasta ahí
mientras mira su carta. La misma explicación va ahora en una ventana
(`abrirVentanaInstalar` en `ui/instalar.js`, que comparte el cuerpo con la
sección del pie) y se abre desde tres lados: la cabecera (al lado de Mi cuenta
y de Ajustes), la esquina de la carta (al lado del engranaje) y la barra de
abajo. Ninguno aparece si la app ya está instalada, ni en el modo `#hoja=`.

## Compartir y descargar, un botón

Vuelven a ser uno solo, pero sin el equívoco que los había separado: el botón
dice "Compartir" y la elección está adentro de la ventana que ya preguntaba por
las referencias, con dos botones, "Compartir" y "Descargar imagen". Las
efemérides pasan por la misma ventana, sin las casillas de referencias, que ahí
no entran.

## El enlace que abre la carta calculada

Hasta ahora el compartir mandaba la imagen y el enlace a la calculadora
**vacía**: quien la recibía tenía que tipear los datos de nuevo. El lado que lee
ya existía (`#carta=<base64url>`, el de `/tu-identidad-en-el-cielo` y el del PDF
por mail) y calcula solo; faltaba el codificador, que es `enlaceDeCarta` en
`ui/app.js`. Lleva también la vista, así que el enlace abre en la vista desde la
que se compartió.

Va **solo si la persona lo elige**, con una casilla y el aviso al lado: ese
enlace lleva la fecha, la hora y el lugar de nacimiento. El fragmento no viaja
al servidor, pero sí queda en el chat de quien lo recibe. El `utm_medium`
distingue `carta` de `imagen`, y el evento `imagen_descargada` suma el
parámetro `enlace`.

Ojo con el relleno: el lector es `/^#(hoja|carta)=([A-Za-z0-9_-]+)/` y el `=`
no entra en esa clase, así que `enlaceDeCarta` lo saca (`atob` acepta base64
sin relleno).

## Y el pendiente que esperaba una release

Debajo de las interpretaciones hay ahora un enlace a
`https://sebabru.com/carta-natal/`. Los textos siguen saliendo de donde salían.

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

**En el iPhone el botón no existe en ningún navegador**, por más que la página
lo quiera: todos son WebKit por dentro y WebKit no da `beforeinstallprompt`.
Ahí va el paso a mano y nada más. Pero ese paso **no es solo de Safari**:
Compartir → Agregar a inicio anda desde cualquier navegador del iPhone a partir
de iOS 16.4, y Seba lo comprobó en Chrome el 2026-11-13 (el texto decía "tiene
que ser desde Safari", que estaba mal). En Firefox de escritorio tampoco se
promete una instalación que no existe.

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
