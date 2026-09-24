const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const file = path.join(__dirname, "../src/lib/auth-login-error.ts");
const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext("(function(module,exports){" + js + "})")(mod, mod.exports);
const { isLoginRateLimitError, loginErrorToast } = mod.exports;

test("429 is treated as rate limit", () => {
  assert.equal(isLoginRateLimitError({ status: 429, message: "Too Many Requests" }), true);
  const toast = loginErrorToast({ status: 429, message: "Request rate limit reached" });
  assert.equal(toast.title, "ログイン試行が多すぎます");
});

test("rate_limit code is treated as rate limit", () => {
  assert.equal(isLoginRateLimitError({ code: "over_request_rate_limit" }), true);
});

test("wrong password stays a credential error", () => {
  const toast = loginErrorToast({ status: 400, message: "Invalid login credentials" });
  assert.equal(toast.title, "ログインに失敗しました");
  assert.match(toast.description, /パスワード/);
});
