#ifndef BRAVIA_HOST_DISPATCH_H
#define BRAVIA_HOST_DISPATCH_H
#include "home_core.h"
/* Interface WE define for a future, verified libapp_client adapter.
   Not a claimed Sony API. No Sony proprietary implementation is included. */
typedef struct {
 void *context;
 /* Return 1 iff host accepted dispatch. Must implement using known Sony IPC. */
 int (*native_action)(void *,Effect,int app_index);
 /* Return 1 iff host accepted system key; 0 indicates it remains unhandled. */
 int (*forward_system_key)(void *,Key);
} BraviaHost;
typedef enum {
 HOST_OK=0,
 HOST_UNHANDLED_SYSTEM_KEY=1, /* pass event back to original Sony dispatcher */
 HOST_NATIVE_NOT_AVAILABLE=2, /* native overlay/app blocked; rollback screen state */
 HOST_INVALID=-1
} HostResult;
HostResult host_dispatch(HomeState *,Key,const BraviaHost *,int *redraw);
#endif
