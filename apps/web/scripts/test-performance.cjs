const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function moduleLoader(overrides={}, browser=true) {
  const cache=new Map();
  function load(file) {
    file=path.resolve(file); if(cache.has(file))return cache.get(file).exports;
    const mod={exports:{}};cache.set(file,mod);
    const req=name=>{
      if(Object.hasOwn(overrides,name))return overrides[name];
      if(name.startsWith('@/lib/actions/'))return new Proxy({}, {get:(_,key)=>async()=>{throw new Error('Unexpected eager server action: '+key);}});
      if(name.startsWith('@/'))return load('src/'+name.slice(2)+'.ts');
      if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
      return require(name);
    };
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`,{window:browser?{}:undefined,console,setTimeout,clearTimeout,URL,Date})(req,mod,mod.exports);
    return mod.exports;
  }
  return load;
}
const {AsyncReadCache}=moduleLoader()('src/lib/async-read-cache.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
test('20 concurrent cache misses run one database read; the warm result is reused',async()=>{
 const c=new AsyncReadCache(),gate=deferred();let calls=0;
 const pending=Array.from({length:20},()=>c.read('c:1:list',1000,()=>{calls++;return gate.promise;}));
 await tick();assert.equal(calls,1);gate.resolve(123);
 assert.ok((await Promise.all(pending)).every(x=>x===123));
 assert.equal(await c.read('c:1:list',1000,async()=>999),123);
});
test('tenant/user cache keys stay independent',async()=>{
 const c=new AsyncReadCache();
 assert.equal(await c.read('c:1:list:u:1',1000,async()=>11),11);
 assert.equal(await c.read('c:1:list:u:2',1000,async()=>12),12);
 assert.equal(await c.read('c:2:list:u:1',1000,async()=>21),21);
 c.invalidatePrefix('c:1:'); assert.equal(c.get('c:1:list:u:2'),undefined); assert.equal(c.get('c:2:list:u:1'),21);
});
test('a read started before a mutation cannot restore stale cache after invalidation',async()=>{
 const c=new AsyncReadCache(),old=deferred(),fresh=deferred();
 const p=c.read('c:1:list',1000,()=>old.promise);await tick();
 c.invalidatePrefix('c:1:');const next=c.read('c:1:list',1000,()=>fresh.promise);await tick();
 old.resolve('old');assert.equal(await p,'old');assert.equal(c.get('c:1:list'),undefined);
 fresh.resolve('new');assert.equal(await next,'new');assert.equal(c.get('c:1:list'),'new');
});
test('old completion cannot remove the newer pending request',async()=>{
 const c=new AsyncReadCache(),old=deferred(),fresh=deferred();
 const p=c.read('x',1000,()=>old.promise);await tick();c.invalidatePrefix('x');
 const next=c.read('x',1000,()=>fresh.promise);await tick();old.resolve('old');await p;
 const follower=c.read('x',1000,()=>{throw Error('duplicate');});fresh.resolve('new');
 assert.equal(await next,'new');assert.equal(await follower,'new');
});
test('failed reads retry and never poison the cache',async()=>{
 const c=new AsyncReadCache();await assert.rejects(c.read('x',1000,async()=>{throw Error('offline');}));
 assert.equal(await c.read('x',1000,async()=>42),42);
});
test('TTL boundary expires and capacity stays bounded',async()=>{
 let time=0;const c=new AsyncReadCache(2,()=>time);c.set('a',1,10);c.set('b',2,10);c.set('c',3,10);
 assert.equal(c.get('a'),undefined);assert.equal(c.get('b'),2);time=10;assert.equal(c.get('b'),undefined);
 assert.equal(await c.read('c',10,async()=>4),4);
});
test('zero TTL deduplicates only in-flight work, retaining fresh reads afterwards',async()=>{
 const c=new AsyncReadCache();let calls=0;
 await Promise.all([c.read('x',0,async()=>++calls),c.read('x',0,async()=>++calls)]);assert.equal(calls,1);
 await c.read('x',0,async()=>++calls);assert.equal(calls,2);
});
function fakeAuth() {
 let current='u1';const calls={auth:0,profiles:0,companies:0};
 const client={auth:{getUser:async()=>{calls.auth++;await tick();return {data:{user:current?{id:current,user_metadata:{mail_signature:'署名'}}:null},error:null};}},from(table){
   if(table!=='profiles'&&table!=='companies')throw Error('Unexpected eager query: '+table);
   calls[table]++;let id;
   const q={select(){return q;},eq(k,v){id=v;return q;},async maybeSingle(){await tick();return {data:{id,company_id:'c-'+id,role:'employee'},error:null};},async single(){return {data:{id,name:'会社'},error:null};}};return q;
 }};
 return {client,calls,switchUser:id=>{current=id;}};
}
test('eight simultaneous browser readers share one verified auth request and one profile read',async()=>{
 const fake=fakeAuth();const load=moduleLoader({'@/lib/supabase/client':{createClient:()=>fake.client}});
 const {browserAuthContext}=load('src/lib/queries/browser-auth.ts');
 const contexts=await Promise.all(Array.from({length:8},()=>browserAuthContext()));
 assert.equal(fake.calls.auth,1);assert.equal(fake.calls.profiles,1);assert.ok(contexts.every(c=>c.profile.company_id==='c-u1'));
});
test('browser auth is reverified after settlement and account changes cannot reuse old context',async()=>{
 const fake=fakeAuth();const load=moduleLoader({'@/lib/supabase/client':{createClient:()=>fake.client}});
 const api=load('src/lib/queries/browser-auth.ts');await api.browserAuthContext();fake.switchUser('u2');api.invalidateBrowserAuthReads();
 assert.equal((await api.browserAuthContext()).profile.company_id,'c-u2');assert.equal(fake.calls.auth,2);
 fake.switchUser(null);api.invalidateBrowserAuthReads();assert.equal((await api.browserAuthContext()).profile,null);
});
test('SSR does not share a module-level browser auth read between requests',async()=>{
 const fake=fakeAuth();const load=moduleLoader({'@/lib/supabase/client':{createClient:()=>fake.client}},false);
 const api=load('src/lib/queries/browser-auth.ts');await Promise.all([api.fetchBrowserUser(),api.fetchBrowserUser()]);assert.equal(fake.calls.auth,2);
});
test('settings first render fetches only auth, profile and company; no hidden-tab actions',async()=>{
 const fake=fakeAuth();const load=moduleLoader({'@/lib/supabase/client':{createClient:()=>fake.client}});
 const api=load('src/lib/queries/portal.ts');const result=await api.fetchSettingsBundle();
 assert.equal(fake.calls.auth,1);assert.equal(fake.calls.profiles,1);assert.equal(fake.calls.companies,1);
 assert.equal(result.initialCompany.id,'c-u1');assert.equal(result.initialSignature,'署名');assert.equal(result.initialMembers,undefined);
});
test('quick navigation pointer passes make no speculative requests; sustained intent makes one',async()=>{
 const {createNavigationIntent}=moduleLoader()('src/lib/navigation-intent.ts');const calls=[];
 const intent=createNavigationIntent(href=>calls.push(href),5);intent.schedule('/crm');intent.cancel();
 await new Promise(r=>setTimeout(r,15));assert.deepEqual(calls,[]);
 intent.schedule('/crm');intent.schedule('/contracts');await new Promise(r=>setTimeout(r,15));assert.deepEqual(calls,['/contracts']);
 intent.schedule('/crm');intent.now('/dashboard');await new Promise(r=>setTimeout(r,15));assert.deepEqual(calls,['/contracts','/dashboard']);
});
test('React Query reuses a prefetched query and invalidation forces the updated read',async()=>{
 const {QueryClient}=require('@tanstack/react-query');const client=new QueryClient({defaultOptions:{queries:{retry:false}}});let calls=0;
 const options={queryKey:['customers',1,''],queryFn:async()=>++calls,staleTime:120000};
 await client.prefetchQuery(options);assert.equal(await client.fetchQuery(options),1);
 await client.invalidateQueries({queryKey:['customers']});assert.equal(await client.fetchQuery(options),2);client.clear();
});
test('the actual server wrapper scopes cache by company and user, and invalidates every user in a company',async()=>{
 let userId='u1',companyId='c1',calls=0;
 const load=moduleLoader({
  react:{cache:fn=>fn},
  'next/headers':{cookies:async()=>({get:()=>undefined})},
  '@/lib/supabase/auth':{getAuthUser:async()=>({id:userId})},
  '@/lib/supabase/server':{createClient:async()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{company_id:companyId,role:'employee'}})})})})})},
 },false);
 const api=load('src/lib/supabase/auth-context.ts');
 assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),1);
 assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),1);
 userId='u2';assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),2);
 companyId='c2';assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),3);
 companyId='c1';await api.invalidateMyCompanyCache();
 userId='u1';assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),4);
 userId='u2';assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),5);
 companyId='c2';assert.equal(await api.cachedByCompany('list',1000,async()=>++calls),3);
});
test('contract and linked construction reads start together and retain separate values',async()=>{
 const gates={contracts:deferred(),constructions:deferred()},started=[],filters={};
 const client={from(table){
  const q={select(){return q;},eq(k,v){(filters[table]??={})[k]=v;return q;},order(){return q;},limit(){return q;},maybeSingle(){started.push(table);return gates[table].promise;}};return q;
 }};
 const load=moduleLoader({'@/lib/queries/scoped':{scopedSupabase:async()=>({supabase:client,companyId:'c1'})}});
 const pending=load('src/lib/queries/details.ts').fetchContract('contract1');await tick();
 assert.deepEqual(started,['contracts','constructions']);assert.equal(filters.constructions.company_id,'c1');
 gates.contracts.resolve({data:{id:'contract1',title:'契約名',amount:12000000,start_date:'2026-09-01',end_date:'2026-10-01'},error:null});
 gates.constructions.resolve({data:{id:'construction1',title:'工事名',order_amount:111111},error:null});
 const result=await pending;assert.equal(result.title,'契約名');assert.equal(result.linked_construction.title,'工事名');assert.equal(result.amount,12000000);
});
test('approval invalidates linked record caches while unrelated records remain reusable',async()=>{
 const {QueryClient}=require('@tanstack/react-query');const client=new QueryClient();
 const {invalidateWorkflowRelatedQueries}=moduleLoader()('src/lib/workflow-cache.ts');
 for(const key of [['dashboard-data'],['contracts'],['contract','c1'],['contract','other'],['estimates'],['estimate','e1'],['construction','build1']])client.setQueryData(key,'old');
 await invalidateWorkflowRelatedQueries(client,{contract_id:'c1'});
 assert.equal(client.getQueryState(['contracts']).isInvalidated,true);
 assert.equal(client.getQueryState(['contract','c1']).isInvalidated,true);
 assert.equal(client.getQueryState(['construction','build1']).isInvalidated,true);
 assert.equal(client.getQueryState(['contract','other']).isInvalidated,false);
 assert.equal(client.getQueryState(['estimates']).isInvalidated,false);
 await invalidateWorkflowRelatedQueries(client,{estimate_id:'e1'});
 assert.equal(client.getQueryState(['estimate','e1']).isInvalidated,true);client.clear();
});
