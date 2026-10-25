#ifndef BRAVIA_NATIVE_RENDER_H
#define BRAVIA_NATIVE_RENDER_H
#include "home_core.h"
#include <stdint.h>
/* Portable C99 drawing contract. No allocations, files, sockets, threads or polling. */
typedef struct { uint8_t r,g,b; } UiColor;
typedef enum { UI_RECT=1, UI_STROKE=2, UI_TEXT=3 } UiOp;
typedef struct {
 UiOp op; int x,y,w,h; int font_px; UiColor color;
 const char *text; int emphasized;
} UiCommand;
typedef struct { int width,height; void *context; int (*emit)(void *,const UiCommand *); } UiCanvas;
typedef struct { int rects,strokes,texts; int errors; } UiMetrics;
/* Called ONLY for VIEW_HOME / VIEW_DETAIL. VIEW_TV stays owned by Sony firmware. */
int ui_render(UiCanvas *canvas,const HomeState *state,UiMetrics *metrics);
#endif
