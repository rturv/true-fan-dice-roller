package es.rtur.truefan.diceroller.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.rtur.truefan.diceroller.entity.ChatEntry;
import es.rtur.truefan.diceroller.entity.ChatEntry.EntryType;
import es.rtur.truefan.diceroller.entity.Room;
import es.rtur.truefan.diceroller.entity.RoomUser;
import es.rtur.truefan.diceroller.service.GameService.CardInfo;
import es.rtur.truefan.diceroller.service.GameService.DiceResult;
import es.rtur.truefan.diceroller.service.GameService.DrawResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.jboss.logging.Logger;

@ApplicationScoped
public class RoomService {

    private static final Logger LOG = Logger.getLogger(RoomService.class);

    private static final int ROOM_CODE_LENGTH = 7;
    private static final int MAX_USERS_PER_ROOM = 20;
    private static final int RECONNECT_TIMEOUT_MINUTES = 15;
    private static final int HISTORY_LIMIT = 50;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecureRandom secureRandom = new SecureRandom();
    private final EntityManager entityManager;
    private final GameService gameService;
    private final ObjectMapper objectMapper;
    private final JwtService jwtService;

    @Inject
    public RoomService(
            EntityManager entityManager,
            GameService gameService,
            ObjectMapper objectMapper,
            JwtService jwtService) {
        this.entityManager = entityManager;
        this.gameService = gameService;
        this.objectMapper = objectMapper;
        this.jwtService = jwtService;
    }

    @Transactional
    public Room createRoom(String adminNickname) {
        String code = generateUniqueCode();

        Room room = new Room();
        room.code = code;
        room.createdAt = Instant.now();
        room.adminNickname = adminNickname;
        room.cardsEnabled = false;

        List<CardInfo> deck = gameService.buildSpanishDeck();
        room.deckState = gameService.deckToJson(deck);

        entityManager.persist(room);

        RoomUser user = new RoomUser();
        user.room = room;
        user.nickname = adminNickname;
        user.joinedAt = Instant.now();
        user.lastSeenAt = Instant.now();
        user.connected = true;
        user.sessionToken = jwtService.generateToken(adminNickname, room.code, true);
        entityManager.persist(user);

        return room;
    }

    @Transactional
    public JoinResult createAndJoinRoom(String nickname) {
        Room room = createRoom(nickname);
        RoomUser user = findUserByNickname(room, nickname).orElse(null);

        List<ChatEntry> history = getRecentHistory(room);
        List<String> users = getConnectedNicknames(room);
        List<CardInfo> deck = gameService.jsonToDeck(room.deckState);

        return new JoinResult(
                true,
                null,
                room,
                user,
                true,
                history,
                users,
                deck.size(),
                room.poolValue,
                room.cardsEnabled);
    }

    @Transactional
    public JoinResult joinRoom(String roomCode, String nickname) {
        Room room = findRoomByCode(roomCode);
        if (room == null) {
            return JoinResult.error("Room not found");
        }

        long connectedCount = countConnectedUsers(room);
        if (connectedCount >= MAX_USERS_PER_ROOM) {
            return JoinResult.error("Room is full (max " + MAX_USERS_PER_ROOM + " users)");
        }

        if (isNicknameTaken(room, nickname)) {
            return JoinResult.error("Nickname already taken in this room");
        }

        RoomUser user = new RoomUser();
        user.room = room;
        user.nickname = nickname;
        user.joinedAt = Instant.now();
        user.lastSeenAt = Instant.now();
        user.connected = true;
        user.sessionToken = jwtService.generateToken(nickname, roomCode, false);
        entityManager.persist(user);

        List<ChatEntry> history = getRecentHistory(room);
        List<String> users = getConnectedNicknames(room);
        List<CardInfo> deck = gameService.jsonToDeck(room.deckState);

        return new JoinResult(
                true,
                null,
                room,
                user,
                nickname.equals(room.adminNickname),
                history,
                users,
                deck.size(),
                room.poolValue,
                room.cardsEnabled);
    }

    @Transactional
    public ReconnectResult reconnectToRoom(String roomCode, String nickname, String sessionToken) {
        Room room = findRoomByCode(roomCode);
        if (room == null) {
            return ReconnectResult.error("Room not found");
        }

        Optional<RoomUser> existing = findUserByToken(room, sessionToken);
        if (existing.isEmpty()) {
            return ReconnectResult.error("Invalid session token");
        }

        RoomUser user = existing.get();
        if (!user.nickname.equals(nickname)) {
            return ReconnectResult.error("Nickname does not match session");
        }

        user.connected = true;
        user.lastSeenAt = Instant.now();
        entityManager.merge(user);

        List<ChatEntry> history = getRecentHistory(room);
        List<String> users = getConnectedNicknames(room);
        List<CardInfo> deck = gameService.jsonToDeck(room.deckState);

        return new ReconnectResult(
                true,
                null,
                room,
                user,
                nickname.equals(room.adminNickname),
                history,
                users,
                deck.size(),
                room.poolValue,
                room.cardsEnabled);
    }

