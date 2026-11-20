import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { buildDiceParticles, type DiceRainVariant } from './dice-particles';

/**
 * Falling/rolling dice shared by the easter egg and the big-chain roll effect.
 *
 * The component renders only the particles: the parent provides the positioned
 * and clipped layer. `rain` falls vertically; `avalanche` crosses the layer
 * from right to left and needs a CSS container (see RollEffectComponent).
 */
@Component({
  selector: 'app-dice-rain',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (die of particles(); track $index) {
      <span
        class="dice-particle"
        [class.rain]="variant() === 'rain'"
        [class.avalanche]="variant() === 'avalanche'"
        [class.is-six]="die.value === 6"
        [style.--x]="die.left + '%'"
        [style.--y]="die.top + '%'"
        [style.--size]="die.size + 'px'"
        [style.--font-size]="die.fontSize + 'px'"
        [style.--delay]="die.delay + 'ms'"
        [style.--duration]="die.duration + 'ms'"
        [style.--spin]="die.spin + 'deg'"
        [style.--spin-mid]="die.spinMid + 'deg'"
        [style.--bounce]="die.bounce + 'px'"
        >{{ die.value }}</span
      >
    }
  `,
  styles: `
    :host { display: contents; }

    .dice-particle {
      position: absolute;
      display: flex; align-items: center; justify-content: center;
      width: var(--size, 44px); height: var(--size, 44px);
      font-family: var(--font-display); font-size: var(--font-size, 22px);
      font-weight: 700; line-height: 1;
      color: var(--accent); background: var(--surface);
      border: 2px solid var(--accent); border-radius: 8px;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
      opacity: 0;
      will-change: transform, opacity;
      animation-delay: var(--delay, 0ms);
      animation-duration: var(--duration, 1600ms);
      animation-fill-mode: forwards;
    }
    .dice-particle.is-six {
      background: color-mix(in oklab, var(--accent) 18%, var(--surface));
      box-shadow:
        0 0 14px color-mix(in oklab, var(--accent) 45%, transparent),
        0 6px 14px rgba(0, 0, 0, 0.25);
    }
    .dice-particle.rain {
      top: -70px; left: var(--x, 50%);
      animation-name: dice-rain-fall;
      animation-timing-function: linear;
    }
    .dice-particle.avalanche {
      top: var(--y, 50%); left: 0;
      animation-name: dice-avalanche-roll;
      animation-timing-function: cubic-bezier(0.25, 0.6, 0.35, 1);
    }

    @keyframes dice-rain-fall {
      0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
      8% { opacity: 1; }
      85% { opacity: 1; }
      100% { transform: translate3d(0, 112vh, 0) rotate(var(--spin, 720deg)); opacity: 0; }
    }
    @keyframes dice-avalanche-roll {
      0% {
        transform: translate3d(calc(100cqw + 80px), 0, 0) rotate(0deg);
        opacity: 0;
      }
      10% { opacity: 1; }
      50% {
        transform: translate3d(50cqw, var(--bounce, 0px), 0) rotate(var(--spin-mid, 400deg));
      }
      88% { opacity: 1; }
      100% {
        transform: translate3d(-100px, 0, 0) rotate(var(--spin, 720deg));
        opacity: 0;
      }
    }
  `,
})
export class DiceRainComponent {
  readonly variant = input.required<DiceRainVariant>();
  readonly count = input(30);

  protected readonly particles = computed(() =>
    buildDiceParticles(this.variant(), this.count())
  );
}
