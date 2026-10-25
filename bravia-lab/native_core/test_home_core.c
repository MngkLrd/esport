#include "home_core.h"
#include <assert.h>
#include <stdio.h>
#define PRESS(k) home_key(&s,(k))
int main(void){
 HomeState s;home_init(&s);
 assert(s.view==VIEW_TV && s.selected_app==-1);
 assert(PRESS(K_LEFT).effect==FX_PASS_TO_SYSTEM);
 PRESS(K_HOME); assert(s.view==VIEW_HOME&&s.area==AREA_TV_CARD);
 PRESS(K_DOWN);assert(s.area==AREA_APPS&&s.focus==0);
 PRESS(K_RIGHT);assert(s.focus==1);
 PRESS(K_DOWN);assert(s.focus==6);
 PRESS(K_RIGHT);assert(s.focus==7);
 PRESS(K_UP);assert(s.focus==2);
 PRESS(K_UP);assert(s.area==AREA_TV_CARD);
 PRESS(K_DOWN);PRESS(K_DOWN);assert(s.focus==5);
 PRESS(K_RIGHT);PRESS(K_RIGHT);PRESS(K_RIGHT);PRESS(K_RIGHT);assert(s.focus==9);
 PRESS(K_RIGHT);assert(s.focus==9);
 PRESS(K_DOWN);assert(s.area==AREA_DOCK&&s.focus==3);
 assert(PRESS(K_OK).effect==FX_NATIVE_SETTINGS);
 PRESS(K_LEFT);assert(PRESS(K_OK).effect==FX_NATIVE_INPUTS);
 PRESS(K_LEFT);assert(PRESS(K_OK).effect==FX_NATIVE_CHANNEL_LIST);
 PRESS(K_UP); assert(s.area==AREA_APPS&&s.focus==6);
 assert(PRESS(K_OK).effect==FX_OPEN_APP&&s.selected_app==6);
 assert(PRESS(K_DOWN).effect==FX_NONE);
 PRESS(K_BACK);assert(s.view==VIEW_HOME);
 {Key reserved[]={K_VOL_UP,K_VOL_DOWN,K_MUTE,K_CH_UP,K_CH_DOWN,K_SOURCE,K_SETTINGS,K_OPTIONS,K_GUIDE,K_DIGIT,K_ANTENNA,K_TITLE_LIST,K_RECORD,K_POWER,K_AUDIO,K_SUBTITLE};
 int i;for(i=0;i<16;i++)assert(PRESS(reserved[i]).effect==FX_PASS_TO_SYSTEM);}
 PRESS(K_BACK);assert(s.view==VIEW_TV);
 PRESS(K_HOME);assert(s.area==AREA_TV_CARD);
 assert(PRESS(K_OK).effect==FX_TO_NATIVE_TV);
 printf("PASS C99 HOME core: TV-first, 10 apps, D-pad, Sony key-pass-through, native menu intents\n");
 return 0;
}
