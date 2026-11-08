/**
 * Easter egg rotation: each invocation of `/rtur` or `/ramorco` plays the next
 * effect in the list and wraps around to the first one.
 */

export const EASTER_EGG_EFFECTS = [
  'glitch-dice',
  'giant-die',
  'confetti-cards',
  'banner',
] as const;

export type EasterEggEffect = (typeof EASTER_EGG_EFFECTS)[number];

export const EASTER_EGG_STORAGE_KEY = 'diced-easter-egg';

/** Returns the effect for `current` and the index to store for the next call. */
export function nextEasterEgg(current: number): { effect: EasterEggEffect; next: number } {
  const size = EASTER_EGG_EFFECTS.length;
  const index = Number.isFinite(current) ? ((Math.trunc(current) % size) + size) % size : 0;
  return { effect: EASTER_EGG_EFFECTS[index], next: (index + 1) % size };
}

export function readEasterEggIndex(): number {
  try {
    const stored = localStorage.getItem(EASTER_EGG_STORAGE_KEY);
    return stored ? Number(stored) || 0 : 0;
  } catch {
    return 0;
  }
}

export function writeEasterEggIndex(next: number): void {
  try {
    localStorage.setItem(EASTER_EGG_STORAGE_KEY, String(next));
  } catch {
    // Private mode or storage disabled: the rotation restarts each session.
  }
}
