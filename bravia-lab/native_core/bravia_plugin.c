#include "bravia_plugin.h"
unsigned bravia_plugin_abi(void){return BRAVIA_PLUGIN_ABI;}
unsigned bravia_plugin_sizeof(void){return (unsigned)sizeof(BraviaPlugin);}
static int valid(const BraviaPlugin *p){return p&&p->magic==BRAVIA_PLUGIN_MAGIC&&p->host.abi==BRAVIA_PLUGIN_ABI;}
void bravia_plugin_reset(BraviaPlugin *p){
 if(!p)return;
 p->magic=0u;p->host.abi=0u;p->host.context=0;
 p->host.launch_app=0;p->host.native_action=0;p->host.forward_system_key=0;
 p->bridge.bridged.context=0;p->bridge.bridged.native_action=0;
 p->bridge.bridged.forward_system_key=0;p->bridge.services=0;
 p->bridge.service_count=0u;p->input_count=0u;
 home_init(&p->home);
}
int bravia_plugin_init(BraviaPlugin *p,const BraviaPluginHost *h){
 if(!p||!h||h->abi!=BRAVIA_PLUGIN_ABI)return -1;
 bravia_plugin_reset(p);
 p->host=*h;
 p->magic=BRAVIA_PLUGIN_MAGIC;
 bravia_catalog_host_init(&p->bridge,0,0u,h->context,
                          h->launch_app,h->native_action,h->forward_system_key);
 bravia_catalog_sync_status(&p->home,&p->bridge);
 return 0;
}
int bravia_plugin_set_registry(BraviaPlugin *p,const BraviaHostService *services,unsigned count){
 if(!valid(p)||count>BRAVIA_MAX_SERVICES||(count>0u&&!services))return -1;
 bravia_catalog_host_init(&p->bridge,services,(size_t)count,p->host.context,
                          p->host.launch_app,p->host.native_action,p->host.forward_system_key);
 bravia_catalog_sync_status(&p->home,&p->bridge);
 return 0;
}
int bravia_plugin_key(BraviaPlugin *p,Key key,int *needs_redraw){
 if(!valid(p)||!needs_redraw)return HOST_INVALID;
 p->input_count++;
 return host_dispatch(&p->home,key,&p->bridge.bridged,needs_redraw);
}
const HomeState *bravia_plugin_state(const BraviaPlugin *p){return valid(p)?&p->home:0;}
int bravia_plugin_render(BraviaPlugin *p,int width,int height,void *ctx,
                         int (*emit)(void *,const UiCommand *),UiMetrics *out){
 UiCanvas canvas;
 if(!valid(p)||!emit||!out)return -1;
 canvas.width=width;canvas.height=height;canvas.context=ctx;canvas.emit=emit;
 return ui_render(&canvas,&p->home,out);
}
