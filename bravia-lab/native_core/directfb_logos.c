/* Optional DirectFB 1.x image-provider bridge. Host must have an
 * authorized IDirectFB and a legal directory of offline Stage17 assets.
 * No Sony-specific ABI, exclusive layer, dynamic network I/O or flashing.
 */
#include "directfb_logos.h"
#ifdef BRAVIA_WITH_DIRECTFB
#include <stdio.h>
#include <string.h>

static const char *const slugs[10] = {
 "kinopoisk", "ivi", "start", "netflix", "youtube",
 "rutube", "msx", "alcopac", "browser", "kion"
};
static const char *const statuses[3] = {"unknown", "ready", "unavailable"};

void bravia_logo_pack_release(BraviaLogoPack *pack) {
 int i, j;
 if (!pack) return;
 for (i = 0; i < 10; ++i)
  for (j = 0; j < 3; ++j) {
   if (pack->surfaces[i][j]) {
    pack->surfaces[i][j]->Release(pack->surfaces[i][j]);
    pack->surfaces[i][j] = NULL;
   }
  }
 pack->loaded_count = 0;
}

void bravia_logo_pack_attach(BraviaDfb *backend, const BraviaLogoPack *pack) {
 int i, j;
 if (!backend) return;
 for (i = 0; i < 10; ++i)
  for (j = 0; j < 3; ++j)
   backend->logos[i][j] = pack ? pack->surfaces[i][j] : NULL;
}

void bravia_logo_pack_detach(BraviaDfb *backend) {
 bravia_logo_pack_attach(backend, NULL);
}

int bravia_logo_pack_load(BraviaLogoPack *pack, IDirectFB *dfb,
                          const char *asset_directory) {
 BraviaLogoPack pending = {0};
 int i, j;
 if (!pack || !dfb || !dfb->CreateImageProvider || !dfb->CreateSurface ||
     !asset_directory || !asset_directory[0] || pack->loaded_count != 0)
  return -1;

 for (i = 0; i < 10; ++i) {
  for (j = 0; j < 3; ++j) {
   char pathname[512];
   int n = snprintf(pathname, sizeof(pathname), "%s/%02d_%s_%s.png",
                    asset_directory, i, slugs[i], statuses[j]);
   IDirectFBImageProvider *provider = NULL;
   IDirectFBSurface *texture = NULL;
   DFBSurfaceDescription desc;
   if (n <= 0 || (size_t)n >= sizeof(pathname)) goto failed;
   if (dfb->CreateImageProvider(dfb, pathname, &provider) != DFB_OK ||
       !provider) {
    if (provider) provider->Release(provider);
    goto failed;
   }
   memset(&desc, 0, sizeof(desc));
   if (provider->GetSurfaceDescription(provider, &desc) != DFB_OK ||
       desc.width != 144 || desc.height != 75) {
    provider->Release(provider);
    goto failed;
   }
   /* Preserve generated transparent pixels, regardless of display format. */
   desc.flags = DSDESC_WIDTH | DSDESC_HEIGHT | DSDESC_PIXELFORMAT;
   desc.pixelformat = DSPF_ARGB;
   if (dfb->CreateSurface(dfb, &desc, &texture) != DFB_OK || !texture) {
    if (texture) texture->Release(texture);
    provider->Release(provider);
    goto failed;
   }
   if (provider->RenderTo(provider, texture, NULL) != DFB_OK) {
    texture->Release(texture);
    provider->Release(provider);
    goto failed;
   }
   provider->Release(provider);
   pending.surfaces[i][j] = texture;
   ++pending.loaded_count;
  }
 }
 *pack = pending;
 return 0;

failed:
 bravia_logo_pack_release(&pending);
 return -1;
}
#endif
