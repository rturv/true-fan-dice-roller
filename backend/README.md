# dice-roller-ws

Backend WebSocket de True Fan Dice Roller.

- **Java 25** (`maven.compiler.release=25`)
- **Quarkus 3.40.1.2 LTS**
- PostgreSQL en producción, H2 en desarrollo/test
- Imagen nativa con Mandrel 25.0.5.0 (OpenJDK 25.0.5)

## Requisitos

- JDK 25
- Maven 3.9+ (o el wrapper `mvnw`)
- Docker/Podman para construir la imagen nativa

> En WSL, si `./mvnw` falla validando el checksum de Maven, instala `unzip`
> (`sudo apt install unzip`) o usa el `mvn` del sistema. El wrapper descarga
> el `.tar.gz` cuando no encuentra `unzip`, pero el SHA-256 configurado es
> el del `.zip`.

## Running the application in dev mode

You can run your application in dev mode that enables live coding using:

```shell script
./mvnw quarkus:dev
```

> **_NOTE:_**  Quarkus now ships with a Dev UI, which is available in dev mode only at <http://localhost:8080/q/dev/>.

## Packaging and running the application

The application can be packaged using:

```shell script
./mvnw package
```

It produces the `quarkus-run.jar` file in the `target/quarkus-app/` directory.
Be aware that it’s not an _über-jar_ as the dependencies are copied into the `target/quarkus-app/lib/` directory.

The application is now runnable using `java -jar target/quarkus-app/quarkus-run.jar`.

If you want to build an _über-jar_, execute the following command:

```shell script
./mvnw package -Dquarkus.package.jar.type=uber-jar
```

The application, packaged as an _über-jar_, is now runnable using `java -jar target/*-runner.jar`.

## Creating a native executable

You can create a native executable using:

```shell script
./mvnw package -Pnative
```

Or, if you don't have GraalVM installed, you can run the native executable build in a container using:

```shell script
./mvnw package -Pnative -Dquarkus.native.container-build=true
```

El perfil `native` fija el builder
`quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:25.0.5.0-Final-java25`
por digest. También desactiva el perfil `dev-h2`, por lo que el binario de
producción no incluye H2.

You can then execute your native executable with: `./target/dice-roller-ws-1.1.0-runner`

La imagen de runtime se construye con el Dockerfile nativo:

```shell script
docker build -f src/main/docker/Dockerfile.native -t dice-roller-ws:native .
```

El binario nativo genera además un SBOM en
`target/dice-roller-ws-1.1.0-runner-cyclonedx.json` y embebe el SBOM en el
propio ejecutable, de forma que `syft` puede extraerlo:

```shell script
syft scan target/dice-roller-ws-1.1.0-runner -o cyclonedx-json
```

If you want to learn more about building native executables, please consult <https://quarkus.io/guides/maven-tooling>.

## Related Guides

- WebSockets Next ([guide](https://quarkus.io/guides/websockets-next)): WebSocket communication channel support
- Hibernate ORM ([guide](https://quarkus.io/guides/hibernate-orm)): Persistencia JPA/Hibernate
- SmallRye JWT ([guide](https://quarkus.io/guides/security-jwt)): Secure your applications with JSON Web Token
- SmallRye Health ([guide](https://quarkus.io/guides/smallrye-health)): Monitor service health
- SmallRye JWT Build ([guide](https://quarkus.io/guides/security-jwt-build)): Create JSON Web Token with SmallRye JWT Build API
- CycloneDX ([guide](https://quarkus.io/guides/cyclonedx)): SBOM y análisis de vulnerabilidades

## Estructura

- `service/GameService`: dados, baraja española y serialización de estado.
- `service/RoomService`: salas, usuarios, historial, pool y cartas.
- `service/JwtService`: emisión, validación y renovación de tokens de sesión.
- `websocket/RoomWebSocket`: protocolo WebSocket en `/ws/room`.
- `entity/`: entidades JPA (`Room`, `RoomUser`, `ChatEntry`).
- `config/`: configuración tipada (`JwtConfig`, `CleanupConfig`).

## Concurrencia

Las operaciones que modifican el estado de una sala (`draw_card`, `pool_delta`,
`pool_set`, `reshuffle_deck`, `toggle_cards`, transferencia de admin y
`kick_user`) bloquean la fila `Room` con `LockModeType.PESSIMISTIC_WRITE`.
Así dos mensajes simultáneos de la misma sala no pueden pisarse: el segundo
espera a que el primero haga commit y lee el estado actualizado. El bloqueo
está en base de datos, por lo que también funciona con varias instancias del
backend.

## Configuración de producción

- `DB_URL`, `DB_USER`, `DB_PASSWORD`: PostgreSQL.
- `JWT_SECRET`: obligatorio en `%prod`; el arranque falla si no está definido.
- `CORS_ORIGINS`: orígenes permitidos (por defecto `*`).

El perfil `%prod` mantiene `quarkus.hibernate-orm.schema-management.strategy=update`.
Para producción se recomienda migrar a Flyway y usar `validate` o `none`.
