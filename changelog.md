# Changelog

Todas las versiones notables de **True Fan Dice Roller**. Las fechas están en formato `AAAA-MM-DD` y el contenido resume los cambios más importantes de cada entrega.

## [1.1.1] - 2026-11-22

> La actualización más técnica hasta la fecha: efectos nuevos, umbrales más generosos y un backend modernizado que aguanta mejor los sustos.

### Añadido

- Lluvia de dados y partículas para las cadenas de explosiones grandes, con avalancha dentro de la tarjeta para el resto de jugadores.
- Leve parpadeo del aviso de «sin conexión» al estabilizarse la conexión con el backend.
- Este archivo de changelog y su versión web.

### Mejorado

- Comprobación adaptativa del estado del backend: cada 15 segundos con el servicio en línea y cada 5 segundos tras un fallo.
- Mejora en los calculos de los umbrales para los efectos en las tiradas.
- Nombre y versión mostrados en el frontend.

### Técnico

- Backend actualizado a Quarkus 3.40.1.2 y Java 25, con imágenes nativas Mandrel 25 fijadas por digest.
- Migración de los WebSockets clásicos al mejorado Quarkus WebSockets Next.
- Bloqueo pesimista por sala para serializar tiradas e impedir colisiones, con tests de concurrencia.

## [1.1.0] - 2026-11-17

> La versión de las florituras: efectos de tirada, dados más bonitos y una ayuda mucho más apañada.

### Añadido

- Efectos de tirada: confeti para las tiradas legendarias y las cadenas, y lluvia para las pifias.
- Los efectos se dibujan dentro de la tarjeta para toda la sala y a pantalla completa solo para el autor.
- Historial local de mensajes en el campo de chat con las flechas `↑` y `↓`.
- Versión de la aplicación visible en el lobby y en la página de ayuda.

### Mejorado

- Botones de dados rediseñado con círculos e iconos SVG.
- Estilo renovado de los botones de incrementar o decrementar el numero de dados en tirada.
- Rebarajeo manual del mazo y mensajes de sistema más claros en el chat.
- Estilos de enlaces y contenido ampliado en la página de ayuda.
- Capturas de ayuda actualizadas, incluida la vista móvil.
- README con la explicación de umbrales, efectos y despliegue.

### Técnico

- Tests para los efectos de tirada, los comandos y el historial del chat.
- Ajustes de build y de assets del frontend.

## [1.0.1] - 2026-11-11

> Primera versión etiquetada: todo listo para publicar imágenes y desplegar sin pelearse con el manual.

### Añadido

- Publicación automática de imágenes Docker en GHCR al crear un tag de versión.
- Guías de despliegue en Render y de compilación nativa del backend.
- Chat con historial reciente, mensajes de sistema y comandos `/carta`, `/roll` y `/Nd6 ± M`.
- Página de ayuda con manual y capturas.
- Easter eggs y comandos ocultos.


### Mejorado

- Cabecera y pie compactos en móvil con menú de opciones.
- Documentación de Docker y del build nativo revisada.
- Eliminado de modo oscuro para cada tema. Se añaden temas oscuros y claros diferenciados.

### Técnico

- Workflow `release-images.yml` para construir y publicar las imágenes de frontend y backend.

## [1.0.0] - junio a noviembre de 2026

> Primera versión funcional.

### Añadido

- Salas en tiempo real con código de 7 caracteres, nickname y sesión protegida por JWT con reconexión y logout.
- Dados d6 explosivos, modificador de -99 a +99, reserva compartida y límite de 1 a 20 dados.
- Baraja española de 50 naipes con comodines, rebarajeo y activación o desactivación por el admin.
- Panel de admin para activar cartas, barajar el mazo y expulsar jugadores.
- Listado de jugadores conectados desde la cabecera.
- 8 temas visuales guardados en el navegador.
- Indicador de estado del backend con comprobación periódica.

### Mejorado

- Estilos de login, chat y tarjetas de tirada.

### Técnico

- Backend Quarkus con H2 en desarrollo y PostgreSQL en producción.
- Limpieza de salas inactivas al arrancar.
- Build estático para Render, compilación con JDK 21 y primera imagen nativa.
- Dockerización de frontend y backend.
