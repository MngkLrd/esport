#include "sony_lifecycle_model.h"
#include <assert.h>
#include <stdio.h>
int main(void){
 SonyLifecycleModel m;
 lifecycle_init(&m);
 assert(m.home.view==VIEW_TV&&!lifecycle_may_render(&m));
 assert(lifecycle_step(&m,EV_STARTED)==1);
 home_key(&m.home,K_HOME);m.owns_focus=1;
 assert(lifecycle_may_render(&m));
 assert(lifecycle_step(&m,EV_PAUSED)==1);
 assert(!lifecycle_may_render(&m));
 assert(lifecycle_step(&m,EV_RESUMED)==1);
 assert(!lifecycle_may_render(&m)); /* Sony owns focus */
 m.owns_focus=1;assert(lifecycle_may_render(&m));
 assert(lifecycle_step(&m,EV_STOPPED)==1);
 assert(m.home.view==VIEW_TV&&!lifecycle_may_render(&m));
 assert(lifecycle_step(&m,EV_STARTED)==1);
 assert(lifecycle_step(&m,EV_WAKEUPED)==0&&m.home.view==VIEW_TV);
 assert(lifecycle_step(&m,EV_SHUTDOWNED)==1);
 assert(!m.active&&m.terminated);
 assert(lifecycle_step(&m,EV_STARTED)==0);
 assert(lifecycle_step(0,EV_STARTED)==-1);
 printf("PASS: original Sony events are modelled without IPC or focus theft\n");
 return 0;
}
