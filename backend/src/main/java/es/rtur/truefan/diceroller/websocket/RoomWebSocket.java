package es.rtur.truefan.diceroller.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.rtur.truefan.diceroller.entity.ChatEntry;
import es.rtur.truefan.diceroller.entity.Room;
import es.rtur.truefan.diceroller.entity.RoomUser;
import es.rtur.truefan.diceroller.service.RoomService;
import es.rtur.truefan.diceroller.service.RoomService.CardDrawResult;
import es.rtur.truefan.diceroller.service.RoomService.DiceRollResult;
import es.rtur.truefan.diceroller.service.RoomService.JoinResult;
import es.rtur.truefan.diceroller.service.RoomService.ReconnectResult;
import es.rtur.truefan.diceroller.service.RoomService.ReshuffleResult;
import es.rtur.truefan.diceroller.service.RoomService.TextMessageResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.OnClose;
import jakarta.websocket.OnError;
import jakarta.websocket.OnMessage;
import jakarta.websocket.OnOpen;
import jakarta.websocket.Session;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@ServerEndpoint("/ws/room")
@ApplicationScoped
public class RoomWebSocket {

    @Inject
    ObjectMapper objectMapper;

    @Inject
    RoomService roomService;

    private final Map<String, Set<Session>> roomSessions = new ConcurrentHashMap<>();
    private final Map<String, String> sessionIdToRoomCode = new ConcurrentHashMap<>();
    private final Map<String, String> sessionIdToToken = new ConcurrentHashMap<>();

    @OnOpen
    public void onOpen(Session session) {
    }

    @OnClose
    public void onClose(Session session) {
        handleDisconnect(session);
    }

