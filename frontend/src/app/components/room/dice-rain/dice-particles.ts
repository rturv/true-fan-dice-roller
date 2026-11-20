export type DiceRainVariant = 'rain' | 'avalanche';

export interface DiceParticle {
  value: number;
  /** Horizontal position in % for the rain variant. */
  left: number;
  /** Vertical band in % for the avalanche variant. */
  top: number;
  size: number;
  fontSize: number;
  delay: number;
  duration: number;
  spin: number;
  /** Rotation reached at the midpoint of the avalanche (less than `spin`). */
  spinMid: number;
  bounce: number;
}

function randomInt(random: () => number, min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.min(span - 1, Math.floor(random() * span));
}

function randomFloat(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

/**
 * Builds the dice particles used by the easter egg and the big-chain effect.
 *
 * `rain` falls vertically from the top, while `avalanche` crosses the layer
 * from right to left in three staggered waves. The second one is meant to live
 * inside the clipped roll card, so the parent must be a CSS container.
 */
export function buildDiceParticles(
  variant: DiceRainVariant,
  count: number,
  random: () => number = Math.random
): DiceParticle[] {
  const total = Math.max(1, Math.trunc(count));

  return Array.from({ length: total }, (_, index) => {
    const value = randomInt(random, 1, 6);

    if (variant === 'rain') {
      const size = Math.round(randomFloat(random, 38, 54));
      const spin = Math.round(randomFloat(random, 540, 900));
      return {
        value,
        left: randomFloat(random, 2, 96),
        top: 0,
        size,
        fontSize: Math.round(size * 0.5),
        delay: Math.round(randomFloat(random, 0, 1400)),
        duration: Math.round(randomFloat(random, 1400, 2300)),
        spin,
        spinMid: Math.round(spin * 0.55),
        bounce: 0,
      };
    }

    const wave = index % 3;
    const size = Math.round(randomFloat(random, 24, 38));
    const spin = Math.round(randomFloat(random, 540, 1080));
    return {
      value,
      left: 0,
      top: Math.round(20 + wave * 27 + randomFloat(random, 0, 14)),
      size,
      fontSize: Math.round(size * 0.5),
      delay: Math.round(wave * 160 + randomFloat(random, 0, 120)),
      duration: Math.round(randomFloat(random, 1200, 1800)),
      spin,
      spinMid: Math.round(spin * 0.55),
      bounce: Math.round(randomFloat(random, -14, 14)),
    };
  });
}
