#!/usr/bin/env python3
"""Rebuild our ten authored placeholder icons, without Sony assets."""
import argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ITEMS=[
 ('kinopoisk','Кино','#3e5366'),('ivi','ИВИ','#b0406d'),('start','START','#39416a'),
 ('netflix','NETFLIX','#3a3038'),('youtube','YouTube','#38464f'),('rutube','RUTUBE','#32465c'),
 ('msx','MSX','#2a5657'),('alcopac','ALCO','#625a3d'),('browser','WEB','#455060'),('kion','KION','#534774')]
FONTS=['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','C:/Windows/Fonts/arialbd.ttf']
def render(out):
 out=Path(out);out.mkdir(parents=True,exist_ok=True)
 fontpath=next((v for v in FONTS if Path(v).is_file()),None)
 for key,label,color in ITEMS:
  image=Image.new('RGBA',(190,190),(0,0,0,0));d=ImageDraw.Draw(image)
  d.rounded_rectangle((4,4,186,186),radius=20,fill=color)
  d.rectangle((23,155,167,157),fill=(220,225,234,95))
  f=ImageFont.truetype(fontpath,26 if len(label)<7 else 22) if fontpath else ImageFont.load_default()
  bounds=d.textbbox((0,0),label,font=f)
  tw=bounds[2]-bounds[0];th=bounds[3]-bounds[1]
  d.text(((190-tw)/2,(150-th)/2-2-bounds[1]),label,font=f,fill=(248,248,250,255))
  image.save(out/(key+'.png'))
 return len(ITEMS)
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--out',type=Path,default=Path(__file__).resolve().parent/'icons')
 a=p.parse_args();print('Generated',render(a.out),'icons')
