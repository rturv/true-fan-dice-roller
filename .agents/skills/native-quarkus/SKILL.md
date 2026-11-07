---
name: native-quarkus
description: Senior Quarkus architect specializing in GraalVM Native Image compilation, Java 21 or later, and cloud-native applications. Ensures all generated code is compatible with Quarkus Native through comprehensive standards, best practices, validation checklists, and design criteria.
user-invocable: true
license: MIT
metadata:
  author: Copyright 2026 Quarkus Native Standards
  version: '1.0'
  target_audience: Enterprise Development Teams
  compliance_required: true
---

# Native Quarkus Development Standards

## Objetivo de la Skill

Esta skill establece un conjunto integral de estándares, reglas, buenas prácticas y criterios de validación para garantizar que todo el código desarrollado en Quarkus sea **100% compatible con compilación nativa mediante GraalVM Native Image**. Está diseñada para ser utilizada como estándar corporativo de desarrollo en proyectos enterprise que requieren:

- **Compilación nativa** (AOT - Ahead-of-Time)
- **Imagen de contenedor ultraligera** (típicamente 50-150MB)
- **Tiempo de arranque subsegundario** (< 1 segundo)
- **Consumo mínimo de memoria** (< 50MB en muchos casos)
- **Compatibilidad total con la JVM estándar**

---

## 1. Principios Native First

### 1.1 Filosofía de Desarrollo

Todo el desarrollo DEBE asumir que la aplicación será compilada con GraalVM Native Image. No es una optimización posterior, sino una restricción de diseño desde el inicio.

**Reglas Obligatorias:**

1. **Asumir Native desde el inicio:** Cualquier decisión de arquitectura debe considerar implicaciones nativas.
2. **Evitar la reflexión innecesaria:** La reflexión no está prohibida, pero debe ser controlada y documentada.
3. **Declaratividad sobre dinamismos:** Preferir configuración declarativa frente a descubrimiento dinámico.
4. **Static Initialization:** Maximizar la inicialización en tiempo de compilación (build-time).
5. **Zero Runtime Discovery:** Minimizar la exploración de clases, métodos e interfaces en runtime.

### 1.2 Impacto del Native First

- **Seguridad:** El árbol de clases se reduce a lo estrictamente necesario.
- **Rendimiento:** Eliminación de JIT compilation overhead.
- **Predictibilidad:** Comportamiento deterministico en memoria y CPU.
- **Escalabilidad:** Mejor densidade de pods en Kubernetes.

---

## 2. Compatibilidad con GraalVM Native Image

### 2.1 Ciclo de Compilación Nativa

```
Source Code
    ↓
Java Compilation (javac)
    ↓
Build-time Initialization (Quarkus processors)
    ↓
GraalVM Native Image Analysis (--report-unsupported-elements-at-runtime)
    ↓
Native Compilation (via C compiler)
    ↓
Executable Binary (~50-150MB)
```

### 2.2 Limitaciones Críticas de GraalVM Native

**Operaciones bloqueadas en tiempo de compilación:**

1. **Reflection sin registro:** Acceso dinámico a clases, métodos, campos.
2. **Classpath Scanning:** Búsqueda de archivos o clases en classpath.
3. **Bytecode Generation:** Generación dinámica de bytecode (CGLIB, Javassist, ASM).
4. **Dynamic Proxies:** Creación de proxies en runtime.
5. **Carga dinámica de clases:** `Class.forName()` sin control estático.
6. **Serialización genérica:** Acceso no declarado a tipos.

### 2.3 Validación Pre-Compilación

Antes de compilar con GraalVM, ejecutar:

```bash
mvn clean quarkus:build -Dquarkus.native.image-type=native
```

Si hay errores, buscar en los logs (`target/native-image-build.log`):
- `Unsupported method` → Necesita `@RegisterForReflection`
- `Dynamic proxy creation` → Reemplazar con CDI
- `Classpath scanning` → Especificar recursos estáticamente

---

## 3. Buenas Prácticas de Quarkus

### 3.1 Arquitectura de Capas

**Estructura recomendada:**

```
src/main/java/
  ├── config/           # Configuración build-time
  ├── entity/           # Entidades JPA
  ├── dto/              # DTOs y Records
  ├── resource/         # Endpoints REST
  ├── service/          # Lógica de negocio
  ├── repository/       # Acceso a datos (Spring Data / Panache)
  ├── client/           # Clientes HTTP/gRPC
  ├── exception/        # Excepciones custom
  ├── security/         # Seguridad y autenticación
  ├── cache/            # Configuración de caché
  └── util/             # Utilidades
```

### 3.2 Inyección de Dependencias (CDI)

**Obligatorio:**

