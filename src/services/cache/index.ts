/**
 * In-memory LRU cache with TTL support.
 * Used to memoize expensive API calls and analysis results.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

class LRUCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTtlMs: number;

  constructor(maxSize = 100, defaultTtlMs = 5 * 60_000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.hits++;
    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize) {
      // Evict LRU (first entry)
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      hits: 0,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  stats() {
    return { size: this.store.size, maxSize: this.maxSize };
  }
}

// Singleton caches for different data types
export const analysisCache = new LRUCache<unknown>(50, 10 * 60_000); // 10 min
export const marketDataCache = new LRUCache<unknown>(200, 2 * 60_000); // 2 min
export const companyCache = new LRUCache<unknown>(100, 30 * 60_000); // 30 min

export function makeCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.map(String).join(":")}`;
}
