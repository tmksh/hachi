/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test entry point. */
// Offline behavior regressions. No credentials, network, or production mutations.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
function load(file, extra={}) {
 const exports={}; const code=ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require,Buffer,URLSearchParams,FormData,Blob,...extra}); return exports;
}
const {threadMatchesFolder:matches}=load('src/lib/mail-folders.ts');
test('inbox excludes filed messages and spam; flags remain cross-folder except spam',()=>{
 assert.equal(matches({},'inbox'),true);
 assert.equal(matches({folder_id:'invoice'},'inbox'),false);
 assert.equal(matches({folder_id:'invoice',is_flagged:true},'flagged'),true);
 assert.equal(matches({folder_id:'invoice'},'invoice'),true);
 for(const folder of ['inbox','invoice','starred','flagged']) assert.equal(matches({is_spam:true,folder_id:'invoice',is_starred:true,is_flagged:true},folder),false);
 assert.equal(matches({is_spam:true},'spam'),true);
 assert.equal(matches({is_spam:false},'spam'),false);
});
test('restoring spam to inbox retains its flag without showing in spam',()=>{
 const restored={is_spam:false,folder_id:null,is_flagged:true};
 assert.equal(matches(restored,'spam'),false);
 assert.equal(matches(restored,'inbox'),true);
 assert.equal(matches(restored,'flagged'),true);
});
test('unconfigured CloudSign never reports a sent document or makes a network call',async()=>{
 const {sendToCloudSign}=load('src/lib/integrations/cloudsign.ts',{fetch:()=>{throw Error('network must not be called');}});
 for(const config of [{enabled:false},{enabled:false,api_key:'test-only'},{enabled:true}]) await assert.rejects(sendToCloudSign(config,{title:'test',signers:[]}),/未設定/);
});
test('mail actions reject another user’s folder and missing thread without claiming success',async()=>{
 let updated=false;
 const rows={email_accounts:[{id:'own-account'}],email_folders:null,email_threads:null};
 const supabase={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from(table){
  const chain={select(){return chain;},eq(){return chain;},in(){return chain;},update(){updated=true;return chain;},maybeSingle:async()=>({data:rows[table],error:null}),then(resolve){return Promise.resolve({data:rows[table],error:null}).then(resolve);}};return chain;
 }};
 const req=id=> id==='@/lib/supabase/server'?{createClient:async()=>supabase}:id==='@/lib/action-result'?{actionFail:(_,error)=>({ok:false,error}),actionOk:data=>({ok:true,...data})}:id==='next/cache'?{revalidatePath(){}}:id==='@/lib/mail-reply'?{}:require(id);
 const actions=load('src/lib/actions/mail.ts',{require:req});
 assert.equal((await actions.moveThreadToFolder('own-thread','foreign-folder')).ok,false);
 assert.equal(updated,false);
 assert.equal((await actions.setThreadSpam('missing-thread',true)).ok,false);
 rows.email_threads={id:'own-thread'};
 assert.equal((await actions.setThreadSpam('own-thread',true)).ok,true);
});

test('procurement file URLs never sign another company’s storage path',async()=>{
 const signed=[];
 const supabase={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from(){const q={select(){return q;},eq(){return q;},single:async()=>({data:{company_id:'company-a',role:'hq_admin'}})};return q;}};
 const req=id=> id==='@/lib/supabase/server'?{createClient:async()=>supabase}:id==='@/lib/action-result'?{actionFail:(_,error)=>({ok:false,error}),actionOk:data=>({ok:true,...data})}:id==='@/lib/storage-server'?{getSignedStorageUrlAsAdmin:async(_,path)=>{signed.push(path);return 'https://example.test/signed';}}:id.startsWith('@/')||id==='next/headers'?{}:require(id);
 const actions=load('src/lib/actions/procurement.ts',{require:req});
 assert.equal(actions.updateOrderProcurement,undefined,'generic patch helper must not be exposed as a server action');
 for(const path of ['procurement/company-b/order/file.pdf','procurement/company-a/../company-b/file.pdf']) assert.equal((await actions.getProcurementFileUrl(path)).ok,false);
 assert.equal(signed.length,0);
 assert.equal((await actions.getProcurementFileUrl('procurement/company-a/order/file.pdf')).ok,true);
 assert.equal(signed.length,1);
});

test('invoice confirmation does not overwrite a concurrent approval or return',async()=>{
 let expected;
 const supabase={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from(){
  let updating=false;
  const q={select(){return q;},eq(){return q;},in(key,values){if(key==='ledger_status') expected=values;return q;},update(){updating=true;return q;},single:async()=>({data:{company_id:'company-a',role:'hq_admin'}}),maybeSingle:async()=>({data:updating?null:{ledger_status:'invoice_received'},error:null})};return q;
 }};
 const req=id=> id==='@/lib/supabase/server'?{createClient:async()=>supabase}:id==='@/lib/action-result'?{actionFail:(e,error)=>({ok:false,error:e?.message||error}),actionOk:data=>({ok:true,...data})}:id.startsWith('@/')||id==='next/headers'?{}:require(id);
 const actions=load('src/lib/actions/procurement.ts',{require:req});
 const result=await actions.confirmVendorInvoice('order');
 assert.equal(result.ok,false);assert.match(result.error,/状態が変更/);assert.equal(JSON.stringify(expected),'["invoice_received"]');
 const inspection=await actions.completeInspection({orderId:'order',result:'reject',inspectionDate:'2026-09-21',comment:'QA',sendEmail:false});
 assert.equal(inspection.ok,false);assert.equal(JSON.stringify(expected),'["delivered"]');
});

