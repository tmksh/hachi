/**
 * 同一サーバーインスタンス内の短命 TTL キャッシュ。
 * Netlify のウォームインスタンスでは画面遷移の繰り返しが速くなる。
 * 会社 ID で区切るので、他テナントへは漏れない。
 */

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

function evictExpired(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
    if (store.size < MAX_ENTRIES * 0.8) break;
  }
  if (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
}

export function ttlGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function ttlSet<T>(key: string, value: T, ttlMs: number) {
  const now = Date.now();
  evictExpired(now);
  store.set(key, { value, expires: now + ttlMs });
}

export function ttlInvalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function companyCacheKey(companyId: string, part: string) {
  return `c:${companyId}:${part}`;
}

export function invalidateCompanyCache(companyId: string) {
  ttlInvalidatePrefix(`c:${companyId}:`);
}

export async function cachedCompanyRead<T>(
  companyId: string,
  part: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const key = companyCacheKey(companyId, part);
  const hit = ttlGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  ttlSet(key, value, ttlMs);
  return value;
}

export const CACHE_TTL = {
  list: 120_000,
  dashboard: 60_000,
  counts: 120_000,
  profiles: 300_000,
  bi: 120_000,
  settings: 300_000,
  locations: 300_000,
  systemSeed: 3_600_000,
  unread: 30_000,
} as const;
