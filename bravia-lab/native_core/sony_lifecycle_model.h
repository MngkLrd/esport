#ifndef BRAVIA_SONY_LIFECYCLE_MODEL_H
#define BRAVIA_SONY_LIFECYCLE_MODEL_H
#include "home_core.h"
/* Not a Sony callback ABI. NO Sony IPC calls. */
typedef enum { EV_STARTED=0, EV_STOPPED, EV_PAUSED, EV_RESUMED, EV_SHUTDOWNED, EV_WAKEUPED, EV_OTHER } SonyLifecycleEvent;
typedef struct {
 HomeState home;
 int active;
 int paused;
 int owns_focus;
 int terminated;
} SonyLifecycleModel;
void lifecycle_init(SonyLifecycleModel *m);
int lifecycle_step(SonyLifecycleModel *m, SonyLifecycleEvent event);
int lifecycle_may_render(const SonyLifecycleModel *m);
#endif
