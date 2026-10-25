/* ARMv7 Linux user-mode simulation entry. No Sony loader, IPC or binaries. */
#include "sim.h"
extern int bravia_io_getc(void);
extern void bravia_io_puts(const char *text);
static int noop(void *ctx,const UiCommand *cmd){(void)ctx;return cmd!=0;}
static void number(int n){
 char data[14];unsigned i=0,j;unsigned v;
 if(n<0){bravia_io_puts("-");v=(unsigned)(-n);}else v=(unsigned)n;
 do{data[i++]=(char)('0'+v%10u);v/=10u;}while(v&&i<13u);
 for(j=i;j>0;j--){char out[2]={data[j-1],0};bravia_io_puts(out);}
}
static Key map(int ch){
 switch(ch){case 'h':return K_HOME;case 'w':return K_UP;case 'a':return K_LEFT;
 case 's':return K_DOWN;case 'd':return K_RIGHT;case 'o':return K_OK;
 case 'b':return K_BACK;case '+':return K_VOL_UP;case 'i':return K_SOURCE;
 case 'p':return K_OPTIONS;case 'g':return K_GUIDE;default:return (Key)0;}
}
int bravia_demo_main(void){
 BraviaSim sim;UiCanvas cv={1280,720,0,noop};int c;
 sim_init(&sim);
 sim_set_app(&sim,3,APP_READY);sim_set_app(&sim,9,APP_UNAVAILABLE);
 bravia_io_puts("SIM_ARMv7_LINUX only; test services mocked; NOT Sony hardware\n");
 for(;;){
  Key k;HostResult r;int n;
  c=bravia_io_getc();if(c<0||c=='q')break;
  k=map(c);if(!k)continue;
  r=sim_key(&sim,k);
  n=sim_render(&sim,&cv);
  if(n<0)return 2;
  bravia_io_puts("SIM owner=");bravia_io_puts(sim_owner_name(sim.owner));
  bravia_io_puts(" focus=");number(sim.home.focus);
  bravia_io_puts(" app=");number(sim.foreground_app);
  bravia_io_puts(" menu=");number((int)sim.menu);
  bravia_io_puts(" last=");number(sim.home.last_dispatched_app);
  bravia_io_puts(" draw=");number(n);
  bravia_io_puts(" result=");number((int)r);
  bravia_io_puts("\n");
 }
 bravia_io_puts("EXIT\n");return 0;
}
