# Stitch — prompts de las 7 pantallas del MVP

Proyecto en Stitch: **entrelugares** (`projects/2941485489938692309`), sistema de diseño `assets/1355268398849959232` (definido en `DESIGN.md`). Móvil 390px para las públicas, escritorio para admin. Español mexicano neutro.

Dirección (2026-09-21): profesional, limpio, tipo Airbnb, para Gen Z y millennials. Sin motivos folclóricos. Incluye búsqueda en mapa y sección "Sucediendo ahora".

## Alta del MCP oficial (ya hecha)

```bash
claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: TU-API-KEY" -s user
```

## Dirección visual (pegar al inicio de cada prompt)

> Diseña para "Entre Lugares", una app web móvil para descubrir qué está pasando cerca este fin de semana en pueblos y ciudades pequeñas de México (conciertos, ferias, mercados, talleres, fiestas, experiencias al aire libre). Público Gen Z y millennial. Estilo Airbnb: fondo blanco, tipografía sans limpia (Plus Jakarta Sans / Inter), fotos grandes 4:3 con esquinas de 16px, mucho aire, un solo acento coral #FF385C, texto casi negro #222222 y gris #6A6A6A. Nada folclórico, nada de degradados, sin emojis. Todos los textos en español mexicano neutro.

## 01 · Explorar (público, móvil)

Pantalla principal "Explorar". Arriba una barra de búsqueda tipo Airbnb: pill blanca con sombra suave, ícono de lupa, texto "¿A dónde vas este finde?" y a la derecha un botón redondo de filtros; debajo, texto pequeño "Cerca de Tepoztlán · 30 km · cambiar". Luego una fila horizontal de categorías con ícono de línea y etiqueta: Conciertos, Ferias, Mercados, Talleres, Comida, Fiestas, Al aire libre, Familia (la primera con subrayado negro). Después la sección "Sucediendo ahora" con un badge rojo pulsante "EN VIVO" junto al título y un carrusel horizontal de tarjetas de 240px con foto 4:3, badge "Termina 23:00" sobre la foto, título y lugar: "Noche de son jarocho · Casa de Cultura Malinalco", "Mercado nocturno · Plaza de Tlayacapan", "Concierto en el atrio · Tepoztlán". Luego la sección "Este fin de semana" con lista vertical de tarjetas grandes: foto 4:3 a todo ancho con botón de corazón arriba a la derecha, debajo título en dos líneas, "Sáb 27 sep · 19:00", "Ex Convento · Tlayacapan · 12 km" y a la derecha el precio "$150" o una etiqueta verde "Gratis". Cuatro eventos realistas: festival de música electrónica en una ex-hacienda de Yautepec, ruta de mezcal y comida en Tepoztlán, taller de cerámica en Tlayacapan, carrera de montaña al amanecer en Malinalco. Botón flotante negro centrado abajo "Mapa" con ícono. Barra inferior: Explorar (activo, coral), Mapa, Guardados, Perfil.

## 02 · Mapa (público, móvil)

Vista de mapa a pantalla completa de la zona entre Tepoztlán, Tlayacapan y Yautepec, con carreteras y relieve suaves en tonos claros. Arriba una barra de búsqueda compacta con "Tepoztlán · Este finde" y botón de filtros. Sobre el mapa, pines en forma de pill blanca con sombra que muestran "$150", "Gratis", "$80", "$300"; el pin seleccionado es negro con texto blanco. En la parte inferior un carrusel horizontal de tarjetas compactas (foto 4:3 a la izquierda 96px, título, "Sáb 27 sep · 19:00", "Tlayacapan · 12 km", precio), la tarjeta activa corresponde al pin negro. Botón flotante blanco arriba a la derecha "Lista" con ícono, y botón redondo de "mi ubicación". Barra inferior con Mapa activo.

## 03 · Detalle de evento (público, móvil)

Pantalla de detalle. Foto grande 4:3 a todo ancho arriba con botones flotantes redondos blancos: atrás, compartir, guardar (corazón). Debajo: badge de categoría "Concierto", título 26px "Noche de son jarocho en el ex convento", fila con ícono de calendario "Sábado 27 de septiembre · 19:00 a 23:00", fila con ícono de pin "Ex Convento de San Juan Bautista · Tlayacapan, Morelos" y un mini mapa estático rectangular con un pin, fila "Organiza: Casa de Cultura La Cerería" con avatar redondo. Sección "Sobre el evento" con 3 líneas de texto y enlace "Leer más". Sección "Cómo llegar" con dos botones secundarios: "Abrir en Maps" y "Waze". Barra fija inferior blanca con borde superior: a la izquierda "$150 por persona" (o "Gratis" en verde), a la derecha botón primario coral "Compartir por WhatsApp" con ícono. Al final, sección "Más cerca de aquí" con 2 tarjetas compactas y enlace discreto "Reportar un dato incorrecto".

