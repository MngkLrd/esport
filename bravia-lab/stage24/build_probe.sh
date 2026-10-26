#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p stage24/build
CFLAGS="-std=c99 -O2 -Wall -Wextra -Werror -Wconversion -pedantic"
SOURCES="native_core/home_core.c native_core/render.c native_core/host_dispatch.c native_core/native_catalog.c native_core/catalog_host.c native_core/bravia_plugin.c"
cc $CFLAGS -Inative_core $SOURCES stage24/native_boot_probe.c -o stage24/build/native_boot_probe_host
./stage24/build/native_boot_probe_host
clang -target armv7-linux-gnueabi -mfpu=vfpv4 -mfloat-abi=softfp -fuse-ld=lld \
 -fno-builtin -ffreestanding -nostdlib -static \
 $CFLAGS -Wl,-e,_start -Wl,--no-undefined -Inative_core $SOURCES \
 stage24/native_boot_probe.c stage24/native_boot_start.S \
 -o stage24/build/bravia_home_native_probe_armv7.elf
readelf -h stage24/build/bravia_home_native_probe_armv7.elf | grep -q 'Machine:.*ARM'
readelf -h stage24/build/bravia_home_native_probe_armv7.elf | grep -q 'Type:.*EXEC'
if readelf -l stage24/build/bravia_home_native_probe_armv7.elf | grep -q 'INTERP';then
 echo 'unexpected dynamic loader' >&2;exit 2
fi
if readelf -d stage24/build/bravia_home_native_probe_armv7.elf | grep -q 'NEEDED';then
 echo 'unexpected runtime dependencies' >&2;exit 2
fi
if command -v qemu-arm >/dev/null 2>&1;then
 qemu-arm stage24/build/bravia_home_native_probe_armv7.elf | grep -q '^BRAVIA_HOME_ARM32_NATIVE_CORE_PASS'
else
 echo 'QEMU not installed: ARM ELF built but not executed on ARM'
fi
