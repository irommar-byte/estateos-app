#!/usr/bin/env bash
# CocoaPods + Xcode 26: incomplete pod install skips Headers/Public|Private symlinks.
# Symptoms: "module map file not found", "SDWebImage/SDWebImageCompat.h file not found", etc.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PODS="$ROOT/ios/Pods"
PBXPROJ="$PODS/Pods.xcodeproj/project.pbxproj"
TSF="$PODS/Target Support Files"

if [[ ! -f "$PBXPROJ" ]]; then
  echo "[fix-ios-pod-headers] skip — Pods not installed"
  exit 0
fi

relative_link() {
  local from_dir="$1"
  local target="$2"
  local link_name="$3"
  mkdir -p "$from_dir"
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$target', '$from_dir'))")"
  ln -sfn "$rel" "$from_dir/$link_name"
}

resolve_tsf_dir() {
  local public_name="$1"
  local modulemap_file="$2"
  local pod_name="${modulemap_file%.modulemap}"
  local candidate
  for candidate in "$public_name" "$pod_name"; do
    if [[ -f "$TSF/$candidate/$modulemap_file" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

pod_srcroot() {
  local tsf_dir="$1"
  local xcconfig="$TSF/$tsf_dir/$tsf_dir.debug.xcconfig"
  [[ -f "$xcconfig" ]] || xcconfig="$TSF/$tsf_dir/$(echo "$tsf_dir" | tr '[:upper:]' '[:lower:]').debug.xcconfig"
  [[ -f "$xcconfig" ]] || return 1
  local raw
  raw="$(grep -E '^PODS_TARGET_SRCROOT' "$xcconfig" | head -1 | cut -d= -f2- | tr -d ' "')"
  if [[ "$raw" == \$\{PODS_ROOT\}* ]]; then
    echo "$PODS/${raw#\$\{PODS_ROOT\}/}"
  else
    echo "$raw"
  fi
}

find_header_in_pod() {
  local pod_root="$1"
  local header="$2"
  [[ -d "$pod_root" ]] || return 1
  find "$pod_root" -name "$header" -type f 2>/dev/null | head -1
}

link_imported_headers() {
  local headers_dir="$1"
  local pod_root="$2"
  local header_list_file="$3"
  while IFS= read -r header; do
    [[ -z "$header" ]] && continue
    local src
    src="$(find_header_in_pod "$pod_root" "$header")"
    if [[ -n "$src" ]]; then
      relative_link "$headers_dir" "$src" "$header"
    fi
  done < "$header_list_file"
}

collect_quoted_imports() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  rg -o '#import "([^"]+)"' "$file" 2>/dev/null | sed -E 's/#import "([^"]+)"/\1/' || true
}

link_one_modulemap() {
  local rel="$1"
  local headers_dir="$PODS/Headers/$(dirname "$rel")"
  local modulemap_file
  modulemap_file="$(basename "$rel")"
  local public_name
  public_name="$(basename "$(dirname "$rel")")"
  local pod_name="${modulemap_file%.modulemap}"

  local tsf_dir
  tsf_dir="$(resolve_tsf_dir "$public_name" "$modulemap_file")" || {
    echo "[fix-ios-pod-headers] skip — $rel (no Target Support Files source)"
    return 0
  }

  relative_link "$headers_dir" "$TSF/$tsf_dir/$modulemap_file" "$modulemap_file"

  local umbrella="${pod_name}-umbrella.h"
  if [[ -f "$TSF/$tsf_dir/$umbrella" ]]; then
    relative_link "$headers_dir" "$TSF/$tsf_dir/$umbrella" "$umbrella"
  fi

  local pod_root
  pod_root="$(pod_srcroot "$tsf_dir")" || pod_root=""

  local modulemap_path="$headers_dir/$modulemap_file"
  local umbrella_from_map=""
  if [[ -f "$modulemap_path" ]]; then
    umbrella_from_map="$(rg -o 'umbrella header "([^"]+)"' "$TSF/$tsf_dir/$modulemap_file" 2>/dev/null | sed -E 's/umbrella header "([^"]+)"/\1/' | head -1 || true)"
  fi

  if [[ -n "$umbrella_from_map" && ! -f "$headers_dir/$umbrella_from_map" ]]; then
    local umbrella_src=""
    if [[ -f "$TSF/$tsf_dir/$umbrella_from_map" ]]; then
      umbrella_src="$TSF/$tsf_dir/$umbrella_from_map"
    elif [[ -n "$pod_root" ]]; then
      umbrella_src="$(find_header_in_pod "$pod_root" "$umbrella_from_map")"
    fi
    if [[ -n "$umbrella_src" ]]; then
      relative_link "$headers_dir" "$umbrella_src" "$umbrella_from_map"
    fi
  fi

  if [[ -n "$pod_root" && -d "$pod_root" ]]; then
    local imports_file
    imports_file="$(mktemp)"
    {
      if [[ -f "$headers_dir/$umbrella" ]]; then
        collect_quoted_imports "$headers_dir/$umbrella"
      fi
      if [[ -n "$umbrella_from_map" && -f "$headers_dir/$umbrella_from_map" ]]; then
        collect_quoted_imports "$headers_dir/$umbrella_from_map"
      fi
    } | sort -u > "$imports_file"
    link_imported_headers "$headers_dir" "$pod_root" "$imports_file"
    rm -f "$imports_file"

    if [[ "$public_name" == "SDWebImage" ]]; then
      for h in "$pod_root"/SDWebImage/Core/*.h "$pod_root"/WebImage/*.h; do
        [[ -f "$h" ]] || continue
        relative_link "$headers_dir" "$h" "$(basename "$h")"
      done
    fi

    if [[ "$public_name" == "libavif" ]]; then
      for h in "$pod_root"/include/avif/*.h; do
        [[ -f "$h" ]] || continue
        relative_link "$headers_dir" "$h" "$(basename "$h")"
      done
    fi
  fi

  if [[ "$tsf_dir" == "SDWebImageWebPCoder" && -n "$pod_root" ]]; then
    for h in "$pod_root"/SDWebImageWebPCoder/Classes/*.h "$pod_root"/SDWebImageWebPCoder/Module/*.h; do
      [[ -f "$h" ]] || continue
      relative_link "$headers_dir" "$h" "$(basename "$h")"
    done
  fi

  if [[ "$tsf_dir" == "SDWebImageSVGCoder" && -n "$pod_root" ]]; then
    for h in "$pod_root"/SDWebImageSVGCoder/Classes/*.h "$pod_root"/SDWebImageSVGCoder/Module/*.h; do
      [[ -f "$h" ]] || continue
      relative_link "$headers_dir" "$h" "$(basename "$h")"
    done
  fi
}

map_count=0
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  link_one_modulemap "$rel"
  map_count=$((map_count + 1))
done < <(
  rg -o 'MODULEMAP_FILE = "?Headers/((Public|Private)/[^";]+)' "$PBXPROJ" \
    | sed -E 's/MODULEMAP_FILE = "?Headers\///' \
    | sort -u
)

echo "[fix-ios-pod-headers] OK — $map_count module maps + public headers under $PODS/Headers"
