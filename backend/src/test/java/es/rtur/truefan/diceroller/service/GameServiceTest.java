package es.rtur.truefan.diceroller.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.rtur.truefan.diceroller.service.GameService.CardInfo;
import es.rtur.truefan.diceroller.service.GameService.DrawResult;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class GameServiceTest {

    private final GameService gameService = new GameService();

    @Test
    void normalDrawKeepsTheRestOfTheDeck() {
        List<CardInfo> deck = new ArrayList<>(gameService.buildSpanishDeck());
        CardInfo top = deck.get(deck.size() - 1);

        DrawResult result = gameService.drawCard(deck);

        assertEquals(top.label, result.card.label);
        assertEquals(49, result.remaining);
        assertEquals(49, deck.size());
        assertFalse(result.autoReshuffled);
        assertNull(result.reshuffleReason);
    }

    @Test
    void drawingTheLastCardRebuildsAFullDeck() {
        List<CardInfo> deck = new ArrayList<>();
        CardInfo lastCard = new CardInfo();
        lastCard.kind = "card";
        lastCard.suit = "oros";
        lastCard.suitName = "Oros";
        lastCard.rank = 1;
        lastCard.label = "1 de Oros";
        deck.add(lastCard);

        DrawResult result = gameService.drawCard(deck);

        assertEquals("1 de Oros", result.card.label);
        assertTrue(result.autoReshuffled);
        assertEquals("empty", result.reshuffleReason);
        assertEquals(50, result.remaining);
        assertEquals(50, deck.size());
    }

    @Test
    void drawingAJokerRebuildsAFullDeck() {
        List<CardInfo> deck = new ArrayList<>(gameService.buildSpanishDeck());
        CardInfo joker = deck.stream()
                .filter(card -> "joker".equals(card.kind))
                .findFirst()
                .orElseThrow();
        deck.remove(joker);
        deck.add(joker);

        DrawResult result = gameService.drawCard(deck);

        assertEquals(joker.label, result.card.label);
        assertTrue(result.autoReshuffled);
        assertEquals("joker", result.reshuffleReason);
        assertEquals(50, result.remaining);
        assertEquals(50, deck.size());
    }

    @Test
    void drawingAnEmptyDeckRebuildsBeforeDrawing() {
        List<CardInfo> deck = new ArrayList<>();

        DrawResult result = gameService.drawCard(deck);

        assertNotNull(result.card);
        assertFalse(result.autoReshuffled);
        assertNull(result.reshuffleReason);
        assertEquals(49, result.remaining);
        assertEquals(49, deck.size());
    }
}
