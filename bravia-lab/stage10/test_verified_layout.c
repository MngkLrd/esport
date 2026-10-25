#include "verified_callback_layout.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
int main(void){
 const char *real[6]={"am_resumed","am_paused","am_stopped","am_shutdowned","am_suspended","am_wakeuped"};
 unsigned i;
 assert(sizeof(SonyDockRegistrationShape32)==60u);
 assert(offsetof(SonyDockRegistrationShape32,process_name)==36u);
 assert(!sony_callback_host_ready());
 for(i=0;i<6;i++){
  const SonyCallbackEvidence *p=sony_callback_evidence(i);
  assert(p&&p->slot_index==i&&p->offset==4*i&&p->role==(SonyCallbackRole)i);
  assert(p->forwarded_function&&!strcmp(p->forwarded_function,real[i]));
 }
 assert(sony_callback_evidence(6)->forwarded_function==0);
 assert(!sony_callback_evidence(7));
 puts("PASS Sony callback metadata (not runtime ABI)");
 return 0;
}
