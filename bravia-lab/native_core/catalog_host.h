#ifndef BRAVIA_CATALOG_HOST_H
#define BRAVIA_CATALOG_HOST_H
/* Sony-independent glue: existing HOME effects -> verified catalogue routes.
 * The firmware adapter must supply actual service IDs and real callbacks.
 * This file DOES NOT speak the proprietary Sony app_man protocol.
 */
#include "native_catalog.h"
#include "host_dispatch.h"
typedef struct {
 BraviaHost bridged;
 const BraviaHostService *services;
 size_t service_count;
 void *host_context;
 int (*launch_verified_service)(void *,int service_id);
 int (*native_system_action)(void *,Effect);
 int (*forward_system_key)(void *,Key);
} BraviaCatalogHost;
void bravia_catalog_host_init(BraviaCatalogHost *out,
                              const BraviaHostService *services,
                              size_t count,
                              void *host_context,
                              int (*launch)(void *,int),
                              int (*native_system_action)(void *,Effect),
                              int (*forward_system_key)(void *,Key));
/* Sync only trusted executable routes as READY. All others stay UNKNOWN,
 * not UNSUPPORTED; cannot infer a noninstalled app from a mock catalogue. */
void bravia_catalog_sync_status(HomeState *state,const BraviaCatalogHost *host);
#endif
