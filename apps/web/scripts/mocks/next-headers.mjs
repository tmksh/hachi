import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function cookies() {
  const store = globalThis.__testCookies;
  return {
    getAll() {
      if (!store) return [];
      return [...store.entries()].map(([name, value]) => ({ name, value }));
    },
    get(name) {
      const v = store?.get(name);
      return v ? { name, value: v } : undefined;
    },
    set(name, value, _options) {
      store?.set(name, value);
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) {
        store?.set(name, value);
      }
    },
  };
}
