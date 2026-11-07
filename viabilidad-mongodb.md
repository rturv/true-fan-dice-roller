# Estudio de viabilidad: migración de PostgreSQL a MongoDB

> **Proyecto**: True Fan Dice Roller
> **Fecha**: 2026-11-07
> **Alcance**: solo capa de persistencia del backend. **No** se toca frontend, **no** se cambia el contrato de API (WebSocket JSON) y **no** se cambia la seguridad (JWT).
> **Estado**: análisis completado. Decisión pendiente.

---

## 1. Estado actual de la persistencia

**Stack**: Quarkus 3.36 + Hibernate ORM (Panache) + JPA. H2 en dev, PostgreSQL en prod (`application.properties`).

**Modelo (3 entidades)**:

| Entidad | Campos clave | Naturaleza |
|---|---|---|
| `Room` | `code` (único), `createdAt`, `deckState` (**JSON en TEXT**), `adminNickname`, `poolValue`, `cardsEnabled` | Raíz |
| `RoomUser` | FK→Room, `nickname`, `sessionToken` (único), `connected`, `lastSeenAt` | Hijo |
| `ChatEntry` | FK→Room, `type`, `nickname`, `content` (**JSON en TEXT**), `timestamp` | Hijo |

**Hallazgo importante**: el modelo ya "huele" a documento. Dos columnas (`deckState` y `content`) son **JSON serializado dentro de columnas relacionales TEXT**, y las relaciones `RoomUser`/`ChatEntry` → `Room` son solo FK usadas como filtro (`WHERE room = :room`). No hay ningún join real, ni agregación, ni consulta que aproveche el SQL.

Toda la lógica está en `RoomService` (~25 métodos que usan `EntityManager`/JPQL), y lo que expone hacia `RoomWebSocket` son DTOs simples (`JoinResult`, `DiceRollResult`, etc.).

---

## 2. ¿MongoDB aporta algo interesante?

**Sí, aporta, pero es un beneficio incremental, no transformacional.**

### A favor

1. **Encaje natural del agregado.** Una `Room` es la raíz de un agregado con: mazo (`deck`), pool, usuarios conectados e historial. En Mongo sería *un documento* con `deck`, `users` y (parte del) historial embebidos. `deckState` y `content` dejarían de ser strings JSON parseados a mano y serían arrays/documentos nativos.
2. **Mejora real de concurrencia.** Hoy `poolValue` y `deckState` se modifican con *read-modify-write* dentro de `@Transactional` **sin optimistic locking**. Con varios usuarios tocando el pool o robando cartas a la vez hay riesgo de *lost update*. Mongo lo resuelve con operaciones atómicas: `$inc` para el pool y `$pop` para robar la carta superior. Este es el argumento técnicamente más sólido.
3. **Schema flexible** para el `content` del evento, que ya varía por tipo (`DICE_ROLL`, `CARD_DRAW`, `SYSTEM`...).

### En contra / matices

1. **PostgreSQL con JSONB daría el 80–90%** del beneficio (guardar `deckState`/`content` como JSONB nativo, e incluso un contador con SQL atómico) **sin tocar el ORM ni el dev**.
2. **Coste de migración real**: reescribir `RoomService` (~25 consultas JPQL), 3 entidades, cambiar el dev de H2 (cero-config) a *Dev Services Mongo* (requiere Docker) o Mongo embebido — esto **rompe NFR5** ("arranca en dev con H2 sin configuración adicional") y hay que actualizarlo explícitamente.
3. **Complejidad operativa**: transacciones multi-documento en Mongo requieren *replica set*; para esta app no hacen falta si embebemos, pero es un matiz a tener en cuenta.
4. **No gana funcionalidad nueva** ni rendimiento medible a esta escala (50 salas × 20 usuarios es trivial para ambos).

---

## 3. Veredicto / recomendación

- Si el objetivo es **"mejor encaje del modelo + concurrencia correcta"** y no importa el stack de datos: la opción de **menor riesgo es quedarse en PostgreSQL y mover `deckState`/`content` a JSONB** (cambio pequeño, sin tocar front/API/seguridad/dev).
- Si el objetivo es **"ir a MongoDB"** (stack objetivo, Atlas, escalado horizontal, preferencia de equipo, o modelo de documento de verdad): es **viable y totalmente acotado a la capa de persistencia**, respetando las tres restricciones. Ver plan abajo.

---

## 4. Plan de transformación (opción MongoDB)

