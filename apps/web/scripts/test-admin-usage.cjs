/* eslint-disable @typescript-eslint/no-require-imports -- Node test entry point. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('admin usage aggregates over 1000 events, login activity, dormant companies and restricts RPC',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
   CREATE TABLE companies(id int,name text,settings jsonb);
   CREATE TABLE profiles(id int,company_id int);
   CREATE TABLE auth.users(id int,last_sign_in_at timestamptz);
   CREATE TABLE constructions(company_id int,updated_at timestamptz);
   CREATE TABLE ai_usage_events(company_id int,tokens_in int,tokens_out int,created_at timestamptz);
   INSERT INTO companies VALUES(1,'A','{"plan":"Pro"}'),(2,'B','{}'),(3,'C','{}');
   INSERT INTO profiles VALUES(11,1),(12,2);
   INSERT INTO auth.users VALUES(11,now()),(12,now()-interval '60 days');
   INSERT INTO constructions VALUES(1,now()-interval '60 days');
   INSERT INTO ai_usage_events SELECT 1,10,20,now()-interval '5 days' FROM generate_series(1,1501);
   INSERT INTO ai_usage_events VALUES(2,4,6,now()-interval '60 days');`);
  await db.exec(fs.readFileSync('../../supabase/migrations/00091_admin_usage_aggregates.sql','utf8'));
  const summary=(await db.query('SELECT admin_usage_summary() AS result')).rows[0].result;
  assert.equal(summary.companyUsage.length,3);
  assert.equal(summary.companyUsage[0].userCount,1);
  assert.equal(summary.companyUsage[0].aiCalls,1501);
  assert.equal(summary.companyUsage[0].active30d,true);
  assert.equal(summary.companyUsage[1].active30d,false);
  assert.equal(summary.companyUsage[2].lastActivityAt,null);
  assert.equal(summary.aiUsage.totalCalls,1502);
  assert.equal(summary.aiUsage.totalTokens,45040);
  assert.equal(summary.aiUsage.last30dCalls,1501);
  assert.equal(summary.aiUsage.byCompany.length,2);
  for(const role of ['anon','authenticated']) await assert.rejects(db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT admin_usage_summary()');}),/permission denied/);
  const service=await db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE service_role');return tx.query('SELECT admin_usage_summary() AS result');});
  assert.equal(service.rows[0].result.aiUsage.totalCalls,1502);
 } finally {await db.close();}
});
