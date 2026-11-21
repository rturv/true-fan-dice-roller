# =============================================================================
# Stage 1: Build the Quarkus application
# =============================================================================
FROM maven:3.9.16-eclipse-temurin-25-alpine@sha256:781f1da87cd3d142e66e47cc149c4582a652fb7f574648206d1e956170c0dc90 AS builder

WORKDIR /app

# Perfil de build de Quarkus. El compose de desarrollo pasa `dev` para que
# el datasource H2 quede fijado en el artefacto; producción usa `prod`.
ARG QUARKUS_PROFILE=prod

# Copy all files and build
COPY . .
RUN mvn package -DskipTests -q -Dquarkus.profile=${QUARKUS_PROFILE}

# =============================================================================
# Stage 2: Run with JDK 25 runtime
# =============================================================================
FROM eclipse-temurin:25-jre-alpine@sha256:69c2a26e9894016e274c880fa542956d005b3755f84db765145185e87405bd89

WORKDIR /app

# Copy the runnable jar and libs from the builder
COPY --from=builder /app/target/quarkus-app/ /app/

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
