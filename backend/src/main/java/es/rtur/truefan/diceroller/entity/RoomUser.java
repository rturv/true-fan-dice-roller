package es.rtur.truefan.diceroller.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "room_users")
public class RoomUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    public Room room;

    @Column(nullable = false, length = 20)
    public String nickname;

    @Column(nullable = false)
    public Instant joinedAt;

    @Column(nullable = false)
    public Instant lastSeenAt;

    @Column(nullable = false)
    public boolean connected;

    @Column(nullable = false, unique = true)
    public String sessionToken;
}
