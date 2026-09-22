# Entre Lugares — reglas de diseño para todas las pantallas

Entre Lugares es una app web móvil para descubrir qué está pasando cerca: conciertos, ferias, mercados, talleres, fiestas y experiencias en pueblos y ciudades pequeñas a 1–2 horas de las grandes ciudades. Público: Gen Z y millennials que planean el fin de semana. Referencia directa: Airbnb (Explorar, mapa, tarjetas con foto grande) y Fever. Debe sentirse profesional, limpia y contemporánea. Nada de motivos folclóricos, papel picado, cremas ni tipografías condensadas.

## Superficie
- Solo tema claro. Fondo blanco #FFFFFF. Superficies secundarias gris muy claro #F7F7F7. Bordes 1px #EBEBEB. Radio 16px en tarjetas y 12px en controles. Sombras suaves solo en elementos flotantes (botón "Mapa", tarjetas sobre el mapa).
- Móvil primero: ancho 390px, gutter 20px. En escritorio (admin) máximo 1200px, barra lateral 240px.
- Texto principal casi negro #222222, secundario #6A6A6A, terciario #9A9A9A. Enlaces subrayados en #222222.

## Color
- Un acento coral #FF385C para el botón primario, el estado activo de la barra inferior y el punto "en vivo". Nada más va en coral.
- "Sucediendo ahora": badge con punto pulsante rojo #E00B41 y texto "EN VIVO" en mayúsculas pequeñas.
- Etiqueta "Gratis" en verde #008A05 sobre fondo #E8F5E9. Precios en texto normal #222222, peso 600.
- Verde WhatsApp #25D366 únicamente en el botón de compartir por WhatsApp.
- Estados en admin: en cola #9A9A9A, procesando #F5A623, listo #008A05, revisar #FF385C, error #C13515.

## Tipografía
- Una sola familia sans geométrica-humanista (Plus Jakarta Sans para títulos, Inter para cuerpo). Sin mayúsculas sostenidas salvo en badges de 11px.
- Título de sección 22px peso 600. Título de tarjeta 16px peso 600, máximo dos líneas. Título en detalle 26px peso 700. Metadatos 14px #6A6A6A. Badges 11px peso 600, letter-spacing 0.04em.
- Fechas en español mexicano abreviado: "Sáb 27 sep · 19:00". Distancias: "12 km".

## Componentes
- Barra de búsqueda tipo Airbnb: pill blanca con sombra suave, ícono de lupa, texto "¿A dónde vas este finde?" y a la derecha un botón redondo de filtros.
- Fila de categorías con íconos de línea y etiqueta debajo (Conciertos, Ferias, Mercados, Talleres, Comida, Fiestas, Al aire libre, Familia); la activa lleva subrayado negro de 2px.
- Sección "Sucediendo ahora": título con badge EN VIVO, carrusel horizontal de tarjetas 240px con foto 4:3, badge "Termina 23:00" y título; si no hay nada en vivo, estado vacío discreto "Nada en vivo ahora · Mira este fin de semana".
- Tarjeta de evento en lista: foto 4:3 a todo ancho con esquinas 16px, botón de guardar (corazón) arriba a la derecha, debajo título, fecha, "lugar · municipio · 12 km" y precio o etiqueta Gratis alineados a la derecha.
- Botón flotante "Mapa" centrado abajo, negro #222222, texto blanco, ícono de mapa, radio full, sombra.
- Vista de mapa: mapa a pantalla completa, pines como pills blancas con precio o "Gratis" (la seleccionada en negro), carrusel de tarjetas compactas en la parte inferior, botón flotante "Lista" arriba. Barra de búsqueda arriba compacta.
- Barra inferior móvil: Explorar, Mapa, Guardados, Perfil. Íconos de línea, activo en coral.
- Botón primario: alto 48px, radio 12px, coral, texto blanco peso 600. Botón secundario: borde 1px #222222, fondo blanco.
- Admin: tablas con filas de 56px, divisores #EBEBEB, estados como pills, tipografía igual a la app.

## Contenido
- Español mexicano neutro y directo. Nombres reales del corredor: Tepoztlán, Tlayacapan, Yautepec, Cuautla, Tetela del Volcán, Totolapan, Atlatlahucan, Malinalco, Tenancingo, Ocuilan.
- Fotografía real como protagonista (conciertos, plazas de noche, mercados, senderos). Nada de ilustraciones, emojis ni patrones decorativos.