    @Transactional
    public void markDisconnected(String sessionToken) {
        Optional<RoomUser> userOpt = findUserBySessionToken(sessionToken);
        userOpt.ifPresent(user -> {
            user.connected = false;
            // Start the reconnect grace period from the moment of disconnection.
            user.lastSeenAt = Instant.now();
            entityManager.merge(user);
        });
    }

    @Transactional
    public void expireStaleSessions() {
        Instant cutoff = Instant.now().minusSeconds(RECONNECT_TIMEOUT_MINUTES * 60);
        List<RoomUser> staleUsers = entityManager
            .createQuery("FROM RoomUser WHERE connected = false AND lastSeenAt < :cutoff", RoomUser.class)
            .setParameter("cutoff", cutoff)
            .getResultList();

        for (RoomUser user : staleUsers) {
            entityManager.remove(user);
        }
    }

    /**
     * Borra las salas sin usuarios conectados cuya última actividad (último
     * {@code lastSeenAt}, último mensaje o fecha de creación) sea anterior al
     * umbral indicado. Borra primero chat_entries y room_users para respetar
     * las claves foráneas.
     *
     * @return número de salas eliminadas
     */
    @Transactional
    public int deleteInactiveRooms(long inactivityHours) {
        Instant cutoff = Instant.now().minus(inactivityHours, ChronoUnit.HOURS);

        List<Room> candidates = entityManager
            .createQuery(
                "SELECT r FROM Room r WHERE NOT EXISTS ("
                    + "SELECT u.id FROM RoomUser u WHERE u.room = r AND u.connected = true)",
                Room.class)
            .getResultList();

        int deleted = 0;
        for (Room room : candidates) {
            if (getLastActivity(room).isAfter(cutoff)) {
                continue;
            }

            entityManager.createQuery("DELETE FROM ChatEntry c WHERE c.room = :room")
                .setParameter("room", room)
                .executeUpdate();
            entityManager.createQuery("DELETE FROM RoomUser u WHERE u.room = :room")
                .setParameter("room", room)
                .executeUpdate();
            entityManager.remove(room);
            deleted++;
        }
        return deleted;
    }

    private Instant getLastActivity(Room room) {
        Instant lastSeen = entityManager
            .createQuery("SELECT MAX(u.lastSeenAt) FROM RoomUser u WHERE u.room = :room", Instant.class)
            .setParameter("room", room)
            .getSingleResult();

        Instant lastEntry = entityManager
            .createQuery("SELECT MAX(c.timestamp) FROM ChatEntry c WHERE c.room = :room", Instant.class)
            .setParameter("room", room)
            .getSingleResult();

        Instant lastActivity = room.createdAt;
        if (lastSeen != null && lastSeen.isAfter(lastActivity)) {
            lastActivity = lastSeen;
        }
        if (lastEntry != null && lastEntry.isAfter(lastActivity)) {
            lastActivity = lastEntry;
        }
        return lastActivity;
    }

    @Transactional
    public DiceRollResult performDiceRoll(RoomUser user, int count, int modifier) {
        DiceResult diceResult = gameService.rollDice(count, modifier);
        String content = toJson(diceResult, "{}");

        ChatEntry entry = new ChatEntry();
        entry.room = user.room;
        entry.type = EntryType.DICE_ROLL;
        entry.nickname = user.nickname;
        entry.content = content;
        entry.timestamp = Instant.now();
        entityManager.persist(entry);

        return new DiceRollResult(user.nickname, diceResult, entry.timestamp.toString());
    }

    @Transactional
    public CardDrawResult performCardDraw(RoomUser user) {
        Room room = user.room;
        List<CardInfo> deck = gameService.jsonToDeck(room.deckState);
        DrawResult drawResult = gameService.drawCard(deck);
        room.deckState = gameService.deckToJson(deck);
        entityManager.merge(room);

        String content = toJson(drawResult, "{}");

        ChatEntry entry = new ChatEntry();
        entry.room = room;
        entry.type = EntryType.CARD_DRAW;
        entry.nickname = user.nickname;
        entry.content = content;
        entry.timestamp = Instant.now();
        entityManager.persist(entry);

        return new CardDrawResult(
                user.nickname,
                drawResult.card(),
                drawResult.remaining(),
                drawResult.autoReshuffled(),
                drawResult.reshuffleReason(),
                entry.timestamp.toString());
    }

    @Transactional
    public TextMessageResult sendTextMessage(RoomUser user, String text) {
        ChatEntry entry = new ChatEntry();
        entry.room = user.room;
        entry.type = EntryType.TEXT_MESSAGE;
        entry.nickname = user.nickname;
        entry.content = text;
        entry.timestamp = Instant.now();
        entityManager.persist(entry);

        return new TextMessageResult(user.nickname, text, entry.timestamp.toString());
    }

