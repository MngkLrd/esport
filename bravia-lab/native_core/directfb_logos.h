#ifndef BRAVIA_DIRECTFB_LOGOS_H
#define BRAVIA_DIRECTFB_LOGOS_H

#include "directfb_backend.h"

#ifdef BRAVIA_WITH_DIRECTFB
/*
 * Optional authorized-host loader for Stage17's 30 preblurred 144x75 PNGs.
 * Never acquires the Sony primary surface, remaps keys, or modifies firmware.
 * Caller initializes pack = {0}, owns its lifetime, and must detach from
 * BraviaDfb BEFORE bravia_logo_pack_release().
 */
typedef struct {
    IDirectFBSurface *surfaces[10][3];
    int loaded_count;
} BraviaLogoPack;

/* 0: all 30 textures loaded; -1: none retained. dir is assets/ path. */
int bravia_logo_pack_load(BraviaLogoPack *pack, IDirectFB *dfb,
                          const char *asset_directory);

/* Borrowed pointers only: BraviaDfb must not release these surfaces. */
void bravia_logo_pack_attach(BraviaDfb *backend, const BraviaLogoPack *pack);
void bravia_logo_pack_detach(BraviaDfb *backend);
void bravia_logo_pack_release(BraviaLogoPack *pack);
#endif
#endif
