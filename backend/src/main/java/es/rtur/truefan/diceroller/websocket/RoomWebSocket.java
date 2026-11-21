package es.rtur.truefan.diceroller.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.rtur.truefan.diceroller.entity.ChatEntry;
import es.rtur.truefan.diceroller.entity.Room;
import es.rtur.truefan.diceroller.entity.RoomUser;
import es.rtur.truefan.diceroller.service.JwtService;
import es.rtur.truefan.diceroller.service.RoomService;
import es.rtur.truefan.diceroller.service.RoomService.CardDrawResult;
import es.rtur.truefan.diceroller.service.RoomService.DiceRollResult;
import es.rtur.truefan.diceroller.service.RoomService.JoinResult;
import es.rtur.truefan.diceroller.service.RoomService.ReconnectResult;
import es.rtur.truefan.diceroller.service.RoomService.ReshuffleResult;
import es.rtur.truefan.diceroller.service.RoomService.TextMessageResult;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnError;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.OpenConnections;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;

@WebSocket(path = "/ws/room")
@ApplicationScoped
public class RoomWebSocket {

    private static final Logger LOG = Logger.getLogger(RoomWebSocket.class);

    private final ObjectMapper objectMapper;
    private final RoomService roomService;
    private final JwtService jwtService;
    private final OpenConnections openConnections;

    // roomCode -> connection ids, y mapas inversos para resolver la sesión.
    private final Map<String, Set<String>> roomConnections = new ConcurrentHashMap<>();
    private final Map<String, String> connectionIdToRoomCode = new ConcurrentHashMap<>();
    private final Map<String, String> connectionIdToToken = new ConcurrentHashMap<>();

    @Inject
    public RoomWebSocket(
            ObjectMapper objectMapper,
            RoomService roomService,
            JwtService jwtService,
            OpenConnections openConnections) {
        this.objectMapper = objectMapper;
        this.roomService = roomService;
        this.jwtService = jwtService;
        this.openConnections = openConnections;
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        handleDisconnect(connection.id());
    }

    @OnError
    public void onError(Throwable error) {
        LOG.debug("Error en WebSocket", error);
    }

    @OnTextMessage
    public void onMessage(String message, WebSocketConnection connection) {
        try {
            JsonNode msg = objectMapper.readTree(message);
            String type = msg.has("type") ? msg.get("type").asText() : "";

            switch (type) {
                case "create_room" -> handleCreateRoom(connection, msg);
                case "join" -> handleJoin(connection, msg);
                case "reconnect" -> handleReconnect(connection, msg);
                case "roll_dice" -> handleRollDice(connection, msg);
                case "draw_card" -> handleDrawCard(connection, msg);
                case "send_message" -> handleSendMessage(connection, msg);
                case "toggle_cards" -> handleToggleCards(connection, msg);
                case "pool_delta" -> handlePoolDelta(connection, msg);
                case "pool_set" -> handlePoolSet(connection, msg);
                case "reshuffle_deck" -> handleReshuffleDeck(connection, msg);
                case "kick_user" -> handleKickUser(connection, msg);
                case "ping" -> handlePing(connection);
                case "pong" -> { /* heartbeat response */ }
                case "renew_token" -> handleRenewToken(connection);
                default -> sendError(connection, "Unknown message type: " + type);
            }
        } catch (Exception e) {
            LOG.debug("Mensaje WebSocket inválido", e);
            sendError(connection, "Invalid message format");
        }
    }

    private void handleCreateRoom(WebSocketConnection connection, JsonNode msg) {
        String nickname = msg.has("nickname") ? msg.get("nickname").asText() : "";
        if (nickname.isBlank()) {
            sendError(connection, "nickname is required");
            return;
        }

        JoinResult result = roomService.createAndJoinRoom(nickname);
        if (!result.success()) {
            sendError(connection, result.errorMessage());
            return;
        }

        registerSession(connection, result.room().code, result.user().sessionToken);
        sendMessage(connection, buildJoinedResponse(result, nickname));
    }

    private void handleJoin(WebSocketConnection connection, JsonNode msg) {
        String roomCode = msg.has("roomCode") ? msg.get("roomCode").asText() : "";
        String nickname = msg.has("nickname") ? msg.get("nickname").asText() : "";

        if (roomCode.isBlank() || nickname.isBlank()) {
            sendError(connection, "roomCode and nickname are required");
            return;
        }

        JoinResult result = roomService.joinRoom(roomCode, nickname);
        if (!result.success()) {
            sendError(connection, result.errorMessage());
            return;
        }

        registerSession(connection, roomCode, result.user().sessionToken);
        sendMessage(connection, buildJoinedResponse(result, nickname));

        broadcastToRoom(roomCode, createUserJoinedMsg(nickname), connection.id());
        broadcastUserList(roomCode);
    }

