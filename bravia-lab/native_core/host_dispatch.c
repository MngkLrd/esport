#include "host_dispatch.h"
HostResult host_dispatch(HomeState *state,Key key,const BraviaHost *host,int *redraw){
 HomeState before;
 HomeEvent event;
 if(!state||!redraw)return HOST_INVALID;
 before=*state;
 *redraw=0;
 event=home_key(state,key);
 if(event.effect==FX_PASS_TO_SYSTEM){
  /* No interception if adapter is absent. Real Sony keys must go to Sony. */
  if(!host||!host->forward_system_key||host->forward_system_key(host->context,key)!=1)
   return HOST_UNHANDLED_SYSTEM_KEY;
  return HOST_OK;
 }
 if(event.effect!=FX_NONE){
  if(!host||!host->native_action||
    host->native_action(host->context,event.effect,event.app_index)!=1){
    /* The UI still shows a detail placeholder for apps: never imply success. */
    if(event.effect!=FX_OPEN_APP)*state=before;
    else state->feedback=(host&&host->native_action)?FEEDBACK_LAUNCH_FAILED:FEEDBACK_NO_HOST;
    *redraw=state->view!=before.view||state->area!=before.area||state->focus!=before.focus;
    return HOST_NATIVE_NOT_AVAILABLE;
  }
  /* Once an app takes focus, returning from the app should show HOME, not a fake detail. */
  if(event.effect==FX_OPEN_APP){
    state->last_dispatched_app=event.app_index;
    state->view=VIEW_HOME;state->selected_app=-1;state->feedback=FEEDBACK_NONE;
  }
  /* The native TV/app/system overlay owns focus after dispatch. Do not render. */
  *redraw=0;
  return HOST_OK;
 }
 *redraw=before.view!=state->view||before.area!=state->area||before.focus!=state->focus||before.selected_app!=state->selected_app||before.feedback!=state->feedback;
 return HOST_OK;
}
