const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
function load(file) {
  file = path.resolve(file);
  const mod = new Module(file);
  mod.require = (name) => name.startsWith("./") ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return mod.exports;
}
const api = load('src/lib/pdf-form-template.ts');
const { pdfMappingIssues } = load('src/lib/pdf-form-mapping.ts');
const field = (id, binding, options = {}) => ({ id, ...api.newFieldDefaults('text', 0), label: id, binding, ...options });
const ctx = { constructionTitle: '山田邸 改修工事', orderAmount: 12000000, startDate: '2026-09-25', customer: { company_name: 'サンプル株式会社' } };
const slot = { id: 'construction_title', kind: 'construction_title', x: .2, y: .3, w: .25, h: .03 };
test('No.106: legacy numeric title is diagnosed and explicitly repaired without moving the field', () => {
  const legacy = field('legacy', 'manual', { type: 'number', label: '数値', text: '111111', xPct: .2, yPct: .3, wPct: .25, hPct: .03 });
  assert.equal(pdfMappingIssues([legacy], [[slot]])[0].suggestedBinding, 'construction_title');
  const repaired = api.changeFieldBinding(legacy, 'construction_title');
  assert.equal(repaired.id, legacy.id);
  assert.equal(repaired.xPct, legacy.xPct);
  assert.equal(repaired.yPct, legacy.yPct);
  assert.equal(repaired.type, 'text');
  assert.equal(repaired.text, '');
  assert.equal(api.resolveFieldValue(repaired, ctx), ctx.constructionTitle);
  assert.deepEqual(pdfMappingIssues([repaired], [[slot]]), []);
});
test('editing a numeric field never changes a name or company, including identical labels', () => {
  const title = field('title', 'construction_title', { label: '同じラベル' });
  const company = field('company', 'customer_company_name');
  const quantity = field('quantity', 'manual', { type: 'number', label: '同じラベル', yPct: .7 });
  const edits = { quantity: '111111' };
  assert.equal(api.pdfFieldInputValue(title, ctx, edits), ctx.constructionTitle);
  assert.equal(api.pdfFieldInputValue(company, ctx, edits), ctx.customer.company_name);
  assert.equal(api.pdfFieldInputValue(quantity, ctx, edits), '111111');
  assert.deepEqual(pdfMappingIssues([quantity], [[slot]]), []);
});
test('explicit positions survive serialization, multiple pages, repeated bindings, and empty values', () => {
  const fields = [field('first', 'construction_title', { xPct: .65, yPct: .6 }), field('second', 'construction_title', { page: 1, xPct: .1, yPct: .2 }), field('blank', 'manual')];
  const saved = JSON.parse(JSON.stringify(fields));
  assert.deepEqual(api.pdfFieldsForPage(saved, 0), [fields[0], fields[2]]);
  assert.deepEqual(api.pdfFieldsForPage(saved, 1), [fields[1]]);
  assert.equal(api.pdfFieldInputValue(fields[2], ctx, { blank: '' }), '');
});
test('required, valid numbers including zero, and valid calendar dates are enforced', () => {
  const n = field('number', 'manual', { type: 'number', required: true });
  const d = field('date', 'manual', { type: 'date' });
  assert.equal(api.validatePdfFieldInputs([n], () => '').length, 1);
  assert.equal(api.validatePdfFieldInputs([n], () => '0').length, 0);
  assert.equal(api.validatePdfFieldInputs([n], () => 'abc').length, 1);
  assert.equal(api.validatePdfFieldInputs([d], () => '2026-02-30').length, 1);
  assert.equal(api.validatePdfFieldInputs([d], () => '2028-02-29').length, 0);
});
test('fixed and read-only fields cannot be overridden; live data loads until the user edits a field', () => {
  const title = field('title', 'construction_title');
  assert.equal(api.pdfFieldInputValue(title, {}, {}), '');
  assert.equal(api.pdfFieldInputValue(title, ctx, {}), ctx.constructionTitle);
  assert.equal(api.pdfFieldInputValue(title, ctx, { title: '' }), '');
  assert.equal(api.pdfFieldInputValue({ ...title, editable: false }, ctx, { title: '111111' }), ctx.constructionTitle);
  assert.equal(api.pdfFieldInputValue({ ...title, type: 'fixed', text: '固定文' }, ctx, { title: '上書き' }), '固定文');
});
test('currency, grouped numbers, dates and unchecked checkboxes use one display resolver', () => {
  assert.equal(api.formatPdfFieldValue(field('amount','order_amount',{type:'number'}), '¥12,000,000'), '¥12,000,000');
  assert.equal(api.formatPdfFieldValue(field('n','manual',{type:'number',numberFormat:'grouped'}), '111111'), '111,111');
  assert.equal(api.formatPdfFieldValue(field('d','start_date',{type:'date',dateFormat:'japanese'}), '2026/09/25'), '2026年9月25日');
  assert.equal(api.formatPdfFieldValue(field('c','manual',{type:'checkbox'}), ''), '');
  assert.equal(api.formatPdfFieldValue(field('c','manual',{type:'checkbox'}), '1'), '✓');
});
test('field configuration rejects duplicate IDs and incompatible types and keeps old defaults', () => {
  const f = field('title', 'construction_title');
  const template = { pageCount: 1, fields: [f] };
  assert.deepEqual(api.validatePdfTemplate(template), []);
  assert.ok(api.validatePdfTemplate({ ...template, fields: [f, f] }).length);
  assert.ok(api.validatePdfTemplate({ ...template, fields: [{...f, type:'number'}] }).length);
  assert.ok(api.validatePdfTemplate({ ...template, fields: [field('custom','customer_custom')] }).length);
  const converted = api.changeFieldType({...f, text:'古い既定値'}, 'number');
  assert.equal(converted.binding, 'manual');
  assert.equal(converted.text, '');
  assert.equal(api.changeFieldType({...f, editable:false}, 'number').editable, false);
  assert.equal(api.changeFieldType({...f, type:'fixed', editable:false}, 'text').editable, true);
});
test('actual multipage PDF: a period label on another row does not shrink the title slot', async () => {
  const { slotsFromPdfPage } = load('src/lib/pdf-form-snap.ts');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('scripts/fixtures/pdf-builder.pdf')), standardFontDataUrl: path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep }).promise;
  try {
    const slots = await slotsFromPdfPage(await pdf.getPage(1));
    const legacy = field('legacy','manual',{type:'number',xPct:156/595,yPct:180/842,wPct:379/595,hPct:26/842});
    assert.equal(pdf.numPages, 2);
    assert.equal(pdfMappingIssues([legacy],[slots]).length,1);
    const fixed = api.changeFieldBinding(legacy,'construction_title');
    assert.deepEqual(pdfMappingIssues([fixed],[slots]),[]);
  } finally { await pdf.destroy(); }
});

