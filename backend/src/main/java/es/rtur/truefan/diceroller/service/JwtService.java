package es.rtur.truefan.diceroller.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.rtur.truefan.diceroller.config.JwtConfig;
import io.smallrye.jwt.algorithm.SignatureAlgorithm;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.jboss.logging.Logger;

@ApplicationScoped
public class JwtService {

    private static final Logger LOG = Logger.getLogger(JwtService.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String JWT_ALGORITHM = "HS256";

    private final ObjectMapper objectMapper;
    private final JwtConfig config;

    @Inject
    public JwtService(ObjectMapper objectMapper, JwtConfig config) {
        this.objectMapper = objectMapper;
        this.config = config;
    }

    /** Generate a JWT token for a user joining a room. */
    public String generateToken(String nickname, String roomCode, boolean isAdmin) {
        Instant now = Instant.now();
        return Jwt.claims()
                .claim("nick", nickname)
                .claim("roomCode", roomCode)
                .claim("isAdmin", isAdmin)
                .issuedAt(now)
                .expiresIn(config.expiryMinutes() * 60L)
                .jws()
                .algorithm(SignatureAlgorithm.HS256)
                .sign(getKey());
    }

    /**
     * Verifica firma y caducidad. Devuelve {@code null} si el token no es
     * válido o ya ha expirado.
     */
    public JwtToken validate(String token) {
        JwtToken claims = verifySignature(token);
        if (claims == null || claims.expiresAt() == null) {
            return null;
        }
        if (claims.expiresAt() <= Instant.now().getEpochSecond()) {
            return null;
        }
        return claims;
    }

    /**
     * Renueva un token dentro del periodo de gracia posterior a su caducidad.
     * La firma se valida siempre; la caducidad se tolera solo durante la
     * ventana configurada.
     */
    public String renewToken(String oldToken) {
        JwtToken claims = verifySignature(oldToken);
        if (claims == null || claims.expiresAt() == null) {
            return null;
        }

        long now = Instant.now().getEpochSecond();
        long graceSeconds = config.renewalGraceMinutes() * 60L;
        if (now > claims.expiresAt() + graceSeconds) {
            return null;
        }

        return generateToken(claims.nickname(), claims.roomCode(), claims.isAdmin());
    }

    /**
     * Valida la firma y devuelve los claims, aunque el token esté caducado.
     * Este método es la base de {@link #validate(String)} y
     * {@link #renewToken(String)}.
     */
    private JwtToken verifySignature(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }

        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return null;
        }

        try {
            JsonNode header = objectMapper.readTree(base64UrlDecode(parts[0]));
            if (!JWT_ALGORITHM.equals(header.path("alg").asText())) {
                return null;
            }
        } catch (Exception e) {
            LOG.debug("Cabecera JWT inválida", e);
            return null;
        }

        byte[] providedSignature;
        try {
            providedSignature = Base64.getUrlDecoder().decode(parts[2]);
        } catch (IllegalArgumentException e) {
            LOG.debug("Firma JWT con Base64URL inválido", e);
            return null;
        }

        String headerPayload = parts[0] + "." + parts[1];
        byte[] expectedSignature = hmacSha256(headerPayload);
        if (!MessageDigest.isEqual(providedSignature, expectedSignature)) {
            return null;
        }

        try {
            String payloadJson = new String(base64UrlDecode(parts[1]), StandardCharsets.UTF_8);
            return parseClaims(payloadJson);
        } catch (Exception e) {
            LOG.debug("Payload JWT inválido", e);
            return null;
        }
    }

    private byte[] hmacSha256(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(getKey());
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("No se pudo calcular HMAC-SHA256", e);
        }
    }

    private byte[] base64UrlDecode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    private JwtToken parseClaims(String json) throws Exception {
        JsonNode node = objectMapper.readTree(json);

        String nickname = node.path("nick").isTextual() ? node.get("nick").asText() : null;
        String roomCode = node.path("roomCode").isTextual() ? node.get("roomCode").asText() : null;
        if (nickname == null || roomCode == null) {
            return null;
        }

        boolean isAdmin = node.path("isAdmin").asBoolean(false);
        Long expiresAt = node.path("exp").isNumber() ? node.get("exp").asLong() : null;

        return new JwtToken(nickname, roomCode, isAdmin, expiresAt);
    }

    private SecretKeySpec getKey() {
        return new SecretKeySpec(config.secret().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }

    /** Claims relevantes de un token de sesión. */
    public record JwtToken(String nickname, String roomCode, boolean isAdmin, Long expiresAt) {
    }
}
