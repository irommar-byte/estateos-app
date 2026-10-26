#!/usr/bin/env bash
# CocoaPods + Xcode 26: incomplete pod install skips Headers/Public|Private
# modulemap symlinks. Do NOT copy React Native SRCROOTs into Headers/Public —
# that shadows iOS headers with Android/cxx stubs (facebook::react::Color).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PODS="$ROOT/ios/Pods"
PBXPROJ="$PODS/Pods.xcodeproj/project.pbxproj"
TSF="$PODS/Target Support Files"
RN="$ROOT/node_modules/react-native"
PUBLIC="$PODS/Headers/Public"
PRIVATE="$PODS/Headers/Private"

# Skrypt używa `rg -o WZORZEC PLIK`. Bez ripgrepa (świeży Mac) krok z module mapami
# po cichu robił 0 linków i build padał na 'yoga/Yoga.h' / module 'React'.
if ! command -v rg >/dev/null 2>&1; then
  rg() {
    [[ "${1:-}" == "-o" ]] && shift
    grep -oE -- "$1" "${@:2}"
  }
fi

if [[ ! -f "$PBXPROJ" ]]; then
  echo "[fix-ios-pod-headers] skip — Pods not installed"
  exit 0
fi

# Xcode 26 rejects IPHONEOS_DEPLOYMENT_TARGET below 15.0 (resource bundles
# from maps / AsyncStorage / RNSVG / SDWebImage still declare 9–13).
bump_ios_deployment_floor() {
  python3 - "$PBXPROJ" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, errors="replace").read()
changed = 0

def repl(match):
    global changed
    raw = match.group(1).strip()
    try:
        value = float(raw)
    except ValueError:
        return match.group(0)
    if value < 15.0:
        changed += 1
        return "IPHONEOS_DEPLOYMENT_TARGET = 15.0;"
    return match.group(0)

next_text = re.sub(r"IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);", repl, text)
if next_text != text:
    open(path, "w").write(next_text)
print(f"[fix-ios-pod-headers] IPHONEOS_DEPLOYMENT_TARGET raised to 15.0 on {changed} settings")
PY
}
bump_ios_deployment_floor

# Xcode 26 explicit modules cannot rebuild ExpoModulesCore for Swift Expo pods.
disable_explicit_modules() {
  python3 - "$TSF" <<'PY'
import os, sys
tsf = sys.argv[1]
keys = (
    "CLANG_ENABLE_EXPLICIT_MODULES = NO",
    "SWIFT_ENABLE_EXPLICIT_MODULES = NO",
)
updated = 0
if not os.path.isdir(tsf):
    print("[fix-ios-pod-headers] skip explicit modules — no Target Support Files")
    raise SystemExit(0)
for tsf_dir in os.listdir(tsf):
    path_dir = os.path.join(tsf, tsf_dir)
    if not os.path.isdir(path_dir):
        continue
    for name in os.listdir(path_dir):
        if not name.endswith(".xcconfig"):
            continue
        path = os.path.join(path_dir, name)
        text = open(path, errors="replace").read()
        original = text
        if not text.endswith("\n"):
            text += "\n"
        for key in keys:
            needle = key.split(" = ", 1)[0]
            if needle in text:
                continue
            text += key + "\n"
        if text != original:
            open(path, "w").write(text)
            updated += 1
print(f"[fix-ios-pod-headers] explicit modules disabled in {updated} xcconfigs")
PY
}
disable_explicit_modules

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
  python3 - "$TSF" "$public_name" "$pod_name" "$modulemap_file" <<'PY'
import os, sys
tsf, public_name, pod_name, modulemap = sys.argv[1:]
wanted = {public_name.lower(), pod_name.lower()}
for name in os.listdir(tsf):
    if name.lower() not in wanted:
        continue
    if os.path.isfile(os.path.join(tsf, name, modulemap)):
        print(name)
        raise SystemExit(0)
raise SystemExit(1)
PY
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
  python3 - "$pod_root" "$header" <<'PY'
import os, sys
root, header = sys.argv[1:]
base = os.path.basename(header)
needle = header.replace("\\", "/")
matches = []
skip_dirs = {".git", "test", "tests", "example", "examples", "docs", "android", "androidTest"}
for dirpath, dirnames, files in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in skip_dirs]
    if base not in files:
        continue
    matches.append(os.path.join(dirpath, base))