```java
import jakarta.inject.Inject;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class UserService {
    @Inject
    UserRepository repository;
    
    public User findById(Long id) {
        return repository.findById(id);
    }
}
```

**Prohibido:**

```java
// ❌ PROHIBIDO - Instanciación manual
UserService service = new UserService();

// ❌ PROHIBIDO - ServiceLocator
UserService service = ServiceLocator.getService(UserService.class);
```

### 3.3 Anotaciones de Contexto

- `@ApplicationScoped` → Singleton durante toda la aplicación
- `@RequestScoped` → Una instancia por request HTTP
- `@Dependent` → Nueva instancia por inyección
- `@Singleton` → Alias para `@ApplicationScoped`

---

## 4. Gestión de Reflection

### 4.1 Regla Obligatoria: @RegisterForReflection

**TODA clase utilizada para representar datos DEBE anotarse con `@RegisterForReflection`.**

Esta anotación garantiza que:
1. GraalVM mantenga metadatos de la clase en la imagen nativa.
2. Jackson pueda serializar/deserializar la clase.
3. JPA pueda acceder a campos y getters/setters.
4. REST clients pueda mapear respuestas.

### 4.2 Dónde DEBE Aplicarse @RegisterForReflection

**Obligatorio en:**

- ✅ DTOs
- ✅ Records
- ✅ Request/Response Objects
- ✅ Command Objects
- ✅ Query Objects
- ✅ Event Objects
- ✅ Clases JAXB
- ✅ Modelos JSON
- ✅ Objetos serializados por Jackson
- ✅ Objetos de REST Clients
- ✅ Objetos de servicios SOAP/CXF
- ✅ Excepciones custom que se serializan

**Ejemplo - DTO:**

```java
import io.quarkus.runtime.annotations.RegisterForReflection;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@RegisterForReflection
@JsonIgnoreProperties(ignoreUnknown = true)
public record UserDto(
    Long id,
    String username,
    String email,
    String fullName
) { }
```

**Ejemplo - Entity (JPA):**

```java
import jakarta.persistence.*;
import io.quarkus.runtime.annotations.RegisterForReflection;

@Entity
@Table(name = "users")
@RegisterForReflection
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    private String email;

    // Getters y setters
}
```

**Ejemplo - REST Request Object:**

```java
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public class CreateUserRequest {
    public String username;
    public String email;
    public String password;

    // Getters y setters
}
```

### 4.3 Minimizar Uso de Reflection Dinámico

**Prohibido:**

```java
// ❌ PROHIBIDO
Class<?> clazz = Class.forName("com.example.User");
Method method = clazz.getMethod("setUsername", String.class);
method.invoke(instance, "john");
```

**Recomendado:**

```java
// ✅ RECOMENDADO
User user = new User();
user.setUsername("john");
```

**Caso especial - Configuración dinámica:**

```java
// ✅ Si es necesario reflection, documentarlo y usar @RegisterForReflection
@ApplicationScoped
public class DynamicConfig {
    public Object instantiate(String className) throws Exception {
        // Documentar por qué se usa reflection
        Class<?> clazz = Class.forName(className);
        return clazz.getDeclaredConstructor().newInstance();
    }
}
```

---

## 5. Gestión de Recursos Nativos

### 5.1 Registrar Recursos en `application.properties`

Cualquier recurso no-Java que la aplicación necesite debe registrarse:

```properties
# application.properties

# Archivos de configuración
quarkus.native.resources.includes=config/**,templates/**

# Archivos WSDL y XSD para SOAP
quarkus.native.resources.includes=wsdl/**,xsd/**

# Archivos de base de datos
quarkus.native.resources.includes=db/migration/**

# Certificados y claves
quarkus.native.resources.includes=certs/**

# Recursos de i18n
quarkus.native.resources.includes=messages/**
```

### 5.2 Ejemplos Prácticos

**Para Flyway/Liquibase:**

```properties
quarkus.native.resources.includes=db/migration/**
```

**Para templates Qute:**

```properties
quarkus.native.resources.includes=templates/**
```

**Para archivos YAML de configuración:**

```properties
quarkus.native.resources.includes=config/application-*.yaml
```

### 5.3 Recursos en Carpetas

```
src/main/resources/
  ├── application.properties
  ├── db/
  │   └── migration/        # ← Registrar en native.resources.includes
  ├── templates/            # ← Registrar si usas Qute
  ├── wsdl/                 # ← Registrar si usas SOAP/CXF
  ├── xsd/
  └── certs/                # ← Registrar si usas SSL personalizado
```

---

## 6. Serialización y Deserialización JSON

### 6.1 Configuración de Jackson

**En `application.properties`:**

```properties
# Permitir mapeo de JSON desconocido sin error
quarkus.jackson.ignore-unknown-properties=true

# Usar formato ISO para fechas
quarkus.jackson.write-dates-as-timestamps=false

# Timezone
quarkus.jackson.timezone=UTC
```