    private void handleReconnect(WebSocketConnection connection, JsonNode msg) {
        String roomCode = msg.has("roomCode") ? msg.get("roomCode").asText() : "";
        String nickname = msg.has("nickname") ? msg.get("nickname").asText() : "";
        String sessionToken = msg.has("sessionToken") ? msg.get("sessionToken").asText() : "";

        if (roomCode.isBlank() || nickname.isBlank() || sessionToken.isBlank()) {
            sendError(connection, "roomCode, nickname, and sessionToken are required");
            return;
        }

        ReconnectResult result = roomService.reconnectToRoom(roomCode, nickname, sessionToken);
        if (!result.success()) {
            sendError(connection, result.errorMessage());
            return;
        }

        registerSession(connection, roomCode, sessionToken);
        sendMessage(connection, buildJoinedResponse(result, nickname));

        broadcastToRoom(roomCode, createUserJoinedMsg(nickname), connection.id());
        broadcastUserList(roomCode);
    }

    private String buildJoinedResponse(JoinResult result, String nickname) {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "joined");
        response.put("roomCode", result.room().code);
        response.put("nickname", nickname);
        response.put("sessionToken", result.user().sessionToken);
        response.put("isAdmin", result.isAdmin());
        response.put("deckRemaining", result.deckRemaining());
        response.put("poolValue", result.poolValue());
        response.put("cardsEnabled", result.cardsEnabled());

        ArrayNode usersArray = response.putArray("users");
        for (String user : result.users()) {
            usersArray.add(user);
        }

        ArrayNode historyArray = response.putArray("history");
        for (ChatEntry entry : result.history()) {
            historyArray.add(chatEntryToJson(entry));
        }

