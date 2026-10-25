#!/usr/bin/env python3
"""Builds a keyboard-navigable OFFLINE visual demonstration from C99 render output.
The drawing commands are emitted by the compiled C renderer. Input navigation
in this preview is a JS mirror, NOT Sony device input / tested TV behavior.
"""
import html,json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
DUMP=ROOT.parent/'native_core'/'render_dump'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def get_scene(mode,area,idx):
    args=[str(DUMP),'1280','720',mode,area,str(idx),'demo']
    result=subprocess.check_output(args,text=True)
    return [json.loads(line) for line in result.splitlines()]

scenes={'home_tv':get_scene('home','tv',0)}
for i in range(10):
    scenes[f'home_app{i}']=get_scene('home','apps',i)
    scenes[f'detail{i}']=get_scene('detail','detail',i)
for i in range(4):scenes[f'home_dock{i}']=get_scene('home','dock',i)
scenes['tv']=[]
jsdata=json.dumps(scenes,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
page='''<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BRAVIA HOME v14 — офлайн-превью</title>
<style>html{background:#080c12;color:#eaf4fc;font:15px system-ui,Arial,sans-serif}body{margin:0;padding:22px;display:grid;justify-items:center;gap:16px}header{width:min(96vw,1280px);display:flex;justify-content:space-between;align-items:center;gap:20px}.tag{background:#17283a;color:#b9d9f1;padding:9px 12px;border:1px solid #354b5d;border-radius:8px;font-weight:700;font-size:12px}canvas{width:min(96vw,1280px);height:auto;aspect-ratio:16/9;background:#0b111b;border:1px solid #223448;outline:0}canvas:focus{box-shadow:0 0 0 2px #85c5f0}.controls{max-width:1280px;width:96vw;display:flex;flex-wrap:wrap;gap:9px;align-items:center}.controls button{border:1px solid #405267;background:#162334;color:#ebf4fc;border-radius:8px;padding:12px 17px;font:inherit;cursor:pointer}.controls button:hover,.controls button:focus-visible{border-color:#a1d4f2;outline:0}.small{color:#94afc7;max-width:1280px;width:96vw;font-size:13px;line-height:1.5}#status{min-height:21px;color:#bde0fb}@media(max-width:600px){header{flex-wrap:wrap}body{padding:8px}.controls button{flex:1}}</style>
<header><strong>BRAVIA HOME v14 · Native C99 preview</strong><span class="tag">ОФЛАЙН-ДЕМО · НЕ SONY TV</span></header>
<canvas id="screen" width="1280" height="720" tabindex="0" aria-label="Симуляция управления пультом"></canvas>
<div class="controls"><button data-k="ArrowLeft">←</button><button data-k="ArrowUp">↑</button><button data-k="ArrowDown">↓</button><button data-k="ArrowRight">→</button><button data-k="Enter">OK</button><button data-k="Backspace">BACK</button><button data-k="h">HOME</button><span id="status" role="status">Стрелки и Enter на клавиатуре управляют демонстрацией.</span></div>
<p class="small">Все изображённые кадры построены из команд скомпилированного C99-рендерера. Зелёная отметка Netflix, отметка отсутствия у КИОН и «последний запрос запуска» — <strong>только тестовые данные</strong>. Встроенный сценарий клавиш не подключён к настоящему пульту Sony. Вызовы настроек, HDMI, каналов и приложений в этой странице не выполняются.</p>
<script>
const scenes=__SCENES__;
const canvas=document.getElementById('screen'),ctx=canvas.getContext('2d'),status=document.getElementById('status');
let view='home',area='tv',focus=0,selected=0;
function sceneKey(){return view==='tv'?'tv':view==='detail'?'detail'+selected:area==='tv'?'home_tv':'home_'+area+focus}
function paint(){
ctx.fillStyle='#0c121c';ctx.fillRect(0,0,1280,720);
if(view==='tv'){
 ctx.fillStyle='#e7f2fc';ctx.font='bold 42px sans-serif';ctx.fillText('Телевидение управляется Sony',110,296);
 ctx.font='24px sans-serif';ctx.fillStyle='#a6bbd0';ctx.fillText('В офлайн-превью нет настоящего сигнала. Нажмите HOME.',110,346);
 return;
}
const cmds=scenes[sceneKey()]||[];
for(const [op,x,y,w,h,r,g,b,size,text,strong] of cmds){
 const rgb='rgb('+r+','+g+','+b+')';ctx.strokeStyle=rgb;ctx.fillStyle=rgb;
 if(op===1){ctx.fillRect(x,y,w,h)}
 else if(op===2){ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1)}
 else if((op===3||op===4)&&text){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.font=(strong?'700 ':'400 ')+size+'px "DejaVu Sans",system-ui,sans-serif';ctx.textBaseline='top';ctx.fillText(text,x,y);ctx.restore()}
}
}
function key(k){
status.textContent='';
if(k==='h'||k==='H'||k==='Home'){view='home';area='tv';focus=0;paint();return}
if(view==='tv'){status.textContent='Телевизионные клавиши в демонстрации не перехватываются.';return}
if(k==='Backspace'||k==='Escape'){if(view==='detail'){view='home';area='apps';focus=selected}else view='tv';paint();return}
if(view==='detail')return;
if(k==='ArrowLeft'){if(area==='apps'&&focus%5>0)focus--;else if(area==='dock'&&focus>0)focus--}
else if(k==='ArrowRight'){if(area==='apps'&&focus%5<4)focus++;else if(area==='dock'&&focus<3)focus++}
else if(k==='ArrowUp'){if(area==='apps'){if(focus<5){area='tv';focus=0}else focus-=5}else if(area==='dock'){area='apps';focus+=5}}
else if(k==='ArrowDown'){if(area==='tv'){area='apps';focus=0}else if(area==='apps'){if(focus<5)focus+=5;else{area='dock';focus=Math.min(3,focus-5)}}}
else if(k==='Enter'){if(area==='tv'||(area==='dock'&&focus===0)){view='tv'}else if(area==='apps'){selected=focus;view='detail'}else{status.textContent='Родное системное меню Sony в офлайн-превью недоступно.'}}
paint();
}
document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Backspace','Escape','Home','h','H'].includes(e.key)){e.preventDefault();key(e.key)}});
document.querySelectorAll('button[data-k]').forEach(b=>b.addEventListener('click',()=>{key(b.dataset.k);canvas.focus()}));
paint();canvas.focus();
</script></html>'''.replace('__SCENES__',jsdata)
(ROOT/'BRAVIA_HOME_v14_INTERACTIVE_PREVIEW.html').write_text(page,encoding='utf-8')
print('interactive preview:',len(page),'chars and',len(scenes),'native C-rendered scenes')
# Visual demo with actual test availability, not real Sony data.
(ROOT/'previews').mkdir(parents=True,exist_ok=True)
for key,name in [('home_app3','demo_netflix_selected.png'),('home_app9','demo_kion_unavailable.png'),('detail9','demo_unavailable_detail.png')]:
 cmds=scenes[key];im=Image.new('RGB',(1280,720),(12,18,28));d=ImageDraw.Draw(im);cache={}
 for cmd in cmds:
  op,x,y,w,h,r,g,b,size,text,strong=cmd[:11]
  color=(r,g,b)
  if op==1:d.rectangle((x,y,x+w-1,y+h-1),fill=color)
  elif op==2:d.rectangle((x,y,x+w-1,y+h-1),outline=color)
  elif op in (3,4) and text:
   n=max(9,int(size));font= BOLD if strong else FONT
   while True:
    if (font,n) not in cache:cache[(font,n)]=ImageFont.truetype(font,n)
    f=cache[(font,n)]
    if n<=9 or d.textbbox((0,0),text,font=f)[2]<=w-4:break
    n-=1
   layer=Image.new('RGBA',(w,h));ImageDraw.Draw(layer).text((0,0),text,font=f,fill=(*color,255))
   im.paste(layer,(x,y),layer)
 out=ROOT/'previews'/name;im.save(out,optimize=True)
 print('native C preview:',out)
