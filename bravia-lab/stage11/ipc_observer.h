#ifndef BRAVIA_SONY_IPC_OBSERVER_H
#define BRAVIA_SONY_IPC_OBSERVER_H
#include <stddef.h>
/* Read-only token observer for off-device unit/replay tests.
 * NOT a Sony transport implementation or permission to access app_man.
 */
typedef enum {
 OBS_INVALID=-1, OBS_UNKNOWN=0,
 OBS_PAUSE,OBS_RESUME,OBS_STOP,OBS_SHUTDOWN,
 OBS_SUSPEND,OBS_WAKEUP,OBS_FOREGROUND,OBS_BACKGROUND
} ObservedEvent;
typedef struct {
 unsigned accepted;
 unsigned unknown;
 unsigned rejected;
 ObservedEvent last;
} IpcObserver;
void ipc_observer_init(IpcObserver *o);
ObservedEvent ipc_observer_token(IpcObserver *o,const char *token,size_t len);
int ipc_observer_has_native_transport(void);
#endif
