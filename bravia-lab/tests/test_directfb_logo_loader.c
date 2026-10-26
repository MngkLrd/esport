#include "directfb_logos.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Synthetic DirectFB only: checks loader behavior, NOT Sony compatibility. */
static int active_surfaces, surface_releases, provider_opens, provider_releases;
static int attempts, fail_open_at = -1, fail_render_at = -1;

static DFBResult surface_release(IDirectFBSurface *s) {
 assert(s && active_surfaces > 0);
 --active_surfaces;
 ++surface_releases;
 free(s);
 return DFB_OK;
}
static DFBResult provider_description(IDirectFBImageProvider *p,
                                       DFBSurfaceDescription *d) {
 (void)p;
 assert(d);
 memset(d, 0, sizeof(*d));
 d->flags = DSDESC_WIDTH | DSDESC_HEIGHT | DSDESC_PIXELFORMAT;
 d->width = 144;
 d->height = 75;
 d->pixelformat = DSPF_ARGB;
 return DFB_OK;
}
static DFBResult provider_render(IDirectFBImageProvider *p, IDirectFBSurface *s,
                                 const DFBRectangle *dst) {
 (void)p;
 (void)dst;
 assert(s);
 if (attempts - 1 == fail_render_at) return -1;
 return DFB_OK;
}
static DFBResult provider_release(IDirectFBImageProvider *p) {
 (void)p;
 ++provider_releases;
 return DFB_OK;
}
static IDirectFBImageProvider image_provider = {
 provider_description, provider_render, provider_release
};
static DFBResult create_provider(IDirectFB *dfb, const char *path,
                                  IDirectFBImageProvider **out) {
 (void)dfb;
 assert(path && strstr(path, ".png"));
 assert(strstr(path, "/"));
 if (attempts++ == fail_open_at) {
  *out = NULL;
  return -1;
 }
 ++provider_opens;
 *out = &image_provider;
 return DFB_OK;
}
static DFBResult create_surface(IDirectFB *dfb,
                                 const DFBSurfaceDescription *desc,
                                 IDirectFBSurface **out) {
 IDirectFBSurface *s;
 (void)dfb;
 assert(desc && desc->width == 144 && desc->height == 75);
 assert(desc->pixelformat == DSPF_ARGB);
 assert((desc->flags & DSDESC_PIXELFORMAT) != 0);
 s = (IDirectFBSurface*)calloc(1, sizeof(*s));
 if (!s) return -1;
 s->Release = surface_release;
 *out = s;
 ++active_surfaces;
 return DFB_OK;
}
static void reset_counters(void) {
 active_surfaces = 0;
 surface_releases = 0;
 provider_opens = 0;
 provider_releases = 0;
 attempts = 0;
 fail_open_at = -1;
 fail_render_at = -1;
}
int main(void) {
 IDirectFB dfb = {create_provider, create_surface};
 BraviaLogoPack pack = {0};
 BraviaDfb backend = {0};
 int i,j;

 reset_counters();
 assert(bravia_logo_pack_load(&pack, &dfb, "/tmp/stage17/assets") == 0);
 assert(pack.loaded_count == 30);
 assert(active_surfaces == 30 && provider_opens == 30);
 assert(provider_releases == 30);
 /* No overwrite of loaded textures; pass through the authorized host. */
 assert(bravia_logo_pack_load(&pack, &dfb, "/tmp/stage17/assets") == -1);
 bravia_logo_pack_attach(&backend, &pack);
 for(i=0;i<10;++i)
  for(j=0;j<3;++j) {
   assert(backend.logos[i][j] == pack.surfaces[i][j]);
   assert(pack.surfaces[i][j] != NULL);
  }
 bravia_logo_pack_detach(&backend);
 for(i=0;i<10;++i)
  for(j=0;j<3;++j)assert(backend.logos[i][j] == NULL);
 bravia_logo_pack_release(&pack);
 assert(pack.loaded_count == 0);
 assert(active_surfaces == 0 && surface_releases == 30);
 bravia_logo_pack_release(&pack); /* idempotent */

 reset_counters();
 fail_open_at = 11;
 assert(bravia_logo_pack_load(&pack, &dfb, "/tmp/stage17/assets") == -1);
 assert(pack.loaded_count == 0 && active_surfaces == 0);
 assert(provider_releases == provider_opens);
 assert(surface_releases == 11);
 for(i=0;i<10;++i)
  for(j=0;j<3;++j)assert(pack.surfaces[i][j] == NULL);

 reset_counters();
 fail_render_at = 5;
 assert(bravia_logo_pack_load(&pack, &dfb, "/tmp/stage17/assets") == -1);
 assert(pack.loaded_count == 0 && active_surfaces == 0);
 assert(provider_releases == provider_opens);
 assert(surface_releases == 6);

 reset_counters();
 assert(bravia_logo_pack_load(&pack, &dfb, "") == -1);
 assert(bravia_logo_pack_load(&pack, &dfb, NULL) == -1);
 assert(attempts == 0 && active_surfaces == 0);
 puts("PASS Stage17: 30 ARGB logos, explicit attach/detach, atomic rollback");
 return 0;
}
