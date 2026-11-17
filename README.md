# True Fan Dice Roller 🎲🃏

Aplicación tipo chat para lanzar dados d6 (con explosión y modificador) y sacar cartas de una baraja española virtual, en tiempo real con amigos.

**Stack**: Angular 21 (frontend) + Quarkus 3.40 LTS / Java 21 (backend) + WebSockets + JPA (H2 en desarrollo, PostgreSQL en producción).

---

## Índice

- [Arquitectura](#arquitectura)
- [Funcionalidades](#funcionalidades)
- [Efectos de tirada](#efectos-de-tirada)
- [Desarrollo local](#desarrollo-local)
- [Tests](#tests)
- [Despliegue con Docker](#despliegue-con-docker)
- [Despliegue estático en Render](#despliegue-estático-en-render)
- [Despliegue en GitHub Pages](#despliegue-en-github-pages)
- [Configuración de backend URL](#configuración-de-backend-url)
- [Estructura del proyecto](#estructura-del-proyecto)

---

## Arquitectura

La aplicación sigue una arquitectura de tres capas: un frontend estático, un backend que concentra la lógica de juego y la comunicación en tiempo real, y PostgreSQL como almacenamiento.

```mermaid
flowchart LR
    Browser["Navegador<br/>(escritorio / móvil)"]
    FE["Frontend<br/>Angular 21<br/>nginx o sitio estático"]
    BE["Backend<br/>Quarkus 3.40 · Java 21<br/>WebSocket + HTTP"]
    DB[("PostgreSQL<br/>perfil prod")]
    H2[("H2 en memoria<br/>perfil dev")]

    Browser -->|"HTTPS"| FE
    FE -->|"WSS · /ws/room"| BE
    FE -->|"GET /health/ready"| BE
    BE -->|"JPA / Hibernate"| DB
    BE -.->|"JPA / Hibernate"| H2
```

- **Frontend**: SPA de Angular servida por nginx (Docker) o por un CDN estático (Render, GitHub Pages). No guarda estado de juego; solo mantiene la sesión y el tema.
- **Backend**: Quarkus expone el WebSocket `/ws/room` para el chat y las acciones de juego, y los endpoints de salud `/health/live` y `/health/ready`. Es la única capa que habla con la base de datos.
- **Base de datos**: PostgreSQL en producción. En desarrollo el perfil `dev` usa H2 en memoria, por lo que no hace falta levantar nada externo.
- **Comunicación**: el navegador descarga la SPA desde el frontend, pero el WebSocket y el health check van directamente al backend (por eso `BACKEND_WS_URL` debe apuntar al backend, no al frontend).

---

## Funcionalidades

- **Salas en tiempo real** con código de 7 caracteres, nickname y sesión firmada con JWT (reconexión automática).
- **Dados d6 explosivos**: cada 6 genera otra tirada; soporte de modificador y de una reserva compartida (`pool`).
- **Efectos de tirada**: confeti para las tiradas buenas y lluvia para las pifias, dentro de la tarjeta y a pantalla completa solo para el autor (comando oculto `/fx` para previsualizarlos).
- **Baraja española** de 50 naipes (incluidos los dos comodines), desactivada por defecto en salas nuevas, con rebarajado automático al salir un comodín o agotarse el mazo.
- **Chat** con historial reciente, entradas de sistema (altas, bajas, cambios de admin, tiradas y cartas) e historial local de mensajes con `↑`/`↓`.
- **Comandos de chat**: `/carta`, `/roll` y `/Nd6±M` (por ejemplo `/3d6+3`). Lo que no encaja con un comando se envía como mensaje normal.
- **Panel de admin**: activar/desactivar cartas, expulsar jugadores y usar la reserva.
- **Listado de jugadores** al pulsar el contador del header.
- **Indicador de estado del backend** con comprobación periódica de `/health/ready`.
- **14 temas visuales** (clásico, Alejo, ocean, tardeo, bosque, pergamino, sakura, neón, playeo, Drácula, Halloween, Matrix, Batman y espacial) que se guardan en el navegador.
- …y algún secreto más que no vamos a desvelar aquí.

---

## Efectos de tirada

Las tiradas especiales se calculan en el cliente a partir del mismo evento `dice_roll` que recibe toda la sala, así que todos los jugadores ven el mismo resultado. El efecto es solo visual: no altera la tirada, no se guarda y no se reproduce al entrar en la sala.

### Cuándo se disparan

Para una tirada con `n` dados iniciales:

```text
Σ = diceTotal   suma de todos los dados, incluidas las explosiones, sin modificador
E = explosions  número de dados extra generados (cada 6 encadena otro dado)

μ = 4.2 · n
σ = 3.262 · √n

legendaria:  Σ ≥ ceil(μ + 2.5σ)
pifia:       n ≥ 2 y Σ ≤ max(n, floor(μ − 1.75σ))
cadena:      E ≥ ceil(0.2n + 2.5 · 0.49√n)
```

De dónde salen los números:

- Un d6 normal tiene media 3.5. Como cada 6 añade otro dado, la media del d6 explosivo es `3.5 / (1 − 1/6) = 4.2`.
- La desviación típica del d6 explosivo es aproximadamente `3.262`.
- El número de explosiones por dado sigue una geométrica con media `0.2` y desviación `0.49`.
- La distribución tiene una cola derecha más larga, por eso la z de pifia (`1.75`) es menor que la de legendaria (`2.5`): así ambas son raras de forma parecida.
- El modificador **no cuenta** para disparar el efecto, solo para el total que se muestra en la tirada.

Umbrales para los recuentos más habituales:

| Dados (n) | Legendaria (Σ ≥) | Pifia (Σ ≤) | Cadena (E ≥) | Probabilidad aprox. (L / P / C) |
|---:|---:|---:|---:|---|
| 1 | 13 | — | 2 | 2.8 % / — / 2.8 % |
| 2 | 20 | 2 | 3 | 3.0 % / 2.8 % / 1.6 % |
| 3 | 27 | 3 | 3 | 2.5 % / 0.5 % / 3.6 % |
| 4 | 34 | 5 | 4 | 2.0 % / 0.4 % / 1.8 % |
| 5 | 40 | 8 | 4 | 1.9 % / 0.7 % / 3.1 % |
| 6 | 46 | 11 | 5 | 1.8 % / 1.0 % / 1.6 % |
| 10 | 68 | 23 | 6 | 1.7 % / 1.2 % / 2.7 % |
| 20 | 121 | 58 | 10 | 1.4 % / 2.4 % / 1.5 % |

Las tres condiciones son independientes entre sí: una misma tirada puede ser legendaria y cadena a la vez. La pifia y la cadena no se muestran juntas.

### Ejemplos

**Legendaria con 2 dados**

```text
valores: [6, 6, 5, 5]
n = 2, Σ = 22, E = 2
22 ≥ 20 → legendaria; 2 < 3 → no hay cadena
```

**Legendaria y cadena a la vez con 2 dados**

```text
valores: [6, 6, 6, 1, 1]
n = 2, Σ = 20, E = 3
20 ≥ 20 → legendaria; 3 ≥ 3 → también cadena
```

**Legendaria sin cadena con 5 dados**

```text
valores: [6, 6, 6, 5, 5, 5, 5, 5]
n = 5 (los cinco primeros), E = 3, Σ = 43
43 ≥ 40 → legendaria; 3 < 4 → no hay cadena
```

**Cadena sin legendaria con 5 dados**

```text
valores: [6, 6, 6, 6, 1, 1, 1, 1, 1]
n = 5, E = 4, Σ = 29
29 < 40 → no es legendaria; 4 ≥ 4 → cadena
```

**Pifia con 5 dados**

```text
valores: [1, 1, 1, 1, 1]
n = 5, Σ = 5, E = 0
5 ≤ 8 → pifia
```

**El modificador no dispara el efecto**

```text
valores: [1, 1], modificador: +99
Σ = 2 (sigue siendo pifia), total mostrado = 101
```

### Qué se ve

- **Legendaria** y **cadena** → confeti.
- **Pifia** → lluvia.
- Los demás jugadores lo ven dentro de la tarjeta de la tirada. Si eres tú quien lanza, el efecto ocupa la pantalla.
- Los chips (`✦ tirada legendaria`, `✖ pifia`, `⚡ cadena ×N`) quedan en la entrada como registro; las partículas son transitorias.

Comandos ocultos de prueba, locales y sin enviar nada a la sala:

```text
/fx                    rota legendaria → pifia → cadena
/fx alta 5             confeti dentro de la tarjeta
/fx pifia              lluvia dentro de la tarjeta
/fx cadena             confeti dentro de la tarjeta
/fx pantalla alta 5    confeti a pantalla completa
```

La lógica está en `frontend/src/app/components/room/roll-effects.ts` (umbrales y detección) y la capa visual en `frontend/src/app/components/room/roll-effect/roll-effect.ts`.

---

## Desarrollo local

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| JDK | 21 |
| Apache Maven | 3.9+ |
| Node.js | 22.x (Angular 21 admite `^20.19`, `^22.12` o `>=24`) |
| Angular CLI | 21.x (`npm install -g @angular/cli@21`) |

### Backend (Quarkus)

```bash
cd backend
$env:JAVA_HOME="C:\programas\jdk-21.0.10"   # Windows
export JAVA_HOME=/path/to/jdk-21              # Linux/macOS

mvn quarkus:dev
```

El backend arranca en `http://localhost:8080` con H2 en memoria y recarga en caliente.

- Perfil `dev` (por defecto): H2 en memoria, esquema `drop-and-create`.
- Perfil `prod`: PostgreSQL. Se puede probar en local con `mvn quarkus:dev -Dquarkus.profile=prod` y las variables `DB_*`.

Endpoints útiles:

| Endpoint | Uso |
|----------|-----|
| `http://localhost:8080/ws/room` | WebSocket de la sala |
| `http://localhost:8080/health/live` | Liveness |
| `http://localhost:8080/health/ready` | Readiness (verifica la conexión a base de datos) |

### Frontend (Angular)

```bash
cd frontend
npm install
npx ng serve
```

El frontend arranca en `http://localhost:4200` y conecta automáticamente al backend en `localhost:8080` (ver `proxy.conf.json` y la auto-detección de `env.js`).

---

## Tests

```bash
# Frontend (Vitest)
cd frontend
npx ng test --watch=false

# Backend (JUnit + Quarkus Test)
cd backend
mvn test
```

---

## Despliegue con Docker

### docker-compose (recomendado)

#### Desarrollo (H2 en memoria)

```bash
docker compose -f docker-compose.desa.yml up -d
```

Abrir `http://localhost:4200`. El backend usa H2 en memoria, no necesita base de datos externa.

#### Producción (PostgreSQL externo)

```bash
export DB_URL=jdbc:postgresql://mi-postgres:5432/diceroller
export DB_USER=postgres
export DB_PASSWORD=secreta
export JWT_SECRET=clave-hmac-de-al-menos-32-caracteres!!
export BACKEND_WS_URL=wss://api.midominio.com/ws/room

docker compose -f docker-compose.prod.yml up -d
```

PostgreSQL **no está incluido** en el compose — debes tenerlo corriendo aparte.

---

### Construcción manual de imágenes

#### Frontend

```bash
cd frontend
docker build -t dice-roller-frontend .
```

```bash
docker run -d \
  -p 80:80 \
  -e BACKEND_WS_URL="wss://tu-servidor.com/ws/room" \
  -e BACKEND_HTTP_URL="https://tu-servidor.com" \
  --name dice-front \
  dice-roller-frontend
```

La imagen es multi-stage (`node:22-alpine` → `nginx:1.27-alpine`) y la URL del backend se inyecta en runtime mediante `envsubst`; no hace falta reconstruir al cambiar de entorno.

#### Backend — Imagen JVM estándar

```bash
cd backend
docker build -t true-fan-dice-roller-ws:jvm .
```

El Dockerfile multi-stage compila con Maven y deja una imagen final con JDK 21.

**Ejecutar con PostgreSQL externo:**

```bash
docker run -d \
  -p 8080:8080 \
  -e QUARKUS_PROFILE=prod \
  -e DB_URL=jdbc:postgresql://mi-postgres:5432/diceroller \
  -e DB_USER=postgres \
  -e DB_PASSWORD=secreta \
  -e JWT_SECRET="clave-hmac-de-al-menos-32-caracteres!!" \
  --name dice-back \
  true-fan-dice-roller-ws:jvm
```

#### Backend — Imagen nativa

Requiere Docker para compilar en contenedor. Quarkus 3.36+ necesita GraalVM/Mandrel **25** como mínimo para el build nativo, aunque el bytecode siga siendo Java 21. El perfil `native` ya apunta al builder image `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-25`.

```bash
cd backend
mvn package -Pnative -Dquarkus.native.container-build=true -DskipTests
docker build -f src/main/docker/Dockerfile.native -t true-fan-dice-roller-ws:native .
```

```bash
docker run -d \
  -p 8080:8080 \
  -e QUARKUS_PROFILE=prod \
  -e DB_URL=jdbc:postgresql://postgres:5432/diceroller \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  --name dice-back-native \
  true-fan-dice-roller-ws:native
```

La imagen nativa arranca en **milisegundos** y consume mucha menos RAM.

> Guía completa del build nativo y publicación en GHCR (`ghcr.io/rturv/true-fan-dice-roller-ws`): [`docs/backend-native-image.md`](docs/backend-native-image.md).

#### Publicación automática en GHCR

El workflow [`.github/workflows/release-images.yml`](.github/workflows/release-images.yml) compila y publica las dos imágenes al empujar un tag de versión:

```bash
git tag v1.0.0
git push origin v1.0.0
```

| Imagen | Contenido |
|---|---|
| `ghcr.io/rturv/true-fan-dice-roller-web` | Frontend Angular servido por nginx |
| `ghcr.io/rturv/true-fan-dice-roller-ws` | Backend Quarkus **nativo** |

Se publican las etiquetas `1.0.0`, `1.0` y `latest` (esta última solo en releases estables, sin guion en el tag). Usa el `GITHUB_TOKEN` del propio workflow, así que no hay que configurar ningún secret. Para probar el pipeline sin publicar versión: Actions → *Release images* → *Run workflow* (publica solo `sha-<short>`).

### Docker Compose completo (ejemplo)

`docker-compose.yml` (puedes crearlo en la raíz):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: diceroller
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    image: ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0
    ports:
      - "8080:8080"
    environment:
      QUARKUS_PROFILE: prod
      DB_URL: jdbc:postgresql://postgres:5432/diceroller
      DB_USER: postgres
      DB_PASSWORD: postgres
    depends_on:
      - postgres

  frontend:
    image: ghcr.io/rturv/true-fan-dice-roller-web:1.0.0
    ports:
      - "80:80"
    environment:
      BACKEND_WS_URL: ws://localhost:8080/ws/room
      BACKEND_HTTP_URL: http://localhost:8080
    depends_on:
      - backend

volumes:
  pgdata:
```

---

## Despliegue estático en Render

El frontend no necesita contenedor: se puede publicar como **Static Site**.

> Guía detallada, con rewrites de SPA, variables y resolución de problemas: [`docs/render-static-site.md`](docs/render-static-site.md).

1. **New + → Static Site** y conecta el repositorio.
2. Configuración:

   | Campo | Valor |
   |-------|-------|
   | Root Directory | `frontend` |
   | Build Command | `npm ci && npm run build:static` |
   | Publish Directory | `dist/frontend/browser` |
   | Node version | `22.22.0` (variable `NODE_VERSION`) |

3. Variables de entorno:

   | Variable | Ejemplo |
   |----------|---------|
   | `BACKEND_WS_URL` | `wss://tu-backend.onrender.com/ws/room` |
   | `BACKEND_HTTP_URL` | `https://tu-backend.onrender.com` |

4. **Redirects/Rewrites** → regla `/*` → `/index.html`, acción **Rewrite** (necesario para las rutas de Angular como `/room/CODIGO`).

`npm run build:static` ejecuta `ng build --configuration production` y después `scripts/generate-env.mjs`, que genera `assets/env.js` a partir de las variables de entorno del build.

---

## Despliegue en GitHub Pages

### 1. Configurar secrets del repositorio

En **Settings > Secrets and variables > Actions**, añade:

| Secret | Ejemplo | Descripción |
|--------|---------|-------------|
| `BACKEND_WS_URL` | `wss://api.midominio.com/ws/room` | URL WebSocket del backend |
| `BACKEND_HTTP_URL` | `https://api.midominio.com` | URL HTTP del backend |

Si no pones secrets, el frontend usará auto-detección relativa (solo útil si sirves backend y frontend desde el mismo dominio).

### 2. Habilitar GitHub Pages

En **Settings > Pages**:
- **Source**: GitHub Actions

### 3. Desplegar

El workflow se ejecuta automáticamente al hacer push a `main` (cuando se toca `frontend/`).

También puedes ejecutarlo manualmente:
1. Ve a **Actions > Deploy Frontend to GitHub Pages**
2. Pulsa **Run workflow**
3. Opcional: introduce la URL del backend manualmente

### 4. Configurar base-href

Si tu repositorio se llama `usuario/repo`, la URL será `https://usuario.github.io/repo/`.
El workflow ya ajusta `--base-href` automáticamente.

Si tu repo es `usuario.github.io` (site root), cambia en el workflow:

```yaml
--base-href /
```

---

## Configuración de backend URL

La URL del backend se define en **runtime** (Docker) o en **build time** (hosting estático), sin meterla en el bundle de Angular:

### Mecanismo

1. `src/index.html` carga `assets/env.js` antes del bundle.
2. `src/assets/env.template.js` contiene los placeholders `${BACKEND_WS_URL}` y `${BACKEND_HTTP_URL}`.
3. Según el entorno se genera `assets/env.js`:
   - **Docker**: `docker-entrypoint.sh` ejecuta `envsubst` al arrancar el contenedor.
   - **Render / builds estáticos**: `scripts/generate-env.mjs` lo genera después del build (`npm run build:static`).
   - **GitHub Pages**: el workflow lo genera desde los secrets.
4. El frontend lee `window.__env.backendWsUrl` y `window.__env.backendHttpUrl`.

### Variables de entorno

| Variable | Propósito | Ejemplo |
|----------|-----------|---------|
| `BACKEND_WS_URL` | URL completa del WebSocket | `wss://api.example.com/ws/room` |
| `BACKEND_HTTP_URL` | URL HTTP del backend (health check) | `https://api.example.com` |
| `JWT_SECRET` | Clave HMAC-SHA256 (mínimo 32 caracteres) | `clave-hmac-de-al-menos-32-caracteres!!` |
| `DB_URL` | JDBC de PostgreSQL (perfil `prod`) | `jdbc:postgresql://host:5432/diceroller` |
| `DB_USER` / `DB_PASSWORD` | Credenciales de PostgreSQL | `postgres` / `secreta` |
| `CORS_ORIGINS` | Orígenes permitidos (por defecto `*`) | `https://app.midominio.com` |

Si `BACKEND_WS_URL` está vacío, el frontend intenta auto-detectarlo:
- **Dev** (`:4200`): conecta a `localhost:8080`.
- **Producción**: conecta al mismo host desde donde se sirve (solo válido con proxy inverso).

---

## Estructura del proyecto

```
.
├── backend/                              # Quarkus 3.40 LTS — Java 21
│   ├── src/main/java/.../entity/         # JPA: Room, RoomUser, ChatEntry
│   ├── src/main/java/.../service/        # GameService, RoomService, JwtService, RoomCleanupService
│   ├── src/main/java/.../websocket/      # RoomWebSocket (/ws/room)
│   ├── src/main/java/.../                # MyLivenessCheck, MyReadinessCheck
│   └── src/main/docker/                  # Dockerfile.jvm, .native, .legacy-jar
├── frontend/                             # Angular 21
│   ├── src/app/components/lobby/         # Pantalla de entrada
│   ├── src/app/components/room/          # Sala, comandos de chat y listado de jugadores
│   ├── src/app/components/room/easter-egg/ # Efectos secretos
│   ├── src/app/components/backend-status-indicator/
│   ├── src/app/services/                 # WebSocket y health check
│   ├── src/assets/env.template.js        # Plantilla de entorno runtime
│   ├── scripts/generate-env.mjs          # Genera env.js en builds estáticos
│   ├── Dockerfile                        # Multi-stage (build + nginx)
│   ├── nginx.conf                        # Configuración nginx SPA
│   └── docker-entrypoint.sh              # Inyección de env vars
├── open-design/                          # Diseño visual y especificación
├── docker-compose.desa.yml               # Compose de desarrollo (H2)
├── docker-compose.prod.yml               # Compose de producción (PostgreSQL)
└── .github/workflows/release-images.yml  # Build y push de ambas imágenes a GHCR
```

---

## Especificación completa

Ver [`open-design/SPECIFICATION.md`](open-design/SPECIFICATION.md) para la especificación detallada del proyecto, incluyendo:

- Grupos de requisitos funcionales (FR1–FR11)
- Protocolo WebSocket completo
- Modelo de datos JPA
- Flujos alternativos
- Criterios de aceptación
