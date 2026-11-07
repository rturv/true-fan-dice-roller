# Estructura del proyecto

Este repositorio está organizado en tres directorios principales:

* `./open-design`

  * Contiene el diseño funcional y visual de la aplicación.
  * Este diseño ha sido generado y mantenido mediante la herramienta OpenDesign.
  * Antes de realizar cambios en la implementación, revisa esta carpeta para comprender la estructura de pantallas, flujos de navegación, componentes y requisitos de interfaz.

* `./frontend`

  * Contiene la aplicación frontend.
  * La tecnología utilizada es **Angular**.
  * Todo el código relacionado con la interfaz de usuario, componentes, servicios, rutas, estilos y pruebas frontend debe ubicarse en este directorio.

* `./backend`

  * Contiene la aplicación backend.
  * La tecnología utilizada es **Quarkus**.
  * Todo el código relacionado con APIs, lógica de negocio, persistencia, integración con sistemas externos y pruebas backend debe ubicarse en este directorio.
  * Tienes apache maven isntalado en C:\programas\apache-maven-3.9.9

## Directrices para el agente

1. Analiza primero el contenido de `./open-design` antes de implementar nuevas funcionalidades.
2. Mantén una separación estricta entre frontend (`./frontend`) y backend (`./backend`).
3. Las funcionalidades de interfaz deben implementarse en Angular siguiendo el diseño definido en OpenDesign.
4. Los servicios y la lógica de negocio deben implementarse en Quarkus.
5. Siempre que sea posible, verifica que la implementación desarrollada sea consistente con los diseños y flujos definidos en `./open-design`.

## OTROS:
maven está en C:\programas\apache-maven-3.9.9
la jdk 21 para usar esta en C:\programas\jdk-21.0.10
la jdk 25 para usar esta en C:\programas\jdk-25.0.2

El backend se compila para **Java 25** (`maven.compiler.release=25`) y usa
**Quarkus 3.40 LTS**. El build local usa Maven Toolchain: si existe
`C:\Users\usuario\.m2\toolchains.xml`, el perfil `toolchain-jdk25` se activa
automáticamente y compila con el JDK 25, independientemente del `JAVA_HOME`.
Si el fichero no existe, Maven debe ejecutarse sobre un JDK 25 para compilar
`release 25` (el `Dockerfile` ya usa Temurin 25).
