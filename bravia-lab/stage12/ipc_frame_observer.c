#include "ipc_frame_observer.h"
/* Freestanding-safe: no required libc helper functions. */
static int token_char(unsigned char c){
 return (c>='a'&&c<='z')||(c>='A'&&c<='Z')||
        (c>='0'&&c<='9')||c=='_'||c=='-'||c=='.';
}
static int span(char *dst,size_t cap,const char *first,size_t len){
 size_t i;
 if(!len||len>=cap)return 0;
 for(i=0;i<len;i++){
  if(!token_char((unsigned char)first[i]))return 0;
  dst[i]=first[i];
 }
 dst[len]='\0';return 1;
}
static int parse(const char *src,size_t n,BraviaCmd *out){
 size_t i,comma1=0,comma2=0,colon=0;
 int count1=0,count2=0,countc=0;
 if(n<7||src[0]!=':')return 0;
 for(i=1;i<n;i++){
  if(src[i]==','){
   if(!count1){comma1=i;count1=1;}
   else if(!count2){comma2=i;count2=1;}
   else return 0;
  }else if(src[i]==':'&&!countc){colon=i;countc=1;}
 }
 if(!count1||!count2||!countc||comma1<=1||comma2<=comma1+1||colon<=comma2+1)return 0;
 if(comma2-comma1!=3||src[comma1+1]!='a'||src[comma1+2]!='m')return 0;
 if(!span(out->process,sizeof(out->process),src+1,comma1-1))return 0;
 if(!span(out->command,sizeof(out->command),src+comma2+1,colon-comma2-1))return 0;
 if(n-colon-1>=sizeof(out->value))return 0;
 for(i=colon+1;i<n;i++)if((unsigned char)src[i]<32||src[i]==127)return 0;
 for(i=0;i<n-colon-1;i++)out->value[i]=src[colon+1+i];
 out->value[n-colon-1]='\0';
 return 1;
}
void bravia_frame_init(BraviaFrameObserver *s){
 if(s){
  volatile unsigned char *bytes=(volatile unsigned char*)s;
  size_t i;
  for(i=0;i<sizeof(*s);i++)bytes[i]=0;
 }
}
void bravia_frame_feed(BraviaFrameObserver *s,const unsigned char *data,size_t len,
                       BraviaFrameSeen cb,void *ctx){
 size_t i;
 if(!s||(!data&&len))return;
 for(i=0;i<len;i++){
  unsigned char c=data[i];
  if(c=='\n'){
   if(s->dropping){s->dropping=0;s->collecting=1;s->size=0;continue;}
   if(s->collecting&&s->size){
    BraviaCmd cmd;
    if(parse(s->buffer,s->size,&cmd)){
     s->accepted++;if(cb)cb(ctx,&cmd);
    }else s->malformed++;
   }
   s->collecting=1;s->size=0;
  }else if(!s->collecting){s->ignored++;}
  else if(!s->dropping){
   if(s->size>=BRAVIA_MAX_FRAME){s->overflow++;s->dropping=1;s->size=0;}
   else s->buffer[s->size++]=(char)c;
  }
 }
}
int bravia_frame_has_transport(void){return 0;}
