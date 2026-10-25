#include "sony_appclient_abi.h"
typedef char bravia_abi_size[(sizeof(SonyAmInitWireLayout32)==60u)?1:-1];
typedef char bravia_abi_name[(offsetof(SonyAmInitWireLayout32,process_name)==36u)?1:-1];
SonyAmAbiStatus sony_am_abi_status(void){return SONY_AM_ABI_PARTIALLY_MAPPED;}
