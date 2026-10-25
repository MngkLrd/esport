/* TEST-ONLY FUNCTIONAL MOCK — does not describe Sony binary ABI. */
#ifndef DIRECTFB_TEST_STUB_H
#define DIRECTFB_TEST_STUB_H
typedef int DFBResult;
#define DFB_OK 0
#define DSFLIP_NONE 0
#define DSTF_TOPLEFT 0
typedef struct {int x1,y1,x2,y2;} DFBRegion;
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
};
#endif
