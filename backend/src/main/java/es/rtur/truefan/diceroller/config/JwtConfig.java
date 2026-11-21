package es.rtur.truefan.diceroller.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

/**
 * Configuración tipada del servicio JWT.
 */
@ConfigMapping(prefix = "diceroller.jwt")
public interface JwtConfig {

    /** Clave HMAC-SHA256 usada para firmar y verificar los tokens. */
    String secret();

    /** Minutos de validez de un token recién emitido. */
    @WithDefault("60")
    int expiryMinutes();

    /** Minutos de gracia para renovar un token ya caducado. */
    @WithDefault("10")
    int renewalGraceMinutes();
}
