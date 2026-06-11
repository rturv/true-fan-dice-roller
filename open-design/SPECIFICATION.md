# Especificación: True Fan Dice Roller

## 1. Historia de Usuario Refinada

**Como** jugador de rol o aficionado a juegos de mesa, **quiero** conectarme a una sala online con amigos, lanzar dados de seis caras con modificadores y sacar cartas de una baraja española virtual compartida, **para** poder jugar partidas a distancia con resolución de tiradas y cartas en tiempo real, sin necesidad de dados ni cartas físicas.

---

## 2. Visión General

Aplicación web tipo "chat room" con dos pantallas:
1. **Pantalla de entrada** (`/`): permite al usuario elegir un nickname temporal y crear una sala nueva o unirse a una existente mediante un código.
2. **Pantalla de sala** (`/room/:code`): sala de chat en tiempo real donde los participantes lanzan dados d6 con modificador opcional, sacan cartas de una baraja española virtual, y envían mensajes de texto.

La comunicación frontend-backend se realiza **exclusivamente mediante WebSockets**. El backend expone endpoints REST únicamente para health checks.

---

## 3. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 21+ (standalone components, signals, OnPush) |
| Backend | Quarkus 3.36.1 (Java 21) |
| WebSockets | Jakarta WebSocket (ServerEndpoint en Quarkus) |
| Persistencia | Hibernate ORM con Panache (JPA) |
| BD Desarrollo | H2 en memoria |
| BD Producción | PostgreSQL |
| Diseño UI | Basado en `open-design/diced-chat-dice-roller.html` |

---

## 4. Funcionalidades (Requisitos Funcionales)

### FR1 — Pantalla de Entrada (Login/Lobby)

| ID | Requisito |
|----|----------|
| FR1.1 | Mostrar un campo de texto para que el usuario introduzca un **nickname** (1-20 caracteres alfanuméricos, no vacío). |
| FR1.2 | Mostrar dos botones principales: **"Crear Sala"** y **"Unirse a Sala"**. |
| FR1.3 | Al pulsar "Crear Sala", el backend genera un **código alfanumérico único de 7 caracteres** (mayúsculas + dígitos), crea la sala, asigna al usuario como **admin** y redirige a la sala. |
| FR1.4 | Mostrar un campo de texto adicional para introducir el **código de sala** al seleccionar "Unirse a Sala". |
| FR1.5 | Al unirse, validar que el código existe y que el nickname no está duplicado en esa sala. Si falla, mostrar mensaje de error. Si todo OK, redirigir a la sala. |
| FR1.6 | No se requiere contraseña ni registro. El nickname es temporal y solo válido para esa sesión. |

### FR2 — Sala de Chat (Game Room)

| ID | Requisito |
|----|----------|
| FR2.1 | La sala debe mostrar el **logo "True Fan Dice Roller"** y el **código de sala** visible en la cabecera. |
| FR2.2 | En la cabecera: selector de tema visual (8 temas), selector de usuario, botón toggle dark/light — según el diseño OpenDesign. |
| FR2.3 | Área central de **chat log**: muestra en orden cronológico inverso (scroll hacia abajo) los eventos de la sala. |
| FR2.4 | Barra de controles inferior con: contador de dados (+/-), campo de modificador, botón **"Roll"** y botón **"Sacar Carta"** — según diseño OpenDesign. |
| FR2.5 | **El admin** debe ver un botón adicional: **"Reiniciar Baraja"** para barajar y reiniciar el mazo manualmente. |

### FR3 — Tirada de Dados

