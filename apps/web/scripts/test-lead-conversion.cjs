const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  const requireMock = name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  };
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { Date, Intl })(requireMock, mod, mod.exports);
  return mod.exports;
}

const dates = load('lib/tokyo-date.ts');
for (const [received, expected] of [
  ['2026-09-14T14:59:59Z', '2026-09-14'],
  ['2026-09-14T15:00:00Z', '2026-09-15'],
  ['2026-09-14T17:43:00Z', '2026-09-15'],
  ['2025-12-31T15:00:00Z', '2026-01-01'],
]) {
  test(`conversion preserves the received date in Japan: ${received}`, async () => {
    let created;
    const lead = { id: 'lead', name: 'QA', created_at: received, status: 'new' };
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
      from(table) {
        const query = {
          select() { return query; }, eq() { return query; },
          order() { return query; }, limit() { return query; },
          update() { return query; },
          single: async () => ({ data: table === 'profiles' ? { company_id: 'company' } : lead }),
          maybeSingle: async () => ({ data: { id: 'deal' } }),
        };
        return query;
      },
    };
    const actions = load('lib/actions/leads.ts', {
      'next/cache': { revalidatePath() {} },
      '@/lib/supabase/server': { createClient: async () => client },
      '@/lib/actions/customers': { createCustomer: async data => { created = data; return { id: 'customer' }; } },
      '@/lib/tokyo-date': dates,
    });
    const result = await actions.convertInboundLeadToCustomer('lead');
    assert.equal(created.inquiry_date, expected);
    assert.equal(result.customerId, 'customer');
    assert.equal(result.dealId, 'deal');
  });
}
