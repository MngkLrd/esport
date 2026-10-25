#ifndef VERIFIED_SONY_CALLBACK_LAYOUT_H
#define VERIFIED_SONY_CALLBACK_LAYOUT_H
/* Exact owner Sony 8.931 binary ABI metadata — NOT a Sony SDK.
 * No callback prototypes, Sony actions, IPC connection or firmware writes.
 */
#include <stdint.h>
#include <stddef.h>
typedef struct {
 uint32_t callback_words[7];    /* offsets 0 through 24 */
 uint32_t unknown_words[2];     /* offsets 28 and 32 */
 char process_name[24];         /* begins at byte 36 */
} SonyDockRegistrationShape32;
typedef enum {
 SONY_EVT_RESUME=0,SONY_EVT_PAUSE,SONY_EVT_STOP,SONY_EVT_SHUTDOWN,
 SONY_EVT_SUSPEND,SONY_EVT_WAKE,SONY_EVT_UNDEFINED,SONY_EVT_COUNT
} SonyCallbackRole;
typedef struct {
 uint8_t slot_index;
 uint8_t offset;
 SonyCallbackRole role;
 const char *forwarded_function;
 const char *observation;
} SonyCallbackEvidence;
const SonyCallbackEvidence *sony_callback_evidence(unsigned slot);
int sony_callback_host_ready(void); /* always false until verified */
#endif
