#include "home_core.h"
static HomeEvent result(Effect effect,int index){HomeEvent v={effect,index};return v;}
static int system_key(Key k){
 switch(k){case K_VOL_UP:case K_VOL_DOWN:case K_MUTE:
 case K_CH_UP:case K_CH_DOWN:case K_SOURCE:case K_SETTINGS:
 case K_OPTIONS:case K_GUIDE:case K_DIGIT:case K_ANTENNA:
 case K_TITLE_LIST:case K_RECORD:case K_POWER:case K_AUDIO:
 case K_SUBTITLE:return 1;default:return 0;}
}
int home_set_app_availability(HomeState *s,int index,AppAvailability status){
 if(!s||index<0||index>=HOME_APP_COUNT||status<APP_UNKNOWN||status>APP_UNAVAILABLE)return 0;
 s->availability[index]=status;return 1;
}
AppAvailability home_get_app_availability(const HomeState *s,int index){
 if(!s||index<0||index>=HOME_APP_COUNT)return APP_UNKNOWN;
 return s->availability[index];
}
void home_init(HomeState *s){
 int i;
 if(!s)return;
 s->view=VIEW_TV;s->area=AREA_TV_CARD;s->focus=0;s->selected_app=-1;
 s->last_dispatched_app=-1;s->feedback=FEEDBACK_NONE;
 for(i=0;i<HOME_APP_COUNT;i++)s->availability[i]=APP_UNKNOWN;
}
HomeEvent home_key(HomeState *s,Key key){
 if(!s)return result(FX_NONE,-1);
 /* Never consume reserved system keys here, including OPTIONS and SOURCE. */
 if(system_key(key))return result(FX_PASS_TO_SYSTEM,-1);
 if(key==K_HOME){
  if(s->view!=VIEW_HOME){s->area=AREA_TV_CARD;s->focus=0;}
  s->view=VIEW_HOME;s->selected_app=-1;s->feedback=FEEDBACK_NONE;
  return result(FX_NONE,-1);
 }
 if(s->view==VIEW_TV)return result(FX_PASS_TO_SYSTEM,-1);
 if(key==K_BACK){
  if(s->view==VIEW_DETAIL){s->view=VIEW_HOME;s->selected_app=-1;s->feedback=FEEDBACK_NONE;return result(FX_NONE,-1);}
  s->view=VIEW_TV;return result(FX_TO_NATIVE_TV,-1);
 }
 if(s->view==VIEW_DETAIL)return result(FX_NONE,-1);
 switch(key){
 case K_LEFT:
  if(s->area==AREA_APPS&&s->focus%HOME_APP_COLUMNS>0)s->focus--;
  else if(s->area==AREA_DOCK&&s->focus>0)s->focus--;
  break;
 case K_RIGHT:
  if(s->area==AREA_APPS&&s->focus%HOME_APP_COLUMNS<HOME_APP_COLUMNS-1&&s->focus+1<HOME_APP_COUNT)s->focus++;
  else if(s->area==AREA_DOCK&&s->focus<HOME_DOCK_COUNT-1)s->focus++;
  break;
 case K_UP:
  if(s->area==AREA_APPS){if(s->focus<HOME_APP_COLUMNS){s->area=AREA_TV_CARD;s->focus=0;}else s->focus-=HOME_APP_COLUMNS;}
  else if(s->area==AREA_DOCK){s->area=AREA_APPS;s->focus=HOME_APP_COLUMNS+s->focus;}
  break;
 case K_DOWN:
  if(s->area==AREA_TV_CARD){s->area=AREA_APPS;s->focus=0;}
  else if(s->area==AREA_APPS){if(s->focus<HOME_APP_COLUMNS)s->focus+=HOME_APP_COLUMNS;
   else{s->area=AREA_DOCK;s->focus=s->focus-HOME_APP_COLUMNS;if(s->focus>=HOME_DOCK_COUNT)s->focus=HOME_DOCK_COUNT-1;}}
  break;
 case K_OK:
  if(s->area==AREA_TV_CARD){s->view=VIEW_TV;return result(FX_TO_NATIVE_TV,-1);}
  if(s->area==AREA_APPS){
   s->selected_app=s->focus;s->view=VIEW_DETAIL;
   s->feedback=FEEDBACK_NONE;
   if(s->availability[s->focus]==APP_UNAVAILABLE){
    s->feedback=FEEDBACK_NOT_REGISTERED;
    return result(FX_NONE,-1);
   }
   return result(FX_OPEN_APP,s->focus);
  }
  if(s->area==AREA_DOCK){
   if(s->focus==0){s->view=VIEW_TV;return result(FX_TO_NATIVE_TV,-1);}
   if(s->focus==1)return result(FX_NATIVE_CHANNEL_LIST,-1);
   if(s->focus==2)return result(FX_NATIVE_INPUTS,-1);
   if(s->focus==3)return result(FX_NATIVE_SETTINGS,-1);
  }
  break;
 default:break;
 }
 return result(FX_NONE,-1);
}
