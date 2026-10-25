#include "verified_callback_layout.h"
typedef char record_size_assert[(sizeof(SonyDockRegistrationShape32)==60u)?1:-1];
typedef char record_name_assert[(offsetof(SonyDockRegistrationShape32,process_name)==36u)?1:-1];
static const SonyCallbackEvidence roles[SONY_EVT_COUNT]={
 {0,0,SONY_EVT_RESUME,"am_resumed","DockUI ELF 0x963c"},
 {1,4,SONY_EVT_PAUSE,"am_paused","DockUI ELF 0x96a0"},
 {2,8,SONY_EVT_STOP,"am_stopped","DockUI ELF 0x9704"},
 {3,12,SONY_EVT_SHUTDOWN,"am_shutdowned","DockUI ELF 0x9734"},
 {4,16,SONY_EVT_SUSPEND,"am_suspended","DockUI ELF 0x9764"},
 {5,20,SONY_EVT_WAKE,"am_wakeuped","DockUI ELF 0x9798"},
 {6,24,SONY_EVT_UNDEFINED,(const char*)0,"No-op at DockUI ELF 0x97c4"}
};
const SonyCallbackEvidence *sony_callback_evidence(unsigned slot){
 return slot<SONY_EVT_COUNT?&roles[slot]:(const SonyCallbackEvidence*)0;
}
int sony_callback_host_ready(void){return 0;}
