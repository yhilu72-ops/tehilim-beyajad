#!/usr/bin/env bash
set -euo pipefail
: "${TBJ_ANDROID_KEYSTORE_PATH:?Configure the existing upload keystore path}"
: "${TBJ_ANDROID_STORE_PASSWORD:?Configure the keystore password securely}"
: "${TBJ_ANDROID_KEY_ALIAS:?Configure the upload key alias}"
: "${TBJ_ANDROID_KEY_PASSWORD:?Configure the key password securely}"
: "${TBJ_BUILD_NUMBER:?Choose a build number greater than the last Play upload}"
test -f "$TBJ_ANDROID_KEYSTORE_PATH"
npm run check
npm test
npm run mobile:sync
(cd android && ./gradlew bundleRelease --no-daemon)
mkdir -p artifacts
cp android/app/build/outputs/bundle/release/app-release.aab artifacts/tehilim-beyajad-release.aab
# jarsigner can exit successfully for an unsigned ZIP; check explicit signed result.
LC_ALL=C jarsigner -verify artifacts/tehilim-beyajad-release.aab > artifacts/android-signature-check.txt
grep -q 'jar verified' artifacts/android-signature-check.txt
sha256sum artifacts/tehilim-beyajad-release.aab > artifacts/android-sha256.txt
printf 'Signed Android bundle prepared in artifacts/. No upload was performed.\n'
