package es.rtur.truefan.diceroller.websocket;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

@QuarkusTest
class WebSocketProtocolTest {

    @TestHTTPResource("/ws/room")
    URL webSocketUrl;

    @Test
    void createRoomRollDiceAndPingWorkOverWebSocket() throws Exception {
        MessageListener listener = new MessageListener();
        WebSocket webSocket = HttpClient.newHttpClient()
                .newWebSocketBuilder()
                .buildAsync(toWebSocketUri(webSocketUrl), listener)
                .get(10, TimeUnit.SECONDS);

        try {
            webSocket.sendText("{\"type\":\"create_room\",\"nickname\":\"test\"}", true).get();
            String joined = await(listener.messages, "joined");
            assertTrue(joined.contains("\"roomCode\":\""));
            assertTrue(joined.contains("\"sessionToken\":\""));

            webSocket.sendText("{\"type\":\"roll_dice\",\"count\":2,\"modifier\":1}", true).get();
            String diceRoll = await(listener.messages, "dice_roll");
            assertTrue(diceRoll.contains("\"initialCount\":2"));

            webSocket.sendText("{\"type\":\"ping\"}", true).get();
            assertEquals("{\"type\":\"pong\"}", await(listener.messages, "pong"));

            webSocket.sendText("{\"type\":\"send_message\",\"text\":\"hola\"}", true).get();
            assertTrue(await(listener.messages, "text_message").contains("\"text\":\"hola\""));

            webSocket.sendText("{\"type\":\"pool_delta\",\"delta\":5}", true).get();
            assertTrue(await(listener.messages, "pool_updated").contains("\"value\":5"));

            webSocket.sendText("{\"type\":\"toggle_cards\"}", true).get();
            assertTrue(await(listener.messages, "cards_toggled").contains("\"enabled\":true"));

            webSocket.sendText("{\"type\":\"draw_card\"}", true).get();
            assertTrue(await(listener.messages, "card_draw").contains("\"card\":"));
        } finally {
            webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "done").get(10, TimeUnit.SECONDS);
        }
    }

    private URI toWebSocketUri(URL url) {
        return URI.create(url.toString().replaceFirst("^http", "ws"));
    }

    private String await(BlockingQueue<String> messages, String type) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            String message = messages.poll(200, TimeUnit.MILLISECONDS);
            if (message == null) {
                continue;
            }
            if (message.contains("\"type\":\"" + type + "\"")) {
                return message;
            }
        }
        throw new AssertionError("Timeout esperando mensaje WebSocket: " + type);
    }

    private static final class MessageListener implements WebSocket.Listener {

        private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        private final StringBuilder buffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);
            if (last) {
                messages.add(buffer.toString());
                buffer.setLength(0);
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            throw new IllegalStateException("Error en WebSocket de test", error);
        }
    }
}
