package es.rtur.truefan.diceroller.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import es.rtur.truefan.diceroller.entity.RoomUser;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

@QuarkusTest
class RoomConcurrencyTest {

    private static final int INCREMENTS = 8;

    @Inject
    RoomService roomService;

    @Test
    void concurrentPoolDeltasAreSerializedByTheRoomLock() throws Exception {
        RoomService.JoinResult join = roomService.createAndJoinRoom("concurrency");
        String roomCode = join.room().code;
        String sessionToken = join.user().sessionToken;

        ExecutorService executor = Executors.newFixedThreadPool(INCREMENTS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < INCREMENTS; i++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    QuarkusTransaction.requiringNew().run(() -> {
                        RoomUser user = roomService.findUserBySessionToken(sessionToken).orElseThrow();
                        roomService.poolDelta(user, 1);
                    });
                    return null;
                }));
            }

            start.countDown();
            for (Future<?> future : futures) {
                future.get(30, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        int poolValue = QuarkusTransaction.requiringNew().call(() -> {
            return roomService.findRoomByCode(roomCode).poolValue;
        });

        assertEquals(INCREMENTS, poolValue);
    }
}