### 6.2 Anotaciones para Serialización

**Todo DTO DEBE ser anotado:**

```java
import io.quarkus.runtime.annotations.RegisterForReflection;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

@RegisterForReflection
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderDto {
    
    @JsonProperty("order_id")
    private Long orderId;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    private BigDecimal totalAmount;

    // Constructor sin argumentos (OBLIGATORIO para Jackson)
    public OrderDto() {}

    public OrderDto(Long orderId, LocalDateTime createdAt, BigDecimal totalAmount) {
        this.orderId = orderId;
        this.createdAt = createdAt;
        this.totalAmount = totalAmount;
    }

    // Getters y setters
}
```

### 6.3 Casos Especiales

**Serialización polimórfica:**

```java
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "@type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = EmailNotification.class, name = "email"),
    @JsonSubTypes.Type(value = SmsNotification.class, name = "sms")
})
public abstract class Notification {
    public String message;
}

@RegisterForReflection
public class EmailNotification extends Notification {
    public String to;
}

@RegisterForReflection
public class SmsNotification extends Notification {
    public String phoneNumber;
}
```

---

## 7. Uso de DTOs y Records

### 7.1 Preferencia: Records (Java 16+)

**Records son la mejor opción para Native porque:**

1. Immutabilidad garantizada
2. Menos bytecode generado
3. Metadatos de reflexión más simples
4. Compatible con JSON

**Recomendado:**

```java
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record CreateUserRequest(
    String username,
    String email,
    String password
) { }

@RegisterForReflection
public record UserResponse(
    Long id,
    String username,
    String email,
    LocalDateTime createdAt
) { }
```

### 7.2 DTOs Tradicionales (si es necesario)

```java
import io.quarkus.runtime.annotations.RegisterForReflection;
import lombok.Data;
import lombok.NoArgsConstructor;

@RegisterForReflection
@Data
@NoArgsConstructor
public class UserDto {
    private Long id;
    private String username;
    private String email;
    private LocalDateTime createdAt;

    // Constructor adicional si es necesario
    public UserDto(Long id, String username, String email) {
        this.id = id;
        this.username = username;
        this.email = email;
    }
}
```

### 7.3 Comparación: Records vs DTOs

| Aspecto | Records | DTOs |
|---------|---------|------|
| Líneas de código | Mínimas | Máximas |
| Inmutabilidad | Garantizada | Depende |
| Bytecode generado | Mínimo | Mayor |
| Reflexión necesaria | Menos | Más |
| Java mínimo | 16+ | 8+ |
| Recomendación Native | ✅ Preferida | ⚠️ Usar si necesario |

---

## 8. CDI e Inyección de Dependencias

### 8.1 Construcción de Beans

**Recomendado - Anotación en clase:**

```java
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class UserService {
    @Inject
    UserRepository repository;

    public User findById(Long id) {
        return repository.findById(id).orElse(null);
    }
}
```

**Producción de Beans (cuando es necesario):**

```java
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;

@ApplicationScoped
public class BeanFactory {
    
    @Produces
    @ApplicationScoped
    public HttpClient httpClient() {
        return HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    }
}
```

### 8.2 Inyección por Interfaz

```java
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

public interface UserService {
    User findById(Long id);
}

@ApplicationScoped
public class UserServiceImpl implements UserService {
    @Inject
    UserRepository repository;

    @Override
    public User findById(Long id) {
        return repository.findById(id).orElse(null);
    }
}

// En cualquier otro bean:
@ApplicationScoped
public class UserController {
    @Inject
    UserService service; // ← Se inyecta UserServiceImpl automáticamente
}
```

### 8.3 Evitar Anti-patrones

**Prohibido - Service Locator:**

```java
// ❌ PROHIBIDO
@ApplicationScoped
public class UserController {
    public void getUser(Long id) {
        UserService service = CDI.current()
            .select(UserService.class)
            .get();  // Anti-patrón
        User user = service.findById(id);
    }
}
```

**Recomendado - Inyección directa:**

```java
// ✅ RECOMENDADO
@ApplicationScoped
public class UserController {
    @Inject
    UserService service;

    public void getUser(Long id) {
        User user = service.findById(id);
    }
}
```

---

## 9. Build Time vs Runtime

### 9.1 Configuración Build-Time

Quarkus permite optimizaciones en tiempo de compilación:

```java
import io.quarkus.runtime.annotations.BuildTime;
import io.quarkus.runtime.configuration.ConfigUtils;

@ApplicationScoped
public class ConfigService {
    
    // ✅ Build-time: se resuelve en compilación
    @Inject
    @ConfigProperty(name = "app.version")
    String appVersion;

    // ✅ Runtime: se resuelve en ejecución
    @Inject
    @ConfigProperty(name = "app.api-key")
    String apiKey;
}
```

