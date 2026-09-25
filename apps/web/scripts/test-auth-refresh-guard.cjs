const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const file = path.join(__dirname, "../src/lib/supabase/refresh-guard.ts");
const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(
  "(function(module,exports,Response){" + js + "})(module, exports, Response)",
  { module: mod, exports: mod.exports, Response },
);
const {
  isRefreshTokenRequest,
  shouldAbandonRefresh,
  filterAuthCookies,
  createBrowserAuthGuard,
} = mod.exports;

test("refresh token grant is detected", () => {
  assert.equal(
    isRefreshTokenRequest("https://example.supabase.co/auth/v1/token?grant_type=refresh_token"),
    true,
  );
  assert.equal(
    isRefreshTokenRequest("https://example.supabase.co/auth/v1/token?grant_type=password"),
    false,
  );
});

test("dead refresh and rate limit stop retries", () => {
  assert.equal(shouldAbandonRefresh(400), true);
  assert.equal(shouldAbandonRefresh(429), true);
  assert.equal(shouldAbandonRefresh(500), false);
});

test("failed refresh hides the auth cookie and does not call the network again", async () => {
  const jar = [{ name: "sb-proj-auth-token.0", value: "stale" }, { name: "other", value: "1" }];
  const cleared = [];
  let fetches = 0;
  const guard = createBrowserAuthGuard({
    fetchImpl: async () => {
      fetches += 1;
      return new Response("{}", { status: 400 });
    },
    readCookies: () => jar,
    writeCookie: () => {},
    clearAuthCookie: (name) => {
      cleared.push(name);
    },
  });

  await guard.fetch("https://example.supabase.co/auth/v1/token?grant_type=refresh_token");
  assert.deepEqual(cleared, ["sb-proj-auth-token.0"]);
  assert.deepEqual(filterAuthCookies(jar, true), [{ name: "other", value: "1" }]);
  assert.deepEqual(guard.getAll(), [{ name: "other", value: "1" }]);

  await guard.fetch("https://example.supabase.co/auth/v1/token?grant_type=refresh_token");
  assert.equal(fetches, 1);

  const password = await guard.fetch("https://example.supabase.co/auth/v1/token?grant_type=password");
  assert.equal(password.status, 400);
  assert.equal(fetches, 2);
});

test("a live session cookie is still returned before a failure", () => {
  const jar = [{ name: "sb-proj-auth-token", value: "ok" }];
  const guard = createBrowserAuthGuard({
    fetchImpl: async () => new Response("{}", { status: 200 }),
    readCookies: () => jar,
    writeCookie: () => {},
    clearAuthCookie: () => {},
  });
  assert.deepEqual(guard.getAll(), jar);
});
