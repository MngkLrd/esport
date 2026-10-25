/* ARM Linux EABI demonstrator. Only standard read/write/exit Linux syscalls.
 * NEVER intended to replace /3rd/sony/sony_dockui/launcher.bin.
 * No Sony libapp_client/directfb linkage; no privileged file or device access.
 */
int bravia_demo_main(void);
static int arm_syscall3(int n,int a,int b,int c){
 register int r0 __asm__("r0")=a;
 register int r1 __asm__("r1")=b;
 register int r2 __asm__("r2")=c;
 register int r7 __asm__("r7")=n;
 __asm__ volatile("svc #0" : "+r"(r0) : "r"(r1),"r"(r2),"r"(r7) : "memory","cc");
 return r0;
}
int bravia_io_getc(void){
 char c;
 int n=arm_syscall3(3,0,(int)(long)&c,1);
 return n==1?(unsigned char)c:-1;
}
void bravia_io_puts(const char *s){
 unsigned len=0,offset=0;
 while(s[len])len++;
 while(offset<len){
  int n=arm_syscall3(4,1,(int)(long)(s+offset),(int)(len-offset));
  if(n<=0)break;
  offset+=(unsigned)n;
 }
}
__attribute__((noreturn,used))void _start(void){
 int code=bravia_demo_main();
 (void)arm_syscall3(1,code,0,0);
 for(;;){}
}
