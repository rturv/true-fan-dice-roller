# Backend: imagen nativa en GHCR

El backend se publica como una **imagen Docker con el ejecutable nativo de Quarkus** (sin JVM) y se guarda en GitHub Container Registry:

```text
ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0
```

La publicación está **automatizada** con GitHub Actions (`.github/workflows/release-images.yml`): al empujar un tag `vX.Y.Z` se compila el nativo y se sube la imagen. Este documento describe ese pipeline y, además, el proceso manual equivalente para reproducirlo en local.

---

## Índice

- [Publicación automática (GitHub Actions)](#publicación-automática-github-actions)
- [Cómo se construye](#cómo-se-construye)
- [Requisitos](#requisitos)
- [1. Build nativo e imagen](#1-build-nativo-e-imagen)
- [2. Publicar en GHCR (manual)](#2-publicar-en-ghcr-manual)
- [3. Ejecutar la imagen](#3-ejecutar-la-imagen)
- [4. Desplegar en Render](#4-desplegar-en-render)
- [Verificación](#verificación)
- [Actualizar la versión](#actualizar-la-versión)
- [Problemas comunes](#problemas-comunes)
- [Por qué nativo](#por-qué-nativo)

---

## Publicación automática (GitHub Actions)

El workflow [`.github/workflows/release-images.yml`](../.github/workflows/release-images.yml) publica las dos imágenes en GHCR al empujar un tag de versión:

```bash
git tag v1.0.0
git push origin v1.0.0
```

| Imagen | Contenido |
|---|---|
| `ghcr.io/rturv/true-fan-dice-roller-ws` | Backend Quarkus **nativo** (este documento) |
| `ghcr.io/rturv/true-fan-dice-roller-web` | Frontend Angular servido por nginx |

Qué hace el job `Backend (nativo)`:

1. `actions/setup-java` instala JDK 21 y cachea `~/.m2`.
2. `./mvnw clean package -Pnative -DskipTests -Dquarkus.native.container-build=true` compila el bytecode en el runner y ejecuta `native-image` dentro del builder image Mandrel 25 definido en el `pom.xml`.
3. `docker/build-push-action` empaqueta el binario `target/*-runner` con `Dockerfile.native` y lo sube a GHCR con las etiquetas derivadas del tag.

Etiquetas publicadas para el tag `v1.2.3`:

| Etiqueta | Uso |
|---|---|
| `1.2.3` | Versión exacta (recomendada para producción) |
| `1.2` | Última revisión de la serie 1.2 |
| `latest` | Solo en releases estables (tag sin guion, p. ej. `v1.2.3`) |

`workflow_dispatch` (Actions → *Release images* → *Run workflow*) permite probar el pipeline sin publicar versión: en ese caso solo se sube `sha-<short>`.

> El runner `ubuntu-latest` trae Docker Engine funcionando, por eso `container-build=true` y el `docker build` posterior funcionan sin configuración adicional. Los runners son efímeros: el builder image de Mandrel se descarga en cada ejecución (1-2 min extra).

---

## Cómo se construye

```mermaid
flowchart LR
    Tag["git push origin v1.0.0"] --> CI["GitHub Actions<br/>release-images.yml"]
    CI --> Mvn["JDK 21 + mvn package -Pnative<br/>native-image en contenedor Mandrel 25"]
    Mvn --> Bin["target/*-runner<br/>binario ELF x86-64"]
    Bin --> Img["docker build<br/>Dockerfile.native"]
    Img --> GHCR["ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0"]
    GHCR --> Run["Render / docker run"]
    Run --> PG[("PostgreSQL")]
```

- El perfil Maven `native` activa `quarkus.native.enabled=true`, desactiva el JAR y apunta al builder image Mandrel 25.
- `-Dquarkus.native.container-build=true` compila el binario Linux **dentro de un contenedor**, así que no hace falta instalar GraalVM ni en local ni en el runner.
- En CI el empaquetado es un `docker build -f src/main/docker/Dockerfile.native`. En local puedes hacerlo todo en un comando con `-Dquarkus.container-image.build=true` (ver [sección 1](#1-build-nativo-e-imagen)).
- El resultado intermedio es un binario Linux en `target/*-runner`; `Dockerfile.native` lo empaqueta sobre `ubi9/ubi-minimal` y lo ejecuta como usuario `1001`.
- El bytecode de la aplicación sigue siendo **Java 21** (`maven.compiler.release=21`); Mandrel 25 es solo el compilador nativo.

---

## Requisitos

| Requisito | Detalle |
|---|---|
| Docker | Docker Desktop o Engine en marcha (build nativo en contenedor + construcción de la imagen) |
| JDK 21 | Para compilar el bytecode (`C:\programas\jdk-21.0.10` en local) |
| Maven 3.9+ | O el wrapper `mvnw` del repo |
| Memoria | 4 GB libres recomendados para el builder nativo |
| Cuenta GHCR | Usuario de GitHub con permiso `write:packages` |

Comprueba que Docker responde:

```bash
docker version
```

---

## 1. Build nativo e imagen

El build real se hace en **un solo comando**: compila el nativo y construye la imagen Docker. Desde `backend/`:

```powershell
# Windows
$env:JAVA_HOME="C:\programas\jdk-21.0.10"
mvn clean package -Pnative `
  "-Dquarkus.native.container-build=true" `
  -DskipTests `
  "-Dquarkus.container-image.build=true" `
  "-Dquarkus.container-image.image=true-fan-dice-roller-ws:native"
```

```bash
# Linux / macOS
export JAVA_HOME=/path/to/jdk-21
mvn clean package -Pnative \
  -Dquarkus.native.container-build=true \
  -DskipTests \
  -Dquarkus.container-image.build=true \
  -Dquarkus.container-image.image=true-fan-dice-roller-ws:native
```

También se puede escribir en una sola línea:

```bash
mvn clean package -Pnative "-Dquarkus.native.container-build=true" -DskipTests "-Dquarkus.container-image.build=true" "-Dquarkus.container-image.image=true-fan-dice-roller-ws:native"
```

Qué hace cada flag:

| Flag | Efecto |
|---|---|
| `clean package` | Limpia `target/` y empaqueta |
| `-Pnative` | Activa el perfil nativo del `pom.xml` (JAR desactivado, builder Mandrel 25, Dockerfile nativo) |
| `-Dquarkus.native.container-build=true` | Compila el binario Linux dentro de un contenedor (obligatorio en Windows) |
| `-DskipTests` | Omite los tests para acelerar |
| `-Dquarkus.container-image.build=true` | Construye la imagen Docker con la extensión `container-image` |
| `-Dquarkus.container-image.image=true-fan-dice-roller-ws:native` | Nombre y etiqueta de la imagen local |

Al terminar deben existir:

```text
backend/target/dice-roller-ws-1.0.0-SNAPSHOT-runner   # binario nativo
true-fan-dice-roller-ws:native                       # imagen Docker local
```

Compruébalo:

```bash
docker images true-fan-dice-roller-ws
```

Notas:

- **`-Dquarkus.native.container-build=true` es obligatorio en Windows**: sin él, Quarkus intentaría usar un GraalVM local y generaría un `.exe` de Windows, inservible para una imagen Linux.
- El primer build descarga el builder image y tarda varios minutos.
- `Dockerfile.native` copia `target/*-runner` como `/work/application`, expone `8080` y arranca con `./application -Dquarkus.http.host=0.0.0.0`.

### Alternativa manual (sin `container-image`)

Si prefieres separar los pasos:

```bash
mvn clean package -Pnative -Dquarkus.native.container-build=true -DskipTests
docker build -f src/main/docker/Dockerfile.native -t true-fan-dice-roller-ws:native .
```

Y si construyes desde una máquina ARM (Apple Silicon) para desplegar en `amd64`:

```bash
docker build --platform linux/amd64 -f src/main/docker/Dockerfile.native -t true-fan-dice-roller-ws:native .
```

---

## 2. Publicar en GHCR (manual)

> Normalmente **no necesitas esta sección**: el workflow publica la imagen al empujar el tag. Usa estos pasos solo para builds manuales o para probar antes de etiquetar.

1. Crea un **Personal Access Token** de GitHub (classic) con permisos `read:packages` y `write:packages`. No lo guardes en el repositorio.

2. Autentícate:

   ```powershell
   $env:GITHUB_TOKEN | docker login ghcr.io -u rturv --password-stdin
   ```

   ```bash
   echo "$GITHUB_TOKEN" | docker login ghcr.io -u rturv --password-stdin
   ```

3. Etiqueta y sube:

   ```bash
   docker tag true-fan-dice-roller-ws:native ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0
   docker push ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0
   ```

4. Visibilidad del paquete: en GitHub → **Packages → true-fan-dice-roller-ws → Package settings**.
   - **Público**: cualquiera puede hacer `docker pull`.
   - **Privado** (por defecto): el host que despliegue la imagen necesita credenciales de registro.

> El nombre del paquete en GHCR debe ir en minúsculas: `ghcr.io/rturv/true-fan-dice-roller-ws`.

---

## 3. Ejecutar la imagen

```bash
docker run -d \
  --name dice-back \
  -p 8080:8080 \
  -e QUARKUS_PROFILE=prod \
  -e DB_URL=jdbc:postgresql://mi-postgres:5432/diceroller \
  -e DB_USER=postgres \
  -e DB_PASSWORD=secreta \
  -e JWT_SECRET="clave-hmac-de-al-menos-32-caracteres!!" \
  -e CORS_ORIGINS="https://true-fan-dice-roller.onrender.com" \
  ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0
```

Variables:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `QUARKUS_PROFILE` | Sí en prod | `prod` activa PostgreSQL |
| `DB_URL` | Sí | JDBC de PostgreSQL |
| `DB_USER` / `DB_PASSWORD` | Sí | Credenciales |
| `JWT_SECRET` | Sí | Clave HMAC de al menos 32 caracteres |
| `CORS_ORIGINS` | Recomendada | Origen del frontend estático (por defecto `*`) |
| `QUARKUS_HTTP_PORT` | Según el host | Puerto de escucha si el host inyecta `PORT` |

---

## 4. Desplegar en Render

1. **New + → Web Service → Deploy an existing image**.
2. Image URL: `ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0`.
3. Si el paquete es **privado**, añade credenciales de registro:
   - Registry: `ghcr.io`
   - Username: `rturv`
   - Password: el PAT con `read:packages`.
4. Configura las variables de entorno de la tabla anterior.
5. Health check path: `/health/ready`.
6. Puerto: la imagen escucha en `8080`. Si Render te asigna un `PORT` distinto y espera que escuches ahí, define `QUARKUS_HTTP_PORT` con ese valor.
7. Crea el servicio y espera a que el health check pase a healthy.

Una vez desplegado, el frontend estático debe apuntar a:

```text
BACKEND_WS_URL=wss://<tu-servicio>.onrender.com/ws/room
BACKEND_HTTP_URL=https://<tu-servicio>.onrender.com
```

---

## Verificación

```bash
# Liveness
curl http://localhost:8080/health/live

# Readiness (comprueba la conexión a PostgreSQL)
curl http://localhost:8080/health/ready
```

También puedes comprobar la imagen y su tamaño:

```bash
docker image inspect ghcr.io/rturv/true-fan-dice-roller-ws:1.0.0 \
  --format '{{.Config.ExposedPorts}} {{.Config.User}} {{.Size}}'
```

Y el arranque (debe ser de decenas de milisegundos):

```bash
docker logs -f dice-back
```

---

## Actualizar la versión

Forma recomendada (automática):

1. Crea y empuja el nuevo tag: `git tag v1.0.1 && git push origin v1.0.1`.
2. El workflow publica `1.0.1`, `1.0` y `latest`.
3. En Render, actualiza la imagen del servicio a `ghcr.io/rturv/true-fan-dice-roller-ws:1.0.1` y redespliega.
4. Mantén una etiqueta mutable (`latest`) solo si te interesa; para producción es mejor una versión fija.

Forma manual, si prefieres construir en local:

```bash
mvn clean package -Pnative \
  -Dquarkus.native.container-build=true \
  -DskipTests \
  -Dquarkus.container-image.build=true \
  -Dquarkus.container-image.image=true-fan-dice-roller-ws:1.0.1

docker tag true-fan-dice-roller-ws:1.0.1 ghcr.io/rturv/true-fan-dice-roller-ws:1.0.1
docker push ghcr.io/rturv/true-fan-dice-roller-ws:1.0.1
```

---

## Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker no está arrancado | Inicia Docker Desktop/Engine |
| `Could not find a valid Docker environment` | Maven no puede acceder al daemon de Docker | Arranca Docker y revisa `DOCKER_HOST` |
| El build termina pero no hay imagen | Faltó `-Dquarkus.container-image.build=true` | Añade el flag o haz el `docker build` manual |
| No encuentro la imagen local | Se cambió el nombre en `container-image.image` | `docker images \| grep true-fan-dice-roller-ws` |
| El build nativo genera un `.exe` | Se omitió `-Dquarkus.native.container-build=true` | Repite con esa propiedad |
| `exec format error` al arrancar | Imagen ARM desplegada en amd64 | Construye con `--platform linux/amd64` |
| `unauthorized` al hacer push | Token sin `write:packages` o sin login | Revisa el PAT y `docker login ghcr.io` |
| Render no puede hacer pull | Paquete privado sin credenciales | Añade credenciales de registro o hazlo público |
| `denied: requested access to the resource is denied` | Nombre de imagen con mayúsculas o usuario incorrecto | Usa `ghcr.io/rturv/true-fan-dice-roller-ws` en minúsculas |
| `denied: permission_denied: write_package` en GitHub Actions | El token del workflow no puede publicar | Revisa `permissions: packages: write` en el workflow y que la política de la organización lo permita |
| El contenedor arranca pero no responde | Escucha en 8080 y el host espera otro puerto | Define `QUARKUS_HTTP_PORT` |
| `/health/ready` devuelve 503 | PostgreSQL no accesible o credenciales mal | Revisa `DB_URL`, `DB_USER`, `DB_PASSWORD` y TLS de la base |
| El build nativo se queda sin memoria | Builder con poca RAM | Aumenta la memoria de Docker o usa una máquina con más recursos |
| `Connection refused` desde el frontend | CORS o URL incorrecta | Revisa `CORS_ORIGINS`, `BACKEND_WS_URL` y `BACKEND_HTTP_URL` |

---

## Por qué nativo

| | JVM | Nativo |
|---|---|---|
| Arranque | ~1-2 s | decenas de ms |
| Memoria base | cientos de MB | decenas de MB |
| Tamaño de imagen | ~200 MB (JRE + app) | ~80-120 MB |
| Build | rápido | varios minutos (GraalVM) |

Alternativas en el repo:

- `backend/Dockerfile`: imagen JVM multi-stage (Maven + Temurin 21).
- `backend/src/main/docker/Dockerfile.jvm`: imagen JVM con `run-java.sh`.
- `backend/src/main/docker/Dockerfile.native`: la que se usa para GHCR.

**¿Y CI/CD?** El build nativo es pesado, así que hasta ahora se hacía manualmente. Ahora lo automatiza `.github/workflows/release-images.yml`: se dispara con un tag `vX.Y.Z`, compila en el runner (con Docker disponible) y publica `true-fan-dice-roller-ws` y `true-fan-dice-roller-web` en GHCR. Los comandos de este documento siguen siendo la referencia para reproducir el build en local.
