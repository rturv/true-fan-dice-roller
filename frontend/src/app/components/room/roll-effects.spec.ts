import { describe, expect, it } from 'vitest';
import type { DiceResult, RollEffectKind } from '../../models/game.models';
import {
  buildPreviewRoll,
  clampDiceCount,
  detectRollEffects,
  rollThresholds,
  rollVisualEffect,
} from './roll-effects';

function roll(initialCount: number, diceTotal: number, explosions: number, modifier = 0): DiceResult {
  return {
    count: initialCount + explosions,
    initialCount,
    values: [],
    diceTotal,
    modifier,
    total: diceTotal + modifier,
    explosions,
  };
}

describe('rollThresholds', () => {
  it('matches the documented thresholds', () => {
    expect(rollThresholds(1)).toEqual({ legendary: 13, fumble: 1, chain: 2 });
    expect(rollThresholds(2)).toEqual({ legendary: 20, fumble: 2, chain: 3 });
    expect(rollThresholds(3)).toEqual({ legendary: 27, fumble: 3, chain: 3 });
    expect(rollThresholds(5)).toEqual({ legendary: 40, fumble: 8, chain: 4 });
    expect(rollThresholds(10)).toEqual({ legendary: 68, fumble: 23, chain: 6 });
    expect(rollThresholds(20)).toEqual({ legendary: 121, fumble: 58, chain: 10 });
  });

  it('clamps the dice count', () => {
    expect(clampDiceCount(0)).toBe(1);
    expect(clampDiceCount(99)).toBe(20);
    expect(clampDiceCount(Number.NaN)).toBe(1);
    expect(clampDiceCount(3.9)).toBe(3);
  });
});

describe('detectRollEffects', () => {
  it('detects a legendary roll at the exact threshold', () => {
    expect(detectRollEffects(roll(3, 27, 2))).toEqual(['legendary']);
    expect(detectRollEffects(roll(3, 26, 2))).toEqual([]);
  });

  it('detects a fumble only with two or more dice', () => {
    expect(detectRollEffects(roll(2, 2, 0))).toEqual(['fumble']);
    expect(detectRollEffects(roll(1, 1, 0))).toEqual([]);
    expect(detectRollEffects(roll(3, 4, 0))).toEqual([]);
    expect(detectRollEffects(roll(20, 58, 0))).toEqual(['fumble']);
  });

  it('detects an explosion chain on its own', () => {
    expect(detectRollEffects(roll(10, 50, 6))).toEqual(['chain']);
    expect(detectRollEffects(roll(10, 50, 5))).toEqual([]);
  });

  it('can return legendary and chain at the same time', () => {
    expect(detectRollEffects(roll(2, 22, 3))).toEqual(['legendary', 'chain']);
  });

  it('ignores the modifier', () => {
    expect(detectRollEffects(roll(2, 8, 0, 99))).toEqual([]);
  });
});

describe('buildPreviewRoll', () => {
  const cases: Array<[RollEffectKind, number]> = [
    ['legendary', 1],
    ['legendary', 2],
    ['legendary', 5],
    ['legendary', 20],
    ['fumble', 1],
    ['fumble', 3],
    ['fumble', 20],
    ['chain', 1],
    ['chain', 3],
    ['chain', 6],
    ['chain', 20],
  ];

  it.each(cases)('builds a %s preview with %i dice', (kind, count) => {
    const preview = buildPreviewRoll(kind, count);

    expect(preview.initialCount).toBeGreaterThanOrEqual(1);
    expect(preview.initialCount).toBeLessThanOrEqual(20);
    expect(preview.count).toBe(preview.values.length);
    expect(preview.explosions).toBe(preview.values.length - preview.initialCount);
    expect(preview.values.every(value => value >= 1 && value <= 6)).toBe(true);
    expect(preview.diceTotal).toBe(preview.values.reduce((sum, value) => sum + value, 0));
    expect(preview.total).toBe(preview.diceTotal + preview.modifier);
    expect(detectRollEffects(preview)).toContain(kind);
  });

  it('keeps a chain preview below the legendary threshold', () => {
    const preview = buildPreviewRoll('chain', 10);
    const effects = detectRollEffects(preview);

    expect(effects).toEqual(['chain']);
    expect(preview.diceTotal).toBeLessThan(rollThresholds(10).legendary);
  });

  it('keeps a fumble preview with no explosions', () => {
    const preview = buildPreviewRoll('fumble', 5);

    expect(preview.explosions).toBe(0);
    expect(preview.values.every(value => value === 1)).toBe(true);
  });
});

describe('rollVisualEffect', () => {
  it('uses confetti for good rolls', () => {
    expect(rollVisualEffect(['legendary'])).toBe('confetti');
    expect(rollVisualEffect(['chain'])).toBe('confetti');
    expect(rollVisualEffect(['legendary', 'chain'])).toBe('confetti');
  });

  it('uses the storm for a fumble', () => {
    expect(rollVisualEffect(['fumble'])).toBe('storm');
    expect(rollVisualEffect(['fumble', 'chain'])).toBe('storm');
  });

  it('returns nothing for ordinary rolls', () => {
    expect(rollVisualEffect([])).toBeNull();
    expect(rollVisualEffect(undefined)).toBeNull();
  });
});
