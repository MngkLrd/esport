#include "host_dispatch.h"
#include <stdio.h>
#include <assert.h>
static int was_action,was_key;
static int ok(void *ctx,Effect effect,int app){(void)ctx;(void)app;was_action=effect;return 1;}
static int fail(void *ctx,Effect effect,int app){(void)ctx;(void)effect;(void)app;return 0;}
static int forward(void *ctx,Key k){(void)ctx;was_key=(int)k;return 1;}
int main(void){
 HomeState s;int redraw=-1;BraviaHost none={0,0,0},allowed={0,ok,forward},denied={0,fail,forward};
 home_init(&s);
 assert(host_dispatch(&s,K_VOL_UP,&none,&redraw)==HOST_UNHANDLED_SYSTEM_KEY);
 assert(s.view==VIEW_TV&&redraw==0);
 assert(host_dispatch(&s,K_SETTINGS,&allowed,&redraw)==HOST_OK);
 assert(was_key==(int)K_SETTINGS&&redraw==0);
 assert(host_dispatch(&s,K_HOME,&allowed,&redraw)==HOST_OK);
 assert(s.view==VIEW_HOME&&redraw==1);
 assert(host_dispatch(&s,K_DOWN,&allowed,&redraw)==HOST_OK);
 assert(s.area==AREA_APPS&&redraw==1);
 assert(host_dispatch(&s,K_DOWN,&allowed,&redraw)==HOST_OK);
 assert(host_dispatch(&s,K_OK,&denied,&redraw)==HOST_NATIVE_NOT_AVAILABLE);
 assert(s.view==VIEW_DETAIL);
 assert(host_dispatch(&s,K_BACK,&allowed,&redraw)==HOST_OK);
 assert(s.view==VIEW_HOME);
 assert(host_dispatch(&s,K_BACK,&denied,&redraw)==HOST_NATIVE_NOT_AVAILABLE);
 assert(s.view==VIEW_HOME);
 assert(host_dispatch(&s,K_DOWN,&allowed,&redraw)==HOST_OK);
 assert(host_dispatch(&s,K_DOWN,&allowed,&redraw)==HOST_OK);
 assert(s.area==AREA_DOCK);
 assert(host_dispatch(&s,K_RIGHT,&allowed,&redraw)==HOST_OK);
 assert(host_dispatch(&s,K_RIGHT,&allowed,&redraw)==HOST_OK);
 assert(host_dispatch(&s,K_RIGHT,&allowed,&redraw)==HOST_OK);
 assert(host_dispatch(&s,K_OK,&denied,&redraw)==HOST_NATIVE_NOT_AVAILABLE);
 assert(s.view==VIEW_HOME);
 assert(host_dispatch(&s,K_OK,&allowed,&redraw)==HOST_OK);
 assert(was_action==FX_NATIVE_SETTINGS&&redraw==0);
 assert(s.view==VIEW_HOME);
 assert(host_dispatch(&s,K_SOURCE,&none,&redraw)==HOST_UNHANDLED_SYSTEM_KEY);
 assert(host_dispatch(0,K_HOME,&none,&redraw)==HOST_INVALID);
 assert(host_dispatch(&s,K_HOME,&none,0)==HOST_INVALID);
 printf("PASS host dispatch: system keys unhandled without Sony adapter, native intent rollback, no focus steal\n");
 return 0;
}
