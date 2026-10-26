#include "bravia_plugin.h"
#include <assert.h>
#include <stdio.h>
static int launched=-1,forwarded=0,draw_count=0;
static int launch(void *context,int service){(void)context;launched=service;return 1;}
static int native(void *context,Effect effect){(void)context;return effect!=FX_NATIVE_INPUTS;}
static int forward(void *context,Key key){(void)context;forwarded++;return key!=K_TITLE_LIST;}
static int draw(void *context,const UiCommand *cmd){(void)context;draw_count++;return cmd!=0;}
int main(void){
 BraviaPlugin p;
 BraviaPluginHost h={BRAVIA_PLUGIN_ABI,0,launch,native,forward};
 const BraviaHostService apps[]={
  {"Netflix",17,1,1},{"YouTube",21,1,0},
  {"Prime Video",30,1,1},{"browser_base",25,1,1}
 };
 int dirty=-1,i;UiMetrics metrics;
 assert(bravia_plugin_abi()==BRAVIA_PLUGIN_ABI);
 assert(bravia_plugin_sizeof()==sizeof p);
 assert(bravia_plugin_init(&p,&h)==0);
 assert(bravia_plugin_state(&p)->view==VIEW_TV);
 assert(bravia_plugin_render(&p,1280,720,0,draw,&metrics)==0);
 assert(draw_count==0);
 assert(bravia_plugin_set_registry(&p,apps,4u)==0);
 assert(p.home.availability[3]==APP_READY);
 assert(p.home.availability[4]==APP_UNKNOWN);
 assert(p.home.availability[9]==APP_UNKNOWN);
 assert(bravia_plugin_key(&p,K_HOME,&dirty)==HOST_OK);
 assert(p.home.view==VIEW_HOME&&dirty);
 assert(bravia_plugin_render(&p,1280,720,0,draw,&metrics)==0);
 assert(draw_count==94);
 assert(bravia_plugin_key(&p,K_DOWN,&dirty)==HOST_OK);
 assert(bravia_plugin_key(&p,K_OK,&dirty)==HOST_NATIVE_NOT_AVAILABLE);
 assert(launched==-1);
 assert(bravia_plugin_key(&p,K_BACK,&dirty)==HOST_OK);
 for(i=0;i<3;i++)assert(bravia_plugin_key(&p,K_RIGHT,&dirty)==HOST_OK);
 assert(p.home.focus==3);
 assert(bravia_plugin_key(&p,K_OK,&dirty)==HOST_OK);
 assert(launched==17&&p.home.last_dispatched_app==3);
 assert(bravia_plugin_key(&p,K_OPTIONS,&dirty)==HOST_OK);
 assert(forwarded==1);
 assert(bravia_plugin_key(&p,K_TITLE_LIST,&dirty)==HOST_UNHANDLED_SYSTEM_KEY);
 assert(forwarded==2);
 assert(bravia_plugin_set_registry(&p,0,0u)==0);
 assert(p.home.availability[3]==APP_UNKNOWN);
 assert(bravia_plugin_key(&p,K_OK,&dirty)==HOST_NATIVE_NOT_AVAILABLE);
 assert(launched==17);
 assert(bravia_plugin_set_registry(&p,0,1u)==-1);
 assert(bravia_plugin_set_registry(&p,apps,129u)==-1);
 assert(bravia_plugin_key(&p,K_VOL_UP,0)==HOST_INVALID);
 bravia_plugin_reset(&p);
 assert(bravia_plugin_state(&p)==0);
 assert(bravia_plugin_key(&p,K_HOME,&dirty)==HOST_INVALID);
 h.abi=9u;
 assert(bravia_plugin_init(&p,&h)==-1);
 puts("PASS Stage23 linked native HOME: render, versioned host ABI, exact service routes, TV focus and Sony keys");
 return 0;
}