| ID | Requisito |
|----|----------|
| FR3.1 | El usuario configura cantidad de dados (1-20) y modificador (-99 a +99). |
| FR3.2 | Al pulsar "Roll" (o Enter/Espacio), se lanzan N dados d6 (valores 1-6). |
| FR3.3 | **Mecánica de explosión**: cada dado que saca 6 genera un dado adicional que se suma. Las explosiones se encadenan (si el extra saca 6, explota de nuevo). |
| FR3.4 | Resultado final = suma de todos los dados (originales + explosiones) + modificador. |
| FR3.5 | En el chat log se muestra: usuario, timestamp, iconos de dados individuales (marcando visualmente los de explosión y los que sacaron 6), puntuación total, desglose detallado, y el modificador aplicado si no es 0. |
| FR3.6 | El mensaje de tirada se etiqueta como "you" para el propio usuario. |

### FR4 — Sacar Carta de Baraja Española

| ID | Requisito |
|----|----------|
| FR4.1 | Baraja española completa: **48 naipes** (1-12 de Oros, Copas, Espadas, Bastos) + **2 comodines** (Rojo y Negro) = **50 cartas totales**. |
| FR4.2 | La baraja es **compartida por sala**: todos los jugadores sacan del mismo mazo. |
| FR4.3 | Al pulsar "Sacar Carta" (o tecla 'C'), se saca la carta superior del mazo. |
| FR4.4 | Cuando el mazo se agota (50 cartas sacadas), se **rebaraja automáticamente** al siguiente robo. |
| FR4.5 | El admin puede **rebarajar manualmente** en cualquier momento mediante el botón "Reiniciar Baraja". |
| FR4.6 | En el chat log se muestra: usuario, timestamp, carta visual renderizada con el diseño español (palo, número, glifo SVG), texto descriptivo, y contador de cartas restantes en el mazo. |

### FR5 — Chat de Texto

| ID | Requisito |
|----|----------|
| FR5.1 | Los usuarios pueden enviar mensajes de texto plano en el chat. |
| FR5.2 | Los mensajes de texto se muestran en el chat log con formato diferenciado (más sencillo que las tiradas/cartas, similar a un chat convencional). |
| FR5.3 | Cada mensaje muestra: usuario, timestamp, contenido del mensaje. |

### FR6 — Roles y Permisos

| ID | Requisito |
|----|----------|
| FR6.1 | El creador de la sala es **admin**. |
| FR6.2 | El admin puede: **expulsar usuarios** de la sala y **rebarajar el mazo** manualmente. |
| FR6.3 | Los usuarios no-admin pueden: tirar dados, sacar cartas, enviar mensajes de texto. |
| FR6.4 | Si el admin abandona la sala, se asigna automáticamente el rol de admin al usuario más antiguo que quede conectado. |

### FR7 — Gestión de Sala

| ID | Requisito |
|----|----------|
| FR7.1 | Máximo **20 usuarios** por sala. |
| FR7.2 | No se permiten nicknames duplicados dentro de la misma sala. |
| FR7.3 | Cada sala persiste en base de datos (no se destruye aunque quede vacía). |
| FR7.4 | Al entrar a una sala, el usuario recibe el historial de las últimas 50 tiradas/cartas/mensajes. |
| FR7.5 | Los eventos nuevos se transmiten por WebSocket a todos los usuarios conectados a la sala. |
| FR7.6 | La sala muestra en tiempo real la lista de usuarios conectados. |

### FR8 — Reconexión

| ID | Requisito |
|----|----------|
| FR8.1 | Si un usuario se desconecta, su sesión se mantiene durante **15 minutos**. |
| FR8.2 | Si se reconecta dentro de ese plazo con el mismo nickname, recupera su sesión. |
| FR8.3 | Pasados 15 minutos, la sesión expira y el nickname queda liberado. |

### FR9 — Temas Visuales

| ID | Requisito |
|----|----------|
| FR9.1 | 8 temas disponibles: Classic, Ocean, Sunset, Forest, Neon, Matrix, Batman, Spaceship. |
| FR9.2 | Cada tema define colores, bordes, sombras y efectos visuales — según CSS del OpenDesign. |
| FR9.3 | Toggle dark/light independiente del tema. |
| FR9.4 | La preferencia de tema se guarda en localStorage del navegador (no en servidor). |

