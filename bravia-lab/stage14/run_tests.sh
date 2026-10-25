#!/usr/bin/env sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$HERE/../native_core"
make test adapter-test
cd "$HERE"
sh "$HERE/build_arm.sh"
python3 "$HERE/build_preview.py"
python3 "$HERE/test_artifacts.py"
