#!/usr/bin/env bash
# Copy official React Native prebuilt framework dSYMs into the archive.
# Fixes Xcode 16+ "Upload Symbols Failed" warnings for Hermes / React / RN deps.
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
    curl -fsSL "${url}" -o "${tarball}"
    tar -xzf "${tarball}" -C "${extract_dir}"
  fi

  local src="${extract_dir}/${inner_path}"
  local dest="${DWARF_DSYM_FOLDER_PATH}/${dsym_name}"

  if [[ ! -d "${src}" ]]; then
    echo "warning: [rn-dsyms] missing ${src}" >&2
    return 0
  fi

  rm -rf "${dest}"
  cp -R "${src}" "${dest}"
  echo "[rn-dsyms] installed ${dsym_name}"
}

fetch_and_extract "hermes-framework" "iphoneos/hermes.framework.dSYM" "hermes.framework.dSYM"
fetch_and_extract "reactnative-core" "ios-arm64/React.framework.dSYM" "React.framework.dSYM"
fetch_and_extract "reactnative-dependencies" "ios-arm64/ReactNativeDependencies.framework.dSYM" "ReactNativeDependencies.framework.dSYM"
