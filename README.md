# True Fan Dice Roller 🎲🃏

Aplicación tipo chat para lanzar dados d6 (con explosión y modificador) y sacar cartas de una baraja española virtual, en tiempo real con amigos.

**Stack**: Angular 21+ (frontend) + Quarkus 3.36 / Java 21 (backend) + WebSockets + JPA (H2/PostgreSQL)

---

## Índice

- [Desarrollo local](#desarrollo-local)
- [Despliegue con Docker](#despliegue-con-docker)
- [Despliegue en GitHub Pages](#despliegue-en-github-pages)
- [Configuración de backend URL](#configuración-de-backend-url)
- [Estructura del proyecto](#estructura-del-proyecto)

---

## Desarrollo local

### Requisitos

| Herramienta | Versión |
|-------------|---------|
| JDK | 21+ |
| Apache Maven | 3.9+ |
| Node.js | 22.x |
| Angular CLI | 21.x (`npm install -g @angular/cli@21`) |

### Backend (Quarkus)

```bash
cd backend
$env:JAVA_HOME="C:\programas\jdk-21.0.10"   # Windows
export JAVA_HOME=/path/to/jdk-21              # Linux/macOS

mvn quarkus:dev
```

El backend arranca en `http://localhost:8080` con H2 en memoria. El perfil `prod` activa PostgreSQL:

```bash
mvn quarkus:dev -Dquarkus.profile=prod
```

### Frontend (Angular)

```bash
cd frontend
npm install
npx ng serve
```

El frontend arranca en `http://localhost:4200`. Conecta automáticamente al backend en `localhost:8080`.

---

## Despliegue con Docker

### Frontend (Angular + nginx)

**Construir imagen:**

```bash
cd frontend
docker build -t dice-roller-frontend .
```

**Ejecutar:**

```bash
docker run -d \
  -p 80:80 \
  -e BACKEND_WS_URL="ws://tu-servidor.com/ws/room" \
  -e BACKEND_HTTP_URL="https://tu-servidor.com" \
  --name dice-front \
  dice-roller-frontend
```

La URL del backend se inyecta en runtime mediante `envsubst` — no necesitas reconstruir la imagen al cambiar de entorno.

### Backend — Imagen JVM estándar

**Paso 1: Empaquetar**

```bash
cd backend
mvn package -DskipTests
```

**Paso 2: Construir imagen Docker**

```bash
docker build -f src/main/docker/Dockerfile.jvm -t dice-roller-backend:jvm .
```

**Paso 3: Ejecutar**

```bash
docker run -d \
  -p 8080:8080 \
  -e QUARKUS_PROFILE=prod \
  -e DB_URL=jdbc:postgresql://postgres:5432/diceroller \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  --name dice-back \
  dice-roller-backend:jvm
```

### Backend — Imagen nativa (ultra-rápida)

Requiere GraalVM o Docker (para build nativo en contenedor).

**Paso 1: Build nativo**

```bash
cd backend
mvn package -Pnative -Dquarkus.native.container-build=true -DskipTests
```

> `-Dquarkus.native.container-build=true` usa Docker para compilar sin instalar GraalVM localmente.

**Paso 2: Construir imagen Docker**

```bash
docker build -f src/main/docker/Dockerfile.native -t dice-roller-backend:native .
```

**Paso 3: Ejecutar**

```bash
docker run -d \
  -p 8080:8080 \
  -e QUARKUS_PROFILE=prod \
  -e DB_URL=jdbc:postgresql://postgres:5432/diceroller \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  --name dice-back-native \
  dice-roller-backend:native
```

La imagen nativa arranca en **milisegundos** y consume mucha menos RAM.

### Docker Compose (todo junto)

`docker-compose.yml` (puedes crearlo en la raíz):

```yaml
version: '3.8'
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
    image: dice-roller-backend:native
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
    image: dice-roller-frontend
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

## Despliegue en GitHub Pages

### 1. Configurar secrets del repositorio

En **Settings > Secrets and variables > Actions**, añade:

| Secret | Ejemplo | Descripción |
|--------|---------|-------------|
| `BACKEND_WS_URL` | `wss://api.midominio.com/ws/room` | URL WebSocket del backend |
| `BACKEND_HTTP_URL` | `https://api.midominio.com` | URL HTTP del backend |

Si no pones secrets, el frontend usará auto-detección relativa (útil si sirves backend y frontend desde el mismo dominio).

### 2. Habilitar GitHub Pages

En **Settings > Pages**:
- **Source**: GitHub Actions

### 3. Desplegar

El workflow se ejecuta automáticamente al hacer push a `main` (toca archivos de `frontend/`).

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

La URL del backend se define en **runtime**, sin reconstruir la aplicación:

### Mecanismo

1. `src/assets/env.template.js` contiene placeholders `${BACKEND_WS_URL}`
2. En Docker: el entrypoint ejecuta `envsubst` para generar `assets/env.js`
3. En GitHub Pages: el workflow genera `assets/env.js` desde secrets
4. El frontend lee `window.__env.backendWsUrl` al conectarse

### Variables de entorno

| Variable | Propósito | Ejemplo |
|----------|-----------|---------|
| `BACKEND_WS_URL` | URL completa del WebSocket | `wss://api.example.com/ws/room` |
| `BACKEND_HTTP_URL` | URL HTTP del backend | `https://api.example.com` |

Si `BACKEND_WS_URL` está vacío, el frontend intenta auto-detectarlo:
- **Dev** (`:4200`): conecta a `localhost:8080`
- **Producción**: conecta al mismo host desde donde se sirve

---

## Estructura del proyecto

```
.
├── backend/                    # Quarkus 3.36 — Java 21
│   ├── src/main/java/.../entity/       # JPA: Room, RoomUser, ChatEntry
│   ├── src/main/java/.../service/      # GameService, RoomService, CorsFilter
│   ├── src/main/java/.../websocket/    # RoomWebSocket (/ws/room)
│   └── src/main/docker/               # Dockerfile.jvm, .native, .legacy-jar
├── frontend/                   # Angular 21+
│   ├── src/app/components/lobby/      # Pantalla de entrada
│   ├── src/app/components/room/       # Chat room (estilo OpenDesign)
│   ├── src/app/services/              # WebSocket service
│   ├── src/assets/env.template.js     # Plantilla de entorno runtime
│   ├── Dockerfile                     # Multi-stage (build + nginx)
│   ├── nginx.conf                     # Configuración nginx SPA
│   └── docker-entrypoint.sh           # Inyección de env vars
├── open-design/                # Diseño visual de referencia
├── .github/workflows/          # GitHub Actions
└── .gitignore
```

---

## Especificación completa

Ver [`open-design/SPECIFICATION.md`](open-design/SPECIFICATION.md) para la especificación detallada del proyecto, incluyendo:

- 10 grupos de requisitos funcionales (FR1–FR10)
- Protocolo WebSocket completo (7 msg cliente → servidor, 12 msg servidor → cliente)
- Modelo de datos JPA
- Flujos alternativos (9 casos)
- 28 criterios de aceptación
