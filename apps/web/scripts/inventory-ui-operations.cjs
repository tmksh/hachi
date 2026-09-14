/** Static coverage inventory. Candidates are never counted as passing tests. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),src=path.join(root,'src');
const out=path.resolve(process.argv[2]||path.join(root,'../../../outputs'));
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.tsx?$/.test(p))files.push(p);}}walk(src);
const modules=new Map();const rel=p=>path.relative(root,p).split(path.sep).join('/');
function resolve(file,spec){const base=spec.startsWith('@/')?path.join(src,spec.slice(2)):spec.startsWith('.')?path.resolve(path.dirname(file),spec):null;if(!base)return null;return ['', '.tsx','.ts','/index.tsx','/index.ts'].map(ext=>base+ext).find(p=>files.includes(p))||null;}
const squish=s=>s.replace(/\s+/g,' ').trim();
for(const file of files){
 const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),deps=[],controls=[],actions=[];
 const line=node=>tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1;
 function visit(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){const p=resolve(file,node.moduleSpecifier.text);if(p)deps.push(p);}
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){const p=resolve(file,node.arguments[0].text);if(p)deps.push(p);}
  if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
   const opening=ts.isJsxElement(node)?node.openingElement:node,tag=opening.tagName.getText(tree),attrs=opening.attributes.properties;
   const handlers=attrs.filter(a=>ts.isJsxAttribute(a)&&/^(onClick|onSubmit|onChange|onValueChange|onCheckedChange|onBlur|onKeyDown|onDrop|action)$/.test(a.name.getText(tree))).map(a=>({event:a.name.getText(tree),expression:squish(a.initializer?.getText(tree)||'').slice(0,180)}));
   const interesting=handlers.length||/^(Button|button|Link|a|Input|input|Select|Checkbox|Switch|TabsTrigger|DialogTrigger|DropdownMenuItem|Textarea|textarea|form)$/.test(tag);
   if(interesting&&!file.includes('/components/ui/')){
    const attr=name=>{const a=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)===name);return a?.initializer?squish(a.initializer.getText(tree)).slice(0,160):null;};
    let label=attr('aria-label')||attr('title')||attr('placeholder')||attr('name');
    if(!label&&ts.isJsxElement(node))label=squish(node.children.filter(ts.isJsxText).map(n=>n.text).join(' '));
    controls.push({id:`${rel(file)}:${line(node)}:${tag}`,file:rel(file),line:line(node),tag,label:label||'(動的ラベル／要画面確認)',href:attr('href'),value:attr('value'),handlers,status:'未実施'});
   }
  }
  if(file.includes('/lib/actions/')&&ts.isFunctionDeclaration(node)&&node.name&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
   const body=node.body?.getText(tree)||'';
   actions.push({name:node.name.text,file:rel(file),line:line(node),directWrites:/\.(insert|update|upsert|delete)\s*\(/.test(body),externalCandidate:/dispatchWebhook|sendEmail|resend\.|fetch\(|cloudsign|createGoogle|notifySales|uploadToStorage|\.storage\./i.test(body),status:'未実施'});
  }
  ts.forEachChild(node,visit);
 }visit(tree);modules.set(file,{deps,controls,actions});
}
function reachable(entry){const seen=new Set();function go(f){if(seen.has(f))return;seen.add(f);for(const next of modules.get(f)?.deps||[])go(next);}go(entry);return [...seen];}
const pages=files.filter(p=>p.endsWith('/page.tsx')&&p.includes('/app/'));
const routes=pages.map(file=>{
 const route='/'+path.relative(path.join(src,'app'),path.dirname(file)).split(path.sep).filter(p=>!/^\(.+\)$/.test(p)).join('/');
 const reach=reachable(file),controls=reach.flatMap(p=>modules.get(p).controls);
 return {route,file:rel(file),candidateControlIds:[...new Set(controls.map(c=>c.id))],status:'未実施',note:'静的依存から抽出した操作候補。条件付き表示や未使用exportを含むため画面照合が必要。'};
}).sort((a,b)=>a.route.localeCompare(b.route));
const shared=['src/components/layout/sidebar.tsx','src/components/layout/mobile-nav.tsx','src/components/layout/admin-sidebar.tsx'];
const controlMap=new Map([...modules.values()].flatMap(m=>m.controls).map(c=>[c.id,c]));
const report={generatedAt:new Date().toISOString(),method:'TypeScript AST/import dependency inventory, not runtime coverage',routes,sharedControls:[...controlMap.values()].filter(c=>shared.includes(c.file)),controls:[...controlMap.values()],serverActions:[...modules.values()].flatMap(m=>m.actions)};
const evidenceFiles=['full-ui-qa-results.json','isolated-ui-qa-results.json'];
const executedCases=[];
report.runtimeEvidence=[];
for(const file of evidenceFiles){
 const evidenceFile=path.join(out,file);
 if(!fs.existsSync(evidenceFile))continue;
 const evidence=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
 report.runtimeEvidence.push({file,status:evidence.status,date:evidence.date});
 executedCases.push(...evidence.cases);
}
for(const route of routes){
 route.executedCaseIds=[...new Set(executedCases.filter(c=>c.route.split('?')[0]===route.route).map(c=>c.id))];
 if(route.executedCaseIds.length)route.status=`一部実施（${route.executedCaseIds.length}ケース・全操作未完了）`;
}
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'full-ui-operation-inventory.json'),JSON.stringify(report,null,2));
const md=['# 全画面・全操作の検証台帳','',`更新: ${report.generatedAt}`,'','この一覧はソースから抽出した操作候補です。未実施を合格として数えません。タブ・ダイアログ・権限・データ条件で現れる操作は実画面と照合して具体的なケースへ展開します。','',`画面入口 ${routes.length}、操作候補 ${controlMap.size}、公開サーバー処理 ${report.serverActions.length}。候補には入力欄や同じ共通コンポーネント、未使用exportも含まれます。`,'','## 実施条件','','- 本番と分離されたSupabase/Auth/Storageを使用し、合成データとテストユーザーで保存・削除・承認を行う。','- 機能ごとに正常系、必須未入力、境界値、キャンセル、保存後の再訪、二重操作、権限違いを確認する。','- 外部送信は専用テスト宛先・サンドボックスを使い、実送信と代替サーバー検証を区別する。','- 各ケースに操作、期待結果、実測結果、証跡、環境、状態を記録する。','- 既存のHTTP成功や過去のOKを、今回の操作テストの合格へ引き継がない。','','## 画面一覧','','| 画面 | 静的に到達する操作候補 | 状態 |','|---|---:|---|',...routes.map(r=>`| \`${r.route}\` | ${r.candidateControlIds.length} | ${r.status} |`),'','個々の操作のソース位置とイベントは `full-ui-operation-inventory.json` に保存しています。',''];
fs.writeFileSync(path.join(out,'full-ui-operation-inventory.md'),md.join('\n'));
console.log(JSON.stringify({routes:routes.length,controlCandidates:controlMap.size,exportedActions:report.serverActions.length,directWriteActions:report.serverActions.filter(a=>a.directWrites).length}));
