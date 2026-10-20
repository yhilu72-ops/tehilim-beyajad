#!/usr/bin/env bash
set -euo pipefail
: "${ANDROID_HOME:?Android SDK required}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
sdkmanager 'platform-tools' 'emulator' 'system-images;android-35;google_apis;x86_64' >/dev/null
printf 'no\n' | avdmanager create avd --name tehilim-ci --package 'system-images;android-35;google_apis;x86_64' --device pixel_6 --force >/dev/null
if [ -e /dev/kvm ]; then sudo chmod 666 /dev/kvm; fi
"$ANDROID_HOME/emulator/emulator" -avd tehilim-ci -no-window -noaudio -no-snapshot -no-boot-anim -gpu swiftshader_indirect > /tmp/tehilim-emulator.log 2>&1 &
trap 'adb emu kill >/dev/null 2>&1 || true' EXIT
adb wait-for-device
booted=false
for i in $(seq 1 120); do
  if [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = '1' ]; then booted=true; break; fi
  sleep 2
done
if [ "$booted" != true ]; then cat /tmp/tehilim-emulator.log; exit 1; fi
adb shell input keyevent 82
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell pm grant com.tehilimbeyajad.app android.permission.POST_NOTIFICATIONS
adb shell appops set com.tehilimbeyajad.app SCHEDULE_EXACT_ALARM allow
# Offline startup must read packaged content, not depend on the Vercel site.
adb shell svc wifi disable
adb shell svc data disable
(cd android && ./gradlew connectedDebugAndroidTest --no-daemon)
adb shell am start -n com.tehilimbeyajad.app/.MainActivity
mkdir -p artifacts
adb exec-out screencap -p > artifacts/android-emulator-start.png
