from io import BytesIO
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, NumberObject, ArrayObject, DecodedStreamObject, TextStringObject
out = Path(__file__).parent / 'fixtures' / 'pdf-updates'
out.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('HeiseiKakuGo-W5','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
buf = BytesIO()
c = canvas.Canvas(buf, pagesize=(595,842))
for n in range(2):
 c.setFont('HeiseiKakuGo-W5', 20); c.drawString(60, 760, '工事請負契約書 - 更新確認')
 c.setFont('HeiseiKakuGo-W5', 14); c.drawString(60, 650, '工期'); c.drawString(330, 650, '年　月　日')
 c.line(140,640,500,640)
 c.setFont('Helvetica',12); c.drawString(60,710,f'PAGE {n+1} / PDF annotation regression fixture')
 c.drawString(60,590,'STAMP:'); c.drawString(60,520,'FORM WIDGET:'); c.drawString(60,450,'CORRECTION:')
 c.showPage()
c.save()
(out/'original.pdf').write_bytes(buf.getvalue())
w=PdfWriter(); w.clone_document_from_reader(PdfReader(buf))
fields=ArrayObject()
def annotation(page, subtype, rect, commands, field=False):
 x,y,x2,y2=rect
 ap=DecodedStreamObject();ap.set_data(commands.encode('ascii'))
 ap.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Form'),NameObject('/BBox'):ArrayObject([NumberObject(v) for v in [0,0,x2-x,y2-y]]),NameObject('/Resources'):DictionaryObject()})
 a=DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject(subtype),NameObject('/Rect'):ArrayObject([NumberObject(v) for v in rect]),NameObject('/F'):NumberObject(4),NameObject('/AP'):DictionaryObject({NameObject('/N'):w._add_object(ap)})})
 if field:a.update({NameObject('/FT'):NameObject('/Tx'),NameObject('/T'):TextStringObject(f'widget-{page}'),NameObject('/V'):TextStringObject('OLD VALUE'),NameObject('/DA'):TextStringObject('/Helv 12 Tf 0 g')})
 ref=w._add_object(a);p=w.pages[page]
 if '/Annots' not in p:p[NameObject('/Annots')]=ArrayObject()
 p['/Annots'].append(ref)
 if field:fields.append(ref)
for p in range(2):
 annotation(p,'/Square',[325,645,450,672],'1 1 1 rg 0 0 125 27 re f')
 annotation(p,'/Stamp',[160,580,220,610],'1 0 0 rg 0 0 60 30 re f')
 annotation(p,'/Widget',[190,510,250,540],'0 1 0 rg 0 0 60 30 re f',True)
 annotation(p,'/FreeText',[160,440,220,470],'0 0 1 rg 0 0 60 30 re f')
w._root_object[NameObject('/AcroForm')]=w._add_object(DictionaryObject({NameObject('/Fields'):fields}))
with open(out/'corrected.pdf','wb') as f:w.write(f)
print('Created original and corrected 2-page fixtures')