### FR10 — Atajos de Teclado

| ID | Requisito |
|----|----------|
| FR10.1 | `Enter` / `Espacio`: lanzar dados. |
| FR10.2 | `C`: sacar carta. |
| FR10.3 | Teclas `1-9`, `0` (=10): fijar cantidad de dados directamente. |
| FR10.4 | `Shift + 1-9` (=11-19): fijar cantidad de dados. |
| FR10.5 | `Flecha arriba/abajo`: ajustar modificador +/- 1. |
| FR10.6 | `+` / `-`: ajustar cantidad de dados +/- 1. |

### FR11 — Pool de Reserva

| ID | Requisito |
|----|----------|
| FR11.1 | La sala tiene un contador de reserva entero ≥ 0, compartido por todos los usuarios. |
| FR11.2 | El pool se muestra en la **barra de controles inferior**, a la izquierda del contador de dados, como un bloque fijo con etiqueta "Pool" y el valor en grande. |
| FR11.3 | Valor inicial: **0** al crear la sala. Sin límite superior. El valor persiste en base de datos. |
| FR11.4 | **Cualquier usuario** puede incrementar/decrementar el pool con botones `+` y `−` de 1 en 1. El botón `−` se deshabilita cuando el valor es 0. |
| FR11.5 | **Solo el admin** ve un icono de lápiz (✎) junto al número del pool. Al pulsarlo se abre un pequeño popup modal donde puede teclear un valor exacto y confirmar con "Set". |
| FR11.6 | El popup de admin valida que el valor introducido sea ≥ 0. Si no lo es, muestra error y no cierra. |
| FR11.7 | Cada cambio en el pool genera una entrada de sistema en el chat log: "X aumentó el pool a Y" / "X redujo el pool a Y" / "X fijó el pool a Y". |
| FR11.8 | Visualmente: pool en 0 se muestra en gris apagado (--meta). Pool > 0 se muestra en color de acento (--accent). |
| FR11.9 | Atajo de teclado: `[` (corchete izquierdo) decrementa el pool, `]` (corchete derecho) lo incrementa. Solo si no hay un input enfocado. |

---

## 5. Requisitos No Funcionales

| ID | Requisito |
|----|----------|
| NFR1 | La latencia de transmisión de eventos (tirada/carta/mensaje) debe ser < 500ms entre el envío y la recepción por los demás usuarios en condiciones de red normales. |
| NFR2 | La aplicación debe soportar al menos 50 salas simultáneas con 20 usuarios cada una (1000 conexiones WebSocket concurrentes). |
| NFR3 | El frontend debe ser responsive (mobile-friendly), con breakpoints como mínimo para ≤600px (según diseño OpenDesign). |
| NFR4 | La UI de la sala debe ser un reflejo fiel del diseño en `open-design/diced-chat-dice-roller.html`. |
| NFR5 | El backend debe arrancar en modo desarrollo con H2 en memoria sin configuración adicional. |
| NFR6 | La configuración de PostgreSQL debe poder activarse mediante propiedades de entorno/profiles de Quarkus. |
| NFR7 | Las tiradas de dados usan `SecureRandom` en el backend para garantizar aleatoriedad criptográfica. |

---

## 6. Modelo de Datos (JPA)

### Entidades

```
Room
├── id: Long (PK, autogenerado)
├── code: String(7) (único, índice)
├── createdAt: Instant
├── deckState: String (JSON con estado del mazo)
├── adminNickname: String
└── poolValue: int (default 0)

RoomUser
├── id: Long (PK, autogenerado)
├── room: Room (FK, ManyToOne)
├── nickname: String
├── joinedAt: Instant
├── lastSeenAt: Instant
└── connected: Boolean

ChatEntry
├── id: Long (PK, autogenerado)
├── room: Room (FK, ManyToOne)
├── type: Enum (DICE_ROLL, CARD_DRAW, TEXT_MESSAGE, SYSTEM)
├── nickname: String
├── content: String (JSON con el payload específico del tipo)
├── timestamp: Instant
```

