#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
node --test tests/test_navigation.cjs
python3 -m unittest -v \
  tests/test_firmware_lab.py \
  tests/test_firmware_extended.py \
  tests/test_audit_bloat.py \
  tests/test_real_firmware_pipeline.py \
  tests/test_ui_v2_browser.py
