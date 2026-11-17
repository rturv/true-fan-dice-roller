/**
 * Local-only chat input history, similar to a Linux shell: Up/Down walk through
 * the last things you sent, and the current draft is restored when you reach
 * the newest entry again.
 *
 * Nothing is sent to the backend; it is only stored in localStorage.
 */

export const CHAT_HISTORY_KEY = 'diced-chat-history';
export const CHAT_HISTORY_MAX = 50;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class ChatHistoryStore {
  private items: string[];
  private cursor: number | null = null;
  private draft = '';

  constructor(
    private readonly storage: StorageLike | null = defaultStorage(),
    private readonly key: string = CHAT_HISTORY_KEY,
    private readonly max: number = CHAT_HISTORY_MAX
  ) {
    this.items = this.read();
  }

  get size(): number {
    return this.items.length;
  }

  get isBrowsing(): boolean {
    return this.cursor !== null;
  }

  /** Adds a successfully sent message or command, ignoring blanks/duplicates. */
  record(text: string): void {
    const value = text.trim();
    this.reset();

    if (!value || this.items[this.items.length - 1] === value) return;

    this.items.push(value);
    if (this.items.length > this.max) {
      this.items = this.items.slice(this.items.length - this.max);
    }
    this.write();
  }

  /** Returns the previous entry or `null` when there is nothing to recall. */
  previous(current: string): string | null {
    if (this.items.length === 0) return null;

    if (this.cursor === null) {
      this.draft = current;
      this.cursor = this.items.length - 1;
    } else if (this.cursor > 0) {
      this.cursor -= 1;
    }

    return this.items[this.cursor];
  }

  /**
   * Returns the next entry, or the draft once the newest entry is reached.
   * Returns `null` only when we are not browsing the history.
   */
  next(): string | null {
    if (this.cursor === null) return null;

    if (this.cursor < this.items.length - 1) {
      this.cursor += 1;
      return this.items[this.cursor];
    }

    this.cursor = null;
    return this.draft;
  }

  /** Leaves history navigation without clearing the stored entries. */
  reset(): void {
    this.cursor = null;
    this.draft = '';
  }

  private read(): string[] {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim())
        .slice(-this.max);
    } catch {
      return [];
    }
  }

  private write(): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.items));
    } catch {
      // Private mode or storage disabled: history only lives in memory.
    }
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
