# tucarta: calculadora de cartas de sebabru.com/tucarta

## Contexto
Seba Bru es astrólogo y docente. Su sitio sebabru.com corre en Firebase (HTML/CSS/JS) y tiene login y compra de cursos, en un repo **privado** (`sebruz-lab/sebabru-sitio`). Esta webapp calcula cartas, inspirada en Solar Fire en precisión, pero pensada para consultantes y alumnxs, no para astrólogxs.

Objetivo:
- Calcular cartas y mostrar la rueda con interpretaciones gratuitas escritas por Seba.
- Invitar a consultar con Seba o con egresadxs de su escuela, que ofrecen consultas más económicas.

## Etapas
1. v1 (ahora): carta natal.
2. Tránsitos.
3. Revolución solar (la persona carga dónde pasa su cumpleaños).
4. Página de consultas y listado de egresadxs con perfiles.

No construir nada de las etapas 2 a 4 todavía, pero la arquitectura no tiene que impedirlas.

## Alcance de la v1
- Formulario: nombre (opcional), fecha, hora y lugar de nacimiento, con buscador de lugares.
- Cálculo con Swiss Ephemeris, zodíaco tropical.
- Puntos: Sol a Plutón, Nodo Norte verdadero, Lilith media, Quirón.
- Casas: Placidus por defecto; selector con Koch, Iguales, Enteras, Regiomontanus, Campanus y Porfirio.
- Aspectos mayores (conjunción, sextil, cuadratura, trígono, oposición). Orbes por defecto:
  - Sol y Luna: 9°.
  - Mercurio, Venus, Marte, Júpiter y Saturno: 7°.
  - Urano, Neptuno, Plutón, Quirón, Nodo y Lilith: 5°.
  - Entre dos puntos con orbes distintos se usa el **mayor**.
  - Aspectos a Ascendente y Medio Cielo: desactivados por defecto, activables, orbe 5°.
- El público ve un panel de ajustes con el sistema de casas, los orbes y los aspectos a los ángulos.
- Rueda en SVG, legible en celular. Glifos como paths SVG (no caracteres Unicode, que salen como emoji).
- Tabla de posiciones (signo, grado y minuto, casa, retrogradación) y tabla de aspectos.
- Interpretaciones: Sol, Luna y Ascendente en cada signo (36 textos). Los escribe Seba; si falta el texto se muestra "PROXIMAMENTE: Un texto".
- Llamado a consultar: botones "Consultar con Seba" y "Consultar con egresadxs", con links configurables.

## Decisiones de arquitectura
- **Licencia:** Swiss Ephemeris bajo AGPL-3.0, así que este repo es público. No importa nada del sitio privado (ni `style.css` ni scripts): la página es autocontenida.
- **Cálculo en el navegador:** Swiss Ephemeris compilado a WASM con Emscripten (fuente en `engine/swisseph/`), en un Web Worker. Planetas, Luna y Nodo con Moshier (sin archivos); Quirón con `seas_18.se1`.
  - Moshier da hasta ~47" de error en el Nodo verdadero (22" en `jujuy-1991`). Queda dentro de la tolerancia de 1', y Seba decidió no sumar `semo_18.se1` (1,3 MB) para que la app sea más liviana.
- **Integración:** el CI publica `dist/` como release con tag. El workflow de deploy del repo privado baja la release fijada y la copia en `public/tucarta/` antes de `firebase deploy`. Mismo origen: sebabru.com/tucarta.
- **Textos:** en Firestore (base `cursos`), colección `tucarta_textos/{sol-aries|luna-tauro|asc-geminis…}` con `{titulo, texto, publicado}`. Links de consulta en `tucarta_config/general`. Nunca en este repo.
- **Husos horarios:** cada localidad trae su zona IANA (Argentina varía por provincia).
  - `time/zonas.json` se genera con `time/build/zonas.mjs` desde el fuente IANA (versión fija, hoy 2025b). Cubre Argentina, Uruguay, España y países vecinos, con huso base y horario de verano por separado (`Intl` no los distingue).
  - Las demás zonas usan `Intl` y solo muestran el offset total.
  - `tests/zonas.test.js` compara la tabla con `Intl` hora por hora desde 1900.
  - El público es mayormente de Argentina, España y Uruguay, nacido de 1970 en adelante. Esas zonas tienen la historia completa en la base IANA estándar.
  - El recorte de historia anterior a 1970 que la base movió al archivo `backzone` (Islandia, varias zonas de África y Europa) no las afecta. Si el público se amplía, se puede empaquetar tzdata con backzone. El caso testigo es `reykjavik-1965.json`.
  - Siempre se muestra el huso base y el horario de verano aplicados, por separado, y se pueden corregir a mano.
  - Antes de 1970 (en cualquier país) la base IANA es imprecisa: aviso de que el huso es tentativo.
  - Horas ambiguas o inexistentes por cambio de hora: se avisa y se deja elegir.
- **Lugares:** índice estático propio armado desde GeoNames (CC-BY): `AR.txt` completo más `cities1000` para el mundo, en fragmentos por prefijo. Respaldo: coordenadas y zona a mano.
- **Privacidad:** no se guardan datos de nacimiento en el servidor ni en la URL. Solo la última carta en `localStorage`, con botón "borrar".
- **Medición (GA4, `gtag` del sitio):** `carta_calculada` (sistema de casas, si se cambiaron orbes) y `clic_consulta` (`destino: seba|egresadxs`). Nunca fecha, hora ni lugar.
- **Modelo de carta en JSON puro.** `engine/aspects.js` es genérico (puntos A × puntos B) y la rueda acepta varios anillos, para tránsitos y revolución solar.

## Interfaz
- Mobile first.
- Español rioplatense, con voseo y lenguaje inclusivo con x.
- Estética del sitio: fondo `#07070a`, tipografía Outfit fina, acentos `#3bc2bc` (turquesa), `#f7d239` (amarillo), `#bfaee0` (lila), `#f56d96` (rosa). Editorial, mucho aire.
- **En HTML, nunca comillas tipográficas** (U+201C/U+201D) en atributos: siempre comillas ASCII rectas.

## Validación
- Cartas de referencia de Solar Fire en `tests/fixtures/solarfire/`, con lat/lon y huso que usó Solar Fire.
- `engine.test.js`: con el UTC y las coordenadas de Solar Fire, posiciones y cúspides dentro de **1 minuto de arco**.
- `tz.test.js`: hora local + zona IANA da el mismo UTC que Solar Fire.
  - Incluye horario de verano argentino, provincias distintas y cartas anteriores a 1970 de Argentina y de otros países.
  - Antes de 1970 una diferencia de huso no falla el test: se registra como "tentativa" en un informe.

## Estructura
- `engine/`: motor sin DOM (Swiss Ephemeris en WASM, carta, aspectos). Corre igual en el navegador (worker) y en Node (tests).
- `time/`: hora local a UTC y husos (`zonas.json` generado).
- `places/`: buscador de lugares. El índice `ui/public/lugares/` se genera con `npm run lugares` y **no se versiona** (unos 20 MB).
- `ui/`: página (Vite, JS sin framework).
  - `app.js` orquesta; `worker.js` calcula; `wheel.js` dibuja la rueda; `glyphs.js` tiene los glifos SVG; `huso.js`, `tables.js`, `settings.js`, `interp.js` y `form.js` arman cada parte.
  - `firestore.js` lee textos y links por la API REST, sin el SDK.
- Las posiciones se muestran **truncadas** al minuto, como Solar Fire.

## Comandos
- `npm test`: tests (Vitest).
- `npm run dev`: servidor local.
- `npm run build`: genera `dist/`.
