import type { DiceResult, RollEffectKind } from '../../models/game.models';

/**
 * Roll effect detection.
 *
 * The backend always sends the same payload to every player, so classifying it
 * here keeps every client in sync without touching the protocol or the
 * database. The thresholds are derived from the distribution of an exploding
 * d6 (mean 4.2, standard deviation ~3.262 per die).
 */

const DIE_MEAN = 4.2;
const DIE_SD = 3.262;
const EXPLOSION_MEAN = 0.2;
const EXPLOSION_SD = 0.49;

/** z-score used for the upper tail. */
const HIGH_Z = 2.5;
/** The lower tail is thinner, so it needs a smaller z-score to stay rare. */
const LOW_Z = 1.75;
/** z-score used for the explosion count. */
const CHAIN_Z = 2.5;
/**
 * z-score used for a big explosion chain.
 *
 * Only 0.2 above `CHAIN_Z`, so with two to nine dice both thresholds round to
 * the same number (any chain already fires the avalanche) and with more dice
 * it sometimes asks for one extra six. That keeps the effect between ~1 in 30
 * and ~1 in 120 rolls instead of the old 1 in 100-1500.
 */
const BIG_CHAIN_Z = 2.7;
/** A big chain always needs at least this many explosions. */
const BIG_CHAIN_MIN = 3;

const MIN_DICE = 1;
const MAX_DICE = 20;

export interface RollThresholds {
  /** Minimum diceTotal for a legendary roll. */
  legendary: number;
  /** Maximum diceTotal for a fumble (only used with 2+ dice). */
  fumble: number;
  /** Minimum explosions for a chain. */
  chain: number;
  /** Minimum explosions for a big chain. */
  bigChain: number;
}

export function clampDiceCount(count: number): number {
  const value = Math.trunc(count);
  if (!Number.isFinite(value)) return MIN_DICE;
  return Math.min(MAX_DICE, Math.max(MIN_DICE, value));
}

/** Thresholds for an initial count of `count` dice. */
export function rollThresholds(count: number): RollThresholds {
  const n = clampDiceCount(count);
  const mean = DIE_MEAN * n;
  const sd = DIE_SD * Math.sqrt(n);
  return {
    legendary: Math.ceil(mean + HIGH_Z * sd),
    fumble: Math.max(n, Math.floor(mean - LOW_Z * sd)),
    chain: Math.ceil(EXPLOSION_MEAN * n + CHAIN_Z * EXPLOSION_SD * Math.sqrt(n)),
    bigChain: Math.max(
      BIG_CHAIN_MIN,
      Math.ceil(EXPLOSION_MEAN * n + BIG_CHAIN_Z * EXPLOSION_SD * Math.sqrt(n))
    ),
  };
}

/**
 * Returns every effect matched by a roll. A roll can be legendary and have an
 * explosion chain at the same time, in which case both are returned. Chains
 * that cross the big-chain threshold add the extra `big-chain` marker.
 */
export function detectRollEffects(
  result: Pick<DiceResult, 'initialCount' | 'diceTotal' | 'explosions'>
): RollEffectKind[] {
  const n = clampDiceCount(result.initialCount || 1);
  const thresholds = rollThresholds(n);
  const effects: RollEffectKind[] = [];

  if (result.diceTotal >= thresholds.legendary) {
    effects.push('legendary');
  } else if (n >= 2 && result.diceTotal <= thresholds.fumble) {
    effects.push('fumble');
  }

  const explosions = result.explosions ?? 0;
  if (explosions >= thresholds.chain && !effects.includes('fumble')) {
    effects.push('chain');
    if (explosions >= thresholds.bigChain) {
      effects.push('big-chain');
    }
  }

  return effects;
}

/**
 * Builds a synthetic (but internally consistent) roll for the hidden `/fx`
 * preview commands. The generated dice always satisfy the requested effect and
 * are shaped like a real exploding-d6 result: the number of sixes equals the
 * number of extra dice.
 */
export function buildPreviewRoll(kind: RollEffectKind, diceCount: number): DiceResult {
  let n = clampDiceCount(diceCount);
  if (kind === 'fumble') n = Math.max(2, n);
  if (kind === 'chain' || kind === 'big-chain') n = Math.max(3, n);

  const thresholds = rollThresholds(n);
  const otherValue =
    kind === 'fumble' || kind === 'chain' || kind === 'big-chain' ? 1 : 5;

  let sixes = 0;
  if (kind === 'legendary') {
    sixes = Math.max(0, Math.ceil((thresholds.legendary - otherValue * n) / 6));
  } else if (kind === 'chain') {
    sixes = thresholds.chain;
  } else if (kind === 'big-chain') {
    sixes = thresholds.bigChain;
  }

  const values: number[] = [
    ...Array.from({ length: sixes }, () => 6),
    ...Array.from({ length: n }, () => otherValue),
  ];
  const diceTotal = values.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,
    initialCount: n,
    values,
    diceTotal,
    modifier: 0,
    total: diceTotal,
    explosions: sixes,
  };
}

export const PREVIEW_ORDER: RollEffectKind[] = ['legendary', 'fumble', 'big-chain'];

export type RollVisualEffect = 'confetti' | 'storm' | 'dice-rain';

/**
 * Maps semantic roll effects to the visual layers that must be drawn.
 *
 * - Legendary rolls get confetti.
 * - Big explosion chains get the dice rain (full screen) or avalanche (card).
 * - A legendary big chain gets both at the same time.
 * - Regular chains keep only their chip and subtle card animation.
 * - Fumbles always use the storm.
 */
export function rollVisualEffects(
  effects: RollEffectKind[] | undefined
): RollVisualEffect[] {
  if (!effects || effects.length === 0) return [];
  if (effects.includes('fumble')) return ['storm'];

  const visuals: RollVisualEffect[] = [];
  if (effects.includes('legendary')) visuals.push('confetti');
  if (effects.includes('big-chain')) visuals.push('dice-rain');
  return visuals;
}