if not matches:
    raise SystemExit(1)

if "/" in needle:
    exact = [m for m in matches if m.replace("\\", "/").endswith("/" + needle)]
    if exact:
        matches = exact

def score(path: str) -> tuple:
    p = path.replace("\\", "/")
    if "/platform/ios/" in p or "/ios/" in p:
        return (0, p)
    if "/platform/android/" in p or "/platform/cxx/" in p or "/android/" in p:
        return (3, p)
    return (1, p)

print(sorted(matches, key=score)[0])
PY
}

link_imported_headers() {
  local headers_dir="$1"
  local pod_root="$2"
  local header_list_file="$3"
  while IFS= read -r header; do
    [[ -z "$header" ]] && continue
    local src
    src="$(find_header_in_pod "$pod_root" "$header")" || continue
    # Path imports belong under Headers/Public/<include>, not nested inside
    # the module folder (that created yoga/yoga and mixed graphics into React).
    if [[ "$header" == */* ]]; then
      relative_link "$PUBLIC/$(dirname "$header")" "$src" "$(basename "$header")"
    else
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

  local umbrella_from_map=""
  umbrella_from_map="$(rg -o 'umbrella header "([^"]+)"' "$TSF/$tsf_dir/$modulemap_file" 2>/dev/null | sed -E 's/umbrella header "([^"]+)"/\1/' | head -1 || true)"

  if [[ -n "$umbrella_from_map" && ! -f "$headers_dir/$umbrella_from_map" ]]; then
    local umbrella_src=""
    if [[ -f "$TSF/$tsf_dir/$umbrella_from_map" ]]; then
      umbrella_src="$TSF/$tsf_dir/$umbrella_from_map"
    elif [[ -n "$pod_root" ]]; then
      umbrella_src="$(find_header_in_pod "$pod_root" "$umbrella_from_map" || true)"
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

# Map every react/renderer/*.h to its #include path under Headers/Public.
# Handles platform/ios, platform/cxx, iosswitch, and direct component trees.
# Prefers iOS sources over cxx/android stubs (same issue as HostPlatformColor).
link_react_renderer_public_headers() {
  python3 - "$RN" "$PUBLIC" <<'PY'
import os, sys

rn, public = sys.argv[1:]
skip = {".git", "test", "tests", "example", "examples", "docs"}
roots = [
    os.path.join(rn, "ReactCommon"),
    os.path.join(rn, "React", "FBReactNativeSpec"),
]
marker = "react/renderer/"
candidates: dict[str, tuple[int, str]] = {}

def score(path: str) -> int:
    p = path.replace("\\", "/")
    if "/platform/ios/" in p or "/iosswitch/" in p:
        return 0
    if "/platform/cxx/" in p:
        return 1
    if "/platform/android/" in p or "/androidswitch/" in p:
        return 3
    return 2

for root in roots:
    if not os.path.isdir(root):
        continue
    for dirpath, dirnames, files in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip and not d.startswith(".")]
        for name in files:
            if not name.endswith(".h"):
                continue
            full = os.path.join(dirpath, name).replace("\\", "/")
            idx = full.rfind(marker)
            if idx < 0:
                continue
            include_rel = full[idx:]
            sc = score(full)
            prev = candidates.get(include_rel)
            if prev is None or sc < prev[0]:
                candidates[include_rel] = (sc, full)

linked = 0
for include_rel, (_sc, full) in sorted(candidates.items()):
    dest = os.path.join(public, include_rel)
    dest_dir = os.path.dirname(dest)
    os.makedirs(dest_dir, exist_ok=True)
    if os.path.isdir(dest) and not os.path.islink(dest):
        continue
    if os.path.lexists(dest) or os.path.islink(dest):
        os.remove(dest)
    os.symlink(os.path.relpath(full, dest_dir), dest)
    linked += 1

# Never leave android/cxx platform trees inside Public — only flat includes.
for bad in ("platform/android", "platform/cxx", "androidswitch"):
    dump = os.path.join(public, "react", "renderer")
    for dirpath, dirnames, _files in os.walk(dump, topdown=True):
        rel = os.path.relpath(dirpath, dump).replace("\\", "/")
        if rel == bad or rel.endswith("/" + bad):
            import shutil
            shutil.rmtree(dirpath)
            dirnames.clear()

# Drop wrongly nested react/renderer trees (switch/iosswitch/react/renderer/...).
nested_marker = f"/{marker}"
for dirpath, dirnames, _files in os.walk(os.path.join(public, "react", "renderer"), topdown=False):
    rel = os.path.relpath(dirpath, public).replace("\\", "/")
    if rel.count("react/renderer/") > 1:
        import shutil
        shutil.rmtree(dirpath)

print(f"[fix-ios-pod-headers] react/renderer public headers — {linked} links (ios > cxx > direct)")
PY
}

# Header-only RN libraries: CocoaPods header_dir copies, skipped on incomplete install.
link_rn_library_headers() {
  python3 - "$RN" "$PUBLIC" <<'PY'
import os, sys

rn, public = sys.argv[1:]

def rel_link(dest_dir, target, name):
    os.makedirs(dest_dir, exist_ok=True)
    path = os.path.join(dest_dir, name)
    if os.path.isdir(path) and not os.path.islink(path):
        return
    if os.path.lexists(path) or os.path.islink(path):
        os.remove(path)
    os.symlink(os.path.relpath(target, dest_dir), path)

specs = [
    ("FBLazyVector", os.path.join(rn, "Libraries", "FBLazyVector", "FBLazyVector")),
    ("RCTRequired", os.path.join(rn, "Libraries", "Required")),
    ("FBReactNativeSpec", os.path.join(rn, "React", "FBReactNativeSpec", "FBReactNativeSpec")),
]
count = 0
for dest_name, src in specs:
    if not os.path.isdir(src):
        continue
    dest = os.path.join(public, dest_name)
    for name in os.listdir(src):
        if not name.endswith(".h"):
            continue
        rel_link(dest, os.path.join(src, name), name)
        count += 1
print(f"[fix-ios-pod-headers] RN library headers — {count} links (FBLazyVector, RCTRequired, FBReactNativeSpec)")
PY
}

# ExpoModulesCore umbrella imports can resolve to android/src/main/cpp on APFS.
# Always publish iOS headers into Headers/Public/ExpoModulesCore.
link_expo_modules_core_headers() {
  local expo_core="$ROOT/node_modules/expo-modules-core"
  local dest="$PUBLIC/ExpoModulesCore"
  [[ -d "$expo_core/ios" ]] || return 0

  python3 - "$expo_core" "$dest" <<'PY'
import os, sys
expo_core, dest = sys.argv[1:]
ios_root = os.path.join(expo_core, "ios")
skip = {".git", "test", "tests", "docs"}
count = 0

def rel_link(target, name):
    os.makedirs(dest, exist_ok=True)
    path = os.path.join(dest, name)
    if os.path.isdir(path) and not os.path.islink(path):
        return
    if os.path.lexists(path) or os.path.islink(path):
        os.remove(path)
    os.symlink(os.path.relpath(target, dest), path)

for dirpath, dirnames, files in os.walk(ios_root):
    dirnames[:] = [d for d in dirnames if d not in skip and not d.startswith(".")]
    for name in files:
        if not name.endswith(".h"):
            continue
        rel_link(os.path.join(dirpath, name), name)
        count += 1

print(f"[fix-ios-pod-headers] ExpoModulesCore iOS headers — {count} links")
PY
}

# Expo/RN codegen output (ios/build/generated/ios) — Private only after incomplete pod install.
link_codegen_public_headers() {
  local generated="$ROOT/ios/build/generated/ios"
  [[ -d "$generated" ]] || {
    echo "[fix-ios-pod-headers] skip codegen headers — run pod install first ($generated)"
    return 0
  }

  python3 - "$generated" "$PUBLIC" <<'PY'
import os, sys

generated, public = sys.argv[1:]
marker = "react/renderer/"
linked = 0

def link_file(full: str) -> None:
    global linked
    norm = full.replace("\\", "/")
    rel = os.path.relpath(full, generated).replace("\\", "/")
    if marker in norm:
        include_rel = norm[norm.rfind(marker):]
        dest = os.path.join(public, include_rel)
    elif "/" in rel:
        dest = os.path.join(public, rel)
    else:
        return
    dest_dir = os.path.dirname(dest)
    os.makedirs(dest_dir, exist_ok=True)
    if os.path.isdir(dest) and not os.path.islink(dest):
        return
    if os.path.lexists(dest) or os.path.islink(dest):
        os.remove(dest)
    os.symlink(os.path.relpath(full, dest_dir), dest)
    linked += 1

for dirpath, dirnames, files in os.walk(generated):
    dirnames[:] = [d for d in dirnames if not d.startswith(".")]
    for name in files:
        if not name.endswith(".h"):
            continue
        link_file(os.path.join(dirpath, name))

print(f"[fix-ios-pod-headers] codegen public headers — {linked} links from {generated}")
PY
}

# CocoaPods header_dir = React flattens React/**/*.h into Headers/Public/React.
# Incomplete installs skip that; compiling then fails on <React/RCTCxxUtils.h>.
flatten_react_core_headers() {
  python3 - "$RN" "$PUBLIC" <<'PY'
import os, sys
rn, public = sys.argv[1:]
src = os.path.join(rn, "React")
dest = os.path.join(public, "React")
if not os.path.isdir(src):
    raise SystemExit(0)
os.makedirs(dest, exist_ok=True)
skip = {".git", "test", "tests", "docs"}
count = 0
for dirpath, dirnames, files in os.walk(src):
    dirnames[:] = [d for d in dirnames if d not in skip and not d.startswith(".")]
    for name in files:
        if not name.endswith(".h"):
            continue
        full = os.path.join(dirpath, name)
        path = os.path.join(dest, name)
        if os.path.lexists(path) or os.path.islink(path):
            if os.path.isdir(path) and not os.path.islink(path):
                continue
            os.remove(path)
        os.symlink(os.path.relpath(full, dest), path)
        count += 1
print(f"[fix-ios-pod-headers] React-Core flattened {count} public headers")
PY
}

inject_search_paths() {
  python3 - "$TSF" "$RN" <<'PY'
import os, re, sys

tsf, rn = sys.argv[1:]
react_common_root = os.path.join(rn, "ReactCommon")
react_common = '"${PODS_ROOT}/../../node_modules/react-native/ReactCommon"'
common_subdirs = []
if os.path.isdir(react_common_root):
    skip = {"cmake-utils", "hermes", "jsc", "yoga"}
    for name in sorted(os.listdir(react_common_root)):
        if name in skip or name.startswith("."):
            continue
        if os.path.isdir(os.path.join(react_common_root, name)):
            common_subdirs.append(
                f'"${{PODS_ROOT}}/../../node_modules/react-native/ReactCommon/{name}"'
            )
jsi = '"${PODS_ROOT}/../../node_modules/react-native/ReactCommon/jsi"'
codegen_ios = '"${PODS_ROOT}/../build/generated/ios"'
hermes_inc = '"${PODS_ROOT}/hermes-engine/destroot/include"'
yoga_src = '"$(PODS_TARGET_SRCROOT)"'
graphics_ios_rel = '"$(PODS_TARGET_SRCROOT)/platform/ios"'
third_party_paths = [
    "$(PODS_ROOT)/boost",
    "$(PODS_ROOT)/glog",
    "$(PODS_ROOT)/DoubleConversion",
    "$(PODS_ROOT)/fast_float/include",
    "$(PODS_ROOT)/fmt/include",
    "$(PODS_ROOT)/SocketRocket",
    "$(PODS_ROOT)/RCT-Folly",
]

host_platforms = []
fabric_component_paths = []
components_root = os.path.join(react_common_root, "react", "renderer", "components")
if os.path.isdir(components_root):
    for name in sorted(os.listdir(components_root)):
        comp = os.path.join(components_root, name)
        if not os.path.isdir(comp):
            continue
        for sub in ("iosswitch", "platform", "platform/ios", "platform/cxx"):
            candidate = os.path.join(comp, sub) if sub != "platform" else comp
            if sub == "platform":
                for plat in ("ios", "cxx"):
                    p = os.path.join(comp, "platform", plat)
                    if os.path.isdir(p):
                        rel = os.path.relpath(p, react_common_root).replace("\\", "/")
                        fabric_component_paths.append(
                            f'"${{PODS_ROOT}}/../../node_modules/react-native/ReactCommon/{rel}"'
                        )
                continue
            if os.path.isdir(candidate):
                rel = os.path.relpath(candidate, react_common_root).replace("\\", "/")
                fabric_component_paths.append(
                    f'"${{PODS_ROOT}}/../../node_modules/react-native/ReactCommon/{rel}"'
                )
    fabric_component_paths = sorted(set(fabric_component_paths))
if os.path.isdir(react_common_root):
    for dirpath, dirnames, _files in os.walk(react_common_root):
        if os.path.basename(dirpath) != "platform":
            continue
        chosen = "ios" if "ios" in dirnames else ("cxx" if "cxx" in dirnames else None)
        if not chosen:
            continue
        rel = os.path.relpath(os.path.join(dirpath, chosen), react_common_root).replace("\\", "/")
        host_platforms.append(
            f'"${{PODS_ROOT}}/../../node_modules/react-native/ReactCommon/{rel}"'
        )
    host_platforms.sort()

rn_name = re.compile(
    r"^(React-|RCT-|Yoga$|yoga$|RN[A-Z]|hermes-engine|fmt$|glog$|RCT-Folly|Nitro)",
    re.I,
)

def srcroot_line(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("PODS_TARGET_SRCROOT"):
            return line
    return ""

def is_expo_pod(tsf_dir: str) -> bool:
    return tsf_dir.startswith("Expo") or tsf_dir.startswith("EX")

def is_rn_pod(tsf_dir: str, text: str) -> bool:
    if is_expo_pod(tsf_dir):
        return False
    if rn_name.search(tsf_dir):
        return True
    lowered = tsf_dir.lower()
    if lowered.startswith("react-native") or lowered.startswith("react_codegen") or lowered == "reactcodegen":
        return True
    src = srcroot_line(text)
    return "react-native" in src or "ReactCommon" in src

def strip_polluted_token(token: str) -> bool:
    markers = [
        "node_modules/react-native/ReactCommon",
        "node_modules/react-native/Libraries",
        "node_modules/react-native/React/",
        "$(PODS_ROOT)/boost",
        "$(PODS_ROOT)/glog",
        "$(PODS_ROOT)/DoubleConversion",
        "$(PODS_ROOT)/fast_float/include",
        "$(PODS_ROOT)/fmt/include",
        "$(PODS_ROOT)/SocketRocket",
        "$(PODS_ROOT)/RCT-Folly",
        "hermes-engine/destroot/include",
        "/build/generated/ios",
    ]
    return any(m in token for m in markers)

def clean_expo_header_line(line: str) -> str:
    if not line.startswith("HEADER_SEARCH_PATHS"):
        return line
    if "switch/iosswitch" not in line:
        return line
    parts = line.split()
    if len(parts) < 3:
        return line
    kept = parts[:3]
    for token in parts[3:]:
        if not strip_polluted_token(token):
            kept.append(token)
    return " ".join(kept)

def is_graphics_pod(tsf_dir: str, text: str) -> bool:
    if tsf_dir == "React-graphics":
        return True
    return "react/renderer/graphics" in srcroot_line(text)

def is_yoga_pod(tsf_dir: str, text: str) -> bool:
    if tsf_dir.lower() == "yoga":
        return True
    return "ReactCommon/yoga" in srcroot_line(text)

def insert_paths(line: str, paths: list[str]) -> str:
    to_add = [p for p in paths if p not in line]
    if not to_add:
        return line
    m = re.match(r"^(HEADER_SEARCH_PATHS\s*=\s*)(\$\(inherited\))?(.*)$", line)
    if not m:
        return line
    prefix, inherited, rest = m.group(1), m.group(2) or "", m.group(3)
    extra = " " + " ".join(to_add)
    if inherited:
        return f"{prefix}{inherited}{extra}{rest}"
    return f"{prefix}{' '.join(to_add)}{rest}"

def drop_paths(line: str, paths: list[str]) -> str:
    for p in paths:
        line = line.replace(" " + p, "")
        line = line.replace(p + " ", "")
    return line

updated = 0
expo_cleaned = 0
for tsf_dir in sorted(os.listdir(tsf)):
    tsf_path = os.path.join(tsf, tsf_dir)
    if not os.path.isdir(tsf_path):
        continue
    for name in os.listdir(tsf_path):
        if not (name.endswith(".debug.xcconfig") or name.endswith(".release.xcconfig")):
            continue
        path = os.path.join(tsf_path, name)
        text = open(path, errors="replace").read()
        if "HEADER_SEARCH_PATHS" not in text:
            continue

        if is_expo_pod(tsf_dir):
            new_lines = []
            changed = False
            for line in text.splitlines():
                nxt = clean_expo_header_line(line)
                if nxt != line:
                    changed = True
                new_lines.append(nxt)
            if changed:
                open(path, "w").write("\n".join(new_lines) + ("\n" if text.endswith("\n") else ""))
                expo_cleaned += 1
            continue

        if not is_rn_pod(tsf_dir, text):
            continue

        add = [*host_platforms, *fabric_component_paths, *third_party_paths, codegen_ios, hermes_inc, react_common, *common_subdirs, jsi,
               '"${PODS_ROOT}/../../node_modules/react-native/Libraries/FBLazyVector"',
               '"${PODS_ROOT}/../../node_modules/react-native/Libraries/Required"',
               '"${PODS_ROOT}/../../node_modules/react-native/React/FBReactNativeSpec"']
        drop = []
        yoga_common = '"${PODS_ROOT}/../../node_modules/react-native/ReactCommon/yoga"'
        if is_yoga_pod(tsf_dir, text):
            add.append(yoga_src)
            add.append(yoga_common)
        else:
            drop.append(yoga_common)
        if is_graphics_pod(tsf_dir, text):
            add.append(graphics_ios_rel)
        else:
            drop.append(graphics_ios_rel)

        new_lines = []
        changed = False
        for line in text.splitlines():
            if line.startswith("HEADER_SEARCH_PATHS"):
                nxt = drop_paths(line, drop) if drop else line
                nxt = insert_paths(nxt, add)
                if nxt != line:
                    changed = True
                new_lines.append(nxt)
            else:
                new_lines.append(line)
        if changed:
            open(path, "w").write("\n".join(new_lines) + ("\n" if text.endswith("\n") else ""))
            updated += 1

print(f"[fix-ios-pod-headers] HEADER_SEARCH_PATHS updated in {updated} xcconfigs")
print(f"[fix-ios-pod-headers] Expo xcconfigs cleaned: {expo_cleaned}")
PY
}

prune_header_dumps() {
  python3 - "$PUBLIC" "$PRIVATE" <<'PY'
import os, shutil, sys

public, private = sys.argv[1:]

DUMP_TOP = {
    "android", "apple", "boost", "callinvoker", "cpp", "cxx", "cxxreact",
    "dav1d", "destroot", "devtoolsruntimesettings", "double-conversion",
    "fusebox", "generate", "hermes", "include", "ios", "jsc", "jserrorhandler",
    "jsiexecutor", "jsinspector-modern", "jsireact", "jsitooling", "logger",
    "macos", "nativeviewconfig", "nitrogen", "oscompat", "platform",
    "reactperflogger", "reanimated", "runtimeexecutor", "sharpyuv", "src",
    "windows", "ReactAndroid", "ReactApple",
    "Fabric", "Libraries", "Modules", "Views", "Base", "BaseText", "Common",
    "CoreModules", "CxxBridge", "CxxLogUtils", "CxxModule", "CxxUtils",
    "DevSupport", "Drivers", "Exported", "I18n", "Inspector", "Legacy",
    "NitroModulesSpec", "Nodes", "Profiler", "RawText", "Requesters", "Runtime",
    "TaskConsumers", "Text", "TextInput", "VirtualText", "WebImage",
}

# Nested trees copied from RN SRCROOT into a module folder.
NESTED_DUMP = {
    "android", "apple", "cxx", "macos", "windows", "platform", "ReactAndroid",
    "ReactApple", "ReactCommon", "destroot", "generate", "src", "include",
    "callinvoker", "cxxreact", "devtoolsruntimesettings", "hermes", "jsc",
    "jserrorhandler", "jsiexecutor", "jsinspector-modern", "jsitooling",
    "logger", "oscompat", "react", "reactperflogger", "runtimeexecutor",
    "yoga", "jsi", "jsireact",
}

def rm(path: str) -> bool:
    if not os.path.lexists(path):
        return False
    if os.path.islink(path) or os.path.isfile(path):
        os.remove(path)
    else:
        shutil.rmtree(path)
    return True

removed = 0

# Loose files at Public root came from basename flattening of SRCROOTs.
if os.path.isdir(public):
    for name in os.listdir(public):
        path = os.path.join(public, name)
        if os.path.isfile(path) or os.path.islink(path):
            if rm(path):
                removed += 1
        elif os.path.isdir(path) and name in DUMP_TOP:
            entries = os.listdir(path)
            if any(e.endswith(".modulemap") for e in entries):
                continue
            if rm(path):
                removed += 1

    for name in os.listdir(public):
        path = os.path.join(public, name)
        if not os.path.isdir(path):
            continue
        entries = os.listdir(path)
        if not any(e.endswith(".modulemap") for e in entries):
            # Keep CocoaPods header_dir folders that only have headers if they
            # are not obvious SRCROOT dumps; module-less dump dirs go away.
            if name in DUMP_TOP or name.endswith("Spec"):
                if rm(path):
                    removed += 1
            continue

        for child in list(os.listdir(path)):
            child_path = os.path.join(path, child)
            try:
                if os.path.isdir(child_path) and os.path.samefile(child_path, path):
                    continue
            except OSError:
                pass
            if child in NESTED_DUMP:
                if rm(child_path):
                    removed += 1
                    continue
            # yoga.yoga / jsi.jsi doubled trees — not the module dir itself
            if child.lower() == name.lower() and os.path.isdir(child_path):
                if rm(child_path):
                    removed += 1

        # React-Core (Public/React) absorbed Fabric via case-insensitive APFS.
        # Keep only graphics/ — that is React-graphics header_dir.
        renderer = os.path.join(path, "renderer")
        if os.path.isdir(renderer):
            for sub in list(os.listdir(renderer)):
                if sub != "graphics":
                    if rm(os.path.join(renderer, sub)):
                        removed += 1

        # Drop android/cxx platform copies anywhere under this module.
        for dirpath, dirnames, files in os.walk(path, topdown=True):
            rel = os.path.relpath(dirpath, path).replace("\\", "/")
            if "/platform/android" in f"/{rel}" or "/platform/cxx" in f"/{rel}" or rel in {"platform/android", "platform/cxx"}:
                dirnames[:] = []
                if rm(dirpath):
                    removed += 1

# Private: this script used to mirror entire SRCROOTs (android+cxx+ios).
# Keep the folder, drop the wrong-platform Color stubs.
if os.path.isdir(private):
    for dirpath, dirnames, files in os.walk(private, topdown=True):
        rel = dirpath.replace("\\", "/")
        if "/platform/android" in rel or "/platform/cxx" in rel:
            dirnames[:] = []
            if rm(dirpath):
                removed += 1
            continue
        for name in files:
            if name in {"HostPlatformColor.h", "Float.h", "PlatformColorParser.h"}:
                full = os.path.join(dirpath, name)
                real = os.path.realpath(full)
                if "/platform/android/" in real.replace("\\", "/") or "/platform/cxx/" in real.replace("\\", "/"):
                    if rm(full):
                        removed += 1

print(f"[fix-ios-pod-headers] pruned {removed} dumped header trees/files")
PY
}

strip_yoga_implicit_submodules() {
  local yoga_map
  for yoga_map in "$TSF/yoga/Yoga.modulemap" "$TSF/Yoga/Yoga.modulemap"; do
    [[ -f "$yoga_map" ]] || continue
    if grep -q 'module \* { export \* }' "$yoga_map"; then
      python3 - "$yoga_map" <<'PY'
import sys
path = sys.argv[1]
text = open(path).read()
text = text.replace("\n  module * { export * }\n", "\n")
open(path, "w").write(text)
print("[fix-ios-pod-headers] Yoga.modulemap: removed implicit submodules")
PY
    fi
  done
}

map_count=0
link_expo_modules_core_headers
if [[ "${FIX_IOS_HEADERS_INJECT_ONLY:-}" != 1 ]]; then
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    link_one_modulemap "$rel"
    map_count=$((map_count + 1))
  done < <(
    rg -o 'MODULEMAP_FILE = "?Headers/((Public|Private)/[^";]+)' "$PBXPROJ" \
      | sed -E 's/MODULEMAP_FILE = "?Headers\///' \
      | sort -u
  )

  prune_header_dumps
  flatten_react_core_headers
fi
link_react_renderer_public_headers
link_rn_library_headers
link_expo_modules_core_headers
link_codegen_public_headers
inject_search_paths
strip_yoga_implicit_submodules

echo "[fix-ios-pod-headers] OK — $map_count module maps, no SRCROOT dump, iOS Color headers"
