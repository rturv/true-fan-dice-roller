import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { DiceRainComponent } from '../dice-rain/dice-rain';
import type { DiceRainVariant } from '../dice-rain/dice-particles';
import type { RollVisualEffect } from '../roll-effects';

interface ConfettiPiece {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: number;
  dxMidValue: string;
  dyValue: string;
  rotMidValue: string;
  dxEndValue: string;
  dyEndValue: string;
  rotEndValue: string;
}

interface RainDrop {
  x: number;
  y: number;
  delay: number;
  duration: number;
}

/**
 * Decorative layer for special rolls.
 *
 * - `kinds` may contain several visuals (for example legendary + big chain);
 *   they are layered together and share the same lifetime.
 * - `fullscreen = false`: the particles are clipped to the roll card.
 * - `fullscreen = true`: the layer covers the viewport (used for your own
 *   rolls only).
 *
 * Confetti celebrates legendary rolls, the dice rain/avalanche highlights big
 * explosion chains, and the storm is the fumble effect.
 */
@Component({
  selector: 'app-roll-effect',
  imports: [DiceRainComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active()) {
      <div
        class="fx-layer"
        [class.fullscreen]="fullscreen()"
        [class.storm]="hasStorm()"
        [attr.data-kinds]="kinds().join(' ')"
        aria-hidden="true"
      >
        @if (hasConfetti()) {
          @for (piece of confetti(); track $index) {
            <span
              [class]="'confetti-piece c' + piece.color"
              [style.left.%]="piece.x"
              [style.--y]="piece.y + '%'"
              [style.--w]="piece.size + 'px'"
              [style.--dx-mid]="piece.dxMidValue"
              [style.--dy]="piece.dyValue"
              [style.--rot-mid]="piece.rotMidValue"
              [style.--dx-end]="piece.dxEndValue"
              [style.--dy-end]="piece.dyEndValue"
              [style.--rot-end]="piece.rotEndValue"
              [style.animation-delay.ms]="piece.delay"
              [style.animation-duration.ms]="piece.duration"
            ></span>
          }
        }

        @if (hasStorm()) {
          <span class="storm-flash"></span>
          @for (drop of drops(); track $index) {
            <span
              class="rain-drop"
              [style.left.%]="drop.x"
              [style.--y]="drop.y + '%'"
              [style.animation-delay.ms]="drop.delay"
              [style.animation-duration.ms]="drop.duration"
            ></span>
          }
        }

        @if (hasDiceRain()) {
          <app-dice-rain [variant]="rainVariant()" [count]="diceRainCount()" />
        }
      </div>
    }
  `,
  styles: `
    :host { display: contents; }

    .fx-layer {
      --rain: 240px;
      position: absolute; inset: 0; overflow: hidden;
      border-radius: inherit; pointer-events: none; z-index: 2;
      container-type: inline-size;
    }
    .fx-layer.fullscreen {
      position: fixed; inset: 0; z-index: 850; border-radius: 0;
      --rain: 105vh;
    }
    .fx-layer.storm:not(.fullscreen) {
      background: color-mix(in oklab, var(--fg-2) 10%, transparent);
    }
    .fx-layer.fullscreen.storm {
      background: rgba(0, 0, 0, 0.22);
    }

    /* ---------- Confetti: burst from the middle of the card ---------- */
    .confetti-piece {
      position: absolute; top: 55%; left: 0;
      width: var(--w, 7px); height: calc(var(--w, 7px) * 1.5);
      border-radius: 2px; opacity: 0;
      animation-name: confetti-burst;
      animation-timing-function: cubic-bezier(0.2, 0.65, 0.35, 1);
      animation-fill-mode: forwards;
      will-change: transform, opacity;
    }
    .c0 { background: var(--accent); }
    .c1 { background: var(--success); }
    .c2 { background: var(--warn); }
    .c3 { background: var(--danger); }
    @keyframes confetti-burst {
      0% { transform: translate3d(0, 0, 0) rotate(0deg) scale(0.7); opacity: 0; }
      8% { opacity: 1; }
      48% {
        transform: translate3d(var(--dx-mid), var(--dy), 0) rotate(var(--rot-mid)) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate3d(var(--dx-end), var(--dy-end), 0) rotate(var(--rot-end)) scale(1);
        opacity: 0;
      }
    }

    /* ---------- Fumble: just rain ---------- */
    .rain-drop {
      position: absolute; top: -14px; left: 0;
      width: 2.5px; height: 12px; border-radius: 9999px;
      background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--fg-2) 82%, transparent));
      opacity: 0;
      transform: rotate(8deg);
      animation-name: rain-fall;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
      will-change: transform, opacity;
    }
    .fx-layer.fullscreen .rain-drop { width: 3px; height: 22px; }
    @keyframes rain-fall {
      0% { transform: translate3d(0, -14px, 0) rotate(8deg); opacity: 0; }
      12% { opacity: 0.85; }
      100% { transform: translate3d(-14px, var(--rain), 0) rotate(8deg); opacity: 0; }
    }

    .storm-flash {
      position: absolute; inset: 0; background: #fff; opacity: 0;
      animation: storm-flash 1800ms ease-out;
      pointer-events: none;
    }
    @keyframes storm-flash {
      0%, 52%, 100% { opacity: 0; }
      55% { opacity: 0.05; }
      57% { opacity: 0; }
      62% { opacity: 0.09; }
      64% { opacity: 0; }
    }
  `,
})
export class RollEffectComponent implements OnInit, OnDestroy {
  readonly kinds = input.required<RollVisualEffect[]>();
  readonly fullscreen = input(false);
  readonly intensity = input(0);
  readonly done = output<void>();

  protected readonly active = signal(true);
  protected readonly hasConfetti = computed(() => this.kinds().includes('confetti'));
  protected readonly hasStorm = computed(() => this.kinds().includes('storm'));
  protected readonly hasDiceRain = computed(() => this.kinds().includes('dice-rain'));
  protected readonly rainVariant = computed<DiceRainVariant>(() =>
    this.fullscreen() ? 'rain' : 'avalanche'
  );

  /**
   * More explosions mean more dice. Combined rolls (legendary + big chain)
   * are slightly thinned so both effects stay readable.
   */
  protected readonly diceRainCount = computed(() => {
    const fullscreen = this.fullscreen();
    const base = fullscreen ? 22 : 10;
    const perExplosion = fullscreen ? 2 : 0.8;
    const max = fullscreen ? 48 : 18;
    const combined = this.hasConfetti() ? 0.8 : 1;
    const raw = Math.round(
      (base + Math.max(0, this.intensity()) * perExplosion) * combined
    );
    const capped = Math.min(max, Math.max(fullscreen ? 18 : 8, raw));
    return this.isNarrowScreen() ? Math.min(capped, fullscreen ? 26 : 12) : capped;
  });

  private readonly allConfetti = Array.from({ length: 90 }, () => ({
    x: 30 + Math.random() * 40,
    y: 35 + Math.random() * 35,
    dx: -1 + Math.random() * 2,
    dy: -1 + Math.random() * 0.8,
    rot: 180 + Math.random() * 540,
    size: 6 + Math.random() * 6,
    delay: Math.random() * 120,
    duration: 1300 + Math.random() * 900,
    color: Math.floor(Math.random() * 4),
  }));

  private readonly allDrops: RainDrop[] = Array.from({ length: 120 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 900,
    duration: 520 + Math.random() * 280,
  }));

  protected readonly confetti = computed<ConfettiPiece[]>(() => {
    const fullscreen = this.fullscreen();
    const diceRain = this.hasDiceRain();
    const pieces = fullscreen
      ? diceRain
        ? this.allConfetti.slice(0, 64)
        : this.allConfetti
      : this.allConfetti.slice(0, diceRain ? 30 : 42);
    const unitX = fullscreen ? 'vw' : 'px';
    const unitY = fullscreen ? 'vh' : 'px';
    const spreadX = fullscreen ? 42 : 180;
    const spreadY = fullscreen ? 45 : 70;
    const fall = fullscreen ? 115 : 240;

    return pieces.map(piece => ({
      x: piece.x,
      y: piece.y,
      size: piece.size,
      delay: piece.delay,
      duration: piece.duration,
      color: piece.color,
      dxMidValue: `${(piece.dx * spreadX * 0.75).toFixed(1)}${unitX}`,
      dyValue: `${(piece.dy * spreadY).toFixed(1)}${unitY}`,
      rotMidValue: `${(piece.rot * 0.6).toFixed(0)}deg`,
      dxEndValue: `${(piece.dx * spreadX).toFixed(1)}${unitX}`,
      dyEndValue: `${(piece.dy * spreadY + fall).toFixed(1)}${unitY}`,
      rotEndValue: `${piece.rot.toFixed(0)}deg`,
    }));
  });

  protected readonly drops = computed(() =>
    this.fullscreen() ? this.allDrops : this.allDrops.slice(0, 44)
  );

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.timer = setTimeout(() => {
      this.active.set(false);
      this.done.emit();
    }, this.duration());
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private duration(): number {
    const fullscreen = this.fullscreen();
    if (this.hasDiceRain()) return fullscreen ? 4600 : 3200;
    if (this.hasStorm()) return fullscreen ? 4200 : 3800;
    return fullscreen ? 4200 : 3800;
  }

  private isNarrowScreen(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 600px)').matches
    );
  }
}