### 9.2 Procesadores Build-Time

**Para lógica compleja en build-time:**

```java
import io.quarkus.deployment.annotations.BuildStep;
import io.quarkus.deployment.builditem.FeatureBuildItem;

public class NativeExtensionProcessor {
    
    @BuildStep
    FeatureBuildItem feature() {
        return new FeatureBuildItem("custom-native-feature");
    }
}
```

### 9.3 Configuración Recomendada

```properties
# application.properties - Optimizaciones build-time
quarkus.package.type=native

# Habilitar optimizaciones de compilación
quarkus.native.enable-all-security-services=false
quarkus.native.full-stack-traces=true

# GraalVM Native Image options
quarkus.native.additional-build-args=-H:+PrintClassInitialization
```

---

## 10. SOAP y CXF

### 10.1 Configuración de CXF para Native

**En `pom.xml`:**

```xml
<!-- Extensión Quarkus para CXF -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-cxf</artifactId>
</dependency>
```

### 10.2 Servicio SOAP

**Port (implementación):**

```java
import jakarta.jws.WebService;
import jakarta.jws.WebMethod;
import jakarta.inject.Inject;
import io.quarkus.runtime.annotations.RegisterForReflection;

@WebService(
    serviceName = "UserService",
    portName = "UserServicePort",
    targetNamespace = "http://example.com/soap/user",
    endpointInterface = "com.example.UserServicePort"
)
public class UserServiceImpl implements UserServicePort {
    
    @Inject
    UserService userService;

    @WebMethod
    @Override
    public GetUserResponse getUser(String userId) {
        User user = userService.findById(Long.parseLong(userId));
        GetUserResponse response = new GetUserResponse();
        response.setUser(mapToSoap(user));
        return response;
    }
}
```

### 10.3 DTOs JAXB

```java
import jakarta.xml.bind.annotation.*;
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection  // ← OBLIGATORIO
@XmlRootElement(name = "user", namespace = "http://example.com/soap/user")
@XmlAccessorType(XmlAccessType.FIELD)
public class UserSoapDto {
    
    @XmlElement
    private Long id;

    @XmlElement
    private String username;

    @XmlElement
    private String email;

    // Getters y setters
}
```

### 10.4 Registro de Recursos WSDL/XSD

```properties
# application.properties
quarkus.native.resources.includes=wsdl/**,xsd/**
```

---

## 11. REST APIs

### 11.1 Endpoints REST

```java
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.inject.Inject;

@Path("/api/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@ApplicationScoped
public class UserResource {
    
    @Inject
    UserService userService;

    @GET
    @Path("/{id}")
    public Response getUser(@PathParam("id") Long id) {
        User user = userService.findById(id);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(mapToDto(user)).build();
    }

    @POST
    public Response createUser(@Valid CreateUserRequest request) {
        User user = userService.create(request);
        return Response.status(Response.Status.CREATED)
            .entity(mapToDto(user))
            .build();
    }
}
```

### 11.2 Anotación Obligatoria de Response DTOs

```java
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;

@RegisterForReflection
public class CreateUserRequest {
    @NotBlank(message = "Username es requerido")
    public String username;

    @Email(message = "Email debe ser válido")
    public String email;

    @NotBlank(message = "Password es requerido")
    public String password;
}

@RegisterForReflection
public class UserResponse {
    public Long id;
    public String username;
    public String email;
    public LocalDateTime createdAt;
}
```

### 11.3 REST Clients

```java
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.enterprise.context.ApplicationScoped;

@RegisterRestClient
@ApplicationScoped
@Path("/api/external/users")
public interface ExternalUserClient {
    
    @GET
    @Path("/{id}")
    ExternalUserDto getUser(@PathParam("id") String id);
}

// El DTO debe estar anotado
@RegisterForReflection
public class ExternalUserDto {
    public String id;
    public String name;
    public String email;
}
```

---

## 12. Optimización de Memoria

### 12.1 Configuración Recomendada

```properties
# application.properties

# Heap inicial y máximo
quarkus.native.native-image-xms=32m
quarkus.native.native-image-xmx=128m

# GC adaptativo
quarkus.native.gc=G1

# Compresión de referencias de objeto
quarkus.native.additional-build-args=-H:+UseCompressedReferences
```

### 12.2 Reducción de Tamaño de Imagen

```properties
# Aplicaciones de menos de 50MB
quarkus.package.type=native
quarkus.native.enable-http2=false  # Si no es necesario
quarkus.native.enable-all-charsets=false  # Si solo usas UTF-8
quarkus.native.enable-all-security-services=false
```

### 12.3 Profiling de Memoria

