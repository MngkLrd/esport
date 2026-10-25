#include "lifecycle.h"
void tv_lifecycle_init(TvLifecycle *l){if(l){l->state=TV_APP_STOPPED;l->transition_count=0;l->rejected_count=0;l->forwarded_count=0;}}
TvGateResult tv_lifecycle_event(TvLifecycle *l,TvAppEvent e){
 TvAppState next;
 if(!l)return TV_GATE_BAD_EVENT;
 next=l->state;
 switch(e){
 case TV_EVENT_START: if(l->state!=TV_APP_STOPPED)goto reject; next=TV_APP_STARTING;break;
 case TV_EVENT_STARTED:if(l->state!=TV_APP_STARTING)goto reject;next=TV_APP_FOREGROUND;break;
 case TV_EVENT_PAUSE:if(l->state!=TV_APP_FOREGROUND)goto reject;next=TV_APP_BACKGROUND;break;
 case TV_EVENT_RESUME:if(l->state!=TV_APP_BACKGROUND)goto reject;next=TV_APP_FOREGROUND;break;
 case TV_EVENT_SUSPEND:if(l->state!=TV_APP_BACKGROUND&&l->state!=TV_APP_FOREGROUND)goto reject;next=TV_APP_SUSPENDED;break;
 case TV_EVENT_WAKE:if(l->state!=TV_APP_SUSPENDED)goto reject;next=TV_APP_FOREGROUND;break;
 case TV_EVENT_STOP:if(l->state==TV_APP_STOPPED||l->state==TV_APP_EXITING)goto reject;next=TV_APP_EXITING;break;
 case TV_EVENT_STOPPED:if(l->state!=TV_APP_EXITING)goto reject;next=TV_APP_STOPPED;break;
 case TV_EVENT_SHUTDOWN:if(l->state==TV_APP_STOPPED)goto reject;next=TV_APP_EXITING;break;
 default:l->rejected_count++;return TV_GATE_BAD_EVENT;
 }
 l->state=next;l->transition_count++;return TV_GATE_OK;
 reject:l->rejected_count++;return TV_GATE_DENIED;
}
TvGateResult tv_lifecycle_send_unsupported(TvLifecycle *l,const TvHostHooks *hooks,TvAppEvent e){
 (void)hooks;(void)e;
 if(l)l->rejected_count++;
 return TV_GATE_DENIED;
}
