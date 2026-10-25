#include "sim.h"
static int mock_native_action(void *context,Effect effect,int index){
 BraviaSim *s=(BraviaSim*)context;
 if(!s)return 0;
 switch(effect){
 case FX_OPEN_APP:
  if(index<0||index>=HOME_APP_COUNT||s->home.availability[index]!=APP_READY)break;
  s->owner=SIM_APP;s->foreground_app=index;s->menu=SIM_MENU_NONE;
  s->accepted_count++;return 1;
 case FX_TO_NATIVE_TV:
  s->owner=SIM_TV;s->foreground_app=-1;s->menu=SIM_MENU_NONE;
  s->accepted_count++;return 1;
 case FX_NATIVE_CHANNEL_LIST:case FX_NATIVE_INPUTS:case FX_NATIVE_SETTINGS:{
  SimMenu which=effect==FX_NATIVE_CHANNEL_LIST?SIM_CHANNELS:
     effect==FX_NATIVE_INPUTS?SIM_INPUTS:SIM_SETTINGS;
  if(!s->menu_available[(int)which-1])break;
  s->owner=SIM_NATIVE_MENU;s->menu=which;s->foreground_app=-1;
  s->accepted_count++;return 1;
 }
 default:break;
 }
 s->denied_count++;return 0;
}
static int mock_forward_system(void *context,Key key){
 BraviaSim *s=(BraviaSim*)context;
 if(!s)return 0;
 s->remote_last=(int)key;s->forwarded_count++;
 /* Simulated system dispatcher ACK means it received a key, never Sony validation. */
 return 1;
}
void sim_init(BraviaSim *s){
 int i;
 if(!s)return;
 home_init(&s->home);
 s->adapter.context=s;
 s->adapter.native_action=mock_native_action;
 s->adapter.forward_system_key=mock_forward_system;
 s->owner=SIM_TV;s->menu=SIM_MENU_NONE;s->foreground_app=-1;
 for(i=0;i<3;i++)s->menu_available[i]=1;
 s->forwarded_count=0;s->accepted_count=0;s->denied_count=0;
 s->remote_last=0;s->frames=0;s->draw_calls=0;s->skipped_frames=0;s->dirty=1;
}
int sim_set_app(BraviaSim *s,int index,AppAvailability status){
 if(!s||!home_set_app_availability(&s->home,index,status))return 0;
 if(s->owner==SIM_HOME)s->dirty=1;
 return 1;
}
void sim_enable_menu(BraviaSim *s,SimMenu menu,int on){
 if(s&&menu>=SIM_CHANNELS&&menu<=SIM_SETTINGS)s->menu_available[(int)menu-1]=(on!=0);
}
HostResult sim_key(BraviaSim *s,Key key){
 HomeState before;SimOwner owner;SimMenu menu;
 int redraw=0;
 HostResult result;
 if(!s)return HOST_INVALID;
 before=s->home;owner=s->owner;menu=s->menu;
 if(s->owner==SIM_APP||s->owner==SIM_NATIVE_MENU){
  /* In this SIMULATOR an app/menu owns focus. Only HOME/BACK return to HOME.
     Native reserved buttons always go via the simulated system dispatcher. */
  if(key==K_HOME||key==K_BACK){
   s->owner=SIM_HOME;s->menu=SIM_MENU_NONE;s->foreground_app=-1;
   (void)home_key(&s->home,K_HOME);
   s->dirty=1;
   return HOST_OK;
  }
  if(key>=K_VOL_UP&&key<=K_SUBTITLE){
   if(mock_forward_system(s,key))return HOST_OK;
   return HOST_UNHANDLED_SYSTEM_KEY;
  }
  return HOST_OK;
 }
 result=host_dispatch(&s->home,key,&s->adapter,&redraw);
 if(key==K_HOME&&s->home.view==VIEW_HOME)s->owner=SIM_HOME;
 if(result==HOST_NATIVE_NOT_AVAILABLE&&s->owner==SIM_TV&&s->home.view==VIEW_HOME)
  s->owner=SIM_HOME;
 if(owner!=s->owner||menu!=s->menu||redraw||
  before.view!=s->home.view||before.area!=s->home.area||
  before.focus!=s->home.focus||before.selected_app!=s->home.selected_app||
  before.feedback!=s->home.feedback||
  before.last_dispatched_app!=s->home.last_dispatched_app)s->dirty=1;
 return result;
}
int sim_render(BraviaSim *s,UiCanvas *target){
 UiMetrics m;int draw;
 if(!s||!target)return -1;
 if(!s->dirty||s->owner!=SIM_HOME){s->skipped_frames++;return 0;}
 if(ui_render(target,&s->home,&m)!=0)return -1;
 draw=m.rects+m.strokes+m.texts;
 s->frames++;s->draw_calls+=(unsigned long)draw;s->dirty=0;
 return draw;
}
const char *sim_owner_name(SimOwner owner){
 switch(owner){case SIM_TV:return "tv";case SIM_HOME:return "home";
 case SIM_APP:return "app";case SIM_NATIVE_MENU:return "native-menu";
 default:return "invalid";}
}
