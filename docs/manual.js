'use strict';
// Static documentation only. This script never connects to the application database.
const $ = (s) => document.querySelector(s);
document.querySelectorAll('[data-print]').forEach(b => b.addEventListener('click', () => window.print()));
let printDetails=[];
window.addEventListener('beforeprint',()=>{printDetails=[...document.querySelectorAll('details')].map(d=>[d,d.open]);printDetails.forEach(([d])=>d.open=true)});
window.addEventListener('afterprint',()=>printDetails.forEach(([d,open])=>d.open=open));
const homeSearch=$('#guide-search');
if(homeSearch){const links=[...document.querySelectorAll('[data-guide]')];homeSearch.addEventListener('input',()=>{const q=homeSearch.value.trim().toLocaleLowerCase();let n=0;links.forEach(a=>{a.hidden=!!q&&!a.textContent.toLocaleLowerCase().includes(q);if(!a.hidden)n++});$('#guide-empty').hidden=n>0;$('#guide-count').textContent=q?`${n}件の操作ガイド`:''})}
const sourceSearch=$('#source-search');
if(sourceSearch){
  const rows=[...document.querySelectorAll('.record')],pageSize=25;
  let page=0,matched=[];
  const render=()=>{
    rows.forEach(r=>r.hidden=true);
    matched.slice(page*pageSize,(page+1)*pageSize).forEach(r=>r.hidden=false);
    $('#source-count').textContent=`${matched.length}件が該当（原本の行数です。機能数・テスト合格数ではありません）`;
    $('#source-empty').hidden=matched.length>0;
    $('#source-page').textContent=matched.length?`${page*pageSize+1}〜${Math.min((page+1)*pageSize,matched.length)}件目 / ${matched.length}件`:'';
    $('#source-prev').disabled=page===0;
    $('#source-next').disabled=(page+1)*pageSize>=matched.length;
  };
  const filter=()=>{
    const q=sourceSearch.value.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean),kind=$('#source-kind').value,status=$('#source-status').value,history=$('#show-history').checked;
    matched=rows.filter(r=>{const hay=r.textContent.normalize('NFKC').toLocaleLowerCase();return !((!history&&r.dataset.history==='true')||(kind&&r.dataset.kind!==kind)||(status&&r.dataset.status!==status)||q.some(w=>!hay.includes(w)))});
    page=0;render();
  };
  [sourceSearch,$('#source-kind'),$('#source-status'),$('#show-history')].forEach(e=>e.addEventListener('input',filter));
  $('#clear-filters').addEventListener('click',()=>{sourceSearch.value='';$('#source-kind').value='';$('#source-status').value='';$('#show-history').checked=false;filter();sourceSearch.focus()});
  $('#source-prev').addEventListener('click',()=>{page=Math.max(0,page-1);render()});
  $('#source-next').addEventListener('click',()=>{page=Math.min(Math.ceil(matched.length/pageSize)-1,page+1);render()});
  window.addEventListener('beforeprint',()=>matched.forEach(r=>r.hidden=false));
  window.addEventListener('afterprint',render);
  filter();
}
const featureSearch=$('#feature-search');
if(featureSearch){const cards=[...document.querySelectorAll('.feature-card')];const update=()=>{const q=featureSearch.value.toLocaleLowerCase().trim(),group=$('#feature-group').value;let n=0;cards.forEach(c=>{c.hidden=(!!q&&!c.textContent.toLocaleLowerCase().includes(q))||(!!group&&c.dataset.group!==group);if(!c.hidden)n++});$('#feature-count').textContent=`${n}件の機能分類を表示`;$('#feature-empty').hidden=n>0};featureSearch.addEventListener('input',update);$('#feature-group').addEventListener('input',update);update()}
const binding=$('#binding-demo');
if(binding){binding.addEventListener('change',()=>{const valid=binding.value==='title';$('#mapping-output').textContent=valid?'サンプル邸 改修工事':'12,000,000';$('#mapping-feedback').textContent=valid?'✓ 名称欄と「工事の名称」が対応しています。実際のPDFでも内容と位置を確認して保存します。':'名称欄に金額が入りました。差し込む情報を「工事の名称」に戻すと、正しい内容になります。';$('#mapping-feedback').style.color=valid?'var(--teal)':'var(--red)'})}
const calculator=$('#cost-calculator');
if(calculator){const amount=id=>{const v=Number($(id).value);return Number.isFinite(v)?Math.max(0,v):0};const update=()=>{const fx=amount('#fx');if(fx<=0||$('#fx').value===''){ $('#monthly-cost').textContent='為替を入力';$('#yearly-cost').textContent='1ドルあたりの円を、1以上で入力してください。';return }const usd=25+amount('#netlify-plan')+amount('#resend-plan')+amount('#github-seats')*4+amount('#ai-budget'),annualDomain=amount('#domain-budget');const yen=usd*fx+annualDomain/12;$('#monthly-cost').textContent=`約 ${Math.round(yen).toLocaleString('ja-JP')} 円／月`;$('#yearly-cost').textContent=`年換算 約 ${Math.round(yen*12).toLocaleString('ja-JP')} 円`;$('#cost-breakdown').textContent=`サービス計 $${usd.toFixed(2)}/月 × ${fx}円 ＋ ドメイン予算 ${annualDomain.toLocaleString('ja-JP')}円/年 ÷ 12`;};calculator.addEventListener('input',update);update()}
const checklist=$('#handover-checklist');
if(checklist){const key='hachi-guide-handover-v1',boxes=[...checklist.querySelectorAll('input')];let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(saved))saved=[]}catch{}boxes.forEach(b=>b.checked=saved.includes(b.id));const update=()=>{const checked=boxes.filter(b=>b.checked);$('#check-count').textContent=`${checked.length} / ${boxes.length} 項目を確認済み`;$('#check-progress').style.width=`${checked.length/boxes.length*100}%`;try{localStorage.setItem(key,JSON.stringify(checked.map(b=>b.id)))}catch{$('#check-storage').textContent='このブラウザーでは確認状態を保存できません。印刷して記録してください。'}};checklist.addEventListener('change',update);$('#reset-checks').addEventListener('click',()=>{boxes.forEach(b=>b.checked=false);update()});update()}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){document.querySelectorAll('.toc a').forEach(a=>{const active=a.hash===`#${e.target.id}`;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}})},{rootMargin:'-12% 0px -65% 0px'});document.querySelectorAll('.chapter').forEach(c=>observer.observe(c))}
