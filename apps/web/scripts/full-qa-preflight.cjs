/** Read-only prerequisites for full UI mutation QA. Does not start tests or change data. */
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function readEnv(file){return Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap(s=>{const m=s.match(/^([A-Z_0-9]+)=(.*)$/);return m?[[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]]:[]}));}
async function main(){
 const localFile=path.join(root,'.env.local');
 const production=fs.existsSync(localFile)?readEnv(localFile).NEXT_PUBLIC_SUPABASE_URL:null;
 const file=process.argv[2]?path.resolve(process.argv[2]):null;
 const target=file?readEnv(file):{};
 const backend=new URL(target.NEXT_PUBLIC_SUPABASE_URL||'http://127.0.0.1:54321');
 const failures=[];
 if(production&&backend.origin===new URL(production).origin)failures.push('検証先が現在の本番接続先と同じです。書き込み検証は禁止します。');
 if(!file)failures.push('分離環境の接続設定ファイルが未指定です。');
 if(['localhost','127.0.0.1','[::1]'].includes(backend.hostname)){
  try{execFileSync('docker',[...(process.env.FULL_QA_DOCKER_CONTEXT?['--context',process.env.FULL_QA_DOCKER_CONTEXT]:[]),'info','--format','{{.ServerVersion}}'],{stdio:'pipe',timeout:10000});}
  catch{failures.push('Dockerが利用できません。ローカルSupabaseを起動できません。');}
 }
 if(file&&!failures.length){
  if(!target.NEXT_PUBLIC_SUPABASE_ANON_KEY)failures.push('検証用の公開APIキーがありません。');
  if(!target.SUPABASE_SERVICE_ROLE_KEY)failures.push('合成データと検証ユーザー作成用の検証環境の管理キーがありません。');
  try{const r=await fetch(new URL('/auth/v1/health',backend),{headers:{apikey:target.NEXT_PUBLIC_SUPABASE_ANON_KEY||''},signal:AbortSignal.timeout(10000)});if(!r.ok)failures.push('検証Authのヘルスチェックに失敗しました: HTTP '+r.status);}
  catch{failures.push('検証Authに接続できません。');}
 }
 console.log(JSON.stringify({ready:failures.length===0,backend:backend.origin,failures,notes:['合格は環境の入口確認のみです。全画面テストの合格ではありません。','メール送信・電子契約・外部連携には別途テスト用接続先が必要です。']},null,2));
 if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
