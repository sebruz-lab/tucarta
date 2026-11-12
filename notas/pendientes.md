# Pendientes

Lo que Seba pidió y todavía no está hecho. Se van tachando a medida que salen.

## Cambiar la carta visualizada

El botoncito de texto "Cambiar la carta visualizada", el que aparece cuando ya
estás mirando una carta, despliega una cajita pero no deja elegir nada. Hay que
hacer que se pueda elegir. Es un error, no una mejora.

## Mailing

El mailing con Brevo (doble opt-in, contactos sincronizados) salió a producción
desde el repo del sitio el 2026-11-12, en otra ventana. Falta ver cómo se
integra a la calculadora.

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
