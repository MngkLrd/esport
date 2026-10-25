#include "render.h"
/* Deterministic, no-heap, network-free TV HOME drawing commands.
   The Sony video layer, system menu and key ownership remain external. */
static const UiColor BG={12,18,28},SURFACE={21,30,43},TEXT={239,245,251},MUTED={147,166,187};
static const UiColor DIV={49,63,78},HERO={22,46,66},HERO_EDGE={75,131,167},FOCUS={235,246,253};
static const UiColor TV_BLOCK={53,91,118},TV_STROKE={220,240,250},OVERLINE={167,201,223};
static const UiColor TILE_DIV={119,126,140},RECENT_BG={21,30,43},DOCK_ACCENT={69,105,138};
static const UiColor BRAND[10]={
 {79,51,44},{57,44,89},{44,38,55},{32,28,37},{198,208,220},
 {32,60,89},{26,63,62},{44,64,49},{32,56,74},{51,39,77}
};
static const UiColor BRAND_TEXT[10]={
 {255,186,116},{237,213,255},{252,248,253},{235,55,63},{199,40,55},
 {227,241,252},{154,237,220},{210,238,189},{177,217,242},{232,212,251}
};
static const char *NAMES[10]={
 "Кинопоиск","Иви","START","Netflix","YouTube","RUTUBE",
 "Media Station X","Al(co)pac","Браузер","КИОН"
};
static const char *MARKS[10]={"К","иви","START","N","YouTube","RUTUBE","MSX","ALCO","WWW","KION"};
static const char *DOCK[4]={"Телевидение","Каналы / GUIDE","Источники","Настройки"};
static const char *DETAIL_INFO[4]={
 "Сервис пока не проверен на этом телевизоре.",
 "Sony сообщает, что сервис зарегистрирован.",
 "Приложение не зарегистрировано в Sony HOME.",
 "Команда запуска отклонена или недоступна."
};
static int scale_x(int x,int width){return (x*width+640)/1280;}
static int scale_y(int y,int height){return (y*height+360)/720;}
static int font_size(int size,int width,int height){int x=scale_x(size,width),y=scale_y(size,height);return x<y?x:y;}
static int emit(UiCanvas *canvas,UiMetrics *metrics,UiOp op,int x,int y,int w,int h,
                UiColor color,const char *text,int font_px,int strong){
 UiCommand cmd;
 if(w<=0||h<=0)return -1;
 cmd.op=op;
 cmd.x=scale_x(x,canvas->width);cmd.y=scale_y(y,canvas->height);
 cmd.w=scale_x(x+w,canvas->width)-cmd.x;cmd.h=scale_y(y+h,canvas->height)-cmd.y;
 if(cmd.w==0)cmd.w=1;
 if(cmd.h==0)cmd.h=1;
 cmd.font_px=font_size(font_px,canvas->width,canvas->height);
 cmd.color=color;cmd.text=text;cmd.emphasized=strong;
 cmd.image_id=-1;cmd.image_variant=0;
 if(cmd.x<0||cmd.y<0||cmd.w<=0||cmd.h<=0||cmd.x+cmd.w>canvas->width||cmd.y+cmd.h>canvas->height){
  metrics->errors++;return -1;
 }
 if(!canvas->emit(canvas->context,&cmd)){metrics->errors++;return -1;}
 if(op==UI_RECT)metrics->rects++;
 if(op==UI_STROKE)metrics->strokes++;
 if(op==UI_TEXT)metrics->texts++;
 return 0;
}
#define RECT(x,y,w,h,c) emit(canvas,metrics,UI_RECT,x,y,w,h,c,0,0,0)
#define STROKE(x,y,w,h,c) emit(canvas,metrics,UI_STROKE,x,y,w,h,c,0,0,0)
#define TXT(x,y,w,h,c,s,z,b) emit(canvas,metrics,UI_TEXT,x,y,w,h,c,s,z,b)
static int draw_logo(UiCanvas *canvas,UiMetrics *metrics,int id,int x,int y,
                     int w,int h,AppAvailability status){
 /* One preblurred image command REPLACES a giant text mark (stable 94 ops).
    Logo-absent Sony hosts retain a text fallback using cmd.text. */
 UiCommand cmd;
 if(id<0||id>=10)return -1;
 cmd.op=UI_LOGO;
 cmd.x=scale_x(x,canvas->width);cmd.y=scale_y(y,canvas->height);
 cmd.w=scale_x(x+w,canvas->width)-cmd.x;
 cmd.h=scale_y(y+h,canvas->height)-cmd.y;
 if(cmd.w<1)cmd.w=1;
 if(cmd.h<1)cmd.h=1;
 cmd.font_px=font_size(id==3?45:(id==0||id==1?33:27),canvas->width,canvas->height);
 cmd.color=BRAND_TEXT[id];cmd.text=MARKS[id];cmd.emphasized=1;
 cmd.image_id=id;cmd.image_variant=(int)status;
 if(cmd.x<0||cmd.y<0||cmd.x+cmd.w>canvas->width||
    cmd.y+cmd.h>canvas->height){metrics->errors++;return -1;}
 if(!canvas->emit(canvas->context,&cmd)){metrics->errors++;return -1;}
 metrics->texts++;return 0;
}
static void outline(UiCanvas *canvas,UiMetrics *metrics,int x,int y,int w,int h){
 const UiColor blue={116,181,226};
 STROKE(x,y,w,h,blue);STROKE(x+3,y+3,w-6,h-6,FOCUS);
}
static void heading(UiCanvas *canvas,UiMetrics *metrics,const HomeState *s){
 const UiColor tick={124,189,230};
 TXT(57,28,410,41,TEXT,"BRAVIA",31,1);
 RECT(226,42,2,25,tick);
 TXT(244,39,400,29,MUTED,"HOME",19,0);
 TXT(977,43,260,22,MUTED,"SONY  /  XG70",14,1);
 RECT(56,82,1168,1,DIV);
 if(s->last_dispatched_app>=0&&s->last_dispatched_app<10){
  TXT(570,40,395,25,MUTED,"Последний запрос:",15,0);
  TXT(725,40,238,25,TEXT,NAMES[s->last_dispatched_app],15,1);
 }
}
static void draw_detail(UiCanvas *canvas,UiMetrics *metrics,const HomeState *s){
 const UiColor okay={121,209,156},warn={240,168,111};
 int id=s->selected_app;
 AppAvailability state=id>=0&&id<10?s->availability[id]:APP_UNKNOWN;
 const char *message=DETAIL_INFO[0];
 UiColor stripe={111,149,181};
 RECT(109,153,1062,407,SURFACE);
 RECT(109,153,5,407,stripe);
 STROKE(109,153,1062,407,DIV);
 TXT(151,189,900,26,MUTED,"СЕРВИС  /  СОСТОЯНИЕ ЗАПУСКА",18,1);
 if(id>=0&&id<10)TXT(149,246,922,69,TEXT,NAMES[id],50,1);
 if(s->feedback==FEEDBACK_NOT_REGISTERED){message=DETAIL_INFO[2];stripe=warn;}
 else if(s->feedback==FEEDBACK_LAUNCH_FAILED||s->feedback==FEEDBACK_NO_HOST){message=DETAIL_INFO[3];stripe=warn;}
 else if(state==APP_READY){message=DETAIL_INFO[1];stripe=okay;}
 else if(state==APP_UNAVAILABLE){message=DETAIL_INFO[2];stripe=warn;}
 RECT(151,337,5,41,stripe);
 TXT(171,344,868,32,TEXT,message,22,0);
 TXT(151,399,880,32,MUTED,"Это не Android: запуск зависит от системы Sony.",19,0);
 RECT(151,465,215,54,HERO);
 TXT(177,478,172,30,TEXT,"BACK   Назад",19,1);
 TXT(151,536,970,21,MUTED,"Ничего не устанавливается и не изменяется в прошивке.",14,0);
}
int ui_render(UiCanvas *canvas,const HomeState *state,UiMetrics *metrics){
 int i,x,y,col,row;
 if(!canvas||!state||!metrics||!canvas->emit||canvas->width<320||canvas->height<180||
    canvas->width>4096||canvas->height>2160||state->view<VIEW_TV||state->view>VIEW_DETAIL)return -1;
 metrics->rects=0;metrics->strokes=0;metrics->texts=0;metrics->errors=0;
 /* The real Sony TV picture is never covered by a fake player. */
 if(state->view==VIEW_TV)return 0;
 RECT(0,0,1280,720,BG);
 heading(canvas,metrics,state);
 if(state->view==VIEW_DETAIL){draw_detail(canvas,metrics,state);return metrics->errors?-1:0;}
 /* TV card is a native handoff action. It does not display simulated TV video. */
 RECT(56,100,1168,113,HERO);
 RECT(56,100,5,113,HERO_EDGE);
 RECT(79,125,63,64,TV_BLOCK);
 STROKE(95,143,31,22,TV_STROKE);
 TXT(166,117,725,19,OVERLINE,"ПРОДОЛЖИТЬ ПРОСМОТР",14,1);
 TXT(166,140,654,43,TEXT,"Телевидение",34,1);
 TXT(166,185,740,20,MUTED,"Эфир, HDMI и настройки остаются у Sony",15,0);
 TXT(1076,130,118,42,TEXT,"TV",29,1);
 TXT(1063,176,152,20,MUTED,"Открыть  →",16,0);
 if(state->area==AREA_TV_CARD)outline(canvas,metrics,56,100,1168,113);
 TXT(56,233,760,35,TEXT,"Приложения",27,1);
 TXT(56,266,770,22,MUTED,"10 сервисов · доступность проверяется на ТВ",16,0);
 TXT(1060,244,164,20,MUTED,"СЕТКА  5 × 2",14,1);
 for(i=0;i<10;i++){
  UiColor titleColor=i==4?(UiColor){37,51,65}:(UiColor){223,232,240};
  UiColor signal={103,120,135};
  const char *badge="?";
  col=i%5;row=i/5;
  x=56+col*238;y=297+row*145;
  if(state->availability[i]==APP_READY){signal=(UiColor){122,213,160};badge="✓";}
  else if(state->availability[i]==APP_UNAVAILABLE){signal=(UiColor){238,176,127};badge="×";}
  RECT(x,y,216,130,BRAND[i]);
  /* Precision strips and icon blocks: native primitives only. */
  RECT(x,y,216,4,BRAND_TEXT[i]);
  draw_logo(canvas,metrics,i,x+36,y+13,144,75,state->availability[i]);
  RECT(x+15,y+94,186,1,TILE_DIV);
  TXT(x+15,y+102,173,24,titleColor,NAMES[i],16,1);
  TXT(x+181,y+101,19,24,signal,badge,16,1);
  if(state->last_dispatched_app==i){
    RECT(x+144,y+13,57,22,RECENT_BG);
    TXT(x+149,y+17,50,19,TEXT,"RECENT",10,1);
  }
  if(state->area==AREA_APPS&&state->focus==i)outline(canvas,metrics,x,y,216,130);
 }
 for(i=0;i<4;i++){
  x=56+i*296;y=600;
  RECT(x,y,280,58,SURFACE);
  RECT(x,y,3,58,DOCK_ACCENT);
  TXT(x+18,y+17,250,31,TEXT,DOCK[i],19,1);
  if(state->area==AREA_DOCK&&state->focus==i)outline(canvas,metrics,x,y,280,58);
 }
 TXT(56,681,790,23,MUTED,"← ↑ ↓ →  Навигация     OK  Выбор     BACK  Назад",15,0);
 TXT(962,681,267,20,MUTED,"ЛОКАЛЬНАЯ СБОРКА  ·  v17",12,0);
 return metrics->errors?-1:0;
}
