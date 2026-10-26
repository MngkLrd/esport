#include "catalog_host.h"
static int catalog_action(void *context,Effect effect,int app_index){
 BraviaCatalogHost *a=(BraviaCatalogHost*)context;
 if(!a)return 0;
 if(effect==FX_OPEN_APP){
  BraviaRoute route;
  if(app_index<0||app_index>=BRAVIA_CATALOG_APPS||
     !a->launch_verified_service)return 0;
  route=bravia_catalog_resolve((size_t)app_index,a->services,a->service_count);
  if(route.status!=BRAVIA_ROUTE_READY)return 0;
  return a->launch_verified_service(a->host_context,route.service_id)==1;
 }
 if(!a->native_system_action)return 0;
 return a->native_system_action(a->host_context,effect)==1;
}
static int catalog_system_key(void *context,Key key){
 BraviaCatalogHost *a=(BraviaCatalogHost*)context;
 return a&&a->forward_system_key&&
    a->forward_system_key(a->host_context,key)==1;
}
void bravia_catalog_host_init(BraviaCatalogHost *out,
                              const BraviaHostService *services,
                              size_t count,
                              void *host_context,
                              int (*launch)(void *,int),
                              int (*native_system_action)(void *,Effect),
                              int (*forward_system_key)(void *,Key)){
 if(!out)return;
 out->services=services;
 out->service_count=count;
 out->host_context=host_context;
 out->launch_verified_service=launch;
 out->native_system_action=native_system_action;
 out->forward_system_key=forward_system_key;
 out->bridged.context=out;
 out->bridged.native_action=catalog_action;
 out->bridged.forward_system_key=catalog_system_key;
}
void bravia_catalog_sync_status(HomeState *state,const BraviaCatalogHost *host){
 size_t i;
 if(!state)return;
 for(i=0;i<BRAVIA_CATALOG_APPS;i++){
  BraviaRoute route={BRAVIA_ROUTE_UNAVAILABLE,-1};
  if(host)route=bravia_catalog_resolve(i,host->services,host->service_count);
  (void)home_set_app_availability(state,(int)i,
   route.status==BRAVIA_ROUTE_READY?APP_READY:APP_UNKNOWN);
 }
}
