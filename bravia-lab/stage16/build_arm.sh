#!/usr/bin/env sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CORE=$DIR/../native_core
STAGE15=$DIR/../stage15
CLANG=${CLANG:-clang}
LLD=${LLD:-ld.lld}
INC=$($CLANG -print-resource-dir)/include
mkdir -p "$DIR/build"
for item in "$CORE/home_core.c" "$CORE/host_dispatch.c" "$CORE/render.c" "$DIR/sim.c" "$DIR/arm_main.c" "$STAGE15/arm_linux_io.c"; do
 name=$(basename "$item" .c)
 "$CLANG" -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp \
  -ffreestanding -fno-builtin -fno-stack-protector -fno-pic -nostdinc -isystem "$INC" \
  -I "$CORE" -I "$DIR" -std=c99 -O2 -Wall -Wextra -Werror \
  -c "$item" -o "$DIR/build/$name.arm.o"
done
"$LLD" -m armelf_linux_eabi -static -e _start --no-undefined \
 "$DIR/build/home_core.arm.o" "$DIR/build/host_dispatch.arm.o" \
 "$DIR/build/render.arm.o" "$DIR/build/sim.arm.o" \
 "$DIR/build/arm_main.arm.o" "$DIR/build/arm_linux_io.arm.o" \
 -o "$DIR/build/bravia-stage16-simulator-armv7-linux-elf"
readelf -h "$DIR/build/bravia-stage16-simulator-armv7-linux-elf" | grep -E 'Class:|Type:|Machine:|Flags:'
echo 'ARM Linux test simulator only. NOT SONY app_man IPC and NOT installable firmware.'
