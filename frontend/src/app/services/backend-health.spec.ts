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

  it('shares a single polling timer across consumers (reference counting)', () => {
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(1 as unknown as ReturnType<typeof setInterval>);
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue(healthResponse('UP'));

    const service = new BackendHealthService();

    service.start();
    service.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    service.stop();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    service.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
