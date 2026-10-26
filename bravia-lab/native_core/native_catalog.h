#ifndef BRAVIA_NATIVE_CATALOG_H
#define BRAVIA_NATIVE_CATALOG_H
/* Native HOME catalogue mapper. Independent of Sony proprietary ABI.
 * Never calls an app, sends IPC, modifies software, or decodes DRM.
 */
#include <stddef.h>
#define BRAVIA_CATALOG_APPS 10
#define BRAVIA_MAX_SERVICES 128
typedef struct {
 const char *slug;                /* Our desired app, NOT stock DockUI entry */
 const char *name;                /* Title shown in our HOME */
 const char *stock_alias;         /* Optional exact service name, host verified */
 int sony_alias_is_candidate;     /* 0 means a separate port is required */
} BraviaCatalogEntry;
typedef struct {
 const char *name;                /* Actual registered Sony service name */
 int service_id;                  /* Trusted host identifier, never guessed */
 int registered;                  /* Queried from actual current host */
 int host_verified;               /* Host verified executable/launch route */
} BraviaHostService;
typedef enum {
 BRAVIA_ROUTE_UNAVAILABLE=0,
 BRAVIA_ROUTE_READY=1,
 BRAVIA_ROUTE_AMBIGUOUS=-1,
 BRAVIA_ROUTE_INVALID=-2
} BraviaRouteStatus;
typedef struct {
 BraviaRouteStatus status;
 int service_id;                  /* -1 unless unique verified route */
} BraviaRoute;
const BraviaCatalogEntry *bravia_catalog_get(size_t index);
/* Exact service lookup ONLY; no approximate spelling, URL or APK assumed. */
BraviaRoute bravia_catalog_resolve(size_t index,
                                   const BraviaHostService *live,
                                   size_t live_count);
/* Return -1 unless every desired app entry has a distinct slug. */
int bravia_catalog_validate(void);
#endif
