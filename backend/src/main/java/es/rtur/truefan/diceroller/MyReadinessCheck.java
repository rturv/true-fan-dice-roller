package es.rtur.truefan.diceroller;

import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

import jakarta.inject.Inject;
import java.sql.Connection;
import javax.sql.DataSource;

/**
 * Readiness check: verifica que el backend está listo para atender tráfico,
 * comprobando que la conexión a la base de datos responde.
 *
 * <p>Expuesto por SmallRye Health en {@code /health/ready}.</p>
 */
@Readiness
public class MyReadinessCheck implements HealthCheck {

    private static final int VALIDATION_TIMEOUT_SECONDS = 3;

    @Inject
    DataSource dataSource;

    @Override
    public HealthCheckResponse call() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(VALIDATION_TIMEOUT_SECONDS)) {
                return HealthCheckResponse.up("database");
            }
            return HealthCheckResponse.down("database");
        } catch (Exception e) {
            return HealthCheckResponse.down("database");
        }
    }
}
