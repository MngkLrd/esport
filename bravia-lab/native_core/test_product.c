#include "host_dispatch.h"
#include "render.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static unsigned launches;
static int launch(void*unused,Effect e,int index){(void)unused;if(e==FX_OPEN_APP){launches++;return index==3;}return 1;}
static int forward(void*unused,Key k){(void)unused;(void)k;return 1;}
int main(void){
 HomeState s;int redraw;unsigned i;
 BraviaHost host={0,launch,forward};
 home_init(&s);
 assert(s.view==VIEW_TV&&s.last_dispatched_app==-1);
 assert(home_get_app_availability(&s,-1)==APP_UNKNOWN);
 assert(!home_set_app_availability(&s,-1,APP_READY));
 assert(!home_set_app_availability(&s,HOME_APP_COUNT,APP_READY));
 assert(!home_set_app_availability(&s,0,(AppAvailability)4));
 assert(home_set_app_availability(&s,0,APP_UNAVAILABLE));
 assert(home_set_app_availability(&s,3,APP_READY));
 assert(home_get_app_availability(&s,3)==APP_READY);
 assert(host_dispatch(&s,K_HOME,&host,&redraw)==HOST_OK&&s.view==VIEW_HOME);
 assert(host_dispatch(&s,K_DOWN,&host,&redraw)==HOST_OK);
 assert(s.area==AREA_APPS&&s.focus==0);
 assert(host_dispatch(&s,K_OK,&host,&redraw)==HOST_OK);
 assert(s.view==VIEW_DETAIL&&s.feedback==FEEDBACK_NOT_REGISTERED);
 assert(launches==0&&redraw==1);
 assert(host_dispatch(&s,K_BACK,&host,&redraw)==HOST_OK&&s.view==VIEW_HOME);
 for(i=0;i<3;i++)assert(host_dispatch(&s,K_RIGHT,&host,&redraw)==HOST_OK);
 assert(s.focus==3);
 assert(host_dispatch(&s,K_OK,&host,&redraw)==HOST_OK);
 assert(launches==1&&s.last_dispatched_app==3&&s.view==VIEW_HOME&&redraw==0);
 assert(host_dispatch(&s,K_RIGHT,&host,&redraw)==HOST_OK);
 assert(host_dispatch(&s,K_OK,&host,&redraw)==HOST_NATIVE_NOT_AVAILABLE);
 assert(launches==2&&s.view==VIEW_DETAIL&&s.feedback==FEEDBACK_LAUNCH_FAILED);
 assert(s.last_dispatched_app==3);
 assert(host_dispatch(&s,K_HOME,&host,&redraw)==HOST_OK&&s.view==VIEW_HOME);
 assert(host_dispatch(&s,K_SOURCE,0,&redraw)==HOST_UNHANDLED_SYSTEM_KEY);
 assert(host_dispatch(&s,K_VOL_UP,&host,&redraw)==HOST_OK);
 for(i=0;i<10000;i++){
  static const Key keys[]={K_LEFT,K_RIGHT,K_UP,K_DOWN,K_HOME,K_BACK,K_OK,K_SOURCE,K_OPTIONS,K_VOL_DOWN};
  (void)host_dispatch(&s,keys[(i*37u+i/7u)%10u],&host,&redraw);
  assert(s.view>=VIEW_TV&&s.view<=VIEW_DETAIL);
  assert(s.area>=AREA_TV_CARD&&s.area<=AREA_DOCK);
  assert(s.focus>=0&&s.focus<HOME_APP_COUNT);
  assert(s.last_dispatched_app>=-1&&s.last_dispatched_app<HOME_APP_COUNT);
 }
 puts("PASS product: availability fail-closed, no fictitious history, native dispatch ack, 10k remote events");
 return 0;
}
