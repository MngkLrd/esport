"""Author-owned text symbols, 190x190 PNG; no OEM image assets/fonts redistributed."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent.parent/'assets';OUT.mkdir(parents=True,exist_ok=True)
ITEMS=[
 ('kinopoisk','Кино', '#3e5366'),('ivi','ИВИ','#b0406d'),('start','START','#39416a'),
 ('netflix','NETFLIX','#3a3038'),('youtube','YouTube','#38464f'),('rutube','RUTUBE','#32465c'),
 ('msx','MSX','#2a5657'),('alcopac','ALCO','#625a3d'),('browser','WEB','#455060'),('kion','KION','#534774')]
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for key,title,color in ITEMS:
 im=Image.new('RGBA',(190,190),(0,0,0,0));d=ImageDraw.Draw(im)
 d.rounded_rectangle((4,4,186,186),radius=20,fill=color)
 d.rectangle((23,155,167,157),fill=(220,225,234,95))
 size=26 if len(title)<7 else 22
 f=ImageFont.truetype(FONT,size)
 bounds=d.textbbox((0,0),title,font=f)
 tw=bounds[2]-bounds[0];th=bounds[3]-bounds[1]
 d.text(((190-tw)/2,(150-th)/2-2-bounds[1]),title,font=f,fill=(248,248,250,255))
 im.save(OUT/(key+'.png'))
print('Authored',len(ITEMS),'local PNG icons')