    @OnError
    public void onError(Session session, Throwable error) {
        handleDisconnect(session);
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            JsonNode msg = objectMapper.readTree(message);
            String type = msg.has("type") ? msg.get("type").asText() : "";

            switch (type) {
                case "create_room" -> handleCreateRoom(session, msg);
                case "join" -> handleJoin(session, msg);
                case "reconnect" -> handleReconnect(session, msg);
                case "roll_dice" -> handleRollDice(session, msg);
                case "draw_card" -> handleDrawCard(session, msg);
                case "send_message" -> handleSendMessage(session, msg);
                case "pool_delta" -> handlePoolDelta(session, msg);
                case "pool_set" -> handlePoolSet(session, msg);
                case "reshuffle_deck" -> handleReshuffleDeck(session, msg);
                case "kick_user" -> handleKickUser(session, msg);
                case "ping" -> {
                    try {
                        ObjectNode pong = objectMapper.createObjectNode();
                        pong.put("type", "pong");
                        sendMessage(session, pong.toString());
                    } catch (Exception e) {}
                }
                case "pong" -> { /* heartbeat response */ }
                default -> sendError(session, "Unknown message type: " + type);
            }
        } catch (Exception e) {
            sendError(session, "Invalid message format");
        }
    }

    private void handleCreateRoom(Session session, JsonNode msg) {
        String nickname = msg.has("nickname") ? msg.get("nickname").asText() : "";
        if (nickname.isBlank()) {
            sendError(session, "nickname is required");
            return;
        }

        JoinResult result = roomService.createAndJoinRoom(nickname);
        if (!result.success) {
            sendError(session, result.errorMessage);
            return;
        }

        registerSession(session, result.room.code, result.user.sessionToken);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "joined");
        response.put("roomCode", result.room.code);
        response.put("nickname", nickname);
        response.put("sessionToken", result.user.sessionToken);
        response.put("isAdmin", true);
        response.put("deckRemaining", result.deckRemaining);
        response.put("poolValue", result.poolValue);

        ArrayNode usersArray = response.putArray("users");
        for (String u : result.users) {
            usersArray.add(u);
        }

        ArrayNode historyArray = response.putArray("history");
        for (ChatEntry entry : result.history) {
            historyArray.add(chatEntryToJson(entry));
        }

        sendMessage(session, response.toString());
    }

    private void handleJoin(Session session, JsonNode msg) {
        String roomCode = msg.has("roomCode") ? msg.get("roomCode").asText() : "";
        String nickname = msg.has("nickname") ? msg.get("nickname").asText() : "";

        if (roomCode.isBlank() || nickname.isBlank()) {
            sendError(session, "roomCode and nickname are required");
            return;
        }

        JoinResult result = roomService.joinRoom(roomCode, nickname);
        if (!result.success) {
            sendError(session, result.errorMessage);
            return;
        }

        registerSession(session, roomCode, result.user.sessionToken);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "joined");
        response.put("roomCode", roomCode);
        response.put("nickname", nickname);
        response.put("sessionToken", result.user.sessionToken);
        response.put("isAdmin", result.isAdmin);
        response.put("deckRemaining", result.deckRemaining);
        response.put("poolValue", result.poolValue);

        ArrayNode usersArray = response.putArray("users");
        for (String u : result.users) {
            usersArray.add(u);
        }

        ArrayNode historyArray = response.putArray("history");
        for (ChatEntry entry : result.history) {
            historyArray.add(chatEntryToJson(entry));
        }

        sendMessage(session, response.toString());

        broadcastToRoom(roomCode, createUserJoinedMsg(nickname), session);

        broadcastUserList(roomCode);
    }

    private void handleReconnect(Session session, JsonNode msg) {
        String roomCode = msg.has("roomCode") ? msg.get("roomCode").asText() : "";
        String nickname = msg.has("nickname") ? msg.get("nickname").asText() : "";
        String sessionToken = msg.has("sessionToken") ? msg.get("sessionToken").asText() : "";

        if (roomCode.isBlank() || nickname.isBlank() || sessionToken.isBlank()) {
            sendError(session, "roomCode, nickname, and sessionToken are required");
            return;
        }

        ReconnectResult result = roomService.reconnectToRoom(roomCode, nickname, sessionToken);
        if (!result.success) {
            sendError(session, result.errorMessage);
            return;
        }

        registerSession(session, roomCode, sessionToken);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "joined");
        response.put("roomCode", roomCode);
        response.put("nickname", nickname);
        response.put("sessionToken", sessionToken);
        response.put("isAdmin", result.isAdmin);
        response.put("deckRemaining", result.deckRemaining);
        response.put("poolValue", result.poolValue);

        ArrayNode usersArray = response.putArray("users");
        for (String u : result.users) {
            usersArray.add(u);
        }

        ArrayNode historyArray = response.putArray("history");
        for (ChatEntry entry : result.history) {
            historyArray.add(chatEntryToJson(entry));
        }

        sendMessage(session, response.toString());

        broadcastToRoom(roomCode, createUserJoinedMsg(nickname), session);
        broadcastUserList(roomCode);
    }

    private void handleRollDice(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        int count = msg.has("count") ? msg.get("count").asInt(2) : 2;
        int modifier = msg.has("modifier") ? msg.get("modifier").asInt(0) : 0;

        DiceRollResult result = roomService.performDiceRoll(user, count, modifier);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "dice_roll");
        response.put("nickname", result.nickname);
        response.put("timestamp", result.timestamp);
        response.set("result", objectMapper.valueToTree(result.result));

        broadcastToRoom(getRoomCode(session), response.toString(), null);
    }

    private void handleDrawCard(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        CardDrawResult result = roomService.performCardDraw(user);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "card_draw");
        response.put("nickname", result.nickname);
        response.put("remaining", result.remaining);
        response.put("reshuffledNext", result.reshuffledNext);
        response.put("timestamp", result.timestamp);
        response.set("card", objectMapper.valueToTree(result.card));

        broadcastToRoom(getRoomCode(session), response.toString(), null);
    }

    private void handleSendMessage(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        String text = msg.has("text") ? msg.get("text").asText() : "";
        if (text.isBlank()) return;

        TextMessageResult result = roomService.sendTextMessage(user, text);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "text_message");
        response.put("nickname", result.nickname);
        response.put("text", result.text);
        response.put("timestamp", result.timestamp);

        broadcastToRoom(getRoomCode(session), response.toString(), null);
    }

    private void handlePoolDelta(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        int delta = msg.has("delta") ? msg.get("delta").asInt(0) : 0;
        if (delta == 0) return;

        RoomService.PoolResult result = roomService.poolDelta(user, delta);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "pool_updated");
        response.put("value", result.value);
        response.put("delta", result.delta);
        response.put("byNickname", result.byNickname);
        response.put("timestamp", result.timestamp);

        broadcastToRoom(getRoomCode(session), response.toString(), null);
    }

    private void handlePoolSet(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        if (!user.nickname.equals(user.room.adminNickname)) {
            sendError(session, "Only the admin can set the pool value");
            return;
        }

        int value = msg.has("value") ? msg.get("value").asInt(-1) : -1;
        if (value < 0) return;

        RoomService.PoolResult result = roomService.poolSet(user, value);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "pool_updated");
        response.put("value", result.value);
        response.put("delta", result.delta);
        response.put("byNickname", result.byNickname);
        response.put("timestamp", result.timestamp);

        broadcastToRoom(getRoomCode(session), response.toString(), null);
    }

    private void handleReshuffleDeck(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        if (!user.nickname.equals(user.room.adminNickname)) {
            sendError(session, "Only the admin can reshuffle the deck");
            return;
        }

        ReshuffleResult result = roomService.reshuffleDeck(user);
        if (result == null) return;

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "deck_reshuffled");
        response.put("byNickname", result.byNickname);
        response.put("remaining", result.remaining);
        response.put("timestamp", result.timestamp);

        broadcastToRoom(getRoomCode(session), response.toString(), null);
    }

    private void handleKickUser(Session session, JsonNode msg) {
        RoomUser user = validateSession(session);
        if (user == null) return;

        String targetNickname = msg.has("targetNickname") ? msg.get("targetNickname").asText() : "";
        if (targetNickname.isBlank()) return;

        boolean kicked = roomService.kickUser(user, targetNickname);
        if (!kicked) {
            sendError(session, "Cannot kick user");
            return;
        }

        String roomCode = getRoomCode(session);

        ObjectNode response = objectMapper.createObjectNode();
        response.put("type", "user_kicked");
        response.put("nickname", targetNickname);
        response.put("byNickname", user.nickname);

        broadcastToRoom(roomCode, response.toString(), null);

        Set<Session> sessions = roomSessions.get(roomCode);
        if (sessions != null) {
            for (Session s : sessions) {
                String sToken = sessionIdToToken.get(s.getId());
                if (sToken != null) {
                    try {
                        RoomUser targetUser = roomService.findUserBySessionToken(sToken).orElse(null);
                        if (targetUser != null && targetUser.nickname.equals(targetNickname)) {
                            ObjectNode kickMsg = objectMapper.createObjectNode();
                            kickMsg.put("type", "you_kicked");
                            kickMsg.put("byNickname", user.nickname);
                            sendMessage(s, kickMsg.toString());
                            s.close();
                        }
                    } catch (Exception e) {
                    }
                }
            }
        }

        broadcastUserList(roomCode);
    }

    private void handleDisconnect(Session session) {
        String roomCode = sessionIdToRoomCode.remove(session.getId());
        String sessionToken = sessionIdToToken.remove(session.getId());

        if (sessionToken != null) {
            roomService.markDisconnected(sessionToken);
        }

        if (roomCode != null) {
            Set<Session> sessions = roomSessions.get(roomCode);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    roomSessions.remove(roomCode);
                }
            }

            if (sessionToken != null) {
                try {
                    RoomUser user = roomService.findUserBySessionToken(sessionToken).orElse(null);
                    if (user != null) {
                        broadcastToRoom(roomCode, createUserLeftMsg(user.nickname, "disconnect"), null);

                        roomService.transferAdminIfNeeded(user.room);

                        broadcastUserList(roomCode);
                    }
                } catch (Exception e) {
                }
            }
        }
    }

    private RoomUser validateSession(Session session) {
        String sessionToken = sessionIdToToken.get(session.getId());
        if (sessionToken == null) {
            sendError(session, "Not authenticated. Send join first.");
            return null;
        }
        return roomService.findUserBySessionToken(sessionToken).orElse(null);
    }

    private void registerSession(Session session, String roomCode, String sessionToken) {
        sessionIdToRoomCode.put(session.getId(), roomCode);
        sessionIdToToken.put(session.getId(), sessionToken);
        roomSessions.computeIfAbsent(roomCode, k -> new CopyOnWriteArraySet<>()).add(session);
    }

    private String getRoomCode(Session session) {
        return sessionIdToRoomCode.get(session.getId());
    }

    private void broadcastToRoom(String roomCode, String message, Session exclude) {
        Set<Session> sessions = roomSessions.get(roomCode);
        if (sessions == null) return;
        for (Session s : sessions) {
            if (exclude != null && s.getId().equals(exclude.getId())) continue;
            sendMessage(s, message);
        }
    }

    private void broadcastUserList(String roomCode) {
        Room room = roomService.findRoomByCode(roomCode);
        if (room == null) return;

        List<String> users = roomService.getConnectedNicknames(room);

        ObjectNode msg = objectMapper.createObjectNode();
        msg.put("type", "user_list");
        ArrayNode usersArray = msg.putArray("users");
        for (String u : users) {
            usersArray.add(u);
        }

        broadcastToRoom(roomCode, msg.toString(), null);

        roomService.transferAdminIfNeeded(room);

        List<String> updatedUsers = roomService.getConnectedNicknames(room);
        String admin = room.adminNickname;
        for (String user : updatedUsers) {
            if (!users.contains(user)) continue;
            if (admin != null && !admin.equals(room.adminNickname)) {
                ObjectNode adminMsg = objectMapper.createObjectNode();
                adminMsg.put("type", "admin_changed");
                adminMsg.put("newAdminNickname", admin);
                broadcastToRoom(roomCode, adminMsg.toString(), null);
            }
        }
    }

    private void sendError(Session session, String errorMessage) {
        try {
            ObjectNode msg = objectMapper.createObjectNode();
            msg.put("type", "error");
            msg.put("message", errorMessage);
            sendMessage(session, msg.toString());
        } catch (Exception e) {
        }
    }

    private void sendMessage(Session session, String message) {
        if (session.isOpen()) {
            try {
                session.getBasicRemote().sendText(message);
            } catch (IOException e) {
            }
        }
    }

    private String createUserJoinedMsg(String nickname) {
        try {
            ObjectNode msg = objectMapper.createObjectNode();
            msg.put("type", "user_joined");
            msg.put("nickname", nickname);
            return msg.toString();
        } catch (Exception e) {
            return "{\"type\":\"user_joined\",\"nickname\":\"" + nickname + "\"}";
        }
    }

    private String createUserLeftMsg(String nickname, String reason) {
        try {
            ObjectNode msg = objectMapper.createObjectNode();
            msg.put("type", "user_left");
            msg.put("nickname", nickname);
            msg.put("reason", reason);
            return msg.toString();
        } catch (Exception e) {
            return "{\"type\":\"user_left\",\"nickname\":\"" + nickname + "\"}";
        }
    }

    private ObjectNode chatEntryToJson(ChatEntry entry) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("type", switch (entry.type.toString()) {
            case "DICE_ROLL" -> "dice_roll";
            case "CARD_DRAW" -> "card_draw";
            case "TEXT_MESSAGE" -> "text_message";
            case "SYSTEM" -> "system";
            default -> "unknown";
        });
        node.put("nickname", entry.nickname);
        node.put("timestamp", entry.timestamp.toString());

        if (entry.type == ChatEntry.EntryType.TEXT_MESSAGE) {
            node.put("text", entry.content);
        } else {
            try {
                node.set("data", objectMapper.readTree(entry.content));
            } catch (Exception e) {
                node.put("data", entry.content);
            }
        }

        return node;
    }
}
