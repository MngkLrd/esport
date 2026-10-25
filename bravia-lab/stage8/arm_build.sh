#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
src="$base/../native_core"
c=${CLANG:-clang}
linker=${LLD:-ld.lld}
inc=$("$c" -print-resource-dir)/include
mkdir -p "$base/objects"
for unit in home_core render host_dispatch; do
 "$c" -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp \
  -ffreestanding -fno-builtin -fno-stack-protector -nostdinc \
  -isystem "$inc" -I "$src" -std=c99 -O2 -Wall -Wextra -Werror \
  -c "$src/$unit.c" -o "$base/objects/$unit.o"
done
"$c" -target armv7-linux-gnueabi -march=armv7-a -mfpu=vfpv4 -mfloat-abi=softfp \
 -ffreestanding -fno-builtin -fno-stack-protector -nostdinc -isystem "$inc" \
 -std=c99 -O2 -Wall -Wextra -Werror -c "$base/sony_appclient_abi.c" \
 -o "$base/objects/sony_appclient_abi.o"
"$linker" -m armelf_linux_eabi -r \
 "$base/objects/home_core.o" "$base/objects/render.o" \
 "$base/objects/host_dispatch.o" "$base/objects/sony_appclient_abi.o" \
 -o "$base/bravia_home_armv7_relocatable.o"
readelf -h "$base/bravia_home_armv7_relocatable.o" | grep -E 'Type:|Machine:|Flags:'
echo 'ET_REL only. NOT a Sony executable, update package or installable HOME.'
