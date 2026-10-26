#ifndef BRAVIA_PLUGIN_H
#define BRAVIA_PLUGIN_H
#include "catalog_host.h"
#include "render.h"
/* Host-owned, no-heap interface; NOT the proprietary Sony app_client ABI.
 * This independently linkable API is a stable handoff point for a future
 * Sony DockUI host adapter. It neither opens devices nor sends IPC.
 */
#define BRAVIA_PLUGIN_ABI 0x00010000u
#define BRAVIA_PLUGIN_MAGIC 0x42525641u
typedef struct {
 unsigned abi;
 void *context;
 int (*launch_app)(void *,int verified_service_id);
 int (*native_action)(void *,Effect);
 int (*forward_system_key)(void *,Key);
} BraviaPluginHost;
typedef struct {
 unsigned magic;
 BraviaPluginHost host;
 BraviaCatalogHost bridge;
 HomeState home;
 unsigned long input_count;
} BraviaPlugin;
unsigned bravia_plugin_abi(void);
unsigned bravia_plugin_sizeof(void);
int bravia_plugin_init(BraviaPlugin *,const BraviaPluginHost *);
int bravia_plugin_set_registry(BraviaPlugin *,const BraviaHostService *,unsigned);
int bravia_plugin_key(BraviaPlugin *,Key,int *needs_redraw);
const HomeState *bravia_plugin_state(const BraviaPlugin *);
int bravia_plugin_render(BraviaPlugin *,int width,int height,void *ctx,
                         int (*emit)(void *,const UiCommand *),UiMetrics *out);
void bravia_plugin_reset(BraviaPlugin *);
#endif
