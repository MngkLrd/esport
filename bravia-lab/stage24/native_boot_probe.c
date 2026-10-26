/* Freestanding ARMv7 Linux self-check of the Stage23 HOME plugin.
 * No Sony firmware calls, filesystem writes, IPC or user tracking. */
#include "bravia_plugin.h"
static int draw_counter(void *ctx,const UiCommand *cmd){
 int *count=(int*)ctx;if(!count||!cmd)return 0;(*count)++;return 1;
}
#if defined(__arm__)
static void output(const char *s,unsigned n){
 register unsigned r0 __asm__("r0")=1u;
 register const char *r1 __asm__("r1")=s;
 register unsigned r2 __asm__("r2")=n;
 register unsigned r7 __asm__("r7")=4u;
 __asm__ volatile("svc #0":"+r"(r0):"r"(r1),"r"(r2),"r"(r7):"memory");
}
void *memcpy(void *dst,const void *src,unsigned long n){
 unsigned char *d=(unsigned char*)dst;
 const unsigned char *s=(const unsigned char*)src;unsigned long i;
 for(i=0;i<n;i++)d[i]=s[i];return dst;
}
#else
#include <stdio.h>
static void output(const char *s,unsigned n){(void)fwrite(s,1u,n,stdout);}
#endif
int bravia_boot_probe_main(void){
 BraviaPlugin p;BraviaPluginHost host={BRAVIA_PLUGIN_ABI,0,0,0,0};
 UiMetrics m;int dirty=0,drawn=0;
 const char yes[]="BRAVIA_HOME_ARM32_NATIVE_CORE_PASS 94 UI commands; Sony host not connected\n";
 const char no[]="BRAVIA_HOME_ARM32_NATIVE_CORE_FAIL\n";
 if(bravia_plugin_init(&p,&host)==0 &&
    bravia_plugin_key(&p,K_HOME,&dirty)==HOST_OK&&dirty&&
    bravia_plugin_render(&p,1280,720,&drawn,draw_counter,&m)==0&&
    drawn==94&&m.errors==0){
   output(yes,(unsigned)sizeof(yes)-1u);return 0;
 }
 output(no,(unsigned)sizeof(no)-1u);return 1;
}
#ifndef __arm__
int main(void){return bravia_boot_probe_main();}
#endif
