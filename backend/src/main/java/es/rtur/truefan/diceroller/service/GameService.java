package es.rtur.truefan.diceroller.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.jboss.logging.Logger;

@ApplicationScoped
public class GameService {

    private static final Logger LOG = Logger.getLogger(GameService.class);

    private static final int DICE_MIN = 1;
    private static final int DICE_MAX = 20;
    private static final int MOD_MIN = -99;
    private static final int MOD_MAX = 99;
    private static final int DECK_SIZE = 50;

    private static final String[][] SUITS = {
        {"oros", "Oros", "◎"},
        {"copas", "Copas", "◠"},
        {"espadas", "Espadas", "✦"},
        {"bastos", "Bastos", "✣"}
    };

    private static final TypeReference<List<CardInfo>> CARD_LIST = new TypeReference<>() {};

    private final SecureRandom secureRandom = new SecureRandom();
    private final ObjectMapper objectMapper;

    @Inject
    public GameService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @RegisterForReflection
    public record DiceResult(
            int count,
            int initialCount,
            List<Integer> values,
            int diceTotal,
            int modifier,
            int total,
            int explosions) {
    }

    @RegisterForReflection
    public record CardInfo(
            String kind,
            String suit,
            String suitName,
            int rank,
            String label,
            String glyph,
            String shortName) {
    }

    @RegisterForReflection
    public record DrawResult(
            CardInfo card,
            int remaining,
            boolean autoReshuffled,
            String reshuffleReason) {
    }

    public DiceResult rollDice(int count, int modifier) {
        int safeCount = Math.clamp(count, DICE_MIN, DICE_MAX);
        int safeModifier = Math.clamp(modifier, MOD_MIN, MOD_MAX);

        List<Integer> initial = new ArrayList<>(safeCount);
        for (int i = 0; i < safeCount; i++) {
            initial.add(rollDie());
        }

        List<Integer> allValues = new ArrayList<>(initial);
        int explosionCount = 0;
        int i = 0;
        while (i < allValues.size()) {
            if (allValues.get(i) == 6) {
                allValues.add(rollDie());
                explosionCount++;
            }
            i++;
        }

        int diceTotal = allValues.stream().mapToInt(Integer::intValue).sum();
        return new DiceResult(
                allValues.size(),
                initial.size(),
                List.copyOf(allValues),
                diceTotal,
                safeModifier,
                diceTotal + safeModifier,
                explosionCount);
    }

    private int rollDie() {
        return secureRandom.nextInt(6) + 1;
    }

    public List<CardInfo> buildSpanishDeck() {
        List<CardInfo> deck = new ArrayList<>(DECK_SIZE);
        for (String[] suit : SUITS) {
            for (int rank = 1; rank <= 12; rank++) {
                deck.add(new CardInfo(
                        "card",
                        suit[0],
                        suit[1],
                        rank,
                        rank + " de " + suit[1],
                        suit[2],
                        suit[0].substring(0, 2).toUpperCase()));
            }
        }

        deck.add(new CardInfo("joker", null, null, 0, "Comodín Rojo", "★", "Jk"));
        deck.add(new CardInfo("joker", null, null, 0, "Comodín Negro", "✶", "Jk"));

        shuffleDeck(deck);
        return deck;
    }

    public void shuffleDeck(List<CardInfo> deck) {
        Collections.shuffle(deck, secureRandom);
    }

    /**
     * Draws the top card. The deck is automatically rebuilt and shuffled when a
     * joker shows up or when the last card of the deck is drawn, so the next
     * draw always starts from a fresh 50-card deck.
     *
     * <p>The deck list is mutated in place: callers persist the same list after
     * the call.</p>
     */
    public DrawResult drawCard(List<CardInfo> deck) {
        if (deck.isEmpty()) {
            // Safety net for rooms persisted with an already exhausted deck.
            deck.addAll(buildSpanishDeck());
        }

        CardInfo drawn = deck.removeLast();
        boolean byJoker = "joker".equals(drawn.kind());
        boolean deckEmpty = deck.isEmpty();
        boolean autoReshuffle = byJoker || deckEmpty;

        if (autoReshuffle) {
            deck.clear();
            deck.addAll(buildSpanishDeck());
        }

        return new DrawResult(
                drawn,
                deck.size(),
                autoReshuffle,
                byJoker ? "joker" : deckEmpty ? "empty" : null);
    }

    public String deckToJson(List<CardInfo> deck) {
        try {
            return objectMapper.writeValueAsString(deck);
        } catch (JsonProcessingException e) {
            LOG.error("No se pudo serializar la baraja", e);
            return "[]";
        }
    }

    public List<CardInfo> jsonToDeck(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, CARD_LIST);
        } catch (JsonProcessingException e) {
            LOG.error("No se pudo deserializar la baraja persistida", e);
            return new ArrayList<>();
        }
    }
}
