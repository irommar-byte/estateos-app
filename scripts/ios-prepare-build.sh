#!/usr/bin/env bash
# Pełne przygotowanie iOS przed buildem w Xcode / expo run:ios.
# Naprawia: objectVersion 70 (CocoaPods), pod install, symlinki Headers, patch react-native-maps.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBXPROJ="$ROOT/ios/EstateOS.xcodeproj/project.pbxproj"

if [[ ! -f "$PBXPROJ" ]]; then
  echo "[ios-prepare] brak ios/EstateOS.xcodeproj — uruchom najpierw: npx expo prebuild --platform ios"
  exit 1
fi

# Xcode 26 + CocoaPods 1.16: objectVersion 70 nie jest rozpoznawane; 77 działa.
if rg -q 'objectVersion = 70;' "$PBXPROJ"; then
  echo "[ios-prepare] objectVersion 70 → 77 (wymagane przez CocoaPods)"
  sed -i '' 's/objectVersion = 70;/objectVersion = 77;/' "$PBXPROJ"
fi

cd "$ROOT"
echo "[ios-prepare] patch-package…"
npx patch-package

echo "[ios-prepare] pod install…"
cd "$ROOT/ios"
pod install

echo "[ios-prepare] gotowe — możesz budować w Xcode (EstateOS.xcworkspace) lub: npx expo run:ios"
