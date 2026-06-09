package es.rtur.truefan.diceroller.service;

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
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class RoomService {

    private static final int ROOM_CODE_LENGTH = 7;
    private static final int MAX_USERS_PER_ROOM = 20;
    private static final int RECONNECT_TIMEOUT_MINUTES = 15;
    private static final int HISTORY_LIMIT = 50;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecureRandom secureRandom = new SecureRandom();

    @Inject
    EntityManager entityManager;

    @Inject
    GameService gameService;

    @Transactional
    public Room createRoom(String adminNickname) {
        String code = generateUniqueCode();

        Room room = new Room();
        room.code = code;
        room.createdAt = Instant.now();
        room.adminNickname = adminNickname;

        List<CardInfo> deck = gameService.buildSpanishDeck();
        room.deckState = gameService.deckToJson(deck);

        entityManager.persist(room);

        RoomUser user = new RoomUser();
        user.room = room;
        user.nickname = adminNickname;
        user.joinedAt = Instant.now();
        user.lastSeenAt = Instant.now();
        user.connected = true;
        user.sessionToken = UUID.randomUUID().toString();
        entityManager.persist(user);

        return room;
    }

    @Transactional
    public JoinResult createAndJoinRoom(String nickname) {
        Room room = createRoom(nickname);
        RoomUser user = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND nickname = :nickname", RoomUser.class)
            .setParameter("room", room)
            .setParameter("nickname", nickname)
            .getResultStream().findFirst().orElse(null);

        List<ChatEntry> history = getRecentHistory(room);
        List<String> users = getConnectedNicknames(room);
        List<CardInfo> deck = gameService.jsonToDeck(room.deckState);

        JoinResult result = new JoinResult();
        result.success = true;
        result.room = room;
        result.user = user;
        result.isAdmin = true;
        result.history = history;
        result.users = users;
        result.deckRemaining = deck.size();
        return result;
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
        user.sessionToken = UUID.randomUUID().toString();
        entityManager.persist(user);

        List<ChatEntry> history = getRecentHistory(room);
        List<String> users = getConnectedNicknames(room);
        String deckState = room.deckState;
        List<CardInfo> deck = gameService.jsonToDeck(deckState);

        JoinResult result = new JoinResult();
        result.success = true;
        result.room = room;
        result.user = user;
        result.isAdmin = nickname.equals(room.adminNickname);
        result.history = history;
        result.users = users;
        result.deckRemaining = deck.size();
        return result;
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
        String deckState = room.deckState;
        List<CardInfo> deck = gameService.jsonToDeck(deckState);

        ReconnectResult result = new ReconnectResult();
        result.success = true;
        result.room = room;
        result.user = user;
        result.isAdmin = nickname.equals(room.adminNickname);
        result.history = history;
        result.users = users;
        result.deckRemaining = deck.size();
        return result;
    }

    @Transactional
    public void markDisconnected(String sessionToken) {
        Optional<RoomUser> userOpt = findUserBySessionToken(sessionToken);
        userOpt.ifPresent(user -> {
            user.connected = false;
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

    @Transactional
    public DiceRollResult performDiceRoll(RoomUser user, int count, int modifier) {
        DiceResult diceResult = gameService.rollDice(count, modifier);

        String content;
        try {
            content = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(diceResult);
        } catch (Exception e) {
            content = "{}";
        }

        ChatEntry entry = new ChatEntry();
        entry.room = user.room;
        entry.type = EntryType.DICE_ROLL;
        entry.nickname = user.nickname;
        entry.content = content;
        entry.timestamp = Instant.now();
        entityManager.persist(entry);

        DiceRollResult result = new DiceRollResult();
        result.nickname = user.nickname;
        result.result = diceResult;
        result.timestamp = entry.timestamp.toString();
        return result;
    }

    @Transactional
    public CardDrawResult performCardDraw(RoomUser user) {
        Room room = user.room;
        List<CardInfo> deck = gameService.jsonToDeck(room.deckState);
        DrawResult drawResult = gameService.drawCard(deck);
        room.deckState = gameService.deckToJson(deck);
        entityManager.merge(room);

        String content;
        try {
            content = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(drawResult);
        } catch (Exception e) {
            content = "{}";
        }

        ChatEntry entry = new ChatEntry();
        entry.room = room;
        entry.type = EntryType.CARD_DRAW;
        entry.nickname = user.nickname;
        entry.content = content;
        entry.timestamp = Instant.now();
        entityManager.persist(entry);

        CardDrawResult result = new CardDrawResult();
        result.nickname = user.nickname;
        result.card = drawResult.card;
        result.remaining = drawResult.remaining;
        result.reshuffledNext = drawResult.reshuffledNext;
        result.timestamp = entry.timestamp.toString();
        return result;
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

        TextMessageResult result = new TextMessageResult();
        result.nickname = user.nickname;
        result.text = text;
        result.timestamp = entry.timestamp.toString();
        return result;
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

        String content = "{\"action\":\"reshuffle\",\"by\":\"" + user.nickname + "\"}";
        ChatEntry entry = new ChatEntry();
        entry.room = room;
        entry.type = EntryType.SYSTEM;
        entry.nickname = user.nickname;
        entry.content = content;
        entry.timestamp = Instant.now();
        entityManager.persist(entry);

        ReshuffleResult result = new ReshuffleResult();
        result.byNickname = user.nickname;
        result.remaining = 50;
        result.timestamp = entry.timestamp.toString();
        return result;
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

        List<RoomUser> connectedUsers = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND connected = true ORDER BY joinedAt ASC", RoomUser.class)
            .setParameter("room", room)
            .getResultList();

        if (!connectedUsers.isEmpty()) {
            String newAdmin = connectedUsers.get(0).nickname;
            room.adminNickname = newAdmin;
            entityManager.merge(room);
            return Optional.of(newAdmin);
        }

        return Optional.empty();
    }

    public Room findRoomByCode(String code) {
        List<Room> results = entityManager
            .createQuery("FROM Room WHERE code = :code", Room.class)
            .setParameter("code", code.toUpperCase())
            .getResultList();
        return results.isEmpty() ? null : results.get(0);
    }

    public Optional<RoomUser> findUserBySessionToken(String sessionToken) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE sessionToken = :token", RoomUser.class)
            .setParameter("token", sessionToken)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public Optional<RoomUser> findUserByToken(Room room, String sessionToken) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND sessionToken = :token", RoomUser.class)
            .setParameter("room", room)
            .setParameter("token", sessionToken)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    public Optional<RoomUser> findConnectedUserByNickname(Room room, String nickname) {
        List<RoomUser> results = entityManager
            .createQuery("FROM RoomUser WHERE room = :room AND nickname = :nickname AND connected = true", RoomUser.class)
            .setParameter("room", room)
            .setParameter("nickname", nickname)
            .getResultList();
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
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

    private String generateUniqueCode() {
        StringBuilder code;
        int attempts = 0;
        do {
            code = new StringBuilder();
            for (int i = 0; i < ROOM_CODE_LENGTH; i++) {
                code.append(CODE_CHARS.charAt(secureRandom.nextInt(CODE_CHARS.length())));
            }
            attempts++;
            if (attempts > 100) {
                throw new RuntimeException("Unable to generate unique room code");
            }
        } while (findRoomByCode(code.toString()) != null);
        return code.toString();
    }

    public static class JoinResult {
        public boolean success;
        public String errorMessage;
        public Room room;
        public RoomUser user;
        public boolean isAdmin;
        public List<ChatEntry> history;
        public List<String> users;
        public int deckRemaining;

        static JoinResult error(String msg) {
            JoinResult r = new JoinResult();
            r.success = false;
            r.errorMessage = msg;
            return r;
        }
    }

    public static class ReconnectResult {
        public boolean success;
        public String errorMessage;
        public Room room;
        public RoomUser user;
        public boolean isAdmin;
        public List<ChatEntry> history;
        public List<String> users;
        public int deckRemaining;

        static ReconnectResult error(String msg) {
            ReconnectResult r = new ReconnectResult();
            r.success = false;
            r.errorMessage = msg;
            return r;
        }
    }

    public static class DiceRollResult {
        public String nickname;
        public DiceResult result;
        public String timestamp;
    }

    public static class CardDrawResult {
        public String nickname;
        public CardInfo card;
        public int remaining;
        public boolean reshuffledNext;
        public String timestamp;
    }

    public static class TextMessageResult {
        public String nickname;
        public String text;
        public String timestamp;
    }

    public static class ReshuffleResult {
        public String byNickname;
        public int remaining;
        public String timestamp;
    }
}