        return response.toString();
    }

    private String buildJoinedResponse(ReconnectResult result, String nickname) {
        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "joined");
        response.put("roomCode", result.room().code);
        response.put("nickname", nickname);
        response.put("sessionToken", result.user().sessionToken);
        response.put("isAdmin", result.isAdmin());
        response.put("deckRemaining", result.deckRemaining());
        response.put("poolValue", result.poolValue());
        response.put("cardsEnabled", result.cardsEnabled());

        ArrayNode usersArray = response.putArray("users");
        for (String user : result.users()) {
            usersArray.add(user);
        }

        ArrayNode historyArray = response.putArray("history");
        for (ChatEntry entry : result.history()) {
            historyArray.add(chatEntryToJson(entry));
        }

        return response.toString();
    }

    private void handlePing(WebSocketConnection connection) {
        ObjectNode pong = objectMapper.createObjectNode();
        pong.put("type", "pong");
        sendMessage(connection, pong.toString());
    }

    private void handleRollDice(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        int count = msg.has("count") ? msg.get("count").asInt(2) : 2;
        int modifier = msg.has("modifier") ? msg.get("modifier").asInt(0) : 0;

        DiceRollResult result = roomService.performDiceRoll(user, count, modifier);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "dice_roll");
        response.put("nickname", result.nickname());
        response.put("timestamp", result.timestamp());
        response.set("result", objectMapper.valueToTree(result.result()));

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handleDrawCard(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        if (!user.room.cardsEnabled) {
            sendError(connection, "Cards are disabled");
            return;
        }

        CardDrawResult result = roomService.performCardDraw(user);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "card_draw");
        response.put("nickname", result.nickname());
        response.put("remaining", result.remaining());
        response.put("autoReshuffled", result.autoReshuffled());
        if (result.reshuffleReason() != null) {
            response.put("reshuffleReason", result.reshuffleReason());
        }
        response.put("timestamp", result.timestamp());
        response.set("card", objectMapper.valueToTree(result.card()));

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handleSendMessage(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        String text = msg.has("text") ? msg.get("text").asText() : "";
        if (text.isBlank()) {
            return;
        }

        TextMessageResult result = roomService.sendTextMessage(user, text);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "text_message");
        response.put("nickname", result.nickname());
        response.put("text", result.text());
        response.put("timestamp", result.timestamp());

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handleToggleCards(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        RoomService.ToggleCardsResult result = roomService.toggleCards(user);
        if (result == null) {
            sendError(connection, "Only the admin can toggle cards");
            return;
        }

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "cards_toggled");
        response.put("enabled", result.enabled());
        response.put("byNickname", result.byNickname());
        response.put("timestamp", result.timestamp());

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handleRenewToken(WebSocketConnection connection) {
        String connectionId = connection.id();
        String oldToken = connectionIdToToken.get(connectionId);
        if (oldToken == null) {
            sendError(connection, "No token to renew");
            return;
        }
        String newToken = jwtService.renewToken(oldToken);
        if (newToken == null || jwtService.validate(newToken) == null) {
            sendError(connection, "Cannot renew token");
            return;
        }

        RoomUser user = roomService.findUserBySessionToken(oldToken).orElse(null);
        if (user != null) {
            roomService.updateSessionToken(user, newToken);
        }

        String roomCode = connectionIdToRoomCode.get(connectionId);
        if (roomCode == null) {
            sendError(connection, "Session is not registered in a room");
            return;
        }
        registerSession(connection, roomCode, newToken);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "token_renewed");
        response.put("sessionToken", newToken);
        sendMessage(connection, response.toString());
    }

    private void handlePoolDelta(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        int delta = msg.has("delta") ? msg.get("delta").asInt(0) : 0;
        if (delta == 0) {
            return;
        }

        RoomService.PoolResult result = roomService.poolDelta(user, delta);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "pool_updated");
        response.put("value", result.value());
        response.put("delta", result.delta());
        response.put("byNickname", result.byNickname());
        response.put("timestamp", result.timestamp());

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handlePoolSet(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        if (!user.nickname.equals(user.room.adminNickname)) {
            sendError(connection, "Only the admin can set the pool value");
            return;
        }

        int value = msg.has("value") ? msg.get("value").asInt(-1) : -1;
        if (value < 0) {
            return;
        }

        RoomService.PoolResult result = roomService.poolSet(user, value);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "pool_updated");
        response.put("value", result.value());
        response.put("delta", result.delta());
        response.put("byNickname", result.byNickname());
        response.put("timestamp", result.timestamp());

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handleReshuffleDeck(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        if (!user.nickname.equals(user.room.adminNickname)) {
            sendError(connection, "Only the admin can reshuffle the deck");
            return;
        }

        ReshuffleResult result = roomService.reshuffleDeck(user);
        if (result == null) {
            return;
        }

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "deck_reshuffled");
        response.put("byNickname", result.byNickname());
        response.put("remaining", result.remaining());
        response.put("timestamp", result.timestamp());

        broadcastToRoom(getRoomCode(connection), response.toString(), null);
    }

    private void handleKickUser(WebSocketConnection connection, JsonNode msg) {
        RoomUser user = validateSession(connection);
        if (user == null) {
            return;
        }

        String targetNickname = msg.has("targetNickname") ? msg.get("targetNickname").asText() : "";
        if (targetNickname.isBlank()) {
            return;
        }

        String roomCode = getRoomCode(connection);

        // Localizar las conexiones ANTES de borrar el RoomUser, porque después
        // ya no se puede resolver el token contra la base de datos.
        Set<String> targetConnectionIds = new HashSet<>();
        Set<String> connectionIds = roomConnections.get(roomCode);
        if (connectionIds != null) {
            for (String candidateId : List.copyOf(connectionIds)) {
                String candidateToken = connectionIdToToken.get(candidateId);
                if (candidateToken == null) {
                    continue;
                }
                RoomUser candidate = roomService.findUserBySessionToken(candidateToken).orElse(null);
                if (candidate != null && candidate.nickname.equals(targetNickname)) {
                    targetConnectionIds.add(candidateId);
                }
            }
        }

        boolean kicked = roomService.kickUser(user, targetNickname);
        if (!kicked) {
            sendError(connection, "Cannot kick user");
            return;
        }

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "user_kicked");
        response.put("nickname", targetNickname);
        response.put("byNickname", user.nickname);

        broadcastToRoom(roomCode, response.toString(), null);

        for (String targetConnectionId : targetConnectionIds) {
            WebSocketConnection targetConnection = findConnection(targetConnectionId);
            if (targetConnection == null) {
                continue;
            }
            try {
                ObjectNode kickMsg = objectMapper.createObjectNode();
                kickMsg.put("type", "you_kicked");
                kickMsg.put("byNickname", user.nickname);
                sendMessage(targetConnection, kickMsg.toString());
                targetConnection.closeAndAwait();
            } catch (Exception e) {
                LOG.debugf(e, "No se pudo expulsar la conexión %s", targetConnectionId);
            }
        }

        broadcastUserList(roomCode);
    }

    private void handleDisconnect(String connectionId) {
        String roomCode = connectionIdToRoomCode.remove(connectionId);
        String sessionToken = connectionIdToToken.remove(connectionId);

        if (roomCode != null) {
            Set<String> connectionIds = roomConnections.get(roomCode);
            if (connectionIds != null) {
                connectionIds.remove(connectionId);
                if (connectionIds.isEmpty()) {
                    roomConnections.remove(roomCode);
                }
            }
        }

        if (sessionToken == null) {
            return;
        }

        // If another live connection already holds the same token (quick
        // reconnect / F5), keep the user connected and do not emit user_left.
        if (connectionIdToToken.containsValue(sessionToken)) {
            return;
        }

        roomService.markDisconnected(sessionToken);

        if (roomCode != null) {
            try {
                RoomUser user = roomService.findUserBySessionToken(sessionToken).orElse(null);
                if (user != null) {
                    broadcastToRoom(roomCode, createUserLeftMsg(user.nickname, "disconnect"), null);
                    // Admin is NOT transferred here: the session keeps a
                    // reconnect grace period. It is transferred later by
                    // transferAdminIfNeeded once that period elapses.
                    broadcastUserList(roomCode);
                }
            } catch (Exception e) {
                LOG.debug("No se pudo notificar la desconexión", e);
            }
        }
    }

    private RoomUser validateSession(WebSocketConnection connection) {
        String sessionToken = connectionIdToToken.get(connection.id());
        if (sessionToken == null) {
            sendError(connection, "Not authenticated. Send join first.");
            return null;
        }
        if (jwtService.validate(sessionToken) == null) {
            sendError(connection, "Invalid or expired token. Send renew_token.");
            return null;
        }
        RoomUser user = roomService.findUserBySessionToken(sessionToken).orElse(null);
        if (user == null) {
            sendError(connection, "Session not found");
            return null;
        }
        return user;
    }

    private void registerSession(WebSocketConnection connection, String roomCode, String sessionToken) {
        String connectionId = connection.id();
        connectionIdToRoomCode.put(connectionId, roomCode);
        connectionIdToToken.put(connectionId, sessionToken);
        roomConnections.computeIfAbsent(roomCode, key -> ConcurrentHashMap.newKeySet()).add(connectionId);
    }

    private String getRoomCode(WebSocketConnection connection) {
        return connectionIdToRoomCode.get(connection.id());
    }

    private WebSocketConnection findConnection(String connectionId) {
        return openConnections.findByConnectionId(connectionId).orElse(null);
    }

    private void broadcastToRoom(String roomCode, String message, String excludeConnectionId) {
        if (roomCode == null) {
            return;
        }
        Set<String> connectionIds = roomConnections.get(roomCode);
        if (connectionIds == null) {
            return;
        }
        for (String connectionId : List.copyOf(connectionIds)) {
            if (connectionId.equals(excludeConnectionId)) {
                continue;
            }
            WebSocketConnection connection = findConnection(connectionId);
            if (connection != null) {
                sendMessage(connection, message);
            }
        }
    }

    private void broadcastUserList(String roomCode) {
        Room room = roomService.findRoomByCode(roomCode);
        if (room == null) {
            return;
        }

        String adminBefore = room.adminNickname;
        roomService.transferAdminIfNeeded(room);

        List<String> users = roomService.getConnectedNicknames(room);

        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "user_list");
        ArrayNode usersArray = msg.putArray("users");
        for (String user : users) {
            usersArray.add(user);
        }

        broadcastToRoom(roomCode, msg.toString(), null);

        String adminAfter = room.adminNickname;
        if (adminBefore != null && adminAfter != null && !adminBefore.equals(adminAfter)) {
            ObjectNode adminMsg = objectMapper.createObjectNode();
            adminMsg.put("type", "admin_changed");
            adminMsg.put("newAdminNickname", adminAfter);
            broadcastToRoom(roomCode, adminMsg.toString(), null);
        }
    }

    private void sendError(WebSocketConnection connection, String errorMessage) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "error");
        msg.put("message", errorMessage);
        sendMessage(connection, msg.toString());
    }

    private void sendMessage(WebSocketConnection connection, String message) {
        if (!connection.isOpen()) {
            return;
        }
        try {
            connection.sendTextAndAwait(message);
        } catch (Exception e) {
            LOG.debugf(e, "No se pudo enviar mensaje a la conexión %s", connection.id());
        }
    }

    private String createUserJoinedMsg(String nickname) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "user_joined");
        msg.put("nickname", nickname);
        return msg.toString();
    }

    private String createUserLeftMsg(String nickname, String reason) {
        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "user_left");
        msg.put("nickname", nickname);
        msg.put("reason", reason);
        return msg.toString();
    }

    private ObjectNode chatEntryToJson(ChatEntry entry) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", switch (entry.type) {
            case DICE_ROLL -> "dice_roll";
            case CARD_DRAW -> "card_draw";
            case TEXT_MESSAGE -> "text_message";
            case SYSTEM -> "system";
        });
        node.put("nickname", entry.nickname);
        node.put("timestamp", entry.timestamp.toString());

        if (entry.type == ChatEntry.EntryType.TEXT_MESSAGE) {
            node.put("text", entry.content);
        } else {
            try {
                node.set("data", objectMapper.readTree(entry.content));
            } catch (Exception e) {
                LOG.debug("Contenido de historial no es JSON válido", e);
                node.put("data", entry.content);
            }
        }

        return node;
    }
}
