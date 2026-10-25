#include "ipc_observer.h"
typedef struct {const char *token;size_t length;ObservedEvent event;} Token;
static const Token known[]={
 {"pause",5,OBS_PAUSE},{"resume",6,OBS_RESUME},
 {"stop",4,OBS_STOP},{"shutdown",8,OBS_SHUTDOWN},
 {"suspend",7,OBS_SUSPEND},{"wakeup",6,OBS_WAKEUP},
 {"foregm",6,OBS_FOREGROUND},{"backgm",6,OBS_BACKGROUND}
};
void ipc_observer_init(IpcObserver *o){
 if(o){o->accepted=0;o->unknown=0;o->rejected=0;o->last=OBS_UNKNOWN;}
}
ObservedEvent ipc_observer_token(IpcObserver *o,const char *token,size_t len){
 unsigned i;size_t j;
 if(!o)return OBS_INVALID;
 if(!token||len==0||len>127){o->rejected++;return OBS_INVALID;}
 for(i=0;i<sizeof(known)/sizeof(known[0]);++i){
  if(known[i].length!=len)continue;
  for(j=0;j<len&&token[j]==known[i].token[j];++j){}
  if(j==len){o->last=known[i].event;o->accepted++;return o->last;}
 }
 o->unknown++;o->last=OBS_UNKNOWN;return OBS_UNKNOWN;
}
int ipc_observer_has_native_transport(void){return 0;}
