package es.rtur.truefan.diceroller.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@ApplicationScoped
public class GameService {

    private static final int DICE_MIN = 1;
    private static final int DICE_MAX = 20;
    private static final int MOD_MIN = -99;
    private static final int MOD_MAX = 99;

    private final SecureRandom secureRandom = new SecureRandom();

    @Inject
    ObjectMapper objectMapper;

    public static class DiceResult {
        public int count;
        public int initialCount;
        public List<Integer> values;
        public int diceTotal;
        public int modifier;
        public int total;
        public int explosions;

        public DiceResult() {}
    }

    public static class CardInfo {
        public String kind;
        public String suit;
        public String suitName;
        public int rank;
        public String label;
        public String glyph;
        public String shortName;
    }

    public static class DrawResult {
        public CardInfo card;
        public int remaining;
        public boolean reshuffledNext;
    }

    public DiceResult rollDice(int count, int modifier) {
        count = Math.max(DICE_MIN, Math.min(DICE_MAX, count));
        modifier = Math.max(MOD_MIN, Math.min(MOD_MAX, modifier));

        List<Integer> initial = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            initial.add(rollDie());
        }

        List<Integer> allValues = new ArrayList<>(initial);
        int explosionCount = 0;
        int i = 0;
        while (i < allValues.size()) {
            if (allValues.get(i) == 6) {
                int extra = rollDie();
                allValues.add(extra);
                explosionCount++;
            }
            i++;
        }

        int diceTotal = allValues.stream().mapToInt(Integer::intValue).sum();
        int total = diceTotal + modifier;

        DiceResult result = new DiceResult();
        result.count = allValues.size();
        result.initialCount = initial.size();
        result.values = allValues;
        result.diceTotal = diceTotal;
        result.modifier = modifier;
        result.total = total;
        result.explosions = explosionCount;
        return result;
    }

    private int rollDie() {
        return secureRandom.nextInt(6) + 1;
    }

    public List<CardInfo> buildSpanishDeck() {
        List<CardInfo> deck = new ArrayList<>();
        String[][] suits = {
            {"oros", "Oros", "◎"},
            {"copas", "Copas", "◠"},
            {"espadas", "Espadas", "✦"},
            {"bastos", "Bastos", "✣"}
        };

        for (String[] suit : suits) {
            for (int rank = 1; rank <= 12; rank++) {
                CardInfo card = new CardInfo();
                card.kind = "card";
                card.suit = suit[0];
                card.suitName = suit[1];
                card.glyph = suit[2];
                card.rank = rank;
                card.label = rank + " de " + suit[1];
                card.shortName = suit[0].substring(0, 2).toUpperCase();
                deck.add(card);
            }
        }

        CardInfo joker1 = new CardInfo();
        joker1.kind = "joker";
        joker1.label = "Comodín Rojo";
        joker1.glyph = "★";
        joker1.shortName = "Jk";
        deck.add(joker1);

        CardInfo joker2 = new CardInfo();
        joker2.kind = "joker";
        joker2.label = "Comodín Negro";
        joker2.glyph = "✶";
        joker2.shortName = "Jk";
        deck.add(joker2);

        shuffleDeck(deck);
        return deck;
    }

    public void shuffleDeck(List<CardInfo> deck) {
        Collections.shuffle(deck, secureRandom);
    }

    public DrawResult drawCard(List<CardInfo> deck) {
        if (deck.isEmpty()) {
            shuffleDeck(deck);
        }
        CardInfo drawn = deck.remove(deck.size() - 1);
        DrawResult result = new DrawResult();
        result.card = drawn;
        result.remaining = deck.size();
        result.reshuffledNext = deck.isEmpty();
        return result;
    }

    public String deckToJson(List<CardInfo> deck) {
        try {
            return objectMapper.writeValueAsString(deck);
        } catch (Exception e) {
            return "[]";
        }
    }

    public List<CardInfo> jsonToDeck(String json) {
        try {
            if (json == null || json.isBlank()) return new ArrayList<>();
            return objectMapper.readValue(json, new TypeReference<List<CardInfo>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }
}
