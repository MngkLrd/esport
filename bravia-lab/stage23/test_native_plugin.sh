#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p stage23/build
cc -std=c99 -O2 -Wall -Wextra -Werror -Wconversion -pedantic \
  -Inative_core native_core/home_core.c native_core/render.c \
  native_core/host_dispatch.c native_core/native_catalog.c \
  native_core/catalog_host.c native_core/bravia_plugin.c \
  stage23/test_native_plugin.c -o stage23/build/test_native_plugin
./stage23/build/test_native_plugin
sh stage23/build_arm_shared.sh
