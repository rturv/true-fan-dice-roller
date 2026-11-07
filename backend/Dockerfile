# =============================================================================
# Stage 1: Build the Quarkus application
# =============================================================================
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copy all files and build
COPY . .
RUN mvn package -DskipTests -q

# =============================================================================
# Stage 2: Run with JDK 21 runtime
# =============================================================================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the runnable jar and libs from the builder
COPY --from=builder /app/target/quarkus-app/ /app/

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/quarkus-run.jar"]