## 04 · Destino: municipio (público, móvil)

Página de destino "Tlayacapan". Foto de portada a todo ancho con degradado mínimo solo para legibilidad del texto, nombre grande "Tlayacapan", subtítulo "Morelos · Pueblo Mágico · 1 h 40 desde CDMX", botón de guardar. Fila de chips de datos: "23 eventos este mes", "Gratis: 14", "Desde $80". Sección "Sucediendo ahora" con badge EN VIVO y una tarjeta. Sección "Próximos eventos" con 3 tarjetas grandes como en Explorar. Sección "Fechas que no te puedes perder" como lista limpia con mes a la izquierda en gris y nombre a la derecha: "Feb · Carnaval de chinelos", "Jun · Fiesta de San Juan Bautista", "Nov · Día de Muertos en los cerros", "Dic · Feria de la cerería y el barro". Sección "Lugares" con tarjetas horizontales pequeñas: Ex Convento de San Juan Bautista, Casa de Cultura La Cerería, Cerro del Sombrerito, Mercado municipal. Botón flotante "Mapa". Barra inferior.

## 05 · Admin · Subir flyers (privado, escritorio)

Panel de administración interno, estilo limpio igual al de la app. Barra lateral izquierda de 240px con logo "Entre Lugares · Admin" y navegación: Subir, Revisión (con contador "12" en pill coral), Fuentes, Eventos, Lugares, Salir. Contenido: título "Subir flyers", texto de apoyo "Las imágenes se encolan y el job local de la Mac las procesa". Zona grande de arrastrar y soltar con borde punteado, ícono de imagen y texto "Arrastra imágenes o haz clic · JPG, PNG, WEBP · varias a la vez". Debajo una fila de campos opcionales: "URL del post de origen", selector "Municipio" (11 opciones), "Organizador". Botón primario coral "Encolar". Debajo una tabla "Cargas recientes" con columnas miniatura, archivo, municipio, subido, estado; estados como pills: "En cola" gris, "Procesando" ámbar, "Listo" verde, "Revisar" coral. Arriba a la derecha un indicador "Job local: activo · última corrida hace 4 min".

## 06 · Admin · Revisión (privado, escritorio)

Pantalla de revisión de eventos extraídos automáticamente, misma barra lateral. Encabezado "Revisión · 12 pendientes" con botones anterior y siguiente y un filtro por municipio. Dos columnas: izquierda el flyer grande con control de zoom y debajo la fuente en gris "Subido por Eduardo · 21 sep 2026 · facebook.com/ayuntamientotlayacapan/…" y un bloque plegable "Texto OCR"; derecha un formulario prellenado: Título, Categoría (chips), Fechas (lista editable de fecha + hora inicio + hora fin, botón "Agregar fecha"), Lugar (campo con autocompletar y una sugerencia resaltada "Ex Convento de San Juan Bautista · Tlayacapan · coincidencia 92%"), Municipio, Precio con toggle "Gratis", Organizador, Descripción. Barra de confianza horizontal "Confianza 0.82" en ámbar. Barra de acciones fija abajo: botón primario coral "Aprobar y publicar", secundario "Guardar corrección", terciarios "Es duplicado de…" y "Descartar" en rojo suave.

## 07 · Admin · Fuentes (privado, escritorio)

Tabla de fuentes que scrapea el job local, misma barra lateral. Encabezado "Fuentes · 24 activas" con botón primario "Agregar fuente" y una franja informativa gris: "El job local corrió por última vez hoy a las 03:12 desde la Mac de Eduardo". Columnas: Nombre ("Ayuntamiento de Tlayacapan"), Tipo (pill: Facebook, Instagram, Sitio web), Municipio, Intervalo ("cada 24 h"), Última corrida ("hoy 03:12"), Nuevos ("+3"), Estado (punto verde OK / punto rojo Error), acción "Correr ahora" como botón secundario pequeño. Una fila expandida muestra el último error en monoespaciada: "Selector no encontrado: article img" con botón "Ver snapshot".
