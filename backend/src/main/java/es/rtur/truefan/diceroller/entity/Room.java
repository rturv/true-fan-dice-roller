package es.rtur.truefan.diceroller.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "rooms")
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, unique = true, length = 7)
    public String code;

    @Column(nullable = false)
    public Instant createdAt;

    @Column(nullable = false, columnDefinition = "TEXT")
    public String deckState;

    @Column(nullable = false)
    public String adminNickname;

    @Column(nullable = false)
    public int poolValue;

    @Column(nullable = false)
    public boolean cardsEnabled = true;
}
