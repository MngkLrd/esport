#!/usr/bin/env sh
set -eu
STAGE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
NATIVE="$STAGE/../native_core"
CC=${CC:-cc}
CLANG=${CLANG:-clang}
mkdir -p "$STAGE/build"
COMMON="-std=c99 -O2 -Wall -Wextra -Werror -pedantic"
"$CC" $COMMON -I "$NATIVE" "$NATIVE/home_core.c" "$NATIVE/host_dispatch.c" "$NATIVE/render.c" "$STAGE/demo_core.c" "$STAGE/host_posix.c" -o "$STAGE/build/bravia-home-linux-x86_64"
INC=$($CLANG -print-resource-dir)/include
for unit in "$NATIVE/home_core.c" "$NATIVE/host_dispatch.c" "$NATIVE/render.c" "$STAGE/demo_core.c" "$STAGE/arm_linux_io.c"; do
 name=$(basename "$unit" .c)
 "$CLANG" -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp \
  -ffreestanding -fno-builtin -fno-stack-protector -fno-pic -nostdinc -isystem "$INC" -I "$NATIVE" -std=c99 -O2 -Wall -Wextra -Werror \
  -c "$unit" -o "$STAGE/build/$name.arm.o"
done
ld.lld -m armelf_linux_eabi -static -e _start --no-undefined \
 "$STAGE/build/home_core.arm.o" "$STAGE/build/host_dispatch.arm.o" \
 "$STAGE/build/render.arm.o" "$STAGE/build/demo_core.arm.o" "$STAGE/build/arm_linux_io.arm.o" \
 -o "$STAGE/build/bravia-home-armv7-linux-elf"
readelf -h "$STAGE/build/bravia-home-armv7-linux-elf" | grep -E 'Class:|Type:|Machine:|Flags:'
readelf -W -l "$STAGE/build/bravia-home-armv7-linux-elf" | grep -E 'LOAD|INTERP' || true
printf '%s\n' 'HOST: runnable Linux ELF. ARM: standalone Linux syscall ELF for compatible ARM Linux only.'
printf '%s\n' 'NOT SONY TV ELF INSTALLER; NO DirectFB/SONY-IPC IMPLEMENTATION.'
