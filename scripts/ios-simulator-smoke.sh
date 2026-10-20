#!/usr/bin/env bash
set -euo pipefail
app_path="$1"
device_id=$(xcrun simctl list devices available -j | python3 -c 'import json,sys; data=json.load(sys.stdin); print(next(d["udid"] for group in data["devices"].values() for d in group if d.get("isAvailable") and "iPhone" in d["name"]))')
xcrun simctl boot "$device_id" || true
xcrun simctl bootstatus "$device_id" -b
xcrun simctl install "$device_id" "$app_path"
xcrun simctl launch "$device_id" com.tehilimbeyajad.app
sleep 5
mkdir -p artifacts
xcrun simctl io "$device_id" screenshot artifacts/ios-simulator-start.png
# Launch verifies process startup only; this is not a signed device or UI acceptance test.
