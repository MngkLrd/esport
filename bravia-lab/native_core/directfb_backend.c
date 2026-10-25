/* DirectFB 1.x adapter. This needs real DirectFB headers/library and a permitted
 * Sony surface/context. It DOES NOT create an exclusive primary layer,
 * receive raw remote keys, hook app_man, or install/flash anything.
 */
#include "directfb_backend.h"
#include <stddef.h>
#ifdef BRAVIA_WITH_DIRECTFB
static int apply_color(BraviaDfb *a,UiColor c){
 return a->surface->SetColor(a->surface,c.r,c.g,c.b,255)==DFB_OK;
}
static int font_bucket(int pixels){
 const int sizes[6]={14,18,22,28,38,52};
 int i,best=0,best_diff=10000;
 for(i=0;i<6;i++){
  int d=pixels>sizes[i]?pixels-sizes[i]:sizes[i]-pixels;
  if(d<best_diff){best_diff=d;best=i;}
 }
 return best;
}
static int emit_to_dfb(void *data,const UiCommand *cmd){
 BraviaDfb *a=(BraviaDfb*)data;
 IDirectFBSurface *s=a->surface;
 DFBResult e;
 if(!apply_color(a,cmd->color))return 0;
 switch(cmd->op){
 case UI_RECT:e=s->FillRectangle(s,cmd->x,cmd->y,cmd->w,cmd->h);break;
 case UI_STROKE:e=s->DrawRectangle(s,cmd->x,cmd->y,cmd->w,cmd->h);break;
 case UI_LOGO:{
  IDirectFBSurface *logo=NULL;
  if(cmd->image_id>=0&&cmd->image_id<10&&cmd->image_variant>=0&&cmd->image_variant<3)
   logo=a->logos[cmd->image_id][cmd->image_variant];
  if(logo){
   DFBRectangle rect={cmd->x,cmd->y,cmd->w,cmd->h};
   e=s->SetBlittingFlags(s,DSBLIT_BLEND_ALPHACHANNEL);
   if(e==DFB_OK)e=s->StretchBlit(s,logo,NULL,&rect);
   if(s->SetBlittingFlags(s,DSBLIT_NOFX)!=DFB_OK)return 0;
   break;
  }
  /* Texture unavailable: preserve the old legible wordmark fallback. */
 }
 /* FALLTHROUGH */
 case UI_TEXT:{
  IDirectFBFont *f=(cmd->emphasized?a->bold:a->regular)[font_bucket(cmd->font_px)];
  if(!f)return 0; /* No fonts: fail instead of pretending render succeeded. */
  DFBRegion region={cmd->x,cmd->y,cmd->x+cmd->w-1,cmd->y+cmd->h-1};
  e=s->SetFont(s,f);
  if(e==DFB_OK)e=s->SetClip(s,&region);
  if(e==DFB_OK)e=s->DrawString(s,cmd->text,-1,cmd->x,cmd->y,DSTF_TOPLEFT);
  if(s->SetClip(s,NULL)!=DFB_OK)return 0;
  break;
 }
 default:return 0;
 }
 a->last_error=(int)e;
 return e==DFB_OK;
}
int bravia_dfb_draw(BraviaDfb *backend,const HomeState *state,UiMetrics *out){
 UiCanvas cv;
 int w,h;
 if(!backend||!backend->surface||!state||!out)return -1;
 if(backend->surface->GetSize(backend->surface,&w,&h)!=DFB_OK)return -1;
 cv.width=w;cv.height=h;cv.context=backend;cv.emit=emit_to_dfb;
 if(ui_render(&cv,state,out))return -1;
 /* The real firmware host owns surface lifecycle. No Flip by default. */
 if(backend->flip&&state->view!=VIEW_TV)
  return backend->surface->Flip(backend->surface,0,DSFLIP_NONE)==DFB_OK?0:-1;
 return 0;
}
#endif
