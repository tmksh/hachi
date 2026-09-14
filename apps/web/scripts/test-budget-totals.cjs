const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const vm=require('node:vm');
const file=path.join(__dirname,'../src/lib/budget-totals.ts');
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};vm.runInNewContext('(function(module,exports){'+js+'})',{})(mod,mod.exports);
const {budgetPlanTotals}=mod.exports;
test('reproduced budget case: 1m sales, 500k direct costs, 200k indirect expenses has 500k gross profit',()=>{
 const actual=budgetPlanTotals([{category:'revenue',amount:1000000},{category:'direct_cost',amount:400000},{category:'direct_cost',amount:100000},{category:'indirect_cost',amount:200000}]);
 assert.equal(actual.revenue,1000000);assert.equal(actual.cost,500000);assert.equal(actual.grossProfit,500000);
});
test('changing indirect expenses never changes construction gross profit',()=>{
 for(const expense of [0,200000,2000000]){
  const actual=budgetPlanTotals([{category:'revenue',amount:1000000},{category:'direct_cost',amount:500000},{category:'indirect_cost',amount:expense}]);
  assert.equal(actual.grossProfit,500000);
 }
});
test('multiple revenue entries, loss-making budgets, and empty budgets',()=>{
 const actual=budgetPlanTotals([{category:'revenue',amount:300000},{category:'revenue',amount:200000},{category:'direct_cost',amount:600000}]);
 assert.equal(actual.revenue,500000);assert.equal(actual.grossProfit,-100000);
 const empty=budgetPlanTotals([]);assert.equal(empty.revenue,0);assert.equal(empty.cost,0);assert.equal(empty.grossProfit,0);
});
