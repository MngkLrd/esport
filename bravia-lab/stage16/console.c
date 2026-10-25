#define _POSIX_C_SOURCE 200809L
#include "sim.h"
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/resource.h>
static Key decode(int c){
 switch(c){
 case 'h':return K_HOME;case 'w':return K_UP;case 'a':return K_LEFT;
 case 's':return K_DOWN;case 'd':return K_RIGHT;case 'o':return K_OK;
 case 'b':return K_BACK;case '+':return K_VOL_UP;case '-':return K_VOL_DOWN;
 case 'i':return K_SOURCE;case 'g':return K_GUIDE;case 'p':return K_OPTIONS;
 case 'v':return K_VOL_DOWN;default:return (Key)0;
 }
}
static int count(void *ctx,const UiCommand *cmd){
 unsigned *p=(unsigned*)ctx;
 if(!p||!cmd)return 0;
 (*p)++;return 1;
}
static int draw(BraviaSim *s){
 UiCanvas ui;unsigned commands=0;
 int rendered;
 ui.width=1280;ui.height=720;ui.context=&commands;ui.emit=count;
 rendered=sim_render(s,&ui);
 if(rendered>=0&&rendered!=(int)commands){fputs("Internal draw count mismatch\n",stderr);return -1;}
 return rendered;
}
static void status(const BraviaSim *s,HostResult result,int rendered){
 printf("owner=%s view=%d area=%d focus=%d selected=%d app=%d menu=%d "
    "feedback=%d accepted=%d denied=%d forwarded=%d last-app=%d draw=%d result=%d\n",
    sim_owner_name(s->owner),s->home.view,s->home.area,s->home.focus,
    s->home.selected_app,s->foreground_app,s->menu,s->home.feedback,
    s->accepted_count,s->denied_count,s->forwarded_count,
    s->home.last_dispatched_app,rendered,result);
}
static double seconds(const struct timespec *a,const struct timespec *b){
 return (double)(b->tv_sec-a->tv_sec)+(double)(b->tv_nsec-a->tv_nsec)/1000000000.0;
}
static int bench(unsigned iterations){
 BraviaSim s;struct timespec start,end;struct rusage usage;
 unsigned i;int total=0;
 const Key seq[]={K_DOWN,K_RIGHT,K_UP,K_LEFT,K_OPTIONS,K_HOME};
 sim_init(&s);(void)sim_key(&s,K_HOME);(void)draw(&s);
 if(clock_gettime(CLOCK_MONOTONIC,&start)!=0)return 2;
 for(i=0;i<iterations;i++){
  if(sim_key(&s,seq[i%6])!=HOST_OK)return 2;
  total+=draw(&s);
 }
 if(clock_gettime(CLOCK_MONOTONIC,&end)!=0)return 2;
 if(getrusage(RUSAGE_SELF,&usage)!=0)return 2;
 printf("BENCH simulator_only=1 events=%u seconds=%.6f us_per_event=%.3f "
   "native_draw_calls=%d actual_frames=%lu skipped=%lu process_peak_rss_kib=%ld\n",
   iterations,seconds(&start,&end),1000000.0*seconds(&start,&end)/(double)iterations,
   total,s.frames,s.skipped_frames,usage.ru_maxrss);
 return 0;
}
int main(int argc,char **argv){
 BraviaSim s;const char *script=0;int demo=0,quiet=0,i;
 unsigned iterations=0;
 for(i=1;i<argc;i++){
  if(!strcmp(argv[i],"--demo"))demo=1;
  else if(!strcmp(argv[i],"--quiet"))quiet=1;
  else if(!strcmp(argv[i],"--script")&&i+1<argc)script=argv[++i];
  else if(!strcmp(argv[i],"--benchmark")&&i+1<argc){
   char *end=0;unsigned long parsed;
   errno=0;parsed=strtoul(argv[++i],&end,10);
   if(errno||end==argv[i]||*end||parsed<1||parsed>10000000UL){fputs("Invalid event count\n",stderr);return 2;}
   iterations=(unsigned)parsed;
  }else{fputs("Usage: console [--demo] [--script hsdob...] [--benchmark 100000] [--quiet]\n",stderr);return 2;}
 }
 if(iterations)return bench(iterations);
 sim_init(&s);
 if(demo){sim_set_app(&s,3,APP_READY);sim_set_app(&s,9,APP_UNAVAILABLE);}
 puts("SIMULATOR ONLY; fake Sony host; real TV/HDMI/DRM NOT RUNNING");
 if(!quiet)status(&s,HOST_OK,draw(&s));
 if(script){
  const unsigned char *p=(const unsigned char*)script;
  while(*p){Key k=decode(*p++);HostResult rc;if(!k)return 2;rc=sim_key(&s,k);i=draw(&s);if(i<0)return 2;if(!quiet)status(&s,rc,i);}
 }else{
  int c;
  puts("h HOME, w/a/s/d navigate, o OK, b BACK, +/- volume, i INPUT, g GUIDE, p OPTIONS, q quit");
  while((c=getchar())!=EOF&&c!='q'){
   Key k=decode(c);HostResult rc;int n;
   if(!k)continue;
   rc=sim_key(&s,k);n=draw(&s);if(n<0)return 2;
   if(!quiet)status(&s,rc,n);
  }
 }
 printf("SUMMARY owner=%s last-app=%d accepted=%d denied=%d forwarded=%d frames=%lu draw-calls=%lu skipped=%lu\n",
  sim_owner_name(s.owner),s.home.last_dispatched_app,s.accepted_count,s.denied_count,
  s.forwarded_count,s.frames,s.draw_calls,s.skipped_frames);
 return 0;
}
