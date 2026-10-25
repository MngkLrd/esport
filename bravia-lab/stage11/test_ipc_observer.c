#include "ipc_observer.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(void){
 IpcObserver o;
 static const char *tokens[]={"pause","resume","stop","shutdown","suspend","wakeup","foregm","backgm"};
 int i;
 ipc_observer_init(&o);
 assert(!ipc_observer_has_native_transport());
 for(i=0;i<8;i++){
  assert(ipc_observer_token(&o,tokens[i],strlen(tokens[i]))==(ObservedEvent)(OBS_PAUSE+i));
 }
 assert(o.accepted==8&&o.rejected==0&&o.unknown==0);
 assert(ipc_observer_token(&o,"PAUSE",5)==OBS_UNKNOWN);
 assert(ipc_observer_token(&o,"pause=1",7)==OBS_UNKNOWN);
 assert(ipc_observer_token(&o,"pause\n",6)==OBS_UNKNOWN);
 assert(ipc_observer_token(&o,"pause",0)==OBS_INVALID);
 assert(ipc_observer_token(&o,"pause",128)==OBS_INVALID);
 assert(ipc_observer_token(&o,0,1)==OBS_INVALID);
 assert(ipc_observer_token(0,"pause",5)==OBS_INVALID);
 assert(o.accepted==8&&o.unknown==3&&o.rejected==3);
 puts("PASS: 8 real ABI event tokens; strict bounds; no Sony IPC transmitter");
 return 0;
}
