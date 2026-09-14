"""Generate synthetic PDF templates and matching field definitions for local regression QA."""
import json, pathlib, io, os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=pathlib.Path(__file__).parent/'fixtures'/'pdf-patterns'
ROOT.mkdir(exist_ok=True)
FONT=os.environ.get('QA_PDF_FONT', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
pdfmetrics.registerFont(TTFont('Japanese',FONT))
base={'constructionTitle':'山田邸 改修工事','constructionNo':'CST-0021','orderAmount':12000000,'startDate':'2028-02-29','endDate':'2028-03-31','customer':{'name':'山田 太郎','company_name':'動作確認株式会社','address':'東京都千代田区一丁目2番3号\n確認ビル 12階','custom_fields':{'管理コード':'QA-ABC-001'}}}
def row(label,typ='text',binding='manual',**kw):return dict(label=label,type=typ,binding=binding,**kw)
patterns=[
 ('portrait','A4縦・工事契約書',[(595.276,841.89)]*2,[[row('工事名称',binding='construction_title',required=True,editable=False),row('会社名',binding='customer_company_name'),row('受注金額','number','order_amount'),row('工期開始','date','start_date',dateFormat='japanese'),row('備考','textarea',text='第一工程：既存設備を撤去します。\n第二工程：新設設備を設置し、動作を確認します。',height=70)], [row('工事名称',binding='construction_title'),row('数量','number',text='111111',numberFormat='grouped'),row('確認済み','checkbox',text='1'),row('署名','signature',text='山田 太郎'),row('固定文','fixed',text='本書は動作確認用です。')]],{}),
 ('landscape','A4横・見積書',[(841.89,595.276)],[[row('工事名称',binding='construction_title'),row('会社名',binding='customer_company_name'),row('受注金額','number','order_amount'),row('小数数量','number',text='1234.567',numberFormat='grouped'),row('値引き','number',text='-2500',numberFormat='currency'),row('住所','textarea','customer_address',height=52)]],{'constructionTitle':'第一地区公共施設の空調設備更新および外壁・屋上防水改修工事（第二期）','orderAmount':99999999999,'customer':{**base['customer'],'company_name':'株式会社 サンプル建設・設備保守管理サービス 東京営業本部'}}),
 ('compact','A5縦・小型領収書',[(419.528,595.276)],[[row('工事名称',binding='construction_title'),row('受注金額','number','order_amount'),row('日付','date','start_date',dateFormat='iso'),row('空欄','text',text=''),row('未確認','checkbox',text=''),row('必須の備考','textarea',text='確認済み',required=True,height=55)]],{'orderAmount':0,'constructionTitle':'零円確認工事'}),
 ('mixed','縦横混在・注文書／納品書',[(595.276,841.89),(841.89,595.276)],[[row('工事名称',binding='construction_title'),row('管理コード',binding='customer_custom',bindingKey='管理コード'),row('同じ項目名','number',text='111111'),row('同じ項目名','text',text='個別の文字列')],[row('工事名称',binding='construction_title'),row('受注金額','number','order_amount_tax'),row('納期','date','end_date'),row('長文備考','textarea',text='日本語の文章と English words を含む長文です。'*5+'\n改行後も同じ枠内に表示します。',height=110)]],{}),
 ('dense','3ページ・明細／全入力種別',[(595.276,841.89)]*3,[[row('工事名称',binding='construction_title')]+[row(f'明細 {p+1}-{i+1}', 'number' if i%2==0 else 'text',text=str((i+1)*(p+1)*1234.5) if i%2==0 else f'材料・工事内容 {p+1}-{i+1}',numberFormat='grouped') for i in range(9)] for p in range(3)],{}),
 ('scanned','画像のみ・スキャン帳票',[(595.276,841.89)],[[row('工事名称',binding='construction_title'),row('会社名',binding='customer_company_name'),row('数量','number',text='111111'),row('日付','date','start_date'),row('備考','textarea',text='画像PDFでも指定した項目だけを差し込みます。',height=70)]],{}),
]
result=[]
for key,name,sizes,rows,overrides in patterns:
  buf=io.BytesIO(); c=canvas.Canvas(buf,pagesize=sizes[0]);fields=[]
  for p,((w,h),items) in enumerate(zip(sizes,rows)):
    c.setPageSize((w,h));c.setFillColorRGB(.04,.26,.29);c.setFont('Japanese',18);c.drawString(30,h-43,name)
    c.setFont('Japanese',9);c.drawString(30,h-64,'架空データによるPDFビルダー動作確認用');c.setStrokeColorRGB(.08,.5,.55);c.line(30,h-78,w-30,h-78)
    y=110; x=130 if w>450 else 113; boxw=w-x-33
    for i,source in enumerate(items):
      item=dict(source);height=item.pop('height',28); label=item['label'];
      c.setFillColorRGB(.12,.15,.18);c.setFont('Japanese',9);c.drawString(30,h-y-17,label)
      c.setStrokeColorRGB(.66,.72,.74);c.rect(x,h-y-height,boxw,height)
      c.setFillColorRGB(.8,.8,.8);c.setFont('Japanese',9);c.drawString(x+4,h-y-17,'旧サンプル値')
      fields.append(dict(id=f'{key}-{p}-{i}',page=p,xPct=(x+1)/w,yPct=(y+1)/h,wPct=(boxw-2)/w,hPct=(height-2)/h,fontSize=12,color='#111111',align='left',text='',editable=item.get('type')!='fixed') | item)
      y+=height+(13 if len(items)>8 else 22)
    c.setFont('Japanese',8);c.setFillColorRGB(.35,.4,.43);c.drawRightString(w-30,23,f'{p+1} / {len(sizes)}');c.showPage()
  c.save();path=ROOT/f'{key}.pdf';path.write_bytes(buf.getvalue())
  if key=='scanned':
    import subprocess
    image_path=ROOT/'scanned.png'
    subprocess.run([os.environ.get('PDFTOPPM', 'pdftoppm'),'-scale-to','1600','-singlefile','-png',str(path),str(ROOT/'scanned')],check=True)
    out=canvas.Canvas(str(path),pagesize=sizes[0]);out.drawImage(str(image_path),0,0,width=sizes[0][0],height=sizes[0][1]);out.save();image_path.unlink()
  template=dict(id=f'qa-{key}',name=name,docType='estimate' if key=='landscape' else 'contract',isActive=True,storagePath='development-only',fileName=f'{key}.pdf',pageCount=len(sizes),pageSizes=[dict(width=w,height=h) for w,h in sizes],fields=fields,createdAt='2026-09-14T00:00:00Z',updatedAt='2026-09-14T00:00:00Z')
  result.append(dict(key=key,template=template,context={**base,**overrides,'recordId':key}))
(ROOT/'patterns.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(f'Generated {len(result)} templates, {sum(len(x[2]) for x in patterns)} pages')
