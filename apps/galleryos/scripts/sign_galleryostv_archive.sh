#!/bin/bash
set -euo pipefail
# Signs a GalleryOSTV .xcarchive for App Store / TestFlight.
# EstateOS TV uses a Manual App Store profile on disk; GalleryOS currently only has
# an Xcode-managed store profile, so we embed + codesign after an unsigned archive.

ARCHIVE_PATH="${1:-${ARCHIVE_PATH:-}}"
if [[ -z "${ARCHIVE_PATH}" || ! -d "${ARCHIVE_PATH}" ]]; then
  echo "usage: $0 /path/to/GalleryOSTV.xcarchive" >&2
  exit 1
fi

APP="${ARCHIVE_PATH}/Products/Applications/GalleryOSTV.app"
PROF_UUID="5811b202-ae4b-49ab-8ad2-63be23444148"
PROF="${HOME}/Library/Developer/Xcode/UserData/Provisioning Profiles/${PROF_UUID}.mobileprovision"
if [[ ! -f "$PROF" ]]; then
  PROF="${HOME}/Library/MobileDevice/Provisioning Profiles/${PROF_UUID}.mobileprovision"
fi
IDENTITY="F3FE2A4FFA2F6A257E840B7D1C75BF65F7EF4F6D"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENT="${ROOT}/GalleryOSTV/Resources/AppStore.entitlements"

[[ -d "$APP" ]] || { echo "missing app: $APP" >&2; exit 1; }
[[ -f "$PROF" ]] || { echo "missing profile: $PROF" >&2; exit 1; }
[[ -f "$ENT" ]] || { echo "missing entitlements: $ENT" >&2; exit 1; }

cp "$PROF" "$APP/embedded.mobileprovision"
while IFS= read -r item; do
  codesign --force --sign "$IDENTITY" --generate-entitlement-der "$item" || true
done < <(find "$APP" \( -name '*.framework' -o -name '*.appex' \))
codesign --force --sign "$IDENTITY" --entitlements "$ENT" --generate-entitlement-der "$APP"

INFO="${ARCHIVE_PATH}/Info.plist"
if [[ -f "$INFO" ]]; then
  /usr/libexec/PlistBuddy -c "Set :ApplicationProperties:Team NW3YW69KL9" "$INFO" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :ApplicationProperties:Team string NW3YW69KL9" "$INFO" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :ApplicationProperties:SigningIdentity Apple Distribution: MARIAN ROMANIENKO (NW3YW69KL9)" "$INFO" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :ApplicationProperties:SigningIdentity string Apple Distribution: MARIAN ROMANIENKO (NW3YW69KL9)" "$INFO" 2>/dev/null || true
fi

codesign -dv --verbose=2 "$APP" 2>&1 | grep -E 'Authority|Identifier|TeamIdentifier|Signature' || true
echo "Signed: $APP"
