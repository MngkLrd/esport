#ifndef BRAVIA_LIFECYCLE_H
#define BRAVIA_LIFECYCLE_H
#include <stdint.h>
/* Authored host state machine; NOT a reverse-engineered Sony callback ABI. */
typedef enum { TV_APP_STOPPED=0, TV_APP_STARTING, TV_APP_FOREGROUND, TV_APP_BACKGROUND, TV_APP_SUSPENDED, TV_APP_EXITING } TvAppState;
typedef enum { TV_EVENT_START=1, TV_EVENT_STARTED, TV_EVENT_PAUSE, TV_EVENT_RESUME, TV_EVENT_SUSPEND, TV_EVENT_WAKE, TV_EVENT_STOP, TV_EVENT_STOPPED, TV_EVENT_SHUTDOWN } TvAppEvent;
typedef enum { TV_GATE_OK=0, TV_GATE_DENIED=1, TV_GATE_BAD_EVENT=2 } TvGateResult;
typedef struct { TvAppState state; uint32_t transition_count; uint32_t rejected_count; uint32_t forwarded_count; } TvLifecycle;
typedef struct { void *opaque; int (*native_callback)(void *opaque, TvAppEvent e); } TvHostHooks;
void tv_lifecycle_init(TvLifecycle *l);
TvGateResult tv_lifecycle_event(TvLifecycle *l, TvAppEvent e);
/* Always reject unverified Sony IPC; don't invent callback prototypes. */
TvGateResult tv_lifecycle_send_unsupported(TvLifecycle *l,const TvHostHooks *hooks,TvAppEvent e);
#endif
