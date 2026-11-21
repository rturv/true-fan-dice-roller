package es.rtur.truefan.diceroller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.rtur.truefan.diceroller.service.JwtService;
import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ApplicationSmokeTest {

    @Inject
    JwtService jwtService;

    @TestHTTPResource("/health")
    URL healthUrl;

    @Test
    void cdiBeansAreWired() {
        String token = jwtService.generateToken("smoke", "ABC1234", true);

        JwtService.JwtToken claims = jwtService.validate(token);

        assertNotNull(claims);
        assertEquals("smoke", claims.nickname());
    }

    @Test
    void healthEndpointIsUp() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder(URI.create(healthUrl.toString())).GET().build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"status\": \"UP\"")
                || response.body().contains("\"status\":\"UP\""));
    }
}
