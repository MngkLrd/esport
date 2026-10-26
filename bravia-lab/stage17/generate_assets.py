#!/usr/bin/env python3
"""Build self-contained, preblurred TV tile wordmark assets (NOT official brand logos).
No web requests, no running blur/shader on television.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib, json
ROOT=Path(__file__).resolve().parent
OUT=ROOT/"assets"/"logos";OUT.mkdir(parents=True,exist_ok=True)
BRANDS=[
 ("kinopoisk","КИНОПОИСК",(255,174,78)),
 ("ivi","ИВИ",(232,180,247)),
 ("start","START",(245,244,247)),
 ("netflix","N",(238,53,72)),
 ("youtube","▶",(239,64,67)),
 ("rutube","RUTUBE",(225,236,245)),
 ("msx","MSX",(95,217,211)),
 ("alcopac","ALCOPAC",(180,224,145)),
 ("browser","WWW",(165,217,246)),
 ("kion","КИОН",(218,178,250))
]
PROFILES=[("unknown",0,3.4,.16),("ready",1,2.6,.26),("unavailable",2,5.8,.10)]
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
items=[]
for idx,(slug,word,rgb) in enumerate(BRANDS):
  for name,variant,blur,opacity in PROFILES:
    img=Image.new("RGBA",(576,300),(0,0,0,0));d=ImageDraw.Draw(img)
    if slug=="youtube":
      d.rounded_rectangle((125,78,451,222),radius=48,fill=(*rgb,255))
      d.polygon([(269,109),(269,192),(350,151)],fill=(255,255,255,255))
    else:
      fs=235 if slug=="netflix" else 145
      while fs>=35:
        font=ImageFont.truetype(FONT,fs)
        box=d.textbbox((0,0),word,font=font)
        if box[2]-box[0]<=450 and box[3]-box[1]<=165:break
        fs-=2
      w,h=box[2]-box[0],box[3]-box[1]
      d.text(((576-w)/2-box[0],(300-h)/2-box[1]),word,font=font,fill=(*rgb,255))
    img=img.filter(ImageFilter.GaussianBlur(blur*4))
    img=img.resize((144,75),Image.Resampling.LANCZOS)
    if name=="unavailable":
      a=img.getchannel("A")
      img=Image.new("RGBA",img.size,(174,174,174))
      img.putalpha(a)
    img.putalpha(img.getchannel("A").point(lambda a:int(round(a*opacity))))
    path=OUT/(slug+"_"+name+".png")
    img.save(path,optimize=True)
    items.append({"id":idx,"name":slug,"state":name,"variant":variant,"file":"assets/logos/"+path.name,
                  "width":144,"height":75,"opacity":opacity,"blur_ref_px":blur,
                  "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                  "identity":"locally rendered wordmark placeholder; not verified official trademark"})
(ROOT/"assets"/"manifest.json").write_text(json.dumps({"count":len(items),"assets":items},ensure_ascii=False,indent=2),encoding="utf-8")
print("Stage17 generated",len(items),"proportional alpha PNGs")
