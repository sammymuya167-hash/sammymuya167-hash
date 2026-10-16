#!/bin/sh
set -eu
mkdir -p screenshots
adb logcat -c
adb logcat -v threadtime > screenshots/android-logcat.txt 2>&1 &
log_pid=$!
trap 'kill "$log_pid" 2>/dev/null || true' EXIT HUP INT TERM
timeout --signal=TERM --kill-after=15s 600s flutter drive --driver=test_driver/integration_test.dart --target=integration_test/app_test.dart --no-dds --host-vmservice-port=8181