    @Transactional
    public PoolResult poolDelta(RoomUser user, int delta) {
        Room room = user.room;
        int newValue = Math.max(0, room.poolValue + delta);
        room.poolValue = newValue;
        entityManager.merge(room);

        ObjectNode content = objectMapper.createObjectNode();
        content.put("action", "pool_delta");
        content.put("value", newValue);
        content.put("delta", delta);
        ChatEntry entry = persistSystemEntry(user, content);

        return new PoolResult(newValue, delta, user.nickname, entry.timestamp.toString());
    }

    @Transactional
    public PoolResult poolSet(RoomUser user, int value) {
        Room room = user.room;
        int clamped = Math.max(0, value);
        int delta = clamped - room.poolValue;
        room.poolValue = clamped;
        entityManager.merge(room);

        ObjectNode content = objectMapper.createObjectNode();
        content.put("action", "pool_set");
        content.put("value", clamped);
        content.put("delta", delta);
        ChatEntry entry = persistSystemEntry(user, content);

        return new PoolResult(clamped, delta, user.nickname, entry.timestamp.toString());
    }

    @Transactional
    public ReshuffleResult reshuffleDeck(RoomUser user) {
        if (!user.nickname.equals(user.room.adminNickname)) {
            return null;
        }

        Room room = user.room;
        List<CardInfo> deck = gameService.buildSpanishDeck();
        room.deckState = gameService.deckToJson(deck);
        entityManager.merge(room);

        ObjectNode content = objectMapper.createObjectNode();
        content.put("action", "reshuffle");
        content.put("by", user.nickname);
        ChatEntry entry = persistSystemEntry(user, content);

        return new ReshuffleResult(user.nickname, deck.size(), entry.timestamp.toString());
    }

    @Transactional
    public ToggleCardsResult toggleCards(RoomUser user) {
        if (!user.nickname.equals(user.room.adminNickname)) {
            return null;
        }
        Room room = user.room;
        room.cardsEnabled = !room.cardsEnabled;
        entityManager.merge(room);

        ObjectNode content = objectMapper.createObjectNode();
        content.put("action", "toggle_cards");
        content.put("enabled", room.cardsEnabled);
        ChatEntry entry = persistSystemEntry(user, content);

        return new ToggleCardsResult(room.cardsEnabled, user.nickname, entry.timestamp.toString());
    }

    @Transactional
    public void updateSessionToken(RoomUser user, String newToken) {
        user.sessionToken = newToken;
        entityManager.merge(user);
    }

    @Transactional
    public boolean kickUser(RoomUser admin, String targetNickname) {
        if (!admin.nickname.equals(admin.room.adminNickname)) {
            return false;
        }
        if (targetNickname.equals(admin.nickname)) {
            return false;
        }

        Optional<RoomUser> target = findConnectedUserByNickname(admin.room, targetNickname);
        if (target.isEmpty()) {
            return false;
        }

        entityManager.remove(target.get());
        return true;
    }

    @Transactional
    public Optional<String> transferAdminIfNeeded(Room room) {
        if (isUserConnected(room, room.adminNickname)) {
            return Optional.empty();
        }

        // Keep the current admin during the reconnect grace period. This avoids
        // losing admin on a transient disconnect such as an F5 refresh.
        RoomUser currentAdmin = findUserByNickname(room, room.adminNickname).orElse(null);
        if (currentAdmin != null
                && currentAdmin.lastSeenAt != null
                && currentAdmin.lastSeenAt.isAfter(
                        Instant.now().minusSeconds(RECONNECT_TIMEOUT_MINUTES * 60L))) {
            return Optional.empty();
        }

        List<RoomUser> connectedUsers = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND connected = true ORDER BY joinedAt ASC", RoomUser.class)
            .setParameter("room", room)
            .getResultList();

        if (!connectedUsers.isEmpty()) {
            String newAdmin = connectedUsers.getFirst().nickname;
            room.adminNickname = newAdmin;
            entityManager.merge(room);
            return Optional.of(newAdmin);
        }

        return Optional.empty();
    }

    public Room findRoomByCode(String code) {
        List<Room> results = entityManager
            .createQuery("FROM Room WHERE code = :code", Room.class)
            .setParameter("code", code.toUpperCase(Locale.ROOT))
            .setMaxResults(1)
            .getResultList();
        return results.isEmpty() ? null : results.getFirst();
    }