---

## 7. Protocolo WebSocket

Formato de mensajes: **JSON**.

### 7.1 Cliente → Servidor

| Tipo | Payload |
|------|---------|
| `join` | `{ "type": "join", "roomCode": "ABC1234", "nickname": "Mago" }` |
| `roll_dice` | `{ "type": "roll_dice", "count": 3, "modifier": 2 }` |
| `draw_card` | `{ "type": "draw_card" }` |
| `send_message` | `{ "type": "send_message", "text": "¡Hola!" }` |
| `reshuffle_deck` | `{ "type": "reshuffle_deck" }` |
| `pool_delta` | `{ "type": "pool_delta", "delta": 1 }` |
| `pool_set` | `{ "type": "pool_set", "value": 10 }` |
| `kick_user` | `{ "type": "kick_user", "targetNickname": "Troll" }` |
| `reconnect` | `{ "type": "reconnect", "roomCode": "ABC1234", "nickname": "Mago", "sessionToken": "..." }` |

### 7.2 Servidor → Cliente

| Tipo | Payload |
|------|---------|
| `joined` | `{ "type": "joined", "roomCode": "...", "users": [...], "history": [...], "deckRemaining": 50, "poolValue": 0, "isAdmin": true/false, "sessionToken": "..." }` |
| `error` | `{ "type": "error", "message": "Nickname already taken" }` |
| `dice_roll` | `{ "type": "dice_roll", "nickname": "Mago", "result": { "values": [6,3,5,2], "initialCount": 3, "diceTotal": 16, "modifier": 2, "total": 18, "explosions": 1 }, "timestamp": "..." }` |
| `card_draw` | `{ "type": "card_draw", "nickname": "Mago", "card": { "kind": "card", "suit": "oros", "suitName": "Oros", "rank": 7, "label": "7 de Oros" }, "remaining": 42, "reshuffledNext": false, "timestamp": "..." }` |
| `text_message` | `{ "type": "text_message", "nickname": "Mago", "text": "¡Hola!", "timestamp": "..." }` |
| `user_joined` | `{ "type": "user_joined", "nickname": "Mago" }` |
| `user_left` | `{ "type": "user_left", "nickname": "Mago", "reason": "disconnect" }` |
| `user_kicked` | `{ "type": "user_kicked", "nickname": "Troll", "byNickname": "Admin" }` |
| `admin_changed` | `{ "type": "admin_changed", "newAdminNickname": "Mago" }` |
| `deck_reshuffled` | `{ "type": "deck_reshuffled", "byNickname": "Admin", "remaining": 50 }` |
| `pool_updated` | `{ "type": "pool_updated", "value": 10, "delta": 1, "byNickname": "Mago" }` |
| `user_list` | `{ "type": "user_list", "users": ["Admin", "Mago", "Elfo"] }` |

### 7.3 Heartbeat

El servidor envía un `ping` cada 30 segundos. El cliente debe responder con `pong`. Si no hay respuesta en 60 segundos, el servidor considera la conexión perdida e inicia el timeout de 15 minutos.

---

## 8. Flujo Principal (Happy Path)

