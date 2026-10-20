#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts
if [ "$1" = '--prepare' ] || [ ! -f artifacts/ios-device-id ]; then
  device_id=$(xcrun simctl list devices available -j | python3 -c 'import json,sys; data=json.load(sys.stdin); print(next(d["udid"] for key,group in sorted(data["devices"].items(),reverse=True) if "iOS" in key for d in group if d.get("isAvailable") and "iPhone" in d["name"]))')
  printf '%s' "$device_id" > artifacts/ios-device-id
  xcrun simctl boot "$device_id"
  if [ "$1" = '--prepare' ]; then exit 0; fi
fi
app_path="$1"
device_id=$(cat artifacts/ios-device-id)
printf 'Waiting for iPhone simulator startup\n'
xcrun simctl bootstatus "$device_id" -b
printf 'Installing bundled app\n'
xcrun simctl install "$device_id" "$app_path"
printf 'Launching com.tehilimbeyajad.app\n'
xcrun simctl launch "$device_id" com.tehilimbeyajad.app
sleep 5
xcrun simctl io "$device_id" screenshot artifacts/ios-simulator-start.png
# This verifies process startup only, not signed-device or UI acceptance.
