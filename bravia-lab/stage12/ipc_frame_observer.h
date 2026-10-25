#ifndef BRAVIA_IPC_FRAME_OBSERVER_H
#define BRAVIA_IPC_FRAME_OBSERVER_H
#include <stddef.h>
/* Offline observer for the verified OUTBOUND am_send_cmd text template ONLY.
   Real INBOUND frame syntax / transport remain unidentified. */
#define BRAVIA_MAX_FRAME 192u
#define BRAVIA_MAX_NAME 32u
#define BRAVIA_MAX_COMMAND 64u
#define BRAVIA_MAX_VALUE 128u
typedef struct {
 char process[BRAVIA_MAX_NAME];
 char command[BRAVIA_MAX_COMMAND];
 char value[BRAVIA_MAX_VALUE];
} BraviaCmd;
typedef struct {
 char buffer[BRAVIA_MAX_FRAME+1u];
 size_t size;
 int collecting;
 int dropping;
 unsigned accepted;
 unsigned malformed;
 unsigned overflow;
 unsigned ignored;
} BraviaFrameObserver;
typedef void (*BraviaFrameSeen)(void *context, const BraviaCmd *command);
void bravia_frame_init(BraviaFrameObserver *state);
void bravia_frame_feed(BraviaFrameObserver *state,const unsigned char *data,size_t len,
                       BraviaFrameSeen on_frame,void *context);
int bravia_frame_has_transport(void);
#endif
