/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test entry point. */
// Emit the application's actual print HTML for each synthetic fixture. No browser emulation.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const assert = require('node:assert/strict');
function load(file) {
  file = path.resolve(file);
  const mod = new Module(file);
  mod.require = (name) => name.startsWith('./') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, file);
  return mod.exports;
}
const api = load('src/lib/pdf-form-template.ts');
const {PDF_FORM_ANNOTATION_MODE} = load('src/lib/pdf-form-render.ts');
const {pdfFieldOverlayHtml,pdfPrintDocumentHtml} = load('src/lib/pdf-form-print.ts');
const {pdfMappingIssues} = load('src/lib/pdf-form-mapping.ts');
const {slotsFromPdfPage} = load('src/lib/pdf-form-snap.ts');
(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const {createCanvas} = require('@napi-rs/canvas');
  const out = path.resolve(process.argv[2] || '../../../work/pdf-pattern-check'); fs.mkdirSync(out,{recursive:true});
  const specs=JSON.parse(fs.readFileSync('scripts/fixtures/pdf-patterns/patterns.json','utf8'));
  const results=[];
  for(const spec of specs) {
    const {template,context}=spec;
    assert.deepEqual(api.validatePdfTemplate(template),[]);
    const value=f=>api.pdfFieldInputValue(f,context,{});
    assert.deepEqual(api.validatePdfFieldInputs(template.fields,value),[]);
    const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(`scripts/fixtures/pdf-patterns/${spec.key}.pdf`)),standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep}).promise;
    const pages=[],slots=[];
    for(let i=0;i<doc.numPages;i++) {
      const page=await doc.getPage(i+1), vp=page.getViewport({scale:1}), large=page.getViewport({scale:2});
      const canvas=createCanvas(Math.ceil(large.width),Math.ceil(large.height));
      await page.render({canvasContext:canvas.getContext('2d'),viewport:large,annotationMode:PDF_FORM_ANNOTATION_MODE}).promise;
      slots.push(await slotsFromPdfPage(page));
      pages.push({width:vp.width,height:vp.height,image:canvas.toDataURL('image/jpeg',.92),overlays:api.pdfFieldsForPage(template.fields,i).map(f=>pdfFieldOverlayHtml(f,api.formatPdfFieldValue(f,value(f)),vp.width,vp.width,vp.height)).join('')});
    }
    assert.deepEqual(pdfMappingIssues(template.fields,slots),[],`${spec.key}: false-positive mapping detection`);
    fs.writeFileSync(path.join(out,`${spec.key}.html`),pdfPrintDocumentHtml(template.name,pages));
    results.push({key:spec.key,name:template.name,pages:template.pageSizes,fields:template.fields.map(f=>({id:f.id,page:f.page,value:api.formatPdfFieldValue(f,value(f))}))});
    await doc.destroy();console.log(`${spec.key}: ${pages.length} pages, ${template.fields.length} fields PASS`);
  }
  fs.writeFileSync(path.join(out,'expected.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
