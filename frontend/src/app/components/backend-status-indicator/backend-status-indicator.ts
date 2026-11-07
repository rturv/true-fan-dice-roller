import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, computed, inject } from '@angular/core';
import { BackendHealthService } from '../../services/backend-health';

/**
 * Muestra el estado de disponibilidad del backend mediante un pill discreto.
 * Inicia y detiene la monitorización mientras el componente está montado.
 */
@Component({
  selector: 'app-backend-status-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="status-pill"
      [class.online]="status() === 'online'"
      [class.offline]="status() === 'offline'"
      [class.checking]="status() === 'checking'"
      role="status"
      aria-live="polite"
      [attr.title]="tooltip()"
    >
      <span class="status-dot" aria-hidden="true"></span>
      <span class="status-text">{{ label() }}</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: color-mix(in oklab, var(--surface), var(--bg) 35%);
      border: 1px solid var(--border-soft);
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
      user-select: none;
      transition: color var(--motion-fast), border-color var(--motion-fast);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--meta);
      flex: 0 0 auto;
    }
    .status-pill.online {
      color: var(--success);
      border-color: color-mix(in oklab, var(--success) 45%, var(--border-soft));
    }
    .status-pill.online .status-dot {
      background: var(--success);
      box-shadow: 0 0 0 3px color-mix(in oklab, var(--success) 18%, transparent);
    }
    .status-pill.offline {
      color: var(--danger);
      border-color: color-mix(in oklab, var(--danger) 45%, var(--border-soft));
    }
    .status-pill.offline .status-dot {
      background: var(--danger);
      box-shadow: 0 0 0 3px color-mix(in oklab, var(--danger) 18%, transparent);
    }
    .status-pill.checking .status-dot {
      animation: status-pulse 1.2s ease-in-out infinite;
    }
    @keyframes status-pulse {
      0%, 100% { opacity: 0.35; }
      50% { opacity: 1; }
    }
  `,
})
export class BackendStatusIndicatorComponent implements OnInit, OnDestroy {
  private readonly health = inject(BackendHealthService);

  protected readonly status = this.health.status;

  protected readonly label = computed(() => {
    switch (this.status()) {
      case 'online': return 'Backend en línea';
      case 'offline': return 'Sin conexión';
      default: return 'Comprobando…';
    }
  });

  protected readonly tooltip = computed(() => {
    const checked = this.health.lastChecked();
    if (!checked) return 'Comprobando la conexión con el backend';
    const time = new Date(checked).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `Última comprobación: ${time}`;
  });

  ngOnInit(): void {
    this.health.start();
  }

  ngOnDestroy(): void {
    this.health.stop();
  }
}
