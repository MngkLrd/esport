#include "directfb_backend.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>
static int fills,strokes,texts,flips,clips;
static DFBResult size(IDirectFBSurface*s,int*w,int*h){(void)s;*w=1280;*h=720;return 0;}
static DFBResult color(IDirectFBSurface*s,unsigned char r,unsigned char g,unsigned char b,unsigned char a){(void)s;(void)r;(void)g;(void)b;(void)a;return 0;}
static DFBResult fill(IDirectFBSurface*s,int x,int y,int w,int h){(void)s;(void)x;(void)y;assert(w>=0&&h>=0);fills++;return 0;}
static DFBResult stroke(IDirectFBSurface*s,int x,int y,int w,int h){(void)s;(void)x;(void)y;(void)w;(void)h;strokes++;return 0;}
static DFBResult font(IDirectFBSurface*s,IDirectFBFont*f){(void)s;return f?0:-1;}
static DFBResult clip(IDirectFBSurface*s,const DFBRegion*r){(void)s;if(r){assert(r->x1<=r->x2);clips++;}return 0;}
static DFBResult draw(IDirectFBSurface*s,const char*t,int n,int x,int y,int flags){(void)s;(void)n;(void)x;(void)y;(void)flags;assert(t&&t[0]);texts++;return 0;}
static DFBResult flip(IDirectFBSurface*s,const DFBRegion*r,int f){(void)s;(void)r;(void)f;flips++;return 0;}
int main(void){
 IDirectFBSurface surface={size,color,fill,stroke,font,clip,draw,flip};
 IDirectFBFont f[12];BraviaDfb backend;UiMetrics m;HomeState state;int i;
 memset(&backend,0,sizeof(backend));backend.surface=&surface;
 for(i=0;i<6;i++){backend.regular[i]=&f[i];backend.bold[i]=&f[i+6];}
 home_init(&state);
 assert(bravia_dfb_draw(&backend,&state,&m)==0&&fills==0&&texts==0&&flips==0);
 home_key(&state,K_HOME);
 assert(bravia_dfb_draw(&backend,&state,&m)==0);
 assert(fills==m.rects&&strokes==m.strokes&&texts==m.texts&&clips==texts&&flips==0);
 backend.flip=1;
 assert(bravia_dfb_draw(&backend,&state,&m)==0&&flips==1);
 backend.regular[0]=0;
 assert(bravia_dfb_draw(&backend,&state,&m)==-1);
 printf("PASS adapter: DirectFB drawing, UTF-8 clipping, explicit flip and fail-closed fonts\n");
 return 0;
}
