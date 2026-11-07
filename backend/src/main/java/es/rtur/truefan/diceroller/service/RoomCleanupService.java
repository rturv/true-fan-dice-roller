package es.rtur.truefan.diceroller.service;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Ejecuta la limpieza de salas inactivas al arrancar el backend.
 *
 * <p>La antigüedad máxima se configura con
 * {@code diceroller.rooms.cleanup.inactivity-hours} (24 por defecto). La
 * limpieza se puede desactivar con
 * {@code diceroller.rooms.cleanup.enabled=false}.</p>
 */
@ApplicationScoped
public class RoomCleanupService {

    private static final Logger LOG = Logger.getLogger(RoomCleanupService.class);

    @Inject
    RoomService roomService;

    @ConfigProperty(name = "diceroller.rooms.cleanup.enabled", defaultValue = "true")
    boolean enabled;

    @ConfigProperty(name = "diceroller.rooms.cleanup.inactivity-hours", defaultValue = "24")
    long inactivityHours;

    void onStart(@Observes StartupEvent event) {
        if (!enabled) {
            LOG.info("Room cleanup on startup is disabled");
            return;
        }
        if (inactivityHours < 0) {
            LOG.warnf("Invalid diceroller.rooms.cleanup.inactivity-hours=%d, skipping cleanup", inactivityHours);
            return;
        }

        try {
            int deleted = roomService.deleteInactiveRooms(inactivityHours);
            LOG.infof("Room cleanup: deleted %d inactive room(s) with no activity in the last %d hour(s)",
                deleted, inactivityHours);
        } catch (Exception e) {
            LOG.error("Room cleanup failed", e);
        }
    }
}
