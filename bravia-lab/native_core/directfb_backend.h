#ifndef BRAVIA_DIRECTFB_BACKEND_H
#define BRAVIA_DIRECTFB_BACKEND_H
#include "render.h"
#ifdef BRAVIA_WITH_DIRECTFB
#include <directfb.h>
typedef struct {
 IDirectFBSurface *surface; /* Provided by authorized Sony application host. */
 /* Fonts preloaded by the verified native host, sizes ~14,18,22,28,38,52px. */
 IDirectFBFont *regular[6];
 IDirectFBFont *bold[6];
 int flip; /* Must be explicitly enabled only when host owns this surface. */
 int last_error;
} BraviaDfb;
int bravia_dfb_draw(BraviaDfb *backend,const HomeState *state,UiMetrics *out);
#endif
#endif
