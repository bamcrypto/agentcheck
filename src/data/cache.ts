interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Simple in-memory TTL cache.
 */
export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Remove all expired entries. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// TTL constants (milliseconds)
export const TTL = {
  TOKEN_PRICE: 5 * 60 * 1000,        // 5 minutes
  AGENT_ANALYSIS: 15 * 60 * 1000,    // 15 minutes
  SCAN_RESULTS: 60 * 60 * 1000,      // 1 hour
  HISTORICAL: Infinity,               // never expires
} as const;

// Global cache instance
export const cache = new Cache();
