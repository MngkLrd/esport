/* Normal desktop/Linux test harness only; libc stdin/stdout. */
#include <stdio.h>
int bravia_demo_main(void);
int bravia_io_getc(void){int c=getchar();return c==EOF?-1:c;}
void bravia_io_puts(const char *s){fputs(s,stdout);fflush(stdout);}
int main(void){return bravia_demo_main();}
