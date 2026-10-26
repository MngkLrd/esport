#!/bin/sh
# Real linked ARM32 ET_DYN shared library. Not an authorized Sony plugin.
set -eu
cd "$(dirname "$0")/.."
: "${CC:=clang}"
mkdir -p stage23/build
"${CC}" -target armv7-linux-gnueabi -mfpu=vfpv4 -mfloat-abi=softfp \
  -fuse-ld=lld -fPIC -fno-builtin -ffreestanding -nostdlib \
  -std=c99 -O2 -Wall -Wextra -Werror -Wconversion -pedantic \
  -Wl,-soname,libbravia_home.so -Wl,--no-undefined \
  -Wl,--version-script=stage23/exports.map -shared \
  native_core/home_core.c native_core/render.c native_core/host_dispatch.c \
  native_core/native_catalog.c native_core/catalog_host.c \
  native_core/bravia_plugin.c -o stage23/build/libbravia_home_armv7.so
readelf -h stage23/build/libbravia_home_armv7.so | grep -q 'Machine:.*ARM'
readelf -h stage23/build/libbravia_home_armv7.so | grep -q 'Type:.*DYN'
if readelf -d stage23/build/libbravia_home_armv7.so | grep -q '(NEEDED)'; then
 echo "unexpected runtime library dependence" >&2; exit 2
fi
echo "PASS ARM32 EABI5 ET_DYN native HOME core built (not Sony installable)"
