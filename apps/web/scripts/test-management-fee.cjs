const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");

const file = path.join(__dirname, "../src/lib/estimate-management-fee.ts");
const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext("(function(module,exports){" + js + "})")(mod, mod.exports);
const { calcManagementFeeAmount, normalizeFeeRate } = mod.exports;

test("management fee is selling total times company rate", () => {
  assert.equal(calcManagementFeeAmount({ sellingTotal: 10_000_000, rate: 0.02 }), 200_000);
});

test("management fee includes reserve cost in the base", () => {
  assert.equal(
    calcManagementFeeAmount({ sellingTotal: 10_000_000, reserveCost: 500_000, rate: 0.02 }),
    210_000,
  );
});

test("zero or missing rate yields no fee", () => {
  assert.equal(calcManagementFeeAmount({ sellingTotal: 10_000_000, rate: 0 }), 0);
  assert.equal(calcManagementFeeAmount({ sellingTotal: 10_000_000, rate: -1 }), 0);
});

test("percent-style rates above 1 are treated as percent", () => {
  assert.equal(calcManagementFeeAmount({ sellingTotal: 1_000_000, rate: 2 }), 20_000);
  assert.equal(normalizeFeeRate(2), 0.02);
  assert.equal(normalizeFeeRate(0.015), 0.015);
});
