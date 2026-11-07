import { Injectable, computed, signal } from '@angular/core';

export type BackendStatus = 'checking' | 'online' | 'offline';

/**
 * Monitoriza la disponibilidad del backend consultando el endpoint de readiness.
 *
 * El endpoint `/health/ready` devuelve HTTP 200 con `{"status":"UP"}` cuando el
 * backend y su base de datos están operativos, y HTTP 503 en caso contrario.
 * El servicio hace polling periódico y expone el estado mediante signals.
 */
@Injectable({ providedIn: 'root' })
export class BackendHealthService {
  readonly status = signal<BackendStatus>('checking');
  readonly lastChecked = signal<number | null>(null);
  readonly online = computed(() => this.status() === 'online');

  private readonly POLL_INTERVAL_MS = 15_000;
  private readonly REQUEST_TIMEOUT_MS = 5_000;
  private readonly HEALTH_PATH = '/health/ready';

  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private refCount = 0;

  /**
   * Inicia el polling. Se lleva un contador de referencias para que varios
   * consumidores (lobby, sala, indicador) compartan una única monitorización.
   */
  start(): void {
    this.refCount++;
    if (this.refCount !== 1) return;

    void this.check();
    this.timer = setInterval(() => void this.check(), this.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.refCount > 0) this.refCount--;
    if (this.refCount !== 0) return;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Ejecuta una comprobación inmediata del estado del backend. */
  async check(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(this.healthUrl(), {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.status.set('offline');
        return;
      }

      // Validamos el cuerpo para no confundir una respuesta SPA (HTML) con un
      // backend realmente listo.
      const body = (await response.json()) as { status?: string };
      this.status.set(body?.status === 'UP' ? 'online' : 'offline');
    } catch {
      this.status.set('offline');
    } finally {
      clearTimeout(timeoutId);
      this.lastChecked.set(Date.now());
      this.inFlight = false;
    }
  }

  private healthUrl(): string {
    const win = window as unknown as Record<string, Record<string, string>>;
    const env = win['__env'] ?? {};

    const httpBase = (env['backendHttpUrl'] ?? '').trim();
    if (httpBase) {
      return `${httpBase.replace(/\/$/, '')}${this.HEALTH_PATH}`;
    }

    // Si no hay URL HTTP configurada, derivamos el host del WebSocket, que en
    // producción sí es obligatorio (evita depender de un proxy /health).
    const wsUrl = (env['backendWsUrl'] ?? '').trim();
    if (wsUrl) {
      try {
        const parsed = new URL(wsUrl);
        const protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
        return `${protocol}//${parsed.host}${this.HEALTH_PATH}`;
      } catch {
        // URL de WebSocket malformada: continuamos con el fallback.
      }
    }

    const isDev = window.location.port === '4200';
    const origin = isDev ? 'http://localhost:8080' : window.location.origin;
    return `${origin.replace(/\/$/, '')}${this.HEALTH_PATH}`;
  }
}
