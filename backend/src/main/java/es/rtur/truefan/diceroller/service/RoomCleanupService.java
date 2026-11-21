package es.rtur.truefan.diceroller.service;

import es.rtur.truefan.diceroller.config.CleanupConfig;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
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

    private final RoomService roomService;
    private final CleanupConfig config;

    @Inject
    public RoomCleanupService(RoomService roomService, CleanupConfig config) {
        this.roomService = roomService;
        this.config = config;
    }

    void onStart(@Observes StartupEvent event) {
        if (!config.enabled()) {
            LOG.info("Room cleanup on startup is disabled");
            return;
        }
        if (config.inactivityHours() < 0) {
            LOG.warnf("Invalid diceroller.rooms.cleanup.inactivity-hours=%d, skipping cleanup",
                    config.inactivityHours());
            return;
        }

        try {
            int deleted = roomService.deleteInactiveRooms(config.inactivityHours());
            LOG.infof("Room cleanup: deleted %d inactive room(s) with no activity in the last %d hour(s)",
                    deleted, config.inactivityHours());
        } catch (Exception e) {
            LOG.error("Room cleanup failed", e);
        }
    }
}
