#!/usr/bin/env bash
# Copy official React Native prebuilt framework dSYMs into the archive.
# Fixes Xcode 16+ "Upload Symbols Failed" warnings for Hermes / React / RN deps.
#
# Hermes dSYM tarball is ~280MB — never download it during Archive.
# ios-prepare-build.sh plants the iphoneos slice next to the xcframework.
set -euo pipefail

if [[ "${CONFIGURATION:-}" != *Release* ]] || [[ "${PLATFORM_NAME:-}" == "iphonesimulator" ]]; then
  exit 0
fi

if [[ -z "${DWARF_DSYM_FOLDER_PATH:-}" ]]; then
  exit 0
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="${ROOT}/ios"

# Xcode run script phases don't inherit nvm/fnm PATH — use .xcode.env like RN scripts.
if [[ -f "${IOS_DIR}/.xcode.env" ]]; then
  # shellcheck source=/dev/null
  source "${IOS_DIR}/.xcode.env"
fi
if [[ -f "${IOS_DIR}/.xcode.env.local" ]]; then
  # shellcheck source=/dev/null
  source "${IOS_DIR}/.xcode.env.local"
fi
NODE="${NODE_BINARY:-$(command -v node || true)}"
if [[ -z "${NODE}" || ! -x "${NODE}" ]]; then
  echo "error: [rn-dsyms] node not found. Set NODE_BINARY in ios/.xcode.env.local" >&2
  exit 1
fi

CACHE_ROOT="${ROOT}/ios/.rn-dsyms-cache"
MAVEN_BASE="${ENTERPRISE_REPOSITORY:-https://repo1.maven.org/maven2}/com/facebook/react/react-native-artifacts"

RN_VERSION="$(
  "${NODE}" -p "require('${ROOT}/node_modules/react-native/package.json').version" 2>/dev/null \
    || "${NODE}" -p "require('${ROOT}/package.json').dependencies['react-native'].replace(/^[^0-9]*/, '')"
)"

BUILD_TYPE="release"
if [[ "${CONFIGURATION:-}" == *Debug* ]]; then
  BUILD_TYPE="debug"
fi

cache_dir="${CACHE_ROOT}/${RN_VERSION}/${BUILD_TYPE}"
mkdir -p "${cache_dir}" "${DWARF_DSYM_FOLDER_PATH}"

install_dsym() {
  local src="$1"
  local dest="$2"
  if [[ ! -d "$src" ]]; then
    return 1
  fi
  rm -rf "$dest"
  cp -R "$src" "$dest"
  echo "[rn-dsyms] installed $(basename "$dest")"
  return 0
}

# 1) Hermes: local xcframework / prepare cache first (no network during Archive).
HERMES_LOCAL_DSYMS=(
  "${PODS_ROOT:-${IOS_DIR}/Pods}/hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64/dSYMs/hermes.framework.dSYM"
  "${cache_dir}/hermes-framework/iphoneos/hermes.framework.dSYM"
)
hermes_dest="${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"
hermes_ok=0
for src in "${HERMES_LOCAL_DSYMS[@]}"; do
  if install_dsym "$src" "$hermes_dest"; then
    hermes_ok=1
    break
  fi
done

fetch_and_extract() {
  local artifact="$1"
  local inner_path="$2"
  local dsym_name="$3"
  local tarball="${cache_dir}/${artifact}.tar.gz"
  local extract_dir="${cache_dir}/${artifact}"
  local url="${MAVEN_BASE}/${RN_VERSION}/react-native-artifacts-${RN_VERSION}-${artifact}-dSYM-${BUILD_TYPE}.tar.gz"

  if [[ ! -f "${extract_dir}/${inner_path}" ]]; then
    echo "[rn-dsyms] fetching ${artifact} (${RN_VERSION}, ${BUILD_TYPE})"
    rm -rf "${extract_dir}"
    mkdir -p "${extract_dir}"
    # Official Maven sometimes 404s optional RN dSYMs (e.g. reactnative-core).
    # Never fail the archive for missing debug symbols.
    if ! curl -fL --retry 2 --retry-delay 1 --connect-timeout 20 --max-time 90 "${url}" -o "${tarball}"; then
      echo "warning: [rn-dsyms] ${artifact} dSYM unavailable — archive continues without ${dsym_name}" >&2
      rm -f "${tarball}"
      rm -rf "${extract_dir}"
      return 0
    fi
    if ! tar -xzf "${tarball}" -C "${extract_dir}"; then
      echo "warning: [rn-dsyms] ${artifact} tarball unreadable — skipped" >&2
      rm -f "${tarball}"
      rm -rf "${extract_dir}"
      return 0
    fi
  fi

  local src="${extract_dir}/${inner_path}"
  local dest="${DWARF_DSYM_FOLDER_PATH}/${dsym_name}"
  if ! install_dsym "$src" "$dest"; then
    echo "warning: [rn-dsyms] missing ${src}" >&2
  fi
}

if [[ "$hermes_ok" -eq 0 ]]; then
  echo "warning: [rn-dsyms] local Hermes dSYM missing — run: npm run ios:prepare" >&2
  fetch_and_extract "hermes-framework" "iphoneos/hermes.framework.dSYM" "hermes.framework.dSYM"
fi

fetch_and_extract "reactnative-core" "ios-arm64/React.framework.dSYM" "React.framework.dSYM"
fetch_and_extract "reactnative-dependencies" "ios-arm64/ReactNativeDependencies.framework.dSYM" "ReactNativeDependencies.framework.dSYM"