```bash
# Generar reporte de imagen nativa
mvn clean quarkus:build -Dquarkus.native.image-type=native \
  -Dquarkus.native.additional-build-args=-H:+PrintMemoryUsage

# Ver tamaño de clases en imagen
native-image --report-unsupported-elements-at-runtime -o app app
```

---

## 13. Optimización de Tiempo de Arranque

### 13.1 Benchmarking de Arranque

```bash
# Tiempo de arranque
time ./target/app-runner

# Con tracing
./target/app-runner -Dquarkus.log.level=DEBUG
```

### 13.2 Optimizaciones Recomendadas

```properties
# application.properties

# Lazy loading de beans
quarkus.arc.remove-unused-beans=true

# Desabilitar componentes no necesarios
quarkus.swagger-ui.always-include=false
quarkus.smallrye-health.root-path=/health

# Logging reducido
quarkus.log.level=INFO
```

### 13.3 Tiempo de Arranque Típico

| Configuración | Tiempo |
|---------------|--------|
| JVM estándar | 2-5 segundos |
| Quarkus JVM | 1-2 segundos |
| Quarkus Native | 0.2-0.5 segundos |
| Quarkus Native Micro | < 0.1 segundos |

---

## 14. Dependencias Recomendadas

### 14.1 Extensiones Oficiales Quarkus (Obligatorio usar frente a librerías externas)

```xml
<!-- Core -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-core</artifactId>
</dependency>

<!-- Web -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-resteasy-reactive-jsonb</artifactId>
</dependency>

<!-- Datos -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-hibernate-orm-panache</artifactId>
</dependency>

<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-jdbc-postgresql</artifactId>
</dependency>

<!-- Validación -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-hibernate-validator</artifactId>
</dependency>

<!-- Seguridad -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-oidc</artifactId>
</dependency>

<!-- Logging -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-logging-json</artifactId>
</dependency>

<!-- Observabilidad -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
</dependency>

<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-smallrye-openapi</artifactId>
</dependency>

<!-- CDI -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-arc</artifactId>
</dependency>

<!-- Caché -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-cache</artifactId>
</dependency>

<!-- SOAP/CXF -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-cxf</artifactId>
</dependency>

<!-- Testing -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-junit5</artifactId>
    <scope>test</scope>
</dependency>
```

### 14.2 Librerías Externas Compatibles

```xml
<!-- JSON Processing (Recomendado) -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
</dependency>

<!-- Utilities -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-lang3</artifactId>
</dependency>

<!-- Lombok (si es necesario) -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <scope>provided</scope>
</dependency>
```

---

## 15. Dependencias a Evitar

### 15.1 Librerías Incompatibles Conocidas

| Librería | Razón | Alternativa |
|----------|-------|------------|
| Spring Framework (no Quarkus) | Reflection intensiva | Quarkus CDI |
| Guice | Binding dinámico | Quarkus CDI |
| CGLIB | Bytecode generation | Quarkus ARC |
| Javassist | Bytecode generation | Quarkus processors |
| ASM | Bytecode generation | Quarkus |
| JDO | No soporta Native | JPA/Panache |
| Hibernate Search Lucene | Indexing dinámico | OpenSearch/Elasticsearch |
| Apache Commons BeanUtils | Reflection intensiva | Lombok/Records |

### 15.2 Por Qué Evitar Reflection Intensiva

```java
// ❌ EVITAR - Reflection intensiva
import org.apache.commons.beanutils.BeanUtils;

public class UserMapper {
    public UserDto mapEntity(User entity) throws Exception {
        // BeanUtils.copyProperties ejecuta reflection dinámico
        UserDto dto = new UserDto();
        BeanUtils.copyProperties(dto, entity);
        return dto;
    }
}

// ✅ ALTERNATIVA - Mapping explícito o MapStruct
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;

@Mapper
public interface UserMapper {
    UserMapper INSTANCE = Mappers.getMapper(UserMapper.class);
    
    UserDto toDto(User entity);
}
```

### 15.3 Análisis de Dependencias

```bash
# Verificar si una dependencia usa reflection intensiva
mvn dependency:tree

# En logs de compilación nativa, buscar:
# - "Use of reflection is unavoidable"
# - "Classpath scanning detected"
# - "Bytecode generation is required"
```

---

## 16. Configuración Recomendada de Quarkus Native

### 16.1 Configuración Mínima en `application.properties`

