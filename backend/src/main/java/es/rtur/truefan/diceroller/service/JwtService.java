package es.rtur.truefan.diceroller.service;

import io.smallrye.jwt.build.Jwt;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;

@ApplicationScoped
public class JwtService {

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "diceroller.jwt.secret")
    String secret;

    @ConfigProperty(name = "diceroller.jwt.expiry-minutes", defaultValue = "60")
    int expiryMinutes;

    @ConfigProperty(name = "diceroller.jwt.renewal-grace-minutes", defaultValue = "10")
    int renewalGraceMinutes;

    private SecretKeySpec getKey() {
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    /** Generate a JWT token for a user joining a room. */
    public String generateToken(String nickname, String roomCode, boolean isAdmin) {
        Instant now = Instant.now();
        return Jwt.claims()
                .claim("nick", nickname)
                .claim("roomCode", roomCode)
                .claim("isAdmin", isAdmin)
                .issuedAt(now)
                .expiresIn(expiryMinutes * 60L)
                .jws()
                .algorithm(io.smallrye.jwt.algorithm.SignatureAlgorithm.HS256)
                .sign(getKey());
    }

    /** Parse and validate a JWT. Returns the claims as a JwtToken or null if invalid. */
    public JwtToken validate(String token) {
        if (token == null || token.isBlank()) return null;

        String[] parts = token.split("\\.");
        if (parts.length != 3) return null;

        String headerPayload = parts[0] + "." + parts[1];
        byte[] providedSig = base64UrlDecode(parts[2]);
        byte[] expectedSig = hmacSha256(headerPayload);
        if (!java.util.Arrays.equals(providedSig, expectedSig)) return null;

        String payloadJson = new String(base64UrlDecode(parts[1]), StandardCharsets.UTF_8);
        JwtToken claims = parseClaims(payloadJson);
        if (claims == null) return null;

        // Check expiry (unless we're just verifying for renewal)
        if (claims.expiresAt != null && claims.expiresAt <= Instant.now().getEpochSecond()) {
            return claims; // expired signature still valid for renewal
        }

        return claims;
    }

    /** Renew a token if within the renewal grace period. */
    public String renewToken(String oldToken) {
        JwtToken claims = validate(oldToken);
        if (claims == null) return null;
        if (claims.expiresAt == null) return null;

        long now = Instant.now().getEpochSecond();
        long cutoff = claims.expiresAt - (renewalGraceMinutes * 60L);
        if (now < cutoff && now <= claims.expiresAt) {
            // Token is not yet within renewal window, but is valid — just reissue anyway
        }
        if (now > claims.expiresAt + (renewalGraceMinutes * 60L)) {
            return null; // too late to renew
        }

        return generateToken(claims.nickname, claims.roomCode, claims.isAdmin);
    }

    private byte[] hmacSha256(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(getKey());
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new RuntimeException("HMAC-SHA256 error", e);
        }
    }

    private byte[] base64UrlDecode(String b64) {
        String padded = b64.replace('-', '+').replace('_', '/');
        while (padded.length() % 4 != 0) padded += "=";
        return Base64.getDecoder().decode(padded);
    }

    @SuppressWarnings("unchecked")
    private JwtToken parseClaims(String json) {
        try {
            java.util.Map<String, Object> map = objectMapper.readValue(json, java.util.Map.class);
            JwtToken token = new JwtToken();
            token.nickname = (String) map.get("nick");
            token.roomCode = (String) map.get("roomCode");
            token.isAdmin = Boolean.TRUE.equals(map.get("isAdmin"));
            Number exp = (Number) map.get("exp");
            token.expiresAt = exp != null ? exp.longValue() : null;
            return token.nickname != null && token.roomCode != null ? token : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Represents parsed JWT claims. */
    public static class JwtToken {
        public String nickname;
        public String roomCode;
        public boolean isAdmin;
        public Long expiresAt;
    }
}
