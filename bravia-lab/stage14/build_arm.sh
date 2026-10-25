#!/usr/bin/env sh
# Build a relocatable ARMv7 C99 core, NOT a runnable Sony application.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CLANG=${CLANG:-clang}
LLD=${LLD:-ld.lld}
INC=$($CLANG -print-resource-dir)/include
mkdir -p "$HERE/build"
for unit in home_core render host_dispatch; do
 "$CLANG" -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp \
  -ffreestanding -fno-builtin -fno-stack-protector -nostdinc \
  -isystem "$INC" -I "$HERE/../native_core" -std=c99 -O2 -Wall -Wextra -Werror \
  -c "$HERE/../native_core/$unit.c" -o "$HERE/build/$unit.arm.o"
done
"$LLD" -m armelf_linux_eabi -r \
 "$HERE/build/home_core.arm.o" "$HERE/build/render.arm.o" \
 "$HERE/build/host_dispatch.arm.o" -o "$HERE/build/BRAVIA_HOME_v14_ARMv7_ET_REL.o"
readelf -h "$HERE/build/BRAVIA_HOME_v14_ARMv7_ET_REL.o" |grep -E 'Class:|Type:|Machine:|Flags:'
echo 'ET_REL only; no Sony app loader, DirectFB SDK, privileged IPC or flash.'
