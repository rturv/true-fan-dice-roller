import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackendHealthService } from './backend-health';

function healthResponse(status: string, ok = true): Response {
  return { ok, json: async () => ({ status }) } as unknown as Response;
}

describe('BackendHealthService', () => {
  let originalFetch: typeof fetch;
  let originalEnv: Record<string, string> | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    const win = window as unknown as { __env?: Record<string, string> };
    originalEnv = win.__env;
    win.__env = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    const win = window as unknown as { __env?: Record<string, string> };
    win.__env = originalEnv;
    vi.restoreAllMocks();
  });

  it('marks the backend as online when readiness responds UP', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(healthResponse('UP'));

    const service = new BackendHealthService();
    await service.check();

    expect(service.status()).toBe('online');
    expect(service.online()).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('marks the backend as offline when the request fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const service = new BackendHealthService();
    await service.check();

    expect(service.status()).toBe('offline');
    expect(service.online()).toBe(false);
  });

  it('marks the backend as offline when readiness responds with an error status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(healthResponse('DOWN', false));

    const service = new BackendHealthService();
    await service.check();

    expect(service.status()).toBe('offline');
    expect(service.online()).toBe(false);
  });

  it('marks the backend as offline when the body does not report UP', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(healthResponse('DOWN'));

    const service = new BackendHealthService();
    await service.check();

    expect(service.status()).toBe('offline');
  });

  it('uses backendHttpUrl when configured', async () => {
    const win = window as unknown as { __env: Record<string, string> };
    win.__env = { backendHttpUrl: 'https://api.example.com', backendWsUrl: '' };
    const fetchMock = vi.fn().mockResolvedValue(healthResponse('UP'));
    globalThis.fetch = fetchMock;

    const service = new BackendHealthService();
    await service.check();

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/health/ready');
  });

  it('derives the health URL from backendWsUrl when backendHttpUrl is empty', async () => {
    const win = window as unknown as { __env: Record<string, string> };
    win.__env = { backendHttpUrl: '', backendWsUrl: 'wss://api.example.com/ws/room' };
    const fetchMock = vi.fn().mockResolvedValue(healthResponse('UP'));
    globalThis.fetch = fetchMock;

    const service = new BackendHealthService();
    await service.check();

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/health/ready');
  });

  it('shares a single polling loop across consumers (reference counting)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(healthResponse('UP'));
    globalThis.fetch = fetchMock;

    const service = new BackendHealthService();

    service.start();
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Con el backend en línea, el siguiente ciclo llega a los 15 s.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Un consumidor se va: la monitorización sigue viva para el otro.
    service.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // El último consumidor se va: se detiene el polling.
    service.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('polls every 15 seconds while the backend is online', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(healthResponse('UP'));
    globalThis.fetch = fetchMock;

    const service = new BackendHealthService();
    service.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    service.stop();
  });

  it('retries every 5 seconds after a failed check', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error('backend down'));
    globalThis.fetch = fetchMock;

    const service = new BackendHealthService();
    service.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('offline');

    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    service.stop();
  });

  it('returns to the 15 second cadence once the backend recovers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('backend down'))
      .mockResolvedValue(healthResponse('UP'));
    globalThis.fetch = fetchMock;

    const service = new BackendHealthService();
    service.start();

    // Primer fallo → reintento a los 5 s y recuperación.
    await vi.advanceTimersByTimeAsync(0);
    expect(service.status()).toBe('offline');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(service.status()).toBe('online');

    // En línea de nuevo → 15 s hasta la siguiente comprobación.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    service.stop();
  });
});