1. Usuario abre la app → ve pantalla de entrada.
2. Introduce nickname "Mago".
3. Pulsa "Crear Sala" → backend genera código `K7X2M9P`, crea sala, asigna a "Mago" como admin.
4. Frontend se conecta por WebSocket a `ws://host/room` y envía mensaje `join` con código y nickname.
5. Backend valida, registra al usuario, devuelve `joined` con lista de usuarios (solo él), historial vacío, y token de sesión.
6. Frontend redirige a la pantalla de sala.
7. "Mago" comparte el código `K7X2M9P` con sus amigos.
8. "Elfo" abre la app, introduce nickname, código, y pulsa "Unirse".
9. "Elfo" se conecta por WebSocket, backend valida y transmite `user_joined` a todos.
10. "Mago" selecciona 3 dados, modificador +2, pulsa "Roll".
11. Backend recibe `roll_dice`, genera números aleatorios [6, 3, 5] + explosión del 6 → [6, 3, 5, 2], total = 16 + 2 = 18.
12. Backend persiste la tirada y transmite `dice_roll` a todos los usuarios.
13. Frontend de "Mago" y "Elfo" muestran la tirada animada en el chat log.
14. "Elfo" pulsa "Sacar Carta", backend saca "7 de Oros", lo transmite a todos.
15. Ambos ven la carta renderizada con el diseño español.
16. Siguen jugando, enviando mensajes de texto, tirando dados, sacando cartas.
17. Cuando un usuario cierra el navegador, los demás ven `user_left`. Si vuelve en <15 min, se reconecta.
18. "Mago" pulsa `+` en el pool → sube a 1. "Elfo" lo ve subir en tiempo real y el chat muestra "Mago aumentó el pool a 1".
19. "Elfo" pulsa `+` dos veces → el pool sube a 3. Ambos lo ven.
20. "Mago" (admin) pulsa el lápiz, escribe "10" en el popup, confirma → el pool salta a 10 y el chat muestra "Admin fijó el pool a 10".

---

## 9. Flujos Alternativos

### FA1 — Nickname duplicado
1. Usuario intenta unirse con nickname ya usado en la sala.
2. Backend responde `{ "type": "error", "message": "Nickname already taken in this room" }`.
3. Frontend muestra mensaje de error y NO redirige.

### FA2 — Código de sala inválido
1. Usuario introduce código que no existe.
2. Backend responde `{ "type": "error", "message": "Room not found" }`.
3. Frontend muestra error.

### FA3 — Sala llena
1. Usuario intenta unirse a sala con 20 usuarios.
2. Backend responde `{ "type": "error", "message": "Room is full (max 20 users)" }`.

### FA4 — Expulsión
1. Admin envía `kick_user`.
2. Backend verifica que quien envía es admin, cierra la conexión WebSocket del usuario expulsado y transmite `user_kicked`.
3. El expulsado ve un mensaje en su frontend y es redirigido a la pantalla de entrada.

### FA5 — Reconexión exitosa
1. Usuario se desconecta (pierde internet / cierra pestaña).
2. Backend marca `connected = false` y notifica `user_left` con reason `disconnect`.
3. Si el usuario se reconecta en <15 min con el mismo nickname y `sessionToken`, backend restaura su sesión, notifica `user_joined` a los demás, y envía el historial perdido.

### FA6 — Timeout de sesión
1. Pasan 15 minutos sin reconexión.
2. Backend libera el nickname, elimina la sesión, y el usuario necesitaría unirse de nuevo (si el nick está libre).

### FA7 — Admin abandona
1. Admin se desconecta (o es expulsado).
2. Backend asigna admin al usuario conectado más antiguo.
3. Se transmite `admin_changed` a todos.

### FA8 — Baraja agotada
1. Se saca la última carta (la nº 50).
2. Backend marca `reshuffledNext: true` en el mensaje `card_draw`.
3. En el siguiente `draw_card`, el backend rebaraja automáticamente las 50 cartas y saca la primera del nuevo mazo.

### FA9 — Baraja reiniciada manualmente
1. Admin pulsa "Reiniciar Baraja".
2. Backend rebaraja, resetea el mazo, transmite `deck_reshuffled` a todos.
3. Todos ven el mensaje en el chat log.

---

## 10. Criterios de Aceptación

### Pantalla de Entrada
- [ ] AC1: Puedo introducir un nickname de 1-20 caracteres.
- [ ] AC2: Al pulsar "Crear Sala", se genera un código de 7 caracteres y entro como admin.
- [ ] AC3: Al pulsar "Unirse a Sala" con un código válido y nickname disponible, entro a la sala.
- [ ] AC4: Si el código no existe, veo un mensaje de error.
- [ ] AC5: Si el nickname está duplicado, veo un mensaje de error.