```properties
# ============================================================
# CONFIGURACIÓN RECOMENDADA PARA QUARKUS NATIVE
# ============================================================

# Tipo de empaquetado
quarkus.package.type=native

# Recursos nativos (OBLIGATORIO documentar todos)
quarkus.native.resources.includes=config/**,db/migration/**,templates/**

# Seguridad
quarkus.native.enable-all-security-services=false
quarkus.ssl.native.enabled=true

# GraalVM options
quarkus.native.full-stack-traces=true
quarkus.native.report-exception-stack-trace=true

# Logging
quarkus.log.level=INFO
quarkus.log.console.enable=true
quarkus.log.console.format=%d{yyyy-MM-dd HH:mm:ss.SSS} %-5p [%c{2.}] (%t) %s%e%n

# Memoria
quarkus.native.native-image-xms=32m
quarkus.native.native-image-xmx=128m

# GC
quarkus.native.gc=G1
```

### 16.2 Configuración Avanzada

```properties
# Para aplicaciones críticas de rendimiento
quarkus.native.additional-build-args=\
  -H:+PrintClassInitialization,\
  -H:+UseCompressedReferences,\
  -H:+ReportExceptionStackTrace,\
  -H:+PrintMemoryUsage

# Habilitar soporte para módulos JDK específicos (si es necesario)
quarkus.native.additional-build-args=-H:EnableURLProtocols=https
```

### 16.3 Compilación Nativa

```bash
# Compilación estándar
mvn clean quarkus:build -Dquarkus.package.type=native

# Con validación de recursos
mvn clean quarkus:build -Dquarkus.package.type=native \
  -Dquarkus.native.report-unsupported-elements-at-runtime=true

# Con debugging
mvn clean quarkus:build -Dquarkus.package.type=native \
  -X
```

---

## 17. Checklist Obligatorio de Validación

**Este checklist DEBE completarse antes de que cualquier código sea marcado como "listo para producción".**

### 17.1 Anotaciones de Reflexión

- [ ] ✅ **Todas las clases DTOs están anotadas con `@RegisterForReflection`**
  - Verificar: `grep -r "public class.*Dto" src/main/java/ | wc -l`
  - Todas deben tener `@RegisterForReflection`

- [ ] ✅ **Todos los Records están anotados con `@RegisterForReflection`**
  - Verificar: `grep -r "public record" src/main/java/ | wc -l`
  - Todas deben tener `@RegisterForReflection`

- [ ] ✅ **Todas las clases de Request están anotadas con `@RegisterForReflection`**
  - Verificar: `grep -r "public class.*Request" src/main/java/ | wc -l`

- [ ] ✅ **Todas las clases de Response están anotadas con `@RegisterForReflection`**
  - Verificar: `grep -r "public class.*Response" src/main/java/ | wc -l`

- [ ] ✅ **Todas las entidades JPA están anotadas con `@RegisterForReflection`**
  - Verificar: `grep -r "@Entity" src/main/java/ | wc -l`

- [ ] ✅ **Todos los DTOs JAXB/SOAP están anotados con `@RegisterForReflection`**
  - Verificar: `grep -r "@XmlRootElement" src/main/java/ | wc -l`

### 17.2 Configuración de Recursos Nativos

- [ ] ✅ **Todos los archivos de migración de BD están registrados**
  - Verificar en `application.properties`:
    ```
    quarkus.native.resources.includes=db/migration/**
    ```

- [ ] ✅ **Todos los archivos de templates están registrados (si aplica)**
  - Verificar: `quarkus.native.resources.includes=templates/**`

- [ ] ✅ **Todos los archivos WSDL/XSD están registrados (si aplica)**
  - Verificar: `quarkus.native.resources.includes=wsdl/**,xsd/**`

- [ ] ✅ **Todos los archivos de configuración están registrados**
  - Verificar: `quarkus.native.resources.includes=config/**`

### 17.3 Ausencia de Reflection Dinámica Innecesaria

- [ ] ✅ **No hay `Class.forName()` sin documentación**
  - Búsqueda: `grep -r "Class.forName" src/main/java/`
  - Si existe, debe estar comentado con razón y anotación

- [ ] ✅ **No hay `Method.invoke()` sin documentación**
  - Búsqueda: `grep -r "Method.invoke" src/main/java/`

- [ ] ✅ **No hay `Constructor.newInstance()` sin documentación**
  - Búsqueda: `grep -r "Constructor.newInstance" src/main/java/`

- [ ] ✅ **No hay `Proxy.newProxyInstance()` sin documentación**
  - Búsqueda: `grep -r "Proxy.newProxyInstance" src/main/java/`

### 17.4 Dependencias y Librerías

- [ ] ✅ **No hay dependencias conocidamente incompatibles (Spring, Guice, CGLIB, Javassist, ASM)**
  - Verificar: `mvn dependency:tree | grep -i "spring\|guice\|cglib\|javassist\|asm"`

- [ ] ✅ **Se usa solo extensiones oficiales de Quarkus para características soportadas**
  - Verificar `pom.xml` para `io.quarkus` artifacts

