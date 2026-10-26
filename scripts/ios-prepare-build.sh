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
if grep -q 'objectVersion = 70;' "$PBXPROJ"; then
  echo "[ios-prepare] objectVersion 70 → 77 (wymagane przez CocoaPods)"
  sed -i '' 's/objectVersion = 70;/objectVersion = 77;/' "$PBXPROJ"
fi

cd "$ROOT"
echo "[ios-prepare] patch-package…"
npx patch-package

echo "[ios-prepare] pod install…"
cd "$ROOT/ios"
pod install

# Archive copies hermes.xcframework from destroot. RN's replace_hermes_version.js
# deletes that folder and extracts a tarball from hermes-engine-artifacts/.
# If the tarball is missing, destroot stays empty and rsync fails.
ensure_hermes_xcframework() {
  local version
  version="$(node -p "require('$ROOT/node_modules/react-native/package.json').version")"
  local art="$ROOT/ios/Pods/hermes-engine-artifacts"
  local dest="$ROOT/ios/Pods/hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64"
  mkdir -p "$art"
  local cfg
  for cfg in release debug; do
    local tarfile="$art/hermes-ios-${version}-${cfg}.tar.gz"
    if [[ ! -s "$tarfile" ]]; then
      echo "[ios-prepare] pobieram Hermes ${cfg} ${version}…"
      curl -fL --retry 3 --retry-delay 2 -o "$tarfile" \
        "https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/${version}/react-native-artifacts-${version}-hermes-ios-${cfg}.tar.gz"
    fi
  done
  if [[ ! -d "$dest" ]]; then
    echo "[ios-prepare] rozpakowuję Hermes Release do Pods/hermes-engine…"
    rm -rf "$ROOT/ios/Pods/hermes-engine"
    mkdir -p "$ROOT/ios/Pods/hermes-engine"
    tar -xf "$art/hermes-ios-${version}-release.tar.gz" -C "$ROOT/ios/Pods/hermes-engine"
    echo Release > "$ROOT/ios/Pods/.last_build_configuration"
  fi
  if [[ ! -d "$dest" ]]; then
    echo "[ios-prepare] BRAK hermes.xcframework/ios-arm64 — Archive w Xcode się wywali."
    exit 1
  fi
  echo "[ios-prepare] Hermes ios-arm64 OK"
}

# Maven hermes-framework dSYM is ~280MB. Archive-time download often times out,
# which is why App Store Connect reports a missing hermes.framework dSYM.
# Prefetch iphoneos slice next to the xcframework so Xcode embeds it.
ensure_hermes_dsym() {
  local version
  version="$(node -p "require('$ROOT/node_modules/react-native/package.json').version")"
  local art="$ROOT/ios/Pods/hermes-engine-artifacts"
  local tarfile="$art/react-native-artifacts-${version}-hermes-framework-dSYM-release.tar.gz"
  local slice_dir="$ROOT/ios/Pods/hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64/dSYMs"
  local slice_dsym="$slice_dir/hermes.framework.dSYM"
  local cache_dsym="$ROOT/ios/.rn-dsyms-cache/${version}/release/hermes-framework/iphoneos/hermes.framework.dSYM"
  local dwarf="$slice_dsym/Contents/Resources/DWARF/hermes"

  if [[ -f "$dwarf" ]]; then
    echo "[ios-prepare] Hermes iphoneos dSYM już w xcframework"
    return
  fi
  if [[ -f "$cache_dsym/Contents/Resources/DWARF/hermes" ]]; then
    echo "[ios-prepare] instaluję Hermes dSYM z cache…"
    mkdir -p "$slice_dir"
    rm -rf "$slice_dsym"
    cp -R "$cache_dsym" "$slice_dsym"
    return
  fi

  mkdir -p "$art"
  if [[ ! -s "$tarfile" ]]; then
    echo "[ios-prepare] pobieram Hermes dSYM ${version} (raz, ~280 MB)…"
    curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 300 -o "$tarfile" \
      "https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/${version}/react-native-artifacts-${version}-hermes-framework-dSYM-release.tar.gz"
  fi

  local tmp
  tmp="$(mktemp -d)"
  echo "[ios-prepare] rozpakowuję iphoneos Hermes dSYM…"
  tar -xzf "$tarfile" -C "$tmp" ./iphoneos
  mkdir -p "$(dirname "$cache_dsym")" "$slice_dir"
  rm -rf "$cache_dsym" "$slice_dsym"
  cp -R "$tmp/iphoneos/hermes.framework.dSYM" "$cache_dsym"
  cp -R "$cache_dsym" "$slice_dsym"
  rm -rf "$tmp"
  echo "[ios-prepare] Hermes iphoneos dSYM OK"
}

ensure_hermes_xcframework
ensure_hermes_dsym

echo "[ios-prepare] gotowe — możesz budować w Xcode (EstateOS.xcworkspace) lub: npx expo run:ios"
