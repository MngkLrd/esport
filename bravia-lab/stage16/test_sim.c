#include "sim.h"
#include <assert.h>
#include <stdio.h>
static int on_draw(void *context,const UiCommand *cmd){
 int *i=(int*)context;if(!cmd)return 0;(*i)++;return 1;
}
static int reject_draw(void *c,const UiCommand *d){(void)c;(void)d;return 0;}
static int draw(BraviaSim *s){int count=0;UiCanvas cv={1280,720,&count,on_draw};int n=sim_render(s,&cv);assert(n==count);return n;}
int main(void){
 BraviaSim s;HomeState h;UiCanvas broken={1280,720,0,reject_draw};int i,events;
 sim_init(&s);assert(s.owner==SIM_TV&&s.home.view==VIEW_TV);
 assert(draw(&s)==0&&s.frames==0);
 assert(sim_key(&s,K_HOME)==HOST_OK);
 assert(s.owner==SIM_HOME&&s.home.view==VIEW_HOME&&draw(&s)==94);
 assert(draw(&s)==0&&s.skipped_frames>=2);
 assert(sim_set_app(&s,3,APP_READY));
 assert(sim_set_app(&s,9,APP_UNAVAILABLE));
 assert(!sim_set_app(&s,10,APP_READY));
 assert(!sim_set_app(&s,0,(AppAvailability)55));
 assert(draw(&s)==94);
 assert(sim_key(&s,K_DOWN)==HOST_OK);
 assert(sim_key(&s,K_OK)==HOST_NATIVE_NOT_AVAILABLE);
 assert(s.owner==SIM_HOME&&s.home.view==VIEW_DETAIL);
 assert(s.home.last_dispatched_app==-1&&s.home.feedback==FEEDBACK_LAUNCH_FAILED);
 assert(draw(&s)>0);
 assert(sim_key(&s,K_BACK)==HOST_OK&&s.home.view==VIEW_HOME);
 assert(draw(&s)==94);
 assert(sim_key(&s,K_RIGHT)==HOST_OK);assert(sim_key(&s,K_RIGHT)==HOST_OK);assert(sim_key(&s,K_RIGHT)==HOST_OK);
 assert(s.home.focus==3);
 assert(sim_key(&s,K_OK)==HOST_OK);
 assert(s.owner==SIM_APP&&s.foreground_app==3&&s.home.last_dispatched_app==3);
 assert(draw(&s)==0);
 {
  int forwarded=s.forwarded_count;
  assert(sim_key(&s,K_DOWN)==HOST_OK&&s.owner==SIM_APP);
  assert(sim_key(&s,K_OK)==HOST_OK&&s.owner==SIM_APP);
  assert(s.forwarded_count==forwarded+2);
 }
 assert(sim_key(&s,K_VOL_UP)==HOST_OK&&s.remote_last==K_VOL_UP);
 assert(sim_key(&s,K_SOURCE)==HOST_OK&&s.remote_last==K_SOURCE);
 assert(sim_key(&s,K_BACK)==HOST_OK&&s.owner==SIM_HOME&&s.home.view==VIEW_HOME);
 assert(draw(&s)>=94);
 assert(sim_key(&s,K_DOWN)==HOST_OK);
 assert(sim_key(&s,K_RIGHT)==HOST_OK);
 assert(s.home.focus==9);
 assert(sim_key(&s,K_OK)==HOST_OK);
 assert(s.home.feedback==FEEDBACK_NOT_REGISTERED&&s.owner==SIM_HOME);
 assert(s.home.last_dispatched_app==3);
 assert(sim_key(&s,K_BACK)==HOST_OK);assert(draw(&s)>0);
 assert(sim_key(&s,K_DOWN)==HOST_OK);assert(s.home.area==AREA_DOCK);
 assert(sim_key(&s,K_LEFT)==HOST_OK);
 assert(sim_key(&s,K_OK)==HOST_OK);
 assert(s.owner==SIM_NATIVE_MENU&&s.menu==SIM_INPUTS&&draw(&s)==0);
 {
  int forwarded=s.forwarded_count;
  assert(sim_key(&s,K_DOWN)==HOST_OK&&s.owner==SIM_NATIVE_MENU);
  assert(sim_key(&s,K_OK)==HOST_OK&&s.owner==SIM_NATIVE_MENU);
  assert(s.forwarded_count==forwarded+2);
  assert(draw(&s)==0);
 }
 assert(sim_key(&s,K_BACK)==HOST_OK&&s.owner==SIM_HOME);
 assert(draw(&s)>=94);
 sim_enable_menu(&s,SIM_INPUTS,0);
 assert(sim_key(&s,K_OK)==HOST_NATIVE_NOT_AVAILABLE);
 assert(s.owner==SIM_HOME&&s.home.view==VIEW_HOME);
 assert(draw(&s)==0);
 assert(sim_key(&s,K_LEFT)==HOST_OK);
 assert(sim_render(&s,&broken)==-1&&s.dirty==1);
 assert(draw(&s)>=94);
 h=s.home;events=s.forwarded_count;
 assert(sim_key(&s,K_OPTIONS)==HOST_OK);
 assert(s.forwarded_count==events+1&&s.remote_last==K_OPTIONS);
 assert(s.home.focus==h.focus&&s.home.area==h.area);
 assert(sim_key(&s,K_BACK)==HOST_OK);
 assert(s.owner==SIM_TV&&s.home.view==VIEW_TV&&draw(&s)==0);
 assert(sim_key(&s,K_HOME)==HOST_OK);
 for(i=0;i<100000;i++){
  static const Key keys[]={K_UP,K_RIGHT,K_DOWN,K_LEFT,K_OPTIONS,K_HOME};
  HostResult r=sim_key(&s,keys[i%6]);
  assert(r==HOST_OK);
  assert(s.home.focus>=0&&s.home.focus<HOME_APP_COUNT);
  assert(s.home.area>=AREA_TV_CARD&&s.home.area<=AREA_DOCK);
 }
 assert(s.owner==SIM_HOME);assert(draw(&s)>=0);
 assert(sim_key(0,K_HOME)==HOST_INVALID);
 printf("PASS Stage16 simulated TV/APP/MENU focus, native C draws, app states, system keys, 100000 inputs; frames=%lu calls=%lu skipped=%lu\n",s.frames,s.draw_calls,s.skipped_frames);
 return 0;
}