test('company settings read failures never silently become a zero fee or fallback margin',async()=>{
 let failColumn='base_gross_profit_rate';
 const supabase={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from(table){
  let projection='';
  const result=()=> table==='profiles'?{data:{company_id:'company-a',role:'hq_admin'}}:table==='estimates'?{data:{default_gross_profit_rate:30,approval_status:'none'}}:projection===failColumn?{data:null,error:{message:'offline'}}:{data:{base_gross_profit_rate:0.3,reserve_fee_rate:0.02},error:null};
  const q={select(value){projection=value;return q;},eq(){return q;},order(){return q;},limit(){return q;},single:async()=>result(),maybeSingle:async()=>result()};return q;
 }};
 const req=id=>id==='@/lib/supabase/server'?{createClient:async()=>supabase}:id.startsWith('@/')?{}:require(id);
 const actions=load('src/lib/actions/sales-flow.ts',{require:req});
 await assert.rejects(actions.getEstimateMarginThreshold('estimate'),/粗利基準を取得/);
 failColumn='reserve_fee_rate';
 await assert.rejects(actions.getEstimateMarginThreshold('estimate'),/経営調整費率を取得/);
 failColumn='';
 const result=await actions.getEstimateMarginThreshold('estimate');
 assert.equal(result.reservePercent,2);assert.equal(result.threshold,32);
});

test('CloudSign validates PDF before creating any external draft',async()=>{
 const {sendToCloudSign}=load('src/lib/integrations/cloudsign.ts',{fetch:()=>{throw Error('must not call');}});
 for(const request of [{html:'<h1>contract</h1>'},{pdf_url:'http://localhost/private'},{pdf_base64:Buffer.from('not a PDF').toString('base64')}]) await assert.rejects(sendToCloudSign({enabled:true,client_id:'test-client'},{title:'QA',signers:[{name:'QA',email:'qa@example.test',order:1}],...request}),/PDF.*未送信/);
});
test('CloudSign uploads PDF and ordered recipients before confirming actual sent status',async()=>{
 const calls=[];
 const {sendToCloudSign}=load('src/lib/integrations/cloudsign.ts',{AbortSignal,fetch:async(url,options)=>{
  calls.push({url,...options});
  return {ok:true,json:async()=>url.endsWith('/token')?{access_token:'test-token'}:{id:'test-doc',status:calls.length===6?1:0}};
 }});
 const result=await sendToCloudSign({enabled:true,client_id:'test-client'},{title:'QA',pdf_base64:Buffer.from('%PDF-1.7\n%%EOF').toString('base64'),signers:[{name:'Second',email:'second@example.test',order:2},{name:'First',email:'first@example.test',order:1}]});
 assert.equal(result.status,'sent');
 assert.deepEqual(calls.map(c=>c.url.replace('https://api.cloudsign.jp','')),['/token','/documents','/documents/test-doc/files','/documents/test-doc/participants','/documents/test-doc/participants','/documents/test-doc']);
 assert.equal(calls[0].body.get('client_id'),'test-client');
 assert.equal(calls[2].body.get('uploadfile').type,'application/pdf');
 assert.equal(calls[3].body.get('email'),'first@example.test');
 assert.equal(calls[4].body.get('email'),'second@example.test');
 assert.equal(calls[1].headers.Authorization,'Bearer test-token');
});
test('CloudSign failures or draft responses never become sent and never retry',async()=>{
 for(const failure of ['upload','send','draft']) {
  const calls=[];
  const {sendToCloudSign}=load('src/lib/integrations/cloudsign.ts',{AbortSignal,fetch:async(url)=>{
   calls.push(url);
   const stage=url.endsWith('/files')?'upload':url.endsWith('/test-doc')?'send':'other';
   if(stage===failure) return {ok:false,status:503};
   return {ok:true,json:async()=>url.endsWith('/token')?{access_token:'test-token'}:{id:'test-doc',status:0}};
  }});
  await assert.rejects(sendToCloudSign({enabled:true,client_id:'test-client'},{title:'QA',pdf_base64:Buffer.from('%PDF-1.7\n%%EOF').toString('base64'),signers:[{name:'QA',email:'qa@example.test',order:1}]}),/書類ID: test-doc/);
  assert.equal(calls.filter(u=>u.endsWith('/test-doc')).length,failure==='upload'?0:1);
 }
});

test('ordinary tenant admins cannot invoke the platform usage aggregate',async()=>{
 let user={email:'tenant-admin@example.test'};let aggregateCalls=0;
 const req=id=>id==='@/lib/supabase/server'?{createClient:async()=>({auth:{getUser:async()=>({data:{user}})}})}:id==='@/lib/supabase/admin'?{createAdminClient:()=>({rpc:async()=>{aggregateCalls++;return {data:{companyUsage:[],aiUsage:{totalCalls:0}},error:null};}})}:id.startsWith('@/')?{}:require(id);
 const {getAdminUsageSummary}=load('src/lib/actions/admin.ts',{require:req});
 await assert.rejects(getAdminUsageSummary(),/Unauthorized/);
 user=null; await assert.rejects(getAdminUsageSummary(),/Unauthorized/);
 assert.equal(aggregateCalls,0);
 user={email:'super-admin@example.com'};
 assert.equal((await getAdminUsageSummary()).aiUsage.totalCalls,0);
 assert.equal(aggregateCalls,1);
});
