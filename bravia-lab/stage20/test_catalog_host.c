#include "catalog_host.h"
#include <assert.h>
#include <stdio.h>
static int launched_id=-1,forwarded_key=-1,native_effect=-1;
static int launch(void *arg,int id){(void)arg;launched_id=id;return 1;}
static int system(void *arg,Effect effect){(void)arg;native_effect=(int)effect;return 1;}
static int forward(void *arg,Key key){(void)arg;forwarded_key=(int)key;return 1;}
int main(void){
 HomeState home;BraviaCatalogHost context;int redraw=0;
 BraviaHostService registered[]={
  {"Netflix",7,1,1},{"YouTube",13,1,0},
  {"browser_base",1,1,1},{"Prime Video",9,1,1}
 };
 home_init(&home);
 bravia_catalog_host_init(&context,registered,4,NULL,launch,system,forward);
 bravia_catalog_sync_status(&home,&context);
 assert(home.availability[3]==APP_READY);
 assert(home.availability[8]==APP_READY);
 assert(home.availability[4]==APP_UNKNOWN);
 assert(home.availability[9]==APP_UNKNOWN);
 assert(host_dispatch(&home,K_HOME,&context.bridged,&redraw)==HOST_OK);
 assert(host_dispatch(&home,K_VOL_UP,&context.bridged,&redraw)==HOST_OK);
 assert(forwarded_key==K_VOL_UP);
 assert(host_dispatch(&home,K_DOWN,&context.bridged,&redraw)==HOST_OK);
 assert(host_dispatch(&home,K_OK,&context.bridged,&redraw)==HOST_NATIVE_NOT_AVAILABLE);
 assert(launched_id==-1 && home.feedback==FEEDBACK_LAUNCH_FAILED);
 assert(host_dispatch(&home,K_BACK,&context.bridged,&redraw)==HOST_OK);
 assert(host_dispatch(&home,K_RIGHT,&context.bridged,&redraw)==HOST_OK);
 assert(host_dispatch(&home,K_RIGHT,&context.bridged,&redraw)==HOST_OK);
 assert(host_dispatch(&home,K_RIGHT,&context.bridged,&redraw)==HOST_OK);
 assert(home.focus==3);
 assert(host_dispatch(&home,K_OK,&context.bridged,&redraw)==HOST_OK);
 assert(launched_id==7 && home.last_dispatched_app==3);
 assert(home.view==VIEW_HOME);
 assert(host_dispatch(&home,K_SOURCE,&context.bridged,&redraw)==HOST_OK);
 assert(forwarded_key==K_SOURCE);
 registered[0].host_verified=0;
 bravia_catalog_sync_status(&home,&context);
 assert(home.availability[3]==APP_UNKNOWN);
 assert(host_dispatch(&home,K_OK,&context.bridged,&redraw)==HOST_NATIVE_NOT_AVAILABLE);
 assert(launched_id==7);
 bravia_catalog_host_init(&context,registered,4,NULL,NULL,NULL,NULL);
 assert(host_dispatch(&home,K_VOL_DOWN,&context.bridged,&redraw)==HOST_UNHANDLED_SYSTEM_KEY);
 puts("PASS Stage20 native HOME adapter: verified app route, no arbitrary Sony app launch, system key passthrough");
 return 0;
}
