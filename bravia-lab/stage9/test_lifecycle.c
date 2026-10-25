#include "lifecycle.h"
#include <assert.h>
#include <stdio.h>
static int dangerous(void *p,TvAppEvent e){(void)e;*(int*)p=1;return 1;}
int main(void){
 TvLifecycle l;TvHostHooks h;int invoked=0;unsigned x;
 tv_lifecycle_init(&l);assert(l.state==TV_APP_STOPPED);
 assert(tv_lifecycle_event(&l,TV_EVENT_STARTED)==TV_GATE_DENIED);
 assert(tv_lifecycle_event(&l,TV_EVENT_START)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_STARTED)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_PAUSE)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_RESUME)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_SUSPEND)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_WAKE)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_STOP)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_STOPPED)==TV_GATE_OK);
 assert(tv_lifecycle_event(&l,TV_EVENT_WAKE)==TV_GATE_DENIED);
 assert(tv_lifecycle_event(&l,(TvAppEvent)100)==TV_GATE_BAD_EVENT);
 h.opaque=&invoked;h.native_callback=dangerous;
 for(x=1;x<10;x++)assert(tv_lifecycle_send_unsupported(&l,&h,(TvAppEvent)x)==TV_GATE_DENIED);
 assert(invoked==0&&l.forwarded_count==0&&l.transition_count==8);
 assert(tv_lifecycle_event(0,TV_EVENT_START)==TV_GATE_BAD_EVENT);
 assert(tv_lifecycle_send_unsupported(0,&h,TV_EVENT_START)==TV_GATE_DENIED);
 puts("PASS lifecycle model; unverified Sony IPC blocked");return 0;
}
