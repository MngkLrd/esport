#include "sony_lifecycle_model.h"
void lifecycle_init(SonyLifecycleModel *m){
 if(!m)return;
 home_init(&m->home);
 m->active=0;m->paused=0;m->owns_focus=0;m->terminated=0;
}
int lifecycle_step(SonyLifecycleModel *m,SonyLifecycleEvent event){
 SonyLifecycleModel before;
 if(!m||event<EV_STARTED||event>EV_OTHER)return -1;
 before=*m;
 switch(event){
  case EV_STARTED:
   if(!m->terminated){m->active=1;m->paused=0;}
   break;
  case EV_STOPPED:
   m->active=0;m->paused=0;m->owns_focus=0;
   home_init(&m->home);break;
  case EV_PAUSED:
   m->paused=1;m->owns_focus=0;break;
  case EV_RESUMED:
   if(m->active&&!m->terminated)m->paused=0;
   break;
  case EV_SHUTDOWNED:
   m->active=0;m->paused=0;m->owns_focus=0;m->terminated=1;
   home_init(&m->home);break;
  case EV_WAKEUPED:
   /* Wake-up never forces custom HOME over the native Sony tuner. */
   break;
  case EV_OTHER:break;
 }
 return m->active!=before.active||m->paused!=before.paused||
        m->owns_focus!=before.owns_focus||m->terminated!=before.terminated||
        m->home.view!=before.home.view;
}
int lifecycle_may_render(const SonyLifecycleModel *m){
 return m&&m->active&&!m->paused&&!m->terminated&&
        m->owns_focus&&m->home.view!=VIEW_TV;
}
