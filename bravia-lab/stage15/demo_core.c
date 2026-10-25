/* Off-device BRAVIA HOME demo. No Sony SDK, app_manager IPC, OTA writes or DRM. */
#include "home_core.h"
#include "host_dispatch.h"
#include "render.h"
#include <stddef.h>

extern int bravia_io_getc(void);
extern void bravia_io_puts(const char *text);

static int noop_draw(void *unused,const UiCommand *draw){(void)unused;(void)draw;return 1;}
static void print_unsigned(unsigned n){
 char buf[12];unsigned i=0,j;
 do{buf[i++]=(char)('0'+n%10u);n/=10u;}while(n&&i<sizeof(buf));
 for(j=i;j>0;j--){char out[2]={buf[j-1],0};bravia_io_puts(out);}
}
static const char *view_name(View view){
 if(view==VIEW_TV)return "tv";
 if(view==VIEW_HOME)return "home";
 if(view==VIEW_DETAIL)return "detail";
 return "invalid";
}
static const char *area_name(Area area){
 if(area==AREA_TV_CARD)return "tv-card";
 if(area==AREA_APPS)return "apps";
 if(area==AREA_DOCK)return "dock";
 return "invalid";
}
static void print_state(const HomeState *s){
 UiMetrics m;UiCanvas c={1280,720,0,noop_draw};
 const int render_status=ui_render(&c,s,&m);
 bravia_io_puts("STATE view=");bravia_io_puts(view_name(s->view));
 bravia_io_puts(" area=");bravia_io_puts(area_name(s->area));
 bravia_io_puts(" focus=");print_unsigned((unsigned)s->focus);
 bravia_io_puts(" selected=");
 if(s->selected_app<0)bravia_io_puts("none");else print_unsigned((unsigned)s->selected_app);
 bravia_io_puts(" feedback=");print_unsigned((unsigned)s->feedback);
 bravia_io_puts(" draw=");
 if(render_status)bravia_io_puts("ERROR");
 else print_unsigned((unsigned)(m.rects+m.strokes+m.texts));
 bravia_io_puts("\n");
}
static Key decode(int c){
 switch(c){
 case 'h':case 'H':return K_HOME;
 case 'w':case 'W':return K_UP;
 case 'a':case 'A':return K_LEFT;
 case 's':case 'S':return K_DOWN;
 case 'd':case 'D':return K_RIGHT;
 case 'o':case 'O':case '\r':return K_OK;
 case 'b':case 'B':return K_BACK;
 case '+':return K_VOL_UP;
 case '-':return K_VOL_DOWN;
 case 'i':return K_SOURCE;
 case 'g':return K_GUIDE;
 default:return (Key)0;
 }
}
int bravia_demo_main(void){
 HomeState home;int c,redraw;HostResult event;
 home_init(&home);
 bravia_io_puts("BRAVIA Stage15 native Linux ELF demo; NOT Sony firmware\n");
 bravia_io_puts("h HOME, w/a/s/d navigate, o OK, b BACK, t mock TV, +/- volume, i source, g GUIDE, q quit\n");
 print_state(&home);
 for(;;){
  Key key;
  c=bravia_io_getc();
  if(c<0||c=='q'||c=='Q')break;
  if(c=='\n'||c==' '||c=='\t')continue;
  if(c=='t'||c=='T'){
   home_init(&home);bravia_io_puts("MOCK-TV: separate host-owned video, NOT tuned live picture\n");print_state(&home);continue;
  }
  key=decode(c);
  if(key==(Key)0){bravia_io_puts("UNKNOWN_INPUT\n");continue;}
  /* A NULL Sony host is intentional: native actions must FAIL CLOSED. */
  event=host_dispatch(&home,key,(const BraviaHost*)0,&redraw);
  if(event==HOST_UNHANDLED_SYSTEM_KEY)bravia_io_puts("UNHANDLED_SONY_SYSTEM_KEY\n");
  else if(event==HOST_NATIVE_NOT_AVAILABLE)bravia_io_puts("NO_SONY_HOST_ACTION\n");
  else if(event==HOST_INVALID)bravia_io_puts("ERROR_NATIVE_HOST_INPUT\n");
  print_state(&home);
 }
 bravia_io_puts("EXIT\n");
 return 0;
}
