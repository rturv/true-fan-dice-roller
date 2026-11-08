import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EASTER_EGG_EFFECTS,
  EASTER_EGG_STORAGE_KEY,
  nextEasterEgg,
  readEasterEggIndex,
  writeEasterEggIndex,
} from './rotation';

describe('easter egg rotation', () => {
  it('plays every effect in order and wraps around', () => {
    expect(nextEasterEgg(0)).toEqual({ effect: 'glitch-dice', next: 1 });
    expect(nextEasterEgg(1)).toEqual({ effect: 'giant-die', next: 2 });
    expect(nextEasterEgg(2)).toEqual({ effect: 'confetti-cards', next: 3 });
    expect(nextEasterEgg(3)).toEqual({ effect: 'banner', next: 0 });
    expect(nextEasterEgg(4)).toEqual({ effect: 'glitch-dice', next: 1 });
  });

  it('handles invalid indexes safely', () => {
    expect(nextEasterEgg(Number.NaN)).toEqual({ effect: 'glitch-dice', next: 1 });
    expect(nextEasterEgg(-1).effect).toBe('banner');
    expect(nextEasterEgg(10).effect).toBe('confetti-cards');
  });

  it('has four effects', () => {
    expect(EASTER_EGG_EFFECTS).toHaveLength(4);
  });
});

describe('easter egg storage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('defaults to zero when empty', () => {
    expect(readEasterEggIndex()).toBe(0);
  });

  it('persists the next index', () => {
    writeEasterEggIndex(2);
    expect(store.get(EASTER_EGG_STORAGE_KEY)).toBe('2');
    expect(readEasterEggIndex()).toBe(2);
  });
});
