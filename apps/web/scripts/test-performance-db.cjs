/** Fully local PostgreSQL (PGlite) regression checks. Never loads .env or connects to Supabase.
 * Uses selected repository DDL, not a complete Supabase migration replay.
 * Usage: npm run qa:performance-db --workspace web -- /absolute/report.json
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const ts = require('typescript');
const {PGlite} = require('@electric-sql/pglite');
const webRoot = path.resolve(__dirname, '..');
const migrations = path.resolve(webRoot, '../../supabase/migrations');
const uuid = text => createHash('md5').update(text).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
const c1=uuid('company1'), c2=uuid('company2'), u1=uuid('user1'), u2=uuid('user2'), u501=uuid('user501');
const db=new PGlite();
const report={engine:'PGlite / PostgreSQL, in memory', fixtureRowsPerIndexedTable:100000, productionAccess:false, indexes:[], checks:[]};
const check=(name)=>{report.checks.push(name);console.log('PASS '+name);};
let currentUser=u1;
const statementLog=[];
async function userQuery(user, sql, params=[]) {
 return db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE authenticated');
  await tx.query("SELECT set_config('app.uid', $1, true)",[user]);
  statementLog.push({user, sql});
  return tx.query(sql,params);
 });
}
const ident=value=>{assert.match(value,/^[a-z_][a-z_0-9]*$/i);return '"'+value+'"';};
const columns=value=>value==='*'?'*':value.split(',').map(s=>ident(s.trim())).join(',');
// Only the subset used by the real actions is implemented. Unsupported calls fail closed.
function client(user=currentUser) {
 return {auth:{getUser:async()=>({data:{user:{id:user}},error:null})},from(table){
  let projection='*', patch=null, where=[], ordering=[], cap, mode;
  const q={
   select(value='*'){projection=columns(value);return q;},
   update(value){patch=value;return q;},
   eq(key,value){where.push([key,'=',value]);return q;},
   lt(key,value){where.push([key,'<',value]);return q;},
   order(key,opts={}){ordering.push(ident(key)+(opts.ascending===false?' DESC':' ASC'));return q;},
   limit(n){assert.ok(Number.isInteger(n)&&n>=0);cap=n;return q;},
   single(){mode='single';return q;},maybeSingle(){mode='maybe';return q;},
   async then(resolve,reject){
    try {
     const params=[];const bind=v=>{params.push(v&&typeof v==='object'?JSON.stringify(v):v);return '$'+params.length;};
     let sql=patch?'UPDATE '+ident(table)+' SET '+Object.entries(patch).map(([k,v])=>ident(k)+'='+bind(v)).join(','):'SELECT '+projection+' FROM '+ident(table);
     if(where.length)sql+=' WHERE '+where.map(([k,op,v])=>ident(k)+op+bind(v)).join(' AND ');
     if(ordering.length)sql+=' ORDER BY '+ordering.join(',');
     if(cap!==undefined)sql+=' LIMIT '+cap;
     if(patch)sql+=' RETURNING '+projection;
     const {rows}=await userQuery(user,sql,params);
     if(mode&&(rows.length>1||(mode==='single'&&rows.length!==1)))throw Error('Expected single row, got '+rows.length);
     return resolve({data:mode?rows[0]??null:rows,error:null});
    }catch(error){return resolve({data:null,error:{message:error.message}});}
   }
  };return q;
 }};
}
function loadActions() {
 const cache=new Map();
 const overrides={
  react:{cache:fn=>fn},
  'next/headers':{cookies:async()=>({get:()=>undefined,set(){}})},
  '@/lib/supabase/server':{createClient:async()=>client()},
  '@/lib/supabase/auth':{getAuthUser:async()=>({id:currentUser})},
  '@/lib/webhooks':{dispatchWebhook:async()=>{}},
  '@/lib/actions/contract-document-archive':{archiveContractDocumentFromRecord:async()=>{}},
  '@/lib/actions/sales-flow':{notifySalesFlowUser:async()=>{}},
 };
 function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
  const mod={exports:{}};cache.set(file,mod);
  const req=name=>{
   if(Object.hasOwn(overrides,name))return overrides[name];
   if(name.startsWith('@/'))return load(path.join(webRoot,'src',name.slice(2)+'.ts'));
   if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'));
   // Do not allow a new dependency to open an external connection during a test.
   throw Error('Unmocked action dependency: '+name);
  };
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext('(function(require,module,exports){'+js+'\n})',{console,Date,Error,URL,setTimeout,clearTimeout,process:{env:{}},fetch:()=>{throw Error('Network forbidden in isolated DB QA');}})(req,mod,mod.exports);
  return mod.exports;
 }
 return rel=>load(path.join(webRoot,rel));
}
async function explain(sql,params){
 const result=await userQuery(u1,'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,params);
 return result.rows[0]['QUERY PLAN'][0];
}
function planIndexes(node){return [node['Index Name'],...(node.Plans??[]).flatMap(planIndexes)].filter(Boolean);}
async function main(){
 await db.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.uid',true),'')::uuid $$;
 CREATE ROLE authenticated NOLOGIN;`);
 let initial=fs.readFileSync(path.join(migrations,'00001_initial_schema.sql'),'utf8');
 initial=initial.replace(/^CREATE EXTENSION[^;]+;/gm,'').replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
 await db.exec(initial);
 for(const file of ['00002_rls_policies.sql','00040_company_update_policy.sql','00047_internal_messages.sql'])await db.exec(fs.readFileSync(path.join(migrations,file),'utf8'));
 await db.exec(`GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
 INSERT INTO companies(id,name) VALUES (md5('company1')::uuid,'QA company A'),(md5('company2')::uuid,'QA company B');
 INSERT INTO auth.users SELECT md5('user'||n)::uuid FROM generate_series(1,1000)n;
 INSERT INTO profiles(id,company_id,display_name,email,role) SELECT md5('user'||n)::uuid,md5('company'||CASE WHEN n<=500 THEN 1 ELSE 2 END)::uuid,'QA user '||n,'user'||n||'@example.test',CASE WHEN n IN(1,501) THEN 'hq_admin' ELSE 'employee' END FROM generate_series(1,1000)n;
 INSERT INTO constructions(id,company_id,construction_no,title) SELECT md5('construction'||n)::uuid,md5('company'||CASE WHEN n<=500 THEN 1 ELSE 2 END)::uuid,'QA-'||n,'QA construction '||n FROM generate_series(1,1000)n;
 INSERT INTO workflow_types(id,company_id,key,name) SELECT md5('type'||n)::uuid,md5('company'||n)::uuid,'custom','QA workflow' FROM generate_series(1,2)n;
 INSERT INTO workflow_requests(id,company_id,type_id,requester_id,title,status) SELECT md5('request'||n)::uuid,md5('company'||CASE WHEN n<=5000 THEN 1 ELSE 2 END)::uuid,md5('type'||CASE WHEN n<=5000 THEN 1 ELSE 2 END)::uuid,md5('user'||CASE WHEN n<=5000 THEN 1 ELSE 501 END)::uuid,'QA request '||n,'submitted' FROM generate_series(1,10000)n;
 INSERT INTO workflow_steps(id,company_id,request_id,step_order,approver_id,status)
 SELECT md5('step'||n)::uuid,md5('company'||CASE WHEN (n-1)%10000<5000 THEN 1 ELSE 2 END)::uuid,md5('request'||((n-1)%10000+1))::uuid,(n-1)/10000+1,md5('user'||((n-1)%1000+1))::uuid,CASE WHEN (n-1)/10000=0 THEN 'pending' ELSE 'approved' END FROM generate_series(1,100000)n;
 INSERT INTO internal_messages(id,company_id,sender_id,recipient_id,content,read_at)
 SELECT md5('message'||n)::uuid,md5('company'||CASE WHEN (n-1)%1000<500 THEN 1 ELSE 2 END)::uuid,md5('user'||CASE WHEN (n-1)%1000<500 THEN 1 ELSE 501 END)::uuid,md5('user'||((n-1)%1000+1))::uuid,'QA message',CASE WHEN n<=10000 THEN NULL ELSE now() END FROM generate_series(1,100000)n;
 INSERT INTO contractor_orders(id,company_id,construction_id,title,created_at)
 SELECT md5('order'||n)::uuid,md5('company'||CASE WHEN (n-1)%1000<500 THEN 1 ELSE 2 END)::uuid,md5('construction'||((n-1)%1000+1))::uuid,'QA order '||n,'2026-01-01'::timestamptz+n*interval '1 second' FROM generate_series(1,100000)n;
 ANALYZE;`);
 const specs=[
  {name:'pending approver',index:'idx_workflow_steps_pending_approver',sql:"SELECT request_id FROM workflow_steps WHERE approver_id=$1 AND status='pending'",args:[u1]},
  {name:'ordered request steps',index:'idx_workflow_steps_request_order',sql:'SELECT id,step_order FROM workflow_steps WHERE request_id=$1 ORDER BY step_order',args:[uuid('request1')]},
  {name:'unread messages',index:'idx_internal_messages_recipient_unread',sql:'SELECT count(*) FROM internal_messages WHERE recipient_id=$1 AND read_at IS NULL',args:[u1]},
  {name:'construction orders',index:'idx_contractor_orders_construction_created',sql:'SELECT id,created_at FROM contractor_orders WHERE construction_id=$1 ORDER BY created_at DESC',args:[uuid('construction1')]},
 ];
 for(const spec of specs){spec.before=await explain(spec.sql,spec.args);spec.rows=(await userQuery(u1,spec.sql,spec.args)).rows;}
 const migration=fs.readFileSync(path.join(migrations,'00087_navigation_query_indexes.sql'),'utf8');
 await db.exec(migration);await db.exec(migration);await db.exec('ANALYZE');
 check('index migration applies twice without duplicate indexes');
 for(const spec of specs){
  const after=await explain(spec.sql,spec.args);const indexes=planIndexes(after.Plan);
  assert.ok(indexes.includes(spec.index),`${spec.name}: expected ${spec.index}, used ${indexes.join(',')}`);
  // Unordered SQL is compared as a set. Sorted SQL also retains order.
  const rows=(await userQuery(u1,spec.sql,spec.args)).rows;
  const norm=values=>spec.sql.includes('ORDER BY')?JSON.stringify(values):JSON.stringify(values.map(x=>JSON.stringify(x)).sort());
  assert.equal(norm(rows),norm(spec.rows));
  report.indexes.push({name:spec.name,index:spec.index,beforeMs:spec.before['Execution Time'],afterMs:after['Execution Time'],rowCount:rows.length,beforePlan:spec.before,afterPlan:after});
  check(spec.name+': planner uses index and returns identical rows with RLS enabled');
 }
 assert.equal((await userQuery(u1,'SELECT * FROM companies WHERE id=$1',[c2])).rows.length,0);
 assert.equal((await userQuery(u1,'UPDATE companies SET name=$1 WHERE id=$2 RETURNING id',['forbidden',c2])).rows.length,0);
 assert.equal((await userQuery(u1,'SELECT * FROM workflow_steps WHERE company_id=$1',[c2])).rows.length,0);
 check('RLS hides the other tenant and prevents its updates');
 const load=loadActions();const profiles=load('src/lib/actions/profiles.ts');const auth=load('src/lib/supabase/auth-context.ts');
 let first=await profiles.getCompany();const count=statementLog.length;assert.equal((await profiles.getCompany()).name,first.name);
 assert.equal(statementLog.slice(count).filter(q=>q.sql.includes('FROM "companies"')).length,0);
 currentUser=u501;assert.equal((await profiles.getCompany()).name,'QA company B');
 currentUser=u2;assert.equal((await profiles.getCompany()).name,'QA company A');
 await assert.rejects(profiles.updateCompany({name:'forbidden'}),/権限/);
 currentUser=u1;await profiles.updateCompany({name:'QA company A saved',fiscal_month_start:10});
 assert.equal((await profiles.getCompany()).name,'QA company A saved');assert.equal((await profiles.getCompanySettings()).fiscal_month_start,10);
 currentUser=u2;assert.equal((await profiles.getCompany()).name,'QA company A saved');
 currentUser=u501;assert.equal((await profiles.getCompany()).name,'QA company B');
 currentUser=u1;await profiles.updateProfile({display_name:'Saved local profile'});assert.equal((await profiles.getProfile(u1)).display_name,'Saved local profile');
 check('real company/profile save actions refresh cached reads across users, preserve other tenant, and reject employee company edits');
 // Two-step approval with a linked contract. Notifications and archive are stubbed, never delivered.
 const req=uuid('approval-request'),step1=uuid('approval-step1'),step2=uuid('approval-step2'),contract=uuid('approval-contract');
 await db.query('INSERT INTO contracts(id,company_id,contract_no,title) VALUES($1,$2,$3,$4)',[contract,c1,'QA-approval','QA contract']);
 await db.query('INSERT INTO workflow_requests(id,company_id,type_id,requester_id,title,status,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[req,c1,uuid('type1'),u1,'QA approval','submitted',JSON.stringify({contract_id:contract})]);
 for(const [id,order,user] of [[step1,1,u1],[step2,2,u2]])await db.query('INSERT INTO workflow_steps(id,company_id,request_id,step_order,approver_id) VALUES($1,$2,$3,$4,$5)',[id,c1,req,order,user]);
 const workflow=load('src/lib/actions/workflow.ts');
 const cachedContract=()=>auth.cachedByCompany('qa-contract',300000,async()=>{const result=await client().from('contracts').select('status').eq('id',contract).single();assert.equal(result.error,null);return result.data.status;});
 assert.equal(await cachedContract(),'preparing');
 currentUser=u2;assert.equal((await workflow.approveWorkflowStep(step2)).ok,false);
 currentUser=u501;assert.equal((await workflow.approveWorkflowStep(step1)).ok,false);
 currentUser=u2;assert.equal((await workflow.approveWorkflowStep(step1)).ok,false);
 check('real approval action rejects out-of-order, wrong approver, and other-tenant attempts');
 currentUser=u1;assert.equal((await workflow.approveWorkflowStep(step1)).ok,true);
 assert.equal((await db.query('SELECT status FROM workflow_requests WHERE id=$1',[req])).rows[0].status,'submitted');
 currentUser=u2;assert.equal((await workflow.approveWorkflowStep(step2)).ok,true);
 assert.equal((await db.query('SELECT status FROM workflow_requests WHERE id=$1',[req])).rows[0].status,'approved');
 currentUser=u1;assert.equal(await cachedContract(),'contracted');
 assert.equal((await workflow.approveWorkflowStep(step1)).ok,false);
 check('two-step approval completes linked contract and invalidates previously cached contract for another user; duplicate approval rejected');
 assert.equal((await userQuery(u1,"SELECT count(*) FROM workflow_steps WHERE request_id=$1 AND status='pending'",[req])).rows[0].count,0);
 const beforeCount=(await userQuery(u1,'SELECT count(*) FROM internal_messages WHERE recipient_id=$1 AND read_at IS NULL',[u1])).rows[0].count;
 await userQuery(u1,'UPDATE internal_messages SET read_at=now() WHERE id=$1',[uuid('message1')]);
 const afterCount=(await userQuery(u1,'SELECT count(*) FROM internal_messages WHERE recipient_id=$1 AND read_at IS NULL',[u1])).rows[0].count;
 assert.equal(Number(afterCount),Number(beforeCount)-1);
 check('partial indexes reflect approval and unread-to-read updates immediately');
 report.pass=true;report.completedAt=new Date().toISOString();
 if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pass:true,checks:report.checks.length,indexes:report.indexes.map(({name,beforeMs,afterMs})=>({name,beforeMs,afterMs}))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
