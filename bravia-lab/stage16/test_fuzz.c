/* Deterministic, nondestructive Stage16 fuzz on mock TV stack only. */
#include "sim.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
static uint32_t seed=0x1987ab52U;
static uint32_t random_u32(void){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return seed;}
static int check_command(void *ctx,const UiCommand *c){
 int *size=(int*)ctx;
 if(!c||c->x<0||c->y<0||c->w<=0||c->h<=0||
    c->x+c->w>size[0]||c->y+c->h>size[1]||c->font_px<0)return 0;
 return 1;
}
int main(void){
 static const int sizes[7][2]={{320,180},{640,360},{1024,768},{1280,720},
                               {1920,1080},{3840,2160},{4096,2160}};
 BraviaSim sim;int i;
 sim_init(&sim);
 for(i=0;i<250000;i++){
  uint32_t v=random_u32();
  if(i%19==0){
   int index=(int)(v%13u)-1;
   int availability=(int)(v%5u)-1;
   (void)sim_set_app(&sim,index,(AppAvailability)availability);
  }
  if(i%83==0)sim_enable_menu(&sim,(SimMenu)(1+(v%3u)),(int)((v>>16)&1u));
  (void)sim_key(&sim,(Key)(1+v%23u));
  if(sim.owner==SIM_HOME)assert(sim.home.view==VIEW_HOME||sim.home.view==VIEW_DETAIL);
  if(sim.owner==SIM_APP)assert(sim.foreground_app>=0&&sim.foreground_app<HOME_APP_COUNT);
  assert(sim.home.focus>=0&&sim.home.focus<HOME_APP_COUNT);
  assert(sim.home.area>=AREA_TV_CARD&&sim.home.area<=AREA_DOCK);
  assert(sim.home.last_dispatched_app>=-1&&sim.home.last_dispatched_app<HOME_APP_COUNT);
  if(i%67==0){
   int bounds[2];UiCanvas canvas;int j=(int)((v>>7)%7u);
   bounds[0]=sizes[j][0];bounds[1]=sizes[j][1];
   canvas.width=bounds[0];canvas.height=bounds[1];
   canvas.context=bounds;canvas.emit=check_command;
   assert(sim_render(&sim,&canvas)>=0);
  }
 }
 puts("PASS Stage16 fuzz: 250000 random keys/service states/menu states, 7 resolutions");
 return 0;
}
