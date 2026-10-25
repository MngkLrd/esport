#include "render.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static void json_text(const char *s){
 const unsigned char *p=(const unsigned char*)s;
 putchar('"');
 for(;*p;p++){
  if(*p=='"'||*p=='\\'){putchar('\\');putchar((int)*p);}
  else if(*p<32)printf("\\u%04x",(unsigned)*p);
  else putchar((int)*p);
 }
 putchar('"');
}
static int write_cmd(void *unused,const UiCommand *cmd){
 (void)unused;
 printf("[%d,%d,%d,%d,%d,%d,%d,%d,%d,",(int)cmd->op,cmd->x,cmd->y,cmd->w,cmd->h,cmd->color.r,cmd->color.g,cmd->color.b,cmd->font_px);
 if(cmd->text)json_text(cmd->text);else fputs("null",stdout);
 printf(",%d,%d,%d]\n",cmd->emphasized,cmd->image_id,cmd->image_variant);
 return 1;
}
int main(int argc,char **argv){
 HomeState home;UiMetrics m;
 UiCanvas cv={1280,720,NULL,write_cmd};
 if(argc!=4&&argc!=7){
  fprintf(stderr,"usage: %s WIDTH HEIGHT tv|home|detail [tv|apps|dock|detail INDEX demo]\n",argv[0]);return 2;
 }
 cv.width=atoi(argv[1]);cv.height=atoi(argv[2]);
 if(cv.width<320||cv.width>4096||cv.height<180||cv.height>2160)return 2;
 home_init(&home);
 if(strcmp(argv[3],"home")==0)home_key(&home,K_HOME);
 else if(strcmp(argv[3],"detail")==0){
  home_key(&home,K_HOME);home_key(&home,K_DOWN);
  home_key(&home,K_RIGHT);home_key(&home,K_DOWN);home_key(&home,K_OK);
 }else if(strcmp(argv[3],"tv")!=0)return 2;
 if(argc==7){
  int number=atoi(argv[5]);
  if(strcmp(argv[6],"demo")!=0)return 2;
  /* These are VISUAL DEMO conditions, never probed on a Sony device. */
  home_set_app_availability(&home,3,APP_READY);
  home_set_app_availability(&home,9,APP_UNAVAILABLE);
  home.last_dispatched_app=3;
  if(strcmp(argv[4],"apps")==0){if(number<0||number>=10)return 2;home.view=VIEW_HOME;home.area=AREA_APPS;home.focus=number;}
  else if(strcmp(argv[4],"dock")==0){if(number<0||number>=4)return 2;home.view=VIEW_HOME;home.area=AREA_DOCK;home.focus=number;}
  else if(strcmp(argv[4],"tv")==0){home.view=VIEW_HOME;home.area=AREA_TV_CARD;home.focus=0;}
  else if(strcmp(argv[4],"detail")==0){if(number<0||number>=10)return 2;home.view=VIEW_DETAIL;home.selected_app=number;home.focus=number;home.feedback=number==9?FEEDBACK_NOT_REGISTERED:FEEDBACK_NO_HOST;}
  else return 2;
 }
 return ui_render(&cv,&home,&m)?1:0;
}
