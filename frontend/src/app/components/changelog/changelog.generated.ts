// Fichero generado automáticamente por frontend/scripts/generate-changelog.mjs.
// No lo edites a mano: cambia ../changelog.md y ejecuta `npm run changelog:sync`.
import type { ChangelogRelease } from './changelog.model';

export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = [
  {
    "version": "1.1.1",
    "date": "2026-11-22",
    "summary": [
      {
        "text": "La actualización más técnica hasta la fecha: efectos nuevos, umbrales más generosos y un backend modernizado que aguanta mejor los sustos."
      }
    ],
    "sections": [
      {
        "title": "Añadido",
        "items": [
          [
            {
              "text": "Lluvia de dados y partículas para las cadenas de explosiones grandes, con avalancha dentro de la tarjeta para el resto de jugadores."
            }
          ],
          [
            {
              "text": "Posibilidad de que una tirada legendaria y una cadena grande muestren sus efectos a la vez."
            }
          ],
          [
            {
              "text": "Previsualización de la avalancha con el comando oculto "
            },
            {
              "text": "/fx",
              "code": true
            },
            {
              "text": "."
            }
          ]
        ]
      },
      {
        "title": "Mejorado",
        "items": [
          [
            {
              "text": "La avalancha es más frecuente y alcanzable con pocos dados gracias a los nuevos umbrales."
            }
          ],
          [
            {
              "text": "Botones de sumar y restar dados con fondo transparente."
            }
          ],
          [
            {
              "text": "Comprobación adaptativa del backend: cada 15 segundos con el servicio en línea y cada 5 segundos tras un fallo."
            }
          ],
          [
            {
              "text": "Más efectos visuales al lanzar dados."
            }
          ]
        ]
      },
      {
        "title": "Corregido",
        "items": [
          [
            {
              "text": "Parpadeo del aviso de «sin conexión» al estabilizarse la conexión con el backend."
            }
          ],
          [
            {
              "text": "Nombre y versión mostrados en el frontend."
            }
          ]
        ]
      },
      {
        "title": "Técnico",
        "items": [
          [
            {
              "text": "Backend actualizado a Quarkus 3.40.1.2 y Java 25, con imágenes nativas Mandrel 25 fijadas por digest."
            }
          ],
          [
            {
              "text": "Migración de los WebSockets clásicos a Quarkus WebSockets Next."
            }
          ],
          [
            {
              "text": "Bloqueo pesimista por sala para serializar tiradas, robos y uso de la reserva, con tests de concurrencia."
            }
          ],
          [
            {
              "text": "Incluye los cambios posteriores al tag "
            },
            {
              "text": "v1.1.1",
              "code": true
            },
            {
              "text": ", que la aplicación sigue mostrando como 1.1.1."
            }
          ]
        ]
      }
    ]
  },
  {
    "version": "1.1.0",
    "date": "2026-11-17",
    "summary": [
      {
        "text": "La versión de las florituras: efectos de tirada, dados más bonitos y una ayuda mucho más apañada."
      }
    ],
    "sections": [
      {
        "title": "Añadido",
        "items": [
          [
            {
              "text": "Efectos de tirada: confeti para las tiradas legendarias y las cadenas, y lluvia para las pifias."
            }
          ],
          [
            {
              "text": "Los efectos se dibujan dentro de la tarjeta para toda la sala y a pantalla completa solo para el autor."
            }
          ],
          [
            {
              "text": "Comando oculto "
            },
            {
              "text": "/fx",
              "code": true
            },
            {
              "text": " para previsualizar los efectos, incluido "
            },
            {
              "text": "/fx pantalla",
              "code": true
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Historial local de mensajes en el campo de chat con las flechas "
            },
            {
              "text": "↑",
              "code": true
            },
            {
              "text": " y "
            },
            {
              "text": "↓",
              "code": true
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Versión de la aplicación visible en el lobby y en la página de ayuda."
            }
          ]
        ]
      },
      {
        "title": "Mejorado",
        "items": [
          [
            {
              "text": "Stepper de dados rediseñado con círculos e iconos SVG."
            }
          ],
          [
            {
              "text": "Rebarajeo manual del mazo y mensajes de sistema más claros en el chat."
            }
          ],
          [
            {
              "text": "Estilos de enlaces y contenido ampliado en la página de ayuda."
            }
          ],
          [
            {
              "text": "Capturas de ayuda actualizadas, incluida la vista móvil."
            }
          ],
          [
            {
              "text": "README con la explicación de umbrales, efectos y despliegue."
            }
          ]
        ]
      },
      {
        "title": "Técnico",
        "items": [
          [
            {
              "text": "Tests para los efectos de tirada, los comandos y el historial del chat."
            }
          ],
          [
            {
              "text": "Ajustes de build y de assets del frontend."
            }
          ]
        ]
      }
    ]
  },
  {
    "version": "1.0.1",
    "date": "2026-11-11",
    "summary": [
      {
        "text": "Primera versión etiquetada: todo listo para publicar imágenes y desplegar sin pelearse con el manual."
      }
    ],
    "sections": [
      {
        "title": "Añadido",
        "items": [
          [
            {
              "text": "Publicación automática de imágenes Docker en GHCR al crear un tag de versión."
            }
          ],
          [
            {
              "text": "Guías de despliegue en Render y de compilación nativa del backend."
            }
          ]
        ]
      },
      {
        "title": "Mejorado",
        "items": [
          [
            {
              "text": "Documentación de Docker y del build nativo revisada."
            }
          ],
          [
            {
              "text": "Versión del proyecto actualizada a 1.0.1."
            }
          ]
        ]
      },
      {
        "title": "Técnico",
        "items": [
          [
            {
              "text": "Workflow "
            },
            {
              "text": "release-images.yml",
              "code": true
            },
            {
              "text": " para construir y publicar las imágenes de frontend y backend."
            }
          ]
        ]
      }
    ]
  },
  {
    "version": "1.0.0",
    "date": "junio a noviembre de 2026",
    "summary": [
      {
        "text": "Primera versión funcional. No llegó a tener un tag propio: el primer tag publicado fue "
      },
      {
        "text": "v1.0.1",
        "code": true
      },
      {
        "text": "."
      }
    ],
    "sections": [
      {
        "title": "Añadido",
        "items": [
          [
            {
              "text": "Salas en tiempo real con código de 7 caracteres, nickname y sesión JWT con reconexión y logout."
            }
          ],
          [
            {
              "text": "Dados d6 explosivos, modificador de -99 a +99, reserva compartida y límite de 1 a 20 dados."
            }
          ],
          [
            {
              "text": "Baraja española de 50 naipes con comodines, rebarajeo automático y activación o desactivación por el admin."
            }
          ],
          [
            {
              "text": "Chat con historial reciente, mensajes de sistema y comandos "
            },
            {
              "text": "/carta",
              "code": true
            },
            {
              "text": ", "
            },
            {
              "text": "/roll",
              "code": true
            },
            {
              "text": " y "
            },
            {
              "text": "/Nd6±M",
              "code": true
            },
            {
              "text": "."
            }
          ],
          [
            {
              "text": "Panel de admin para activar cartas, barajar el mazo y expulsar jugadores."
            }
          ],
          [
            {
              "text": "Listado de jugadores conectados desde la cabecera."
            }
          ],
          [
            {
              "text": "14 temas visuales guardados en el navegador."
            }
          ],
          [
            {
              "text": "Indicador de estado del backend con comprobación periódica."
            }
          ],
          [
            {
              "text": "Página de ayuda con manual y capturas."
            }
          ],
          [
            {
              "text": "Easter eggs y comandos ocultos."
            }
          ]
        ]
      },
      {
        "title": "Mejorado",
        "items": [
          [
            {
              "text": "Cabecera y pie compactos en móvil con menú de opciones."
            }
          ],
          [
            {
              "text": "Estilos de login, chat y tarjetas de tirada."
            }
          ]
        ]
      },
      {
        "title": "Técnico",
        "items": [
          [
            {
              "text": "Backend Quarkus con H2 en desarrollo y PostgreSQL en producción."
            }
          ],
          [
            {
              "text": "Limpieza de salas inactivas al arrancar."
            }
          ],
          [
            {
              "text": "Build estático para Render, compilación con JDK 21 y primera imagen nativa."
            }
          ],
          [
            {
              "text": "Dockerización de frontend y backend."
            }
          ]
        ]
      }
    ]
  }
];