const { pdfFieldOverlayHtml } = load('src/lib/pdf-form-print.ts');
test('print preserves each exact position, blanks clear sample text, and content is escaped', () => {
  const title = field('title','construction_title',{xPct:.27,yPct:.2});
  const value = api.formatPdfFieldValue(title, api.pdfFieldInputValue(title,ctx,{quantity:'111111'}));
  const html = pdfFieldOverlayHtml(title,value,595,595,842);
  assert.ok(html.includes('left:27.000%;top:20.000%'));
  assert.ok(html.includes(ctx.constructionTitle));
  assert.ok(!html.replace(/<[^>]*>/g, '').includes('111111'));
  assert.ok(pdfFieldOverlayHtml(field('blank','manual'),'',595,595,842).includes('background:#fff'));
  assert.ok(pdfFieldOverlayHtml(title,'<script>alert(1)</script>',595,595,842).includes('&lt;script&gt;'));
});
test('a bound amount in a company box is diagnosed without changing its data source', () => {
  const companySlot={...slot,id:'company_orderer',kind:'company_orderer'};
  const amountSlot={...slot,id:'subtotal',kind:'subtotal',y:.8};
  const amount=field('amount','order_amount',{type:'number',xPct:.2,yPct:.3,wPct:.25,hPct:.03});
  const issue=pdfMappingIssues([amount],[[companySlot,amountSlot]])[0];
  assert.equal(issue.suggestedBinding,undefined);
  assert.equal(issue.suggestedSlot,amountSlot);
  assert.equal(amount.binding,'order_amount');
});

test('multiline notes use the available height instead of shrinking as one long line', () => {
  const text = '日本語の文章と English words を含む長文です。'.repeat(5)+'\n改行後も同じ枠内に表示します。';
  const font = api.overlayFontSizePx(12,842,610,78,490,text,true);
  assert.ok(font > 8 && font <= 12*610/842);
  assert.ok(api.overlayFontSizePx(12,595,595,20,100,'長文'.repeat(60),true) < 12);
});

test('print document preserves physical page sizes for portrait, landscape and A5, with no extra last page', () => {
  const {pdfPrintDocumentHtml}=load('src/lib/pdf-form-print.ts');
  const html=pdfPrintDocumentHtml('mixed',[{width:595.276,height:841.89,image:'data:image/jpeg;base64,AA==',overlays:''},{width:841.89,height:595.276,image:'data:image/jpeg;base64,AA==',overlays:''},{width:419.528,height:595.276,image:'data:image/jpeg;base64,AA==',overlays:''}]);
  assert.ok(html.includes('@page pdfPage1 { size:841.89pt 595.276pt;'));
  assert.ok(html.includes('page:pdfPage2;width:419.528pt;height:595.276pt'));
  assert.ok(html.includes('.sheet:last-child { break-after:auto; }'));
});

test('all six fixture definitions validate and keep all 65 distinct fields after saving', () => {
  const patterns=JSON.parse(fs.readFileSync('scripts/fixtures/pdf-patterns/patterns.json','utf8'));
  assert.equal(patterns.length,6);
  assert.equal(patterns.reduce((n,p)=>n+p.template.fields.length,0),65);
  for(const p of patterns) {
    const saved=JSON.parse(JSON.stringify(p.template));
    assert.deepEqual(api.validatePdfTemplate(saved),[],p.key);
    assert.deepEqual(saved.fields,p.template.fields);
    assert.deepEqual(api.validatePdfFieldInputs(saved.fields,f=>api.pdfFieldInputValue(f,p.context,{})),[],p.key);
  }
});
