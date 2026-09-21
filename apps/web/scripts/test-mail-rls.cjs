/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test entry point. */
// Real PostgreSQL policy execution in memory. No Supabase credentials or network.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('spam migration preserves old mail, persists classification and isolates users/folders',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('app.uid')::uuid $$;
   CREATE TABLE companies(id uuid PRIMARY KEY);
   CREATE TABLE profiles(id uuid PRIMARY KEY, company_id uuid REFERENCES companies);
   CREATE FUNCTION auth_company_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT company_id FROM profiles WHERE id=auth.uid() $$;
   CREATE TABLE email_accounts(id uuid PRIMARY KEY,company_id uuid,user_id uuid);
   CREATE TABLE email_threads(id uuid PRIMARY KEY,company_id uuid,account_id uuid,is_read boolean DEFAULT false);
   CREATE TABLE email_messages(id uuid PRIMARY KEY,company_id uuid,thread_id uuid);
   CREATE TABLE email_attachments(id uuid PRIMARY KEY,company_id uuid,message_id uuid);
   ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
   INSERT INTO companies VALUES ('${uuid(1)}'),('${uuid(2)}');
   INSERT INTO profiles VALUES ('${uuid(11)}','${uuid(1)}'),('${uuid(12)}','${uuid(1)}'),('${uuid(13)}','${uuid(2)}');
   INSERT INTO email_accounts VALUES ('${uuid(21)}','${uuid(1)}','${uuid(11)}'),('${uuid(22)}','${uuid(1)}','${uuid(12)}'),('${uuid(23)}','${uuid(2)}','${uuid(13)}');
   INSERT INTO email_threads(id,company_id,account_id) VALUES ('${uuid(31)}','${uuid(1)}','${uuid(21)}'),('${uuid(32)}','${uuid(1)}','${uuid(22)}'),('${uuid(33)}','${uuid(2)}','${uuid(23)}');`);
  for(const migration of ['00081_email_user_scoped_rls.sql','00088_email_folders_and_flags.sql','00090_email_spam.sql']) await db.exec(fs.readFileSync(`../../supabase/migrations/${migration}`,'utf8'));
  // Reapplication should be harmless.
  await db.exec(fs.readFileSync('../../supabase/migrations/00090_email_spam.sql','utf8'));
  assert.equal((await db.query('SELECT count(*)::int n FROM email_threads WHERE is_spam=false')).rows[0].n,3);
  await db.exec(`INSERT INTO email_folders(id,company_id,user_id,name) VALUES ('${uuid(41)}','${uuid(1)}','${uuid(11)}','請求書'),('${uuid(42)}','${uuid(1)}','${uuid(12)}','他人'); GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`);
  const query=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query("SELECT set_config('app.uid',$1,true)",[uuid(11)]);return tx.query(sql,args);});
  assert.equal((await query('SELECT * FROM email_threads')).rows.length,1);
  assert.equal((await query('UPDATE email_threads SET is_spam=true WHERE id=$1 RETURNING id',[uuid(32)])).rows.length,0);
  assert.equal((await query('UPDATE email_threads SET is_spam=true WHERE id=$1 RETURNING id',[uuid(33)])).rows.length,0);
  await query('UPDATE email_threads SET is_spam=true WHERE id=$1',[uuid(31)]);
  assert.equal((await query('SELECT is_spam FROM email_threads WHERE id=$1',[uuid(31)])).rows[0].is_spam,true);
  await assert.rejects(query('UPDATE email_threads SET folder_id=$1 WHERE id=$2',[uuid(42),uuid(31)]),/row-level security/);
  await query('UPDATE email_threads SET is_spam=false,folder_id=$1 WHERE id=$2',[uuid(41),uuid(31)]);
  assert.equal((await query('SELECT folder_id FROM email_threads WHERE id=$1',[uuid(31)])).rows[0].folder_id,uuid(41));
  await query('DELETE FROM email_folders WHERE id=$1',[uuid(41)]);
  const restored=(await query('SELECT folder_id,is_spam FROM email_threads WHERE id=$1',[uuid(31)])).rows[0];
  assert.deepEqual(restored,{folder_id:null,is_spam:false});
 } finally { await db.close(); }
});
