/**
 * 同一サーバーインスタンス内の短命 TTL キャッシュ。
 * Netlify のウォームインスタンスでは画面遷移の繰り返しが速くなる。
 * 会社 ID で区切るので、他テナントへは漏れない。
 */

import { AsyncReadCache } from "./async-read-cache";

const store = new AsyncReadCache();
export const ttlGet = <T>(key: string) => store.get<T>(key);
export const ttlSet = <T>(key: string, value: T, ttlMs: number) => store.set(key, value, ttlMs);
export const ttlInvalidatePrefix = (prefix: string) => store.invalidatePrefix(prefix);

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
  return store.read(companyCacheKey(companyId, part), ttlMs, fn);
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
