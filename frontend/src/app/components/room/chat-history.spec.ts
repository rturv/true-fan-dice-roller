import { describe, expect, it } from 'vitest';
import { ChatHistoryStore, type StorageLike } from './chat-history';

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  raw(key: string): string | null {
    return this.getItem(key);
  }
}

describe('ChatHistoryStore', () => {
  it('ignores empty messages and consecutive duplicates', () => {
    const store = new ChatHistoryStore(new MemoryStorage());

    store.record('hola');
    store.record('   ');
    store.record('hola');
    store.record('/3d6+3');

    const first = store.previous('');
    const second = store.previous('');
    const third = store.previous('');

    expect(first).toBe('/3d6+3');
    expect(second).toBe('hola');
    expect(third).toBe('hola');
  });

  it('walks backwards and forwards restoring the draft', () => {
    const store = new ChatHistoryStore(new MemoryStorage());
    store.record('uno');
    store.record('dos');
    store.record('tres');

    expect(store.previous('borrador')).toBe('tres');
    expect(store.previous('')).toBe('dos');
    expect(store.previous('')).toBe('uno');
    expect(store.next()).toBe('dos');
    expect(store.next()).toBe('tres');
    expect(store.isBrowsing).toBe(true);
    expect(store.next()).toBe('borrador');
    expect(store.isBrowsing).toBe(false);
  });

  it('does nothing when there is no history', () => {
    const store = new ChatHistoryStore(new MemoryStorage());

    expect(store.previous('algo')).toBeNull();
    expect(store.next()).toBeNull();
  });

  it('persists the history and keeps only the newest entries', () => {
    const storage = new MemoryStorage();
    const store = new ChatHistoryStore(storage, 'test-key', 3);

    store.record('uno');
    store.record('dos');
    store.record('tres');
    store.record('cuatro');

    const reloaded = new ChatHistoryStore(storage, 'test-key', 3);
    expect(reloaded.size).toBe(3);
    expect(reloaded.previous('')).toBe('cuatro');
    expect(reloaded.previous('')).toBe('tres');
    expect(reloaded.previous('')).toBe('dos');
    expect(reloaded.previous('')).toBe('dos');
  });

  it('survives corrupted storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('bad', 'not-json');

    const store = new ChatHistoryStore(storage, 'bad');
    expect(store.size).toBe(0);
    expect(store.previous('')).toBeNull();
  });

  it('resets the navigation without clearing the entries', () => {
    const store = new ChatHistoryStore(new MemoryStorage());
    store.record('hola');

    expect(store.previous('')).toBe('hola');
    store.reset();

    expect(store.isBrowsing).toBe(false);
    expect(store.previous('')).toBe('hola');
  });
});
