#include "ipc_frame_observer.h"
#include <string.h>
#include <assert.h>
#include <stdio.h>
typedef struct{unsigned seen;unsigned invalid;} Seen;
static void on_frame(void *p,const BraviaCmd *c){
 Seen *s=(Seen*)p;s->seen++;if(strcmp(c->process,"dockui"))s->invalid++;
}
int main(void){
 const char *raw="\n:dockui,am,pause:0\n\n:dockui,am,resume:1\n\n:dockui,am,stop:0\n";
 size_t step,offset,n,bytes=strlen(raw);
 for(step=1;step<=30;step++){
  BraviaFrameObserver s;Seen rec={0};bravia_frame_init(&s);
  for(offset=0;offset<bytes;offset+=step){
   n=bytes-offset;if(n>step)n=step;
   bravia_frame_feed(&s,(const unsigned char*)raw+offset,n,on_frame,&rec);
  }
  assert(rec.seen==3&&rec.invalid==0&&s.accepted==3&&s.malformed==0&&s.overflow==0);
 }
 puts("PASS: 30 fragmentation patterns");
 return 0;
}
