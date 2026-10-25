#include "ipc_frame_observer.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
typedef struct {unsigned called;BraviaCmd last;} Events;
static void seen(void *ctx,const BraviaCmd *cmd){
 Events *e=(Events*)ctx;e->called++;e->last=*cmd;
}
static void feed(BraviaFrameObserver *s,Events *e,const char *text){
 bravia_frame_feed(s,(const unsigned char*)text,strlen(text),seen,e);
}
int main(void){
 BraviaFrameObserver s;Events e={0};char buf[260];
 bravia_frame_init(&s);
 assert(!bravia_frame_has_transport());
 feed(&s,&e,"prefixignored\n:dockui,am,resume:1\n");
 assert(e.called==1&&s.accepted==1&&s.ignored==13);
 assert(!strcmp(e.last.process,"dockui")&&!strcmp(e.last.command,"resume"));
 feed(&s,&e,"\n:dockui,am,pa");
 assert(e.called==1);
 feed(&s,&e,"use:0\n\n:dockui,am,focus:input:HDMI1\n");
 assert(e.called==3&&s.accepted==3&&!strcmp(e.last.value,"input:HDMI1"));
 feed(&s,&e,"\n:bad,,resume:1\n\n:dockui,notam,resume:1\n\n:dockui,am,abc\n");
 assert(s.malformed==3);
 feed(&s,&e,"\n:dockui,am,stop:\n\n:dockui,am,resume:ok\n");
 assert(e.called==5&&!strcmp(e.last.value,"ok"));
 memset(buf,'X',sizeof(buf));buf[0]='\n';buf[259]='\n';
 bravia_frame_feed(&s,(const unsigned char*)buf,sizeof(buf),seen,&e);
 assert(s.overflow==1);
 feed(&s,&e,":dockui,am,resume:2\n");
 assert(e.called==6&&s.accepted==6&&!strcmp(e.last.value,"2"));
 bravia_frame_feed(&s,0,0,seen,&e);
 bravia_frame_feed(0,(const unsigned char*)"x",1,seen,&e);
 puts("PASS read-only outbound observer: fragments, malformed inputs, oversize recovery");
 return 0;
}
