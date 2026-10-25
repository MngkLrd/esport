#include "render.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
typedef struct {int seen,focused,tiles,err,ready_glyph,unknown_glyph,unavailable_glyph,recent;int width,height;} Stats;
static int inspect(void *ptr,const UiCommand *cmd){
 Stats *s=(Stats*)ptr;
 int i;
 if(cmd->x<0||cmd->y<0||cmd->w<=0||cmd->h<=0||cmd->x+cmd->w>s->width||cmd->y+cmd->h>s->height){s->err++;return 0;}
 s->seen++;
 if(cmd->op==UI_RECT){
  for(i=0;i<10;i++){
   int w=(int)((((56+(i%5)*238+216)*s->width+640)/1280)-((56+(i%5)*238)*s->width+640)/1280);
   int h=(int)((((297+(i/5)*145+130)*s->height+360)/720)-((297+(i/5)*145)*s->height+360)/720);
   int x=(int)(((56+(i%5)*238)*s->width+640)/1280);
   int y=(int)(((297+(i/5)*145)*s->height+360)/720);
   if(cmd->x==x&&cmd->y==y&&cmd->w==w&&cmd->h==h)s->tiles++;
  }
 }
 if(cmd->op==UI_STROKE&&cmd->color.r==235)s->focused++;
 if(cmd->op==UI_TEXT&&cmd->text){
  if(!strcmp(cmd->text,"✓"))s->ready_glyph++;
  if(!strcmp(cmd->text,"?"))s->unknown_glyph++;
  if(!strcmp(cmd->text,"×"))s->unavailable_glyph++;
  if(!strcmp(cmd->text,"RECENT"))s->recent++;
 }
 return 1;
}
static int failure(void *ptr,const UiCommand *cmd){(void)ptr;(void)cmd;return 0;}
static int run(int width,int height,HomeState *home,Stats *s,UiMetrics *metrics){
 UiCanvas c={width,height,s,inspect};s->width=width;s->height=height;
 return ui_render(&c,home,metrics);
}
int main(void){
 HomeState home;UiMetrics m;Stats s;
 const int sizes[][2]={{1280,720},{1920,1080},{1366,768},{1024,768},{640,360}};
 int i,base_ops=-1;
 home_init(&home);
 for(i=0;i<5;i++){
  memset(&s,0,sizeof(s));assert(run(sizes[i][0],sizes[i][1],&home,&s,&m)==0);
  assert(m.rects==0&&m.strokes==0&&m.texts==0);
 }
 home_key(&home,K_HOME);
 for(i=0;i<5;i++){
  memset(&s,0,sizeof(s));assert(run(sizes[i][0],sizes[i][1],&home,&s,&m)==0);
  assert(s.err==0&&m.errors==0&&m.rects>=35&&m.texts>=40&&m.strokes>=3);
  assert(s.tiles==10&&s.unknown_glyph==10&&s.focused==1);
  if(base_ops<0)base_ops=s.seen;else assert(base_ops==s.seen);
 }
 assert(home_set_app_availability(&home,3,APP_READY));
 assert(home_set_app_availability(&home,9,APP_UNAVAILABLE));
 home.last_dispatched_app=3;
 memset(&s,0,sizeof(s));assert(run(1280,720,&home,&s,&m)==0);
 assert(s.ready_glyph==1&&s.unavailable_glyph==1&&s.unknown_glyph==8&&s.recent==1);
 home_key(&home,K_DOWN);memset(&s,0,sizeof(s));
 assert(run(1280,720,&home,&s,&m)==0&&s.focused==1);
 home_key(&home,K_DOWN);home_key(&home,K_RIGHT);home_key(&home,K_OK);
 memset(&s,0,sizeof(s));assert(run(1280,720,&home,&s,&m)==0&&m.texts>=6&&m.rects>=4);
 home_key(&home,K_BACK);home_key(&home,K_BACK);
 memset(&s,0,sizeof(s));assert(run(1280,720,&home,&s,&m)==0&&s.seen==0);
 {UiCanvas fail={1280,720,0,failure};home_key(&home,K_HOME);
  assert(ui_render(&fail,&home,&m)==-1&&m.errors>0);}
 {UiCanvas shortcv={319,720,&s,inspect};assert(ui_render(&shortcv,&home,&m)==-1);}
 assert(ui_render(0,&home,&m)==-1);
 assert(ui_render(&(UiCanvas){1280,720,&s,inspect},&home,0)==-1);
 printf("PASS render: 5 sizes, ten tile geometries, live app status, recent, focus, TV protection\n");
 return 0;
}
