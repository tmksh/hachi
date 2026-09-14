/** Bounded TTL cache with in-flight deduplication and invalidation-safe writes. */
export class AsyncReadCache {
  private entries = new Map<string, { value: unknown; expires: number }>();
  private pending = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries = 500, private readonly now = Date.now) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) { this.entries.delete(key); return undefined; }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    if (ttlMs <= 0) return;
    const now = this.now();
    for (const [name, entry] of this.entries) if (entry.expires <= now) this.entries.delete(name);
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expires: now + ttlMs });
  }

  invalidatePrefix(prefix: string) {
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
    // Detached reads may resolve for their original caller, but must not refill the cache.
    for (const key of this.pending.keys()) if (key.startsWith(prefix)) this.pending.delete(key);
  }

  read<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return Promise.resolve(hit);
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const promise = Promise.resolve().then(load).then((value) => {
      if (this.pending.get(key) === promise) this.set(key, value, ttlMs);
      return value;
    }).finally(() => {
      if (this.pending.get(key) === promise) this.pending.delete(key);
    });
    this.pending.set(key, promise);
    return promise;
  }
}