Principio rector: **solo cambia la capa de persistencia.** `RoomWebSocket`, `GameService`, `JwtService`, `CorsFilter` y el health check **no se tocan**. El contrato WebSocket (tipos y payloads JSON) y la seguridad JWT quedan idénticos. `RoomService` conserva sus firmas públicas y DTOs; solo cambian sus tripas.

### Fase 0 — Decisiones de diseño (a confirmar)
- **D1. Embedding vs colecciones**: `Room` embebe `deck` y `users`; el historial (`ChatEntry`) va a **colección separada** `chat_entries` con índice `(roomCode, timestamp)` (preserva "persistir todo", consultando los últimos 50).
- **D2. Dev**: *Dev Services for MongoDB* (Docker, cero-config en `mvn quarkus:dev`) **vs** Mongo embebido (`flapdoodle`). Actualizar NFR5 en consecuencia.
- **D3. `findUserBySessionToken(token)` global** (sin room): se resuelve con un **índice multikey único** sobre `users.sessionToken` embebido.

### Fase 1 — Dependencias y configuración
- `pom.xml`: quitar `quarkus-hibernate-orm-panache`, `quarkus-hibernate-orm`, `quarkus-jdbc-h2`, `quarkus-jdbc-postgresql`; añadir `quarkus-mongodb-panache` y `quarkus-mongodb-client`.
- `application.properties`: sustituir bloques `%dev`/`%prod` de datasource por `quarkus.mongodb.connection-string`, `quarkus.mongodb.database` y Dev Services.
- `docker-compose.prod.yml`: `DB_URL/DB_USER/DB_PASSWORD` → `MONGO_CONNECTION`; añadir servicio `mongo` (o apuntar a Atlas). Actualizar `README.md`.

### Fase 2 — Entidades → documentos
- `Room` → `PanacheMongoEntity` con `List<CardInfo> deck`, `List<RoomUserDoc> users`, `poolValue`, `adminNickname`, `cardsEnabled`, `code` (índice único).
- `ChatEntry` → colección `chat_entries` con `roomCode`, `type`, `nickname`, `content` (documento nativo), `timestamp`.
- `GameService` deja de serializar a JSON string: guarda la `List<CardInfo>` directamente.

### Fase 3 — Reescribir `RoomService` (mismas firmas públicas)
- Sustituir JPQL por Panache Mongo: `find`, `update`, `$inc`, `$pop`, `findOneAndUpdate`.
- Mapear: `createAndJoinRoom`, `joinRoom`, `reconnectToRoom`, `markDisconnected`, `performDiceRoll`, `performCardDraw`, `sendTextMessage`, `poolDelta`/`poolSet`, `reshuffleDeck`, `toggleCards`, `kickUser`, `transferAdminIfNeeded`, `getRecentHistory`, etc.

### Fase 4 — Concurrencia atómica (la mejora clave)
- Pool: `$inc` en vez de read-modify-write.
- Robar carta: `findOneAndUpdate` con `$pop` (último elemento) devolviendo la carta extraída — elimina *lost updates* al robar.

### Fase 5 — Pruebas
- Hoy no hay tests (`src/test` vacío). Añadir tests de integración con Dev Services/Testcontainers que verifiquen que el **contrato WebSocket** sigue produciendo exactamente los mismos JSONs.

### Fase 6 — Verificación de contrato y seguridad
- Levantar front + backend con Mongo y validar flujo completo (join, roll, card, chat, pool, kick, reconnect) sin cambios en front. Confirmar que JWT sigue validándose igual.

### Fase 7 — Migración de datos (solo si hay prod con datos)
- Script puntual Postgres → Mongo (rooms + chat). Si el proyecto está verde, no aplica.

**Esfuerzo estimado**: medio — la mayor parte es reescribir `RoomService`; las fases 5–7 son verificación/migración.
**Riesgo principal**: el cambio de H2 a Dev Services Mongo en dev, y asegurar el comportamiento atómico del mazo.

---

## 5. Archivos relevantes (referencia)

- `backend/src/main/java/.../entity/` — `Room`, `RoomUser`, `ChatEntry` (JPA).
- `backend/src/main/java/.../service/RoomService.java` — toda la persistencia/lógica (~25 queries).
- `backend/src/main/java/.../service/GameService.java` — mazo + serialización JSON.
- `backend/src/main/java/.../websocket/RoomWebSocket.java` — contrato WS (no se toca).
- `backend/src/main/java/.../service/JwtService.java` — seguridad (no se toca).
- `backend/src/main/resources/application.properties` — datasource H2/PostgreSQL.
- `docker-compose.prod.yml` / `docker-compose.desa.yml` — despliegue.
- `open-design/SPECIFICATION.md` — especificación (incluye NFR5).
