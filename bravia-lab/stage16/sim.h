#ifndef BRAVIA_SIM_HOST_H
#define BRAVIA_SIM_HOST_H
/* Host simulation only. Not a Sony ABI nor actual libapp_client wire protocol. */
#include "home_core.h"
#include "host_dispatch.h"
#include "render.h"
typedef enum { SIM_TV=0, SIM_HOME, SIM_APP, SIM_NATIVE_MENU } SimOwner;
typedef enum { SIM_MENU_NONE=0, SIM_CHANNELS, SIM_INPUTS, SIM_SETTINGS } SimMenu;
typedef struct {
 HomeState home;
 BraviaHost adapter;
 SimOwner owner;
 SimMenu menu;
 int foreground_app;
 int menu_available[3];
 int forwarded_count;
 int accepted_count;
 int denied_count;
 int remote_last;
 unsigned long frames;
 unsigned long draw_calls;
 unsigned long skipped_frames;
 int dirty;
} BraviaSim;
void sim_init(BraviaSim *s);
int sim_set_app(BraviaSim *s,int index,AppAvailability status);
void sim_enable_menu(BraviaSim *s,SimMenu menu,int on);
/* All actions are explicitly mock-host outcomes. */
HostResult sim_key(BraviaSim *s,Key key);
/* Returns -1 when draw failed, 0 when skipped, >0 number of emitted C UI calls. */
int sim_render(BraviaSim *s,UiCanvas *target);
const char *sim_owner_name(SimOwner owner);
#endif