- [ ] ✅ **Se evita scanning de classpath dinámico**
  - Búsqueda: `grep -r "ResourcePatternResolver\|ClassPathScanningCandidateComponentProvider"` src/

### 17.5 Inyección de Dependencias (CDI)

- [ ] ✅ **Se usa `@Inject` y CDI en lugar de instanciación manual**
  - Verificar patrones como `new ServiceImpl()` son mínimos

- [ ] ✅ **Se usa `@ApplicationScoped` para singletons**
  - Verificar: `grep -r "@ApplicationScoped" src/main/java/ | wc -l`

- [ ] ✅ **Se evita Service Locator pattern**
  - Búsqueda: `grep -r "CDI.current()" src/main/java/`

### 17.6 REST APIs

- [ ] ✅ **Todo endpoint REST retorna objetos anotados con `@RegisterForReflection`**
  - Verificar cada `@GET`, `@POST`, `@PUT`, `@DELETE`

- [ ] ✅ **Todo Request/Response de REST está anotado**
  - Verificar métodos con `@RequestBody` o retorno con `@RegisterForReflection`

- [ ] ✅ **REST clients tienen DTOs anotados**
  - Verificar `@RegisterRestClient` interfaces y sus DTOs

### 17.7 Base de Datos

- [ ] ✅ **Se usa Panache ORM en lugar de Hibernate puro (si aplica)**
  - Verificar: `import io.quarkus.hibernate.orm.panache`

- [ ] ✅ **Migraciones de BD están en lugar correcto**
  - Verificar: `src/main/resources/db/migration/`

- [ ] ✅ **Archivos SQL de migración están registrados como recursos nativos**

### 17.8 Serialización JSON

- [ ] ✅ **Jackson está configurado correctamente**
  - Verificar `application.properties` para configuración de Jackson

- [ ] ✅ **No hay `@JsonCreator` dinámicos sin control**
  - Búsqueda: `grep -r "@JsonCreator" src/main/java/`

- [ ] ✅ **Todo DTO tiene constructor sin argumentos**
  - Necesario para Jackson

### 17.9 SOAP/CXF (si aplica)

- [ ] ✅ **DTOs JAXB están anotados con `@RegisterForReflection`**
  - Verificar: `grep -r "@XmlRootElement" src/main/java/ | wc -l`

- [ ] ✅ **Archivos WSDL están en `src/main/resources/wsdl/`**
  - Verificar estructura

- [ ] ✅ **Archivos XSD están en `src/main/resources/xsd/`**
  - Verificar estructura

- [ ] ✅ **Recursos WSDL/XSD están registrados en `application.properties`**

### 17.10 Compilación Nativa

- [ ] ✅ **La aplicación compila exitosamente como imagen nativa**
  ```bash
  mvn clean quarkus:build -Dquarkus.package.type=native
  ```

- [ ] ✅ **No hay advertencias de "Unsupported method" en compilación**
  - Verificar logs: `target/native-image-build.log`

- [ ] ✅ **No hay advertencias de "Classpath scanning detected"**

- [ ] ✅ **El ejecutable nativo se inicia correctamente**
  ```bash
  ./target/app-runner
  ```

- [ ] ✅ **Tiempo de arranque es < 1 segundo**
  ```bash
  time ./target/app-runner
  ```

- [ ] ✅ **Tamaño de imagen nativa es < 200MB (o meta acordada)**
  ```bash
  ls -lh target/app-runner
  ```

### 17.11 Testing

- [ ] ✅ **Tests corren en JVM sin problemas**
  ```bash
  mvn test
  ```

- [ ] ✅ **Tests corren correctamente con native profile (si aplica)**
  ```bash
  mvn test -Pnative
  ```

- [ ] ✅ **No hay fallos relacionados con reflection en tests**

### 17.12 Documentación de Desviaciones

- [ ] ✅ **Cualquier uso de reflection dinámico está documentado**
  - Comentarios en código explicando por qué es necesario
  - Referencia a issue o ticket

- [ ] ✅ **Cualquier dependencia incompatible tiene justificación documentada**
  - Ticket en backlog para reemplazo
  - Explicación de alternativas exploradas

- [ ] ✅ **Recursos nativos adicionales están documentados**
  - Comentario en `application.properties`

### 17.13 Preparación para Producción

- [ ] ✅ **Aplicación está testeada en contenedor Native**
  ```bash
  docker build -f Dockerfile.native -t app:latest .
  docker run app:latest
  ```

- [ ] ✅ **Logs están configurados correctamente**
  - Formato JSON para agregación (si aplica)
  - Nivel de log apropiado

- [ ] ✅ **Health checks están implementados**
  - Liveness probe
  - Readiness probe

- [ ] ✅ **Métricas Prometheus están expuestas (si aplica)**
  - Verificar: `http://localhost:8080/metrics`

