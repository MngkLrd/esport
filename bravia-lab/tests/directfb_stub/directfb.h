/* TEST-ONLY FUNCTIONAL MOCK — does not describe Sony binary ABI. */
#ifndef DIRECTFB_TEST_STUB_H
#define DIRECTFB_TEST_STUB_H
typedef int DFBResult;
#define DFB_OK 0
#define DSFLIP_NONE 0
#define DSTF_TOPLEFT 0
#define DSBLIT_BLEND_ALPHACHANNEL 1
#define DSBLIT_NOFX 0
#define DSDESC_WIDTH 1
#define DSDESC_HEIGHT 2
#define DSDESC_PIXELFORMAT 4
#define DSPF_ARGB 1
typedef struct {int x,y,w,h;} DFBRectangle;
typedef struct {int x1,y1,x2,y2;} DFBRegion;
typedef struct {int flags,width,height,pixelformat;} DFBSurfaceDescription;
typedef struct IDirectFBFont {int slot;} IDirectFBFont;
typedef struct IDirectFBSurface IDirectFBSurface;
struct IDirectFBSurface{
 DFBResult (*GetSize)(IDirectFBSurface*,int*,int*);
 DFBResult (*SetColor)(IDirectFBSurface*,unsigned char,unsigned char,unsigned char,unsigned char);
 DFBResult (*FillRectangle)(IDirectFBSurface*,int,int,int,int);
 DFBResult (*DrawRectangle)(IDirectFBSurface*,int,int,int,int);
 DFBResult (*SetFont)(IDirectFBSurface*,IDirectFBFont*);
 DFBResult (*SetClip)(IDirectFBSurface*,const DFBRegion*);
 DFBResult (*DrawString)(IDirectFBSurface*,const char*,int,int,int,int);
 DFBResult (*Flip)(IDirectFBSurface*,const DFBRegion*,int);
 DFBResult (*SetBlittingFlags)(IDirectFBSurface*,int);
 DFBResult (*StretchBlit)(IDirectFBSurface*,IDirectFBSurface*,const DFBRectangle*,const DFBRectangle*);
 DFBResult (*Release)(IDirectFBSurface*);
};
typedef struct IDirectFBImageProvider IDirectFBImageProvider;
struct IDirectFBImageProvider {
 DFBResult (*GetSurfaceDescription)(IDirectFBImageProvider*,DFBSurfaceDescription*);
 DFBResult (*RenderTo)(IDirectFBImageProvider*,IDirectFBSurface*,const DFBRectangle*);
 DFBResult (*Release)(IDirectFBImageProvider*);
};
typedef struct IDirectFB IDirectFB;
struct IDirectFB {
 DFBResult (*CreateImageProvider)(IDirectFB*,const char*,IDirectFBImageProvider**);
 DFBResult (*CreateSurface)(IDirectFB*,const DFBSurfaceDescription*,IDirectFBSurface**);
};
#endif
