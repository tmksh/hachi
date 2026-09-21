/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test entry point. */
// Real PDF rendering regression: whiteout, stamps and FreeText must survive
// preview/print, while AcroForm widgets must not duplicate our HTML fields.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const { createCanvas } = require('@napi-rs/canvas');
const mod = new Module(__filename);
mod._compile(ts.transpileModule(fs.readFileSync('src/lib/pdf-form-render.ts','utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS},
}).outputText, __filename);
const { PDF_FORM_ANNOTATION_MODE } = mod.exports;
const output = process.env.PDF_UPDATE_OUTPUT;
function coloredPixels(canvas, rect, scale, color) {
  const [x,y,w,h] = rect.map(n=>Math.round(n*scale));
  const data=canvas.getContext('2d').getImageData(x,y,w,h).data;
  let count=0;
  for(let i=0;i<data.length;i+=4) if(color(data[i],data[i+1],data[i+2])) count++;
  return count;
}
test('updated PDF keeps whiteout/stamp/FreeText on every preview and print page, excluding widgets', async () => {
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 assert.equal(PDF_FORM_ANNOTATION_MODE,pdfjs.AnnotationMode.ENABLE_FORMS);
 const docs=[];
 try {
  for(const version of ['original','corrected']) {
   const doc=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(`scripts/fixtures/pdf-updates/${version}.pdf`)),cMapPacked:true,cMapUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'cmaps')+path.sep,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts')+path.sep}).promise;
   docs.push(doc);
   for(let p=1;p<=doc.numPages;p++) for(const scale of [1,2]) {
    const page=await doc.getPage(p);
    for(const mode of [0,1,PDF_FORM_ANNOTATION_MODE]) {
     const vp=page.getViewport({scale}),canvas=createCanvas(vp.width,vp.height);
     await page.render({canvasContext:canvas.getContext('2d'),viewport:vp,annotationMode:mode}).promise;
     const ink=coloredPixels(canvas,[330,170,118,25],scale,(r,g,b)=>r<180&&g<180&&b<180);
     if(version==='original'||mode===0) assert.ok(ink>15,'old date text must reproduce');
     else assert.equal(ink,0,'whiteout must hide old date text');
     if(version==='corrected') {
      const red=coloredPixels(canvas,[165,235,40,20],scale,(r,g,b)=>r>200&&g<40&&b<40);
      const blue=coloredPixels(canvas,[165,375,40,20],scale,(r,g,b)=>b>200&&r<40&&g<40);
      const green=coloredPixels(canvas,[195,305,40,20],scale,(r,g,b)=>g>200&&r<40&&b<40);
      assert.equal(red>0,mode!==0,'stamp must survive');
      assert.equal(blue>0,mode!==0,'FreeText appearance must survive');
      assert.equal(green>0,mode===1,'interactive widget must not be duplicated');
     }
     if(output&&scale===1) {
      fs.mkdirSync(output,{recursive:true});
      fs.writeFileSync(path.join(output,`${version}-page-${p}-mode-${mode}.png`),canvas.toBuffer('image/png'));
     }
    }
   }
  }
 } finally { await Promise.all(docs.map(doc=>doc.destroy())); }
});
