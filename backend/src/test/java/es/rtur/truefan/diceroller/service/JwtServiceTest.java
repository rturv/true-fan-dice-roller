package es.rtur.truefan.diceroller.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import es.rtur.truefan.diceroller.config.JwtConfig;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "01234567890123456789012345678901";

    private JwtService service(int expiryMinutes, int renewalGraceMinutes) {
        JwtConfig config = new JwtConfig() {
            @Override
            public String secret() {
                return SECRET;
            }

            @Override
            public int expiryMinutes() {
                return expiryMinutes;
            }

            @Override
            public int renewalGraceMinutes() {
                return renewalGraceMinutes;
            }
        };
        return new JwtService(new ObjectMapper(), config);
    }

    @Test
    void generatedTokenIsValidAndKeepsClaims() {
        JwtService jwtService = service(60, 10);
        String token = jwtService.generateToken("ana", "ABC1234", true);

        JwtService.JwtToken claims = jwtService.validate(token);

        assertNotNull(claims);
        assertEquals("ana", claims.nickname());
        assertEquals("ABC1234", claims.roomCode());
        assertEquals(true, claims.isAdmin());
    }

    @Test
    void tamperedTokenIsRejected() {
        JwtService jwtService = service(60, 10);
        String token = jwtService.generateToken("ana", "ABC1234", false);
        String[] parts = token.split("\\.");
        char[] payload = parts[1].toCharArray();
        payload[0] = payload[0] == 'A' ? 'B' : 'A';
        String tampered = parts[0] + "." + new String(payload) + "." + parts[2];

        assertNull(jwtService.validate(tampered));
    }

    @Test
    void algNoneTokenIsRejected() {
        JwtService jwtService = service(60, 10);
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String header = encoder.encodeToString(
                "{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = encoder.encodeToString(
                "{\"nick\":\"ana\",\"roomCode\":\"ABC1234\",\"isAdmin\":false,\"exp\":9999999999}"
                        .getBytes(StandardCharsets.UTF_8));
        String token = header + "." + payload + ".";

        assertNull(jwtService.validate(token));
    }

    @Test
    void expiredTokenCanBeRenewedWithinGracePeriod() {
        JwtService jwtService = service(-1, 10);
        String token = jwtService.generateToken("ana", "ABC1234", false);

        assertNull(jwtService.validate(token));
        assertNotNull(jwtService.renewToken(token));
    }

    @Test
    void expiredTokenCannotBeRenewedAfterGracePeriod() {
        JwtService jwtService = service(-20, 1);
        String token = jwtService.generateToken("ana", "ABC1234", false);

        assertNull(jwtService.renewToken(token));
        assertFalse(token.isBlank());
    }
}