- [ ] ✅ **Security checks completados**
  - No hay credenciales en código
  - Validaciones de input implementadas
  - CORS configurado correctamente

---

## 18. Validación Automática (Scripts)

### 18.1 Script de Validación Rápida

```bash
#!/bin/bash
# validate-native.sh

echo "🔍 Validando compatibilidad con Quarkus Native..."

# 1. Verificar @RegisterForReflection
echo "1. Verificando anotaciones @RegisterForReflection..."
MISSING_ANNOTATIONS=$(grep -r "public class.*Dto\|public record\|public class.*Request\|public class.*Response" src/main/java/ | \
  grep -v "@RegisterForReflection" | wc -l)

if [ "$MISSING_ANNOTATIONS" -gt 0 ]; then
    echo "❌ FALLO: $MISSING_ANNOTATIONS clases sin @RegisterForReflection"
    exit 1
else
    echo "✅ PASS: Todas las clases están anotadas"
fi

# 2. Verificar uso de reflection dinámico
echo "2. Verificando uso de reflection dinámico..."
DYNAMIC_REFLECTION=$(grep -r "Class.forName\|Method.invoke\|Constructor.newInstance" src/main/java/ | wc -l)

if [ "$DYNAMIC_REFLECTION" -gt 0 ]; then
    echo "⚠️ ADVERTENCIA: Se encontró $DYNAMIC_REFLECTION uso(s) de reflection dinámico"
else
    echo "✅ PASS: No hay reflection dinámico"
fi

# 3. Verificar dependencias prohibidas
echo "3. Verificando dependencias prohibidas..."
mvn dependency:tree | grep -i "spring\|guice\|cglib\|javassist" > /dev/null && \
    echo "❌ FALLO: Se encontraron dependencias incompatibles" && exit 1 || \
    echo "✅ PASS: Dependencias válidas"

echo ""
echo "✅ Validación completada exitosamente"
```

### 18.2 Usar en CI/CD

```yaml
# .github/workflows/native-validation.yml
name: Native Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate Native Compatibility
        run: bash scripts/validate-native.sh
      - name: Build Native Image
        run: mvn clean quarkus:build -Dquarkus.package.type=native
```

---

## 19. Guía de Troubleshooting

### 19.1 Error: "Unsupported method"

**Síntoma:** Error en compilación nativa
```
Error: Unsupported method: java.lang.Class.forName(String)
```

**Solución:**
1. Encontrar dónde se usa `Class.forName()`
2. Si es en DTO/Entity, anotarlo con `@RegisterForReflection`
3. Si es en lógica, reemplazar con CDI

### 19.2 Error: "Classpath scanning detected"

**Síntoma:**
```
Error: Classpath scanning is not supported in native images
```

**Solución:**
1. No usar `ResourcePatternResolver`
2. Declarar clases/resources explícitamente
3. Usar `@RegisterResource` o `quarkus.native.resources.includes`

### 19.3 Error: "Dynamic proxy creation"

**Síntoma:**
```
Error: Dynamic proxy creation not supported
```

**Solución:**
1. Si es SOAP/REST Client, usar extensión Quarkus
2. Si es otro caso, usar CDI con interfaz

### 19.4 Error: "JsonMappingException"

**Síntoma:**
```
JsonMappingException: No suitable constructor found for type
```

**Solución:**
1. Añadir `@RegisterForReflection` al DTO
2. Asegurar DTO tiene constructor sin argumentos
3. Añadir getters/setters

---

## 20. Referencias Normativas

### Documentación Oficial

- [Quarkus Native Image Guide](https://quarkus.io/guides/building-native-image)
- [GraalVM Documentation](https://www.graalvm.org/latest/docs/native-image/)
- [Quarkus CDI Reference](https://quarkus.io/guides/cdi)
- [Quarkus Extension Registry](https://code.quarkus.io/)

### Herramientas de Validación

- [GraalVM Native Image Tool](https://www.graalvm.org/latest/reference-manual/native-image/overview/Benefits/)
- [Quarkus Maven Plugin](https://quarkus.io/guides/maven-tooling)
- [Quarkus CLI](https://quarkus.io/guides/cli-tooling)

---

## Conclusión

Esta skill proporciona el marco completo para desarrollar aplicaciones Quarkus 100% compatibles con GraalVM Native Image. Seguir estas reglas garantiza:

✅ Compilación exitosa a imagen nativa  
✅ Tiempo de arranque subsegundario  
✅ Consumo mínimo de memoria  
✅ Compatibilidad total con contenedores  
✅ Escalabilidad en Kubernetes  

**Recordar:** Native First no es una optimización posterior, es una restricción de diseño desde el inicio.

---

*Versión 1.0 - Junio 2026*  
*Estándar Corporativo de Desarrollo Quarkus Native*
