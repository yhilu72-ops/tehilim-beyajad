#!/usr/bin/env bash
set -euo pipefail
: "${TBJ_APPLE_TEAM_ID:?Configure the registered Apple developer team}"
: "${TBJ_IOS_PROFILE_NAME:?Configure the installed App Store provisioning profile}"
: "${TBJ_BUILD_NUMBER:?Choose a build number greater than the last App Store upload}"
# Requires the account's distribution certificate in the macOS login keychain.
# Never create an unsigned archive and present it as a release.
npm run check
npm test
npm run mobile:sync
mkdir -p artifacts
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath artifacts/TehilimBeYajad.xcarchive \
  DEVELOPMENT_TEAM="$TBJ_APPLE_TEAM_ID" CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER="$TBJ_IOS_PROFILE_NAME" \
  CURRENT_PROJECT_VERSION="$TBJ_BUILD_NUMBER" archive
python3 - <<'PY'
import os,plistlib
with open('artifacts/ExportOptions.plist','wb') as f:
    plistlib.dump({'method':'app-store-connect','destination':'export','teamID':os.environ['TBJ_APPLE_TEAM_ID'],
                  'signingStyle':'manual','provisioningProfiles':{'com.tehilimbeyajad.app':os.environ['TBJ_IOS_PROFILE_NAME']}},f)
PY
xcodebuild -exportArchive -archivePath artifacts/TehilimBeYajad.xcarchive \
  -exportPath artifacts/ios-release -exportOptionsPlist artifacts/ExportOptions.plist
find artifacts/ios-release -name '*.ipa' -exec shasum -a 256 {} \; > artifacts/ios-sha256.txt
test -s artifacts/ios-sha256.txt
printf 'Signed iOS export prepared in artifacts/. No upload was performed.\n'
