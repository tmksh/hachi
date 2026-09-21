/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test entry point, matching the other QA scripts. */
/** Local HTTP route smoke test, NOT browser interaction or database mutation QA.
 * Reads .env.local public Supabase values, uses the supplied user's RLS session.
 * No service-role key; never executes client effects or submits Server Actions.
 * QA_EMAIL/QA_PASSWORD must be supplied by the caller. QA_BASE_URL must be loopback.
 */
const fs=require('node:fs');
const path=require('node:path');
const {createServerClient}=require('@supabase/ssr');
const root=path.resolve(__dirname,'..');
const base=new URL(process.env.QA_BASE_URL||'http://127.0.0.1:3000');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('Only loopback application URLs allowed');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env.local'),'utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const cookies=new Map();
const sdk=createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
 cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>cookies.set(name,value))},
 global:{fetch:async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url??input.toString());const method=(init?.method||'GET').toUpperCase();if(!['GET','HEAD'].includes(method)&&!(method==='POST'&&url.pathname==='/auth/v1/token'))throw Error('Mutation forbidden: '+method+' '+url.pathname);return fetch(input,init);}},
});
const result={scope:'HTTP rendered shells only; no browser hydration, save, approval, or external integration calls',passed:[],failed:[],skipped:[]};
function findPages(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name.startsWith('@')?[]:findPages(path.join(dir,e.name))):e.name==='page.tsx'?[path.join(dir,e.name)]:[]);}
async function page(route){
 let url=new URL(route,base);const started=performance.now();
 for(let n=0;n<4;n++){
  const response=await fetch(url,{redirect:'manual',headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},signal:AbortSignal.timeout(45000)});
  const location=response.headers.get('location');
  if(response.status>=300&&response.status<400&&location){url=new URL(location,url);if(route.startsWith('/marketing/')&&url.origin===base.origin&&url.pathname==='/unauthorized')return {route,ok:true,status:response.status,expectedDenial:true,reason:'marketing is intentionally disabled for all roles'};if(url.origin!==base.origin||/\/(login|unauthorized)/.test(url.pathname))return {route,ok:false,status:response.status,reason:'unexpected authentication or external redirect'};continue;}
  const body=await response.text();
  const ok=response.status===200&&!/"digest":"[0-9]+"/.test(body)&&!/<title>404[ :]/.test(body);
  return {route,ok,status:response.status,ms:Math.round(performance.now()-started),bytes:Buffer.byteLength(body)};
 }
 return {route,ok:false,reason:'redirect loop'};
}
async function main(){
 if(!process.env.QA_EMAIL||!process.env.QA_PASSWORD)throw Error('QA_EMAIL and QA_PASSWORD required');
 const {data,error}=await sdk.auth.signInWithPassword({email:process.env.QA_EMAIL,password:process.env.QA_PASSWORD});if(error)throw Error(error.message);
 const {data:profile,error:profileError}=await sdk.from('profiles').select('role,company_id').eq('id',data.user.id).single();if(profileError)throw Error(profileError.message);
 result.role=profile.role;
 const dir=path.join(root,'src/app/(app)');
 const patterns=findPages(dir).map(file=>'/'+path.relative(dir,path.dirname(file)).split(path.sep).join('/'));
 const mapping={'crm':'customers','quotes':'estimates','craftsmen':'craftsmen','contracts':'contracts','constructions':'constructions','invoices':'invoices','workflow':'workflow_requests','circulation':'announcements','settings/pdf-builder':'pdf_form_templates'};
 const ids={};
 for(const [prefix,table] of Object.entries(mapping)){
  // PDF templates are stored in company settings, not a standalone table.
  if(prefix==='settings/pdf-builder'){const {data:company,error}=await sdk.from('companies').select('settings').eq('id',profile.company_id).single();const template=company?.settings?.pdf_form_templates?.[0];if(!error&&template)ids[prefix]=template.id;continue;}
  const {data,error}=await sdk.from(table).select('id').limit(1).maybeSingle();if(!error&&data)ids[prefix]=data.id;
 }
 const routes=[];
 for(const pattern of patterns){
  if(pattern.startsWith('/admin')||pattern==='/unauthorized'){result.skipped.push({pattern,reason:'different authorization flow'});continue;}
  if(!pattern.includes('[')){routes.push(pattern);continue;}
  const prefix=pattern.split('/[id]')[0].slice(1);
  if(ids[prefix]&&!pattern.includes('reports'))routes.push(pattern.replace('[id]',ids[prefix]));
  else result.skipped.push({pattern,reason:'no suitable read-only fixture selected'});
 }
 for(const route of routes){
  const r=await page(route);(r.ok?result.passed:result.failed).push(r);console.log((r.ok?'PASS ':'FAIL ')+route+' HTTP '+r.status);
 }
 result.completedAt=new Date().toISOString();
 if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:result.passed.length,failed:result.failed.length,skipped:result.skipped.length}));
 if(result.failed.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