    public Optional<RoomUser> findUserBySessionToken(String sessionToken) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE sessionToken = :token", RoomUser.class)
            .setParameter("token", sessionToken)
            .setMaxResults(1)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.getFirst());
    }

    public Optional<RoomUser> findUserByToken(Room room, String sessionToken) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND sessionToken = :token", RoomUser.class)
            .setParameter("room", room)
            .setParameter("token", sessionToken)
            .setMaxResults(1)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.getFirst());
    }

    public Optional<RoomUser> findUserByNickname(Room room, String nickname) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND nickname = :nickname", RoomUser.class)
            .setParameter("room", room)
            .setParameter("nickname", nickname)
            .setMaxResults(1)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.getFirst());
    }

    public Optional<RoomUser> findConnectedUserByNickname(Room room, String nickname) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND nickname = :nickname AND connected = true", RoomUser.class)
            .setParameter("room", room)
            .setParameter("nickname", nickname)
            .setMaxResults(1)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.getFirst());
    }

    public boolean isNicknameTaken(Room room, String nickname) {
        return entityManager
            .createQuery("SELECT COUNT(u) FROM RoomUser u WHERE u.room = :room AND u.nickname = :nickname", Long.class)
            .setParameter("room", room)
            .setParameter("nickname", nickname)
            .getSingleResult() > 0;
    }

    public boolean isUserConnected(Room room, String nickname) {
        return entityManager
            .createQuery("SELECT COUNT(u) FROM RoomUser u WHERE u.room = :room AND u.nickname = :nickname AND u.connected = true", Long.class)
            .setParameter("room", room)
            .setParameter("nickname", nickname)
            .getSingleResult() > 0;
    }

    public long countConnectedUsers(Room room) {
        return entityManager
            .createQuery("SELECT COUNT(u) FROM RoomUser u WHERE u.room = :room AND u.connected = true", Long.class)
            .setParameter("room", room)
            .getSingleResult();
    }

    public List<String> getConnectedNicknames(Room room) {
        return entityManager
            .createQuery("SELECT u.nickname FROM RoomUser u WHERE u.room = :room AND u.connected = true ORDER BY u.joinedAt ASC", String.class)
            .setParameter("room", room)
            .getResultList();
    }

    public List<ChatEntry> getRecentHistory(Room room) {
        return entityManager
            .createQuery("FROM ChatEntry WHERE room = :room ORDER BY timestamp DESC", ChatEntry.class)
            .setParameter("room", room)
            .setMaxResults(HISTORY_LIMIT)
            .getResultList();
    }

    private ChatEntry persistSystemEntry(RoomUser user, ObjectNode content) {
        ChatEntry entry = new ChatEntry();
        entry.room = user.room;
        entry.type = EntryType.SYSTEM;
        entry.nickname = user.nickname;
        entry.content = content.toString();
        entry.timestamp = Instant.now();
        entityManager.persist(entry);
        return entry;
    }

    private String toJson(Object value, String fallback) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            LOG.error("No se pudo serializar el contenido del evento", e);
            return fallback;
        }
    }

    private String generateUniqueCode() {
        StringBuilder code;
        int attempts = 0;
        do {
            code = new StringBuilder(ROOM_CODE_LENGTH);
            for (int i = 0; i < ROOM_CODE_LENGTH; i++) {
                code.append(CODE_CHARS.charAt(secureRandom.nextInt(CODE_CHARS.length())));
            }
            attempts++;
            if (attempts > 100) {
                throw new IllegalStateException("Unable to generate unique room code");
            }
        } while (findRoomByCode(code.toString()) != null);
        return code.toString();
    }

    public record JoinResult(
            boolean success,
            String errorMessage,
            Room room,
            RoomUser user,
            boolean isAdmin,
            List<ChatEntry> history,
            List<String> users,
            int deckRemaining,
            int poolValue,
            boolean cardsEnabled) {

        static JoinResult error(String msg) {
            return new JoinResult(false, msg, null, null, false, List.of(), List.of(), 0, 0, false);
        }
    }

    public record ReconnectResult(
            boolean success,
            String errorMessage,
            Room room,
            RoomUser user,
            boolean isAdmin,
            List<ChatEntry> history,
            List<String> users,
            int deckRemaining,
            int poolValue,
            boolean cardsEnabled) {

        static ReconnectResult error(String msg) {
            return new ReconnectResult(false, msg, null, null, false, List.of(), List.of(), 0, 0, false);
        }
    }

    public record DiceRollResult(String nickname, DiceResult result, String timestamp) {
    }

    public record CardDrawResult(
            String nickname,
            CardInfo card,
            int remaining,
            boolean autoReshuffled,
            String reshuffleReason,
            String timestamp) {
    }

    public record TextMessageResult(String nickname, String text, String timestamp) {
    }

    public record ReshuffleResult(String byNickname, int remaining, String timestamp) {
    }

    public record PoolResult(int value, int delta, String byNickname, String timestamp) {
    }

    public record ToggleCardsResult(boolean enabled, String byNickname, String timestamp) {
    }
}
