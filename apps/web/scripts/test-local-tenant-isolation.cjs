const fs=require('node:fs'),assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
async function main(){
 if(!process.argv[2]||!process.argv[3]||!process.argv[4])throw Error('Usage: isolated.env fixtures.json results.json');
 const env=Object.fromEntries(fs.readFileSync(process.argv[2],'utf8').trim().split(/\r?\n/).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
 if(env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:54321'||env.HACHI_QA_ISOLATED!=='true')throw Error('Requires local QA backend');
 const f=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 assert.equal(f.backend,env.NEXT_PUBLIC_SUPABASE_URL);
 const results=[];
 for(const role of ['hq_admin','admin','employee']){
  const u=f.users.find(x=>x.role===role&&x.company_id===f.companies[0].id);
  const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const {error:authError}=await client.auth.signInWithPassword({email:u.email,password:u.password});if(authError)throw authError;
  async function check(name,fn){try{await fn();results.push({role,name,status:'PASS'});}catch(e){results.push({role,name,status:'FAIL',reason:e.message});}}
  await check('own customer can be read',async()=>{const r=await client.from('customers').select('id').eq('id',f.records.customer.id);assert.equal(r.error,null);assert.equal(r.data.length,1);});
  await check('other company customer cannot be read',async()=>{const r=await client.from('customers').select('id').eq('id',f.records.otherCustomer.id);assert.equal(r.error,null);assert.equal(r.data.length,0);});
  await check('other company customer update affects zero rows',async()=>{const r=await client.from('customers').update({notes:'QA forbidden update'}).eq('id',f.records.otherCustomer.id).select('id');assert.equal(r.error,null);assert.equal(r.data.length,0);});
  await check('other company customer insert rejected by RLS',async()=>{const r=await client.from('customers').insert({company_id:f.companies[1].id,name:'QA prohibited '+role});assert.equal(r.error?.code,'42501');});
  await check('other company profile cannot be read',async()=>{const other=f.users.find(x=>x.company_id===f.companies[1].id);const r=await client.from('profiles').select('id').eq('id',other.id);assert.equal(r.error,null);assert.equal(r.data.length,0);});
  await client.auth.signOut({scope:'local'});
 }
 const report={at:new Date().toISOString(),backend:f.backend,method:'real local Supabase Auth/PostgREST/RLS; not browser-operation coverage',results};
 fs.writeFileSync(process.argv[4],JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL')}));
 if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
