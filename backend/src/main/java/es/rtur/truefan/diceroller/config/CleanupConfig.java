package es.rtur.truefan.diceroller.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

/**
 * Configuración de la limpieza de salas inactivas al arrancar.
 */
@ConfigMapping(prefix = "diceroller.rooms.cleanup")
public interface CleanupConfig {

    @WithDefault("true")
    boolean enabled();

    @WithDefault("24")
    long inactivityHours();
}
