#!/usr/bin/env python3
"""Canonical generator for 30 preblurred RGBA assets. NO network at build/runtime.
Only Kinopoisk, Netflix and YouTube have sourced vector paths (Simple Icons).
Others use explicitly project-made typographic wordmark placeholders.
"""
from pathlib import Path
import io, json, hashlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter
BASE=Path(__file__).resolve().parent
OUT=BASE/'assets'
OUT.mkdir(parents=True,exist_ok=True)
W,H=144,75
SERVICES=[
 ('kinopoisk','КИНОПОИСК',(255,177,94)),('ivi','ИВИ',(238,193,255)),
 ('start','START',(255,255,255)),('netflix','NETFLIX',(238,59,65)),
 ('youtube','YouTube',(243,247,255)),('rutube','RUTUBE',(235,241,255)),
 ('msx','MSX',(140,222,210)),('alcopac','AL(CO)PAC',(210,238,194)),
 ('browser','WWW',(180,220,243)),('kion','КИОН',(231,214,255))]
STATES={'unknown':(.14,3.4),'ready':(.22,2.6),'unavailable':(.08,5.8)}
FONT_PATHS=['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
 '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf']
def font(sz):
 for p in FONT_PATHS:
  if Path(p).is_file():return ImageFont.truetype(p,sz)
 return ImageFont.load_default()
def source_image(idx,slug,label,color):
 image=Image.new('RGBA',(W*3,H*3));d=ImageDraw.Draw(image)
 source=OUT/'source'/f'{idx}_{slug}.svg'
 if source.exists():
  import cairosvg
  icon=Image.open(io.BytesIO(cairosvg.svg2png(url=str(source),
     output_width=72,output_height=72))).convert('RGBA')
  image.alpha_composite(icon,(28,72))
 size=81 if len(label)<5 else (55 if len(label)>7 else 69)
 while True:
  f=font(size);box=d.textbbox((0,0),label,font=f)
  if box[2]-box[0]<=(310 if source.exists() else 383) or size<=30:break
  size-=2
 x=112 if source.exists() else (W*3-(box[2]-box[0]))//2
 y=(H*3-(box[3]-box[1]))//2-box[1]
 d.text((x,y),label,font=f,fill=color+(255,))
 return image.resize((W,H),Image.Resampling.LANCZOS)
def main():
 records=[]
 for idx,(slug,label,color) in enumerate(SERVICES):
  original=source_image(idx,slug,label,color)
  for status,(alpha,radius) in STATES.items():
   im=original.filter(ImageFilter.GaussianBlur(radius))
   if status=='unavailable':
    gray=Image.new('RGBA',im.size)
    gray.putdata([(int(.3*r+.59*g+.11*b),)*3+(a,) for r,g,b,a in im.getdata()])
    im=gray
   im.putalpha(im.getchannel('A').point(lambda a,opacity=alpha:int(a*opacity+.5)))
   filename=f'{idx:02d}_{slug}_{status}.png'
   path=OUT/filename;im.save(path,optimize=True)
   records.append(dict(id=idx,slug=slug,status=status,width=W,height=H,
    source='Simple Icons vector' if (OUT/'source'/f'{idx}_{slug}.svg').exists() else 'project wordmark fallback',
    sha256=hashlib.sha256(path.read_bytes()).hexdigest(),filename=filename))
 (OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(f'Stage17 assets: {len(records)} RGBA preblurred tile images generated offline')
if __name__=='__main__':main()
