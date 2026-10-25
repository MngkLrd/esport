#ifndef BRAVIA_SONY_APPCLIENT_ABI_H
#define BRAVIA_SONY_APPCLIENT_ABI_H
/* Read-only ABI facts from user-supplied v8.931 ARM DockUI; NOT a Sony SDK.
 * No callback signature/protocol has been verified; never call am_client_init
 * using this descriptive layout.
 */
#include <stddef.h>
#include <stdint.h>
typedef struct {
  uint32_t unknown_callback_or_reserved[9];
  char process_name[24];
} SonyAmInitWireLayout32;
#define BRAVIA_AM_INIT_BYTES 60u
#define BRAVIA_AM_INIT_NAME_OFFSET 36u
typedef enum {
  SONY_AM_ABI_UNKNOWN=0,
  SONY_AM_ABI_PARTIALLY_MAPPED=1
} SonyAmAbiStatus;
SonyAmAbiStatus sony_am_abi_status(void);
#endif
