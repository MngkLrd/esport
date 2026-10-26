#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 source/make_icons.py
node --check source/bravia_catalog.js
node --check source/ram_hook.js
node tests/test_catalog.js
node tests/test_real_oem_bridge.js
python3 -m unittest discover -s tests -p 'test_patch.py' -v
