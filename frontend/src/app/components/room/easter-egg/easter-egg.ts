import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  input,
  output,
} from '@angular/core';
import type { EasterEggEffect } from './rotation';

interface FallingDie {
  left: number;
  delay: number;
  duration: number;
  value: number;
}

interface ConfettiPiece {
  left: number;
  tx: number;
  ty: number;
  rot: number;
  delay: number;
  duration: number;
}

interface FlyingCard {
  suit: string;
  rank: string;
  tx: number;
  ty: number;
  rot: number;
  delay: number;
}

/** How long each effect stays on screen before removing itself. */
const DURATIONS: Record<EasterEggEffect, number> = {
  'glitch-dice': 4500,
  'giant-die': 2800,
  'confetti-cards': 3200,
  banner: 4000,
};

const SUITS = ['oros', 'copas', 'espadas', 'bastos'];
const RANKS = ['1', '3', '7', '12'];

@Component({
  selector: 'app-easter-egg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="egg" [attr.data-effect]="effect()" aria-hidden="true">
      @switch (effect()) {
        @case ('glitch-dice') {
          <div class="glitch"></div>
          @for (die of dice; track $index) {
            <span
              class="falling-die"
              [style.--x]="die.left + '%'"
              [style.animation-delay.ms]="die.delay"
              [style.animation-duration.ms]="die.duration"
              >{{ die.value }}</span
            >
          }
        }
        @case ('giant-die') {
          <div class="giant-die">
            @for (pip of giantPips; track $index) {
              <span class="pip" [class.on]="pip"></span>
            }
          </div>
        }
        @case ('confetti-cards') {
          @for (piece of confetti; track $index) {
            <span
              class="confetti-piece"
              [style.left.%]="piece.left"
              [style.--tx]="piece.tx + 'vw'"
              [style.--ty]="piece.ty + 'vh'"
              [style.--rot]="piece.rot + 'deg'"
              [style.animation-delay.ms]="piece.delay"
              [style.animation-duration.ms]="piece.duration"
            ></span>
          }
          @for (card of cards; track $index) {
            <div
              class="flying-card"
              [style.--tx]="card.tx + 'vw'"
              [style.--ty]="card.ty + 'vh'"
              [style.--rot]="card.rot + 'deg'"
              [style.animation-delay.ms]="card.delay"
            >
              <span class="card-rank">{{ card.rank }}</span>
              <img [src]="'assets/suits/' + card.suit + '.svg'" alt="" />
            </div>
          }
        }
        @case ('banner') {
          <div class="banner">
            <div class="banner-title">CREATED BY RTURV</div>
            <div class="banner-marquee">
              <span>https://github.com/rturv/true-fan-dice-roller</span>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: contents; }

    .egg {
      position: fixed; inset: 0; z-index: 900;
      pointer-events: none; overflow: hidden;
    }

    /* ---------- Act 1: glitch + dice rain ---------- */
    .egg[data-effect='glitch-dice'] { animation: egg-shake 260ms steps(2) 3; }

    .glitch {
      position: absolute; inset: 0;
      background: repeating-linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.07) 0 2px,
        transparent 2px 4px
      );
      animation: glitch-fade 900ms ease-out forwards;
    }
    .glitch::before,
    .glitch::after {
      content: ''; position: absolute; inset: 0;
    }
    .glitch::before { background: rgba(255, 0, 120, 0.1); transform: translateX(-3px); }
    .glitch::after { background: rgba(0, 220, 255, 0.1); transform: translateX(3px); }

    .falling-die {
      position: absolute; top: -70px; left: var(--x, 50%);
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px;
      font-family: var(--font-display); font-size: 22px; font-weight: 700;
      color: var(--accent); background: var(--surface);
      border: 2px solid var(--accent); border-radius: 8px;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
      opacity: 0;
      animation-name: die-fall;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    @keyframes egg-shake {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(2px, -1px); }
      50% { transform: translate(-2px, 1px); }
      75% { transform: translate(1px, 2px); }
    }
    @keyframes glitch-fade {
      0% { opacity: 1; }
      70% { opacity: 0.6; }
      100% { opacity: 0; }
    }
    @keyframes die-fall {
      0% { transform: translateY(0) rotate(0deg); opacity: 0; }
      8% { opacity: 1; }
      85% { opacity: 1; }
      100% { transform: translateY(112vh) rotate(720deg); opacity: 0; }
    }

    /* ---------- Act 2: giant die ---------- */
    .giant-die {
      position: absolute; top: 50%; left: -360px; margin-top: -150px;
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
      width: 300px; height: 300px; padding: 26px;
      background: linear-gradient(145deg, var(--surface), var(--bg));
      border: 6px solid var(--accent); border-radius: 34px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      animation: die-cross 2.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
    }
    .giant-die .pip { border-radius: 50%; background: transparent; }
    .giant-die .pip.on {
      background: var(--accent);
      box-shadow: 0 0 14px color-mix(in oklab, var(--accent) 55%, transparent);
    }
    @keyframes die-cross {
      0% { transform: translateX(0) translateY(0) rotate(-30deg); }
      45% { transform: translateX(calc(50vw + 160px)) translateY(-5vh) rotate(300deg); }
      52% { transform: translateX(calc(50vw + 180px)) translateY(0) rotate(340deg); }
      100% { transform: translateX(calc(100vw + 420px)) translateY(-3vh) rotate(720deg); }
    }

    /* ---------- Act 3: confetti + cards ---------- */
    .confetti-piece {
      position: absolute; bottom: 8%; left: 50%;
      width: 10px; height: 14px; border-radius: 2px;
      background: var(--accent);
      opacity: 0;
      animation-name: confetti-fly;
      animation-timing-function: cubic-bezier(0.2, 0.6, 0.3, 1);
      animation-fill-mode: forwards;
    }
    .confetti-piece:nth-child(4n) { background: var(--accent); }
    .confetti-piece:nth-child(4n + 1) { background: var(--success); }
    .confetti-piece:nth-child(4n + 2) { background: var(--warn); }
    .confetti-piece:nth-child(4n + 3) { background: var(--danger); }

    .flying-card {
      position: absolute; bottom: 10%; left: 50%; margin-left: -42px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; width: 84px; height: 122px;
      background: #fffdf7; color: #1a1a1a;
      border: 2px solid var(--accent); border-radius: 10px;
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.3);
      opacity: 0;
      animation-name: card-fly;
      animation-duration: 2.4s;
      animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1);
      animation-fill-mode: forwards;
    }
    .flying-card .card-rank { font-family: var(--font-display); font-size: 22px; font-weight: 700; }
    .flying-card img { width: 40px; height: 46px; object-fit: contain; }

    @keyframes confetti-fly {
      0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
      10% { opacity: 1; }
      100% { transform: translate(var(--tx, 0), var(--ty, -50vh)) rotate(var(--rot, 540deg)); opacity: 0; }
    }
    @keyframes card-fly {
      0% { transform: translate(0, 0) rotate(0deg) scale(0.6); opacity: 0; }
      15% { opacity: 1; }
      75% { opacity: 1; }
      100% { transform: translate(var(--tx, 0), var(--ty, -55vh)) rotate(var(--rot, 0deg)) scale(1); opacity: 0; }
    }

    /* ---------- Act 4: banner ---------- */
    .banner {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; background: rgba(0, 0, 0, 0.55);
      animation: banner-in 400ms ease-out forwards;
    }
    .banner-title {
      font-family: "Bangers", "Impact", "Arial Black", sans-serif;
      font-size: clamp(36px, 8vw, 104px); letter-spacing: 0.06em;
      max-width: 92vw; text-align: center; line-height: 0.95;
      color: #fff; opacity: 0;
      text-shadow:
        0 0 18px var(--accent),
        0 0 42px color-mix(in oklab, var(--accent) 60%, transparent),
        4px 4px 0 rgba(0, 0, 0, 0.6);
      animation: banner-pop 700ms cubic-bezier(0.2, 1.4, 0.4, 1) forwards;
    }
    .banner-marquee {
      width: min(80vw, 900px); overflow: hidden;
      padding: 8px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.25);
      border-bottom: 1px solid rgba(255, 255, 255, 0.25);
    }
    .banner-marquee span {
      display: inline-block; white-space: nowrap;
      font-family: var(--font-mono); font-size: clamp(12px, 1.6vw, 18px);
      color: #fff; opacity: 0.92;
      transform: translateX(100vw);
      animation: marquee 3.6s linear 0.25s forwards;
    }
    @keyframes banner-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes banner-pop {
      from { opacity: 0; transform: scale(0.6) rotate(-2deg) skewX(-3deg); }
      to { opacity: 1; transform: scale(1) rotate(-2deg) skewX(-3deg); }
    }
    @keyframes marquee {
      from { transform: translateX(100vw); }
      to { transform: translateX(-110%); }
    }

  `,
})
export class EasterEggComponent implements OnInit, OnDestroy {
  readonly effect = input.required<EasterEggEffect>();
  readonly done = output<void>();

  protected readonly dice: FallingDie[] = Array.from({ length: 30 }, () => ({
    left: 2 + Math.random() * 94,
    delay: Math.random() * 1400,
    duration: 1400 + Math.random() * 900,
    value: 1 + Math.floor(Math.random() * 6),
  }));

  protected readonly confetti: ConfettiPiece[] = Array.from({ length: 30 }, () => ({
    left: 35 + Math.random() * 30,
    tx: -42 + Math.random() * 84,
    ty: -30 - Math.random() * 45,
    rot: 180 + Math.random() * 720,
    delay: Math.random() * 500,
    duration: 1200 + Math.random() * 900,
  }));

  protected readonly cards: FlyingCard[] = SUITS.map((suit, index) => ({
    suit,
    rank: RANKS[index],
    tx: (index - 1.5) * 16,
    ty: -38 - Math.random() * 18,
    rot: (index - 1.5) * 18,
    delay: 150 + index * 80,
  }));

  protected readonly giantPips = EasterEggComponent.pips(1 + Math.floor(Math.random() * 6));

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.done.emit(), DURATIONS[this.effect()]);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private static pips(value: number): boolean[] {
    const faces: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const on = new Set(faces[value] ?? []);
    return Array.from({ length: 9 }, (_, index) => on.has(index));
  }
}