### Sala de Chat
- [ ] AC6: La sala se ve exactamente como el diseño OpenDesign (cabecera, chat log, controles).
- [ ] AC7: Puedo cambiar entre los 8 temas visuales y alternar dark/light.
- [ ] AC8: Veo la lista de usuarios conectados en tiempo real.

### Tirada de Dados
- [ ] AC9: Puedo ajustar la cantidad de dados (1-20) con los botones +/-.
- [ ] AC10: Puedo introducir un modificador (-99 a +99).
- [ ] AC11: Al tirar, veo los dados individuales, explosiones, total y desglose.
- [ ] AC12: Los demás usuarios ven mi tirada en tiempo real (<500ms).
- [ ] AC13: Las tiradas se persisten y aparecen al entrar en la sala.

### Sacar Carta
- [ ] AC14: Al sacar carta, veo la carta renderizada con el diseño español.
- [ ] AC15: La baraja se comparte entre todos los usuarios de la sala.
- [ ] AC16: Al agotarse, se rebaraja automáticamente.
- [ ] AC17: El admin puede rebarajar manualmente.

### Chat de Texto
- [ ] AC18: Puedo enviar mensajes de texto y los demás los ven.
- [ ] AC19: Los mensajes de texto se diferencian visualmente de tiradas y cartas.

### Admin
- [ ] AC20: Como admin, puedo expulsar a un usuario.
- [ ] AC21: Como admin, veo el botón "Reiniciar Baraja".
- [ ] AC22: Si el admin se va, otro usuario hereda el rol.

### Reconexión
- [ ] AC23: Si pierdo conexión y vuelvo en <15 min, recupero mi sesión.
- [ ] AC24: Si pasan >15 min, mi nickname se libera.

### Atajos
- [ ] AC25: Enter/Espacio lanza dados.
- [ ] AC26: Tecla C saca carta.
- [ ] AC27: Teclas numéricas fijan cantidad de dados.
- [ ] AC28: Flechas y +/- ajustan modificador y cantidad.

### Pool de Reserva
- [ ] AC29: El pool se ve en la barra de controles con etiqueta "Pool" y valor 0 al crear sala.
- [ ] AC30: Cualquier usuario puede pulsar + / − para cambiar el pool de 1 en 1.
- [ ] AC31: El botón − se deshabilita cuando el pool es 0.
- [ ] AC32: Solo el admin ve el icono de lápiz junto al pool.
- [ ] AC33: El admin puede abrir el popup con el lápiz, teclear un valor ≥ 0, y confirmar con "Set".
- [ ] AC34: Si el admin introduce un valor < 0, el popup muestra error y no se cierra.
- [ ] AC35: Cada cambio en el pool se refleja en el chat log de todos los jugadores.
- [ ] AC36: El pool > 0 se muestra en color de acento; el pool = 0 en gris apagado.
- [ ] AC37: Los atajos `[` y `]` decrementan/incrementan el pool respectivamente.

---

## 11. Restricciones y Consideraciones

- El frontend **no debe contener lógica de negocio de tiradas** (la generación de números aleatorios ocurre SIEMPRE en el backend).
- Cada sala tiene **exactamente un WebSocket endpoint** (`/ws/room`), el código de sala y nickname van en el payload.
- Las sesiones JWT se usan para autenticación de WebSocket (el token se emite al hacer join y se valida en cada mensaje).
- Para desarrollo local, el H2 es suficiente. El perfil `prod` activa PostgreSQL.
- Los iconos SVG de los palos de la baraja española están referenciados en el HTML del OpenDesign (URLs de Wikimedia). Se deben embeber o servir localmente para evitar dependencia externa.
- Las animaciones de entrada (`fade-in`) se mantienen según el CSS del OpenDesign.
- La fuente "Bangers" de Google Fonts se usa para el logo.
