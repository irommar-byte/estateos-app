#!/usr/bin/env python3
"""Generates ParagonOS.xcodeproj from Swift sources + bundled resources."""
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "ParagonOS"
TEST_SRC = ROOT / "ParagonOSTests"
OUT = ROOT / "ParagonOS.xcodeproj" / "project.pbxproj"

SWIFT = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*.swift"))
TEST_SWIFT = sorted(p.relative_to(TEST_SRC).as_posix() for p in TEST_SRC.rglob("*.swift")) if TEST_SRC.exists() else []
WIDGET_SRC = ROOT / "ParagonOSWidgets"
WIDGET_SWIFT = (
    sorted(p.relative_to(WIDGET_SRC).as_posix() for p in WIDGET_SRC.rglob("*.swift"))
    if WIDGET_SRC.exists()
    else []
)
WIDGET_RES = (
    sorted(p.name for p in WIDGET_SRC.iterdir() if p.suffix in {".xcstrings"})
    if WIDGET_SRC.exists()
    else []
)
WIDGET_SHARED = ["Core/HomeSnapshot.swift"]

RES = []
res_dir = SRC / "Resources"
if res_dir.exists():
    for p in sorted(res_dir.iterdir()):
        if p.suffix in {".xcassets", ".json", ".xcprivacy", ".cer", ".key", ".xcstrings", ".storekit"}:
            RES.append(f"Resources/{p.name}")
        elif p.is_dir():
            for child in sorted(p.iterdir()):
                if child.suffix in {".wav", ".caf", ".mp3", ".png", ".pdf"}:
                    RES.append(f"Resources/{p.name}/{child.name}")


def gid():
    return uuid.uuid4().hex[:24].upper()


def read_build_number() -> str:
    pbx = ROOT / "ParagonOS.xcodeproj" / "project.pbxproj"
    if pbx.exists():
        match = re.search(r"CURRENT_PROJECT_VERSION = (\d+);", pbx.read_text())
        if match:
            return match.group(1)
    return "2"


BUILD_NUMBER = read_build_number()

PROJ = gid()
TARGET = gid()
TEST_TARGET = gid()
SRC_PHASE = gid()
TEST_SRC_PHASE = gid()
RES_PHASE = gid()
FWK_PHASE = gid()
TEST_FWK_PHASE = gid()
APP_REF = gid()
TEST_REF = gid()
MAIN_GRP = gid()
APP_GRP = gid()
TEST_GRP = gid()
PROD_GRP = gid()
CL_PROJ = gid()
CL_TGT = gid()
CL_TEST = gid()
DBG_PROJ = gid()
REL_PROJ = gid()
DBG_TGT = gid()
REL_TGT = gid()
DBG_TEST = gid()
REL_TEST = gid()
CONTAINER_PROXY = gid()
XC_TARGET_DEP = gid()
X509_PKG = gid()
X509_PROD = gid()
X509_BF = gid()
WIDGET_TARGET = gid()
WIDGET_SRC_PHASE = gid()
WIDGET_FWK_PHASE = gid()
WIDGET_RES_PHASE = gid()
WIDGET_REF = gid()
WIDGET_GRP = gid()
WIDGET_INFO_REF = gid()
WIDGET_ENT_REF = gid()
WIDGET_EMBED_PHASE = gid()
WIDGET_EMBED_BF = gid()
WIDGET_CONTAINER_PROXY = gid()
WIDGET_TARGET_DEP = gid()
CL_WIDGET = gid()
DBG_WIDGET = gid()
REL_WIDGET = gid()

swift_ref = {f: gid() for f in SWIFT}
swift_bf = {f: gid() for f in SWIFT}
test_ref = {f: gid() for f in TEST_SWIFT}
test_bf = {f: gid() for f in TEST_SWIFT}
res_ref = {f: gid() for f in RES}
res_bf = {f: gid() for f in RES}
widget_ref = {f: gid() for f in WIDGET_SWIFT}
widget_bf = {f: gid() for f in WIDGET_SWIFT}
widget_res_ref = {f: gid() for f in WIDGET_RES}
widget_res_bf = {f: gid() for f in WIDGET_RES}
widget_shared_bf = {f: gid() for f in WIDGET_SHARED}

folders = {"": APP_GRP}
for f in SWIFT + RES:
    parts = Path(f).parts
    for i in range(len(parts) - 1):
        key = "/".join(parts[: i + 1])
        folders.setdefault(key, gid())

lines = []
o = lines.append

o("// !$*UTF8*$!")
o("{")
o("\tarchiveVersion = 1;")
o("\tclasses = {};")
o("\tobjectVersion = 56;")
o("\tobjects = {")

o("\n/* Begin PBXBuildFile section */")
for f in SWIFT:
    o(f"\t\t{swift_bf[f]} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {swift_ref[f]} /* {f} */; }};")
for f in TEST_SWIFT:
    o(f"\t\t{test_bf[f]} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {test_ref[f]} /* {f} */; }};")
for f in RES:
    o(f"\t\t{res_bf[f]} /* {f} in Resources */ = {{isa = PBXBuildFile; fileRef = {res_ref[f]} /* {f} */; }};")
for f in WIDGET_SWIFT:
    o(f"\t\t{widget_bf[f]} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {widget_ref[f]} /* {f} */; }};")
for f in WIDGET_RES:
    o(f"\t\t{widget_res_bf[f]} /* {f} in Resources */ = {{isa = PBXBuildFile; fileRef = {widget_res_ref[f]} /* {f} */; }};")
for f in WIDGET_SHARED:
    o(f"\t\t{widget_shared_bf[f]} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {swift_ref[f]} /* {f} */; }};")
o(f"\t\t{WIDGET_EMBED_BF} /* ParagonOSWidgets.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {WIDGET_REF} /* ParagonOSWidgets.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, CodeSignOnCopy, ); }}; }};")
o(f"\t\t{X509_BF} /* X509 in Frameworks */ = {{isa = PBXBuildFile; productRef = {X509_PROD} /* X509 */; }};")
o("/* End PBXBuildFile section */")

o("\n/* Begin PBXContainerItemProxy section */")
o(f"\t\t{CONTAINER_PROXY} = {{")
o("\t\t\tisa = PBXContainerItemProxy;")
o(f"\t\t\tcontainerPortal = {PROJ} /* Project object */;")
o("\t\t\tproxyType = 1;")
o(f"\t\t\tremoteGlobalIDString = {TARGET};")
o("\t\t\tremoteInfo = ParagonOS;")
o("\t\t};")
o(f"\t\t{WIDGET_CONTAINER_PROXY} = {{")
o("\t\t\tisa = PBXContainerItemProxy;")
o(f"\t\t\tcontainerPortal = {PROJ} /* Project object */;")
o("\t\t\tproxyType = 1;")
o(f"\t\t\tremoteGlobalIDString = {WIDGET_TARGET};")
o("\t\t\tremoteInfo = ParagonOSWidgets;")
o("\t\t};")
o("/* End PBXContainerItemProxy section */")

o("\n/* Begin PBXFileReference section */")
o(f"\t\t{APP_REF} /* ParagonOS.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ParagonOS.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
o(f"\t\t{TEST_REF} /* ParagonOSTests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = ParagonOSTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};")
o(f"\t\t{WIDGET_REF} /* ParagonOSWidgets.appex */ = {{isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; includeInIndex = 0; path = ParagonOSWidgets.appex; sourceTree = BUILT_PRODUCTS_DIR; }};")
o(f"\t\t{WIDGET_INFO_REF} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\"; }};")
o(f"\t\t{WIDGET_ENT_REF} /* ParagonOSWidgets.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = ParagonOSWidgets.entitlements; sourceTree = \"<group>\"; }};")
for f in SWIFT:
    o(f"\t\t{swift_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {Path(f).name}; sourceTree = \"<group>\"; }};")
for f in TEST_SWIFT:
    o(f"\t\t{test_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {Path(f).name}; sourceTree = \"<group>\"; }};")
for f in WIDGET_SWIFT:
    o(f"\t\t{widget_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {Path(f).name}; sourceTree = \"<group>\"; }};")
for f in WIDGET_RES:
    o(f"\t\t{widget_res_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = text.json.xcstrings; path = {f}; sourceTree = \"<group>\"; }};")
for f in RES:
    if f.endswith(".xcassets"):
        t = "folder.assetcatalog"
    elif f.endswith(".json"):
        t = "text.json"
    elif f.endswith(".xcprivacy"):
        t = "text.xml"
    elif f.endswith(".wav"):
        t = "audio.wav"
    elif f.endswith(".mp3"):
        t = "audio.mp3"
    elif f.endswith(".caf"):
        t = "audio.caf"
    elif f.endswith(".cer"):
        t = "data"
    elif f.endswith(".key"):
        t = "text"
    elif f.endswith(".png"):
        t = "image.png"
    elif f.endswith(".pdf"):
        t = "image.pdf"
    elif f.endswith(".xcstrings"):
        t = "text.json.xcstrings"
    elif f.endswith(".storekit"):
        t = "text"
    else:
        t = "text"
    o(f"\t\t{res_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = {t}; path = {Path(f).name}; sourceTree = \"<group>\"; }};")
o("/* End PBXFileReference section */")

o("\n/* Begin PBXFrameworksBuildPhase section */")
o(f"\t\t{FWK_PHASE} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({X509_BF} /* X509 in Frameworks */); runOnlyForDeploymentPostprocessing = 0; }};")
o(f"\t\t{TEST_FWK_PHASE} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};")
o(f"\t\t{WIDGET_FWK_PHASE} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};")
o("/* End PBXFrameworksBuildPhase section */")

o("\n/* Begin PBXGroup section */")
o(f"\t\t{PROD_GRP} = {{isa = PBXGroup; children = ({APP_REF} /* ParagonOS.app */, {TEST_REF} /* ParagonOSTests.xctest */, {WIDGET_REF} /* ParagonOSWidgets.appex */); name = Products; sourceTree = \"<group>\"; }};")
test_children = ", ".join(f"{test_ref[f]} /* {Path(f).name} */" for f in TEST_SWIFT)
o(f"\t\t{TEST_GRP} = {{isa = PBXGroup; children = ({test_children}); path = ParagonOSTests; sourceTree = \"<group>\"; }};")
widget_children = ", ".join(
    [f"{widget_ref[f]} /* {Path(f).name} */" for f in WIDGET_SWIFT]
    + [f"{widget_res_ref[f]} /* {f} */" for f in WIDGET_RES]
    + [f"{WIDGET_INFO_REF} /* Info.plist */", f"{WIDGET_ENT_REF} /* ParagonOSWidgets.entitlements */"]
)
o(f"\t\t{WIDGET_GRP} = {{isa = PBXGroup; children = ({widget_children}); path = ParagonOSWidgets; sourceTree = \"<group>\"; }};")
o(f"\t\t{MAIN_GRP} = {{isa = PBXGroup; children = ({APP_GRP} /* ParagonOS */, {TEST_GRP} /* ParagonOSTests */, {WIDGET_GRP} /* ParagonOSWidgets */, {PROD_GRP} /* Products */); sourceTree = \"<group>\"; }};")

for key in sorted(folders.keys(), key=lambda k: (k.count("/"), k)):
    if key == "":
        continue
    name = Path(key).name
    children = []
    for f in SWIFT + RES:
        if str(Path(f).parent) == key:
            ref = swift_ref.get(f) or res_ref.get(f)
            children.append(f"{ref} /* {Path(f).name} */")
    for sub in sorted(folders):
        if sub.count("/") == key.count("/") + 1 and sub.startswith(key + "/"):
            children.append(f"{folders[sub]} /* {Path(sub).name} */")
    o(f"\t\t{folders[key]} = {{isa = PBXGroup; children = ({', '.join(children)}); path = {name}; sourceTree = \"<group>\"; }};")

top_children = []
for f in SWIFT + RES:
    if "/" not in f:
        ref = swift_ref.get(f) or res_ref.get(f)
        top_children.append(f"{ref} /* {Path(f).name} */")
for sub in sorted(folders):
    if sub and "/" not in sub:
        top_children.append(f"{folders[sub]} /* {sub} */")
o(f"\t\t{APP_GRP} = {{isa = PBXGroup; children = ({', '.join(top_children)}); path = ParagonOS; sourceTree = \"<group>\"; }};")
o("/* End PBXGroup section */")

o("\n/* Begin PBXCopyFilesBuildPhase section */")
o(f"\t\t{WIDGET_EMBED_PHASE} = {{")
o("\t\t\tisa = PBXCopyFilesBuildPhase;")
o("\t\t\tbuildActionMask = 2147483647;")
o(f"\t\t\tdstPath = \"\";")
o("\t\t\tdstSubfolderSpec = 13;")
o(f"\t\t\tfiles = ({WIDGET_EMBED_BF} /* ParagonOSWidgets.appex in Embed Foundation Extensions */);")
o('\t\t\tname = "Embed Foundation Extensions";')
o("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
o("\t\t};")
o("/* End PBXCopyFilesBuildPhase section */")

o("\n/* Begin PBXNativeTarget section */")
o(f"\t\t{TARGET} = {{")
o(f"\t\t\tisa = PBXNativeTarget; buildConfigurationList = {CL_TGT};")
o(f"\t\t\tbuildPhases = ({SRC_PHASE} /* Sources */, {FWK_PHASE} /* Frameworks */, {RES_PHASE} /* Resources */, {WIDGET_EMBED_PHASE} /* Embed Foundation Extensions */);")
o(f"\t\t\tbuildRules = (); dependencies = ({WIDGET_TARGET_DEP} /* PBXTargetDependency */); name = ParagonOS;")
o(f"\t\t\tpackageProductDependencies = ({X509_PROD} /* X509 */);")
o(f"\t\t\tproductReference = {APP_REF}; productType = \"com.apple.product-type.application\";")
o("\t\t};")
o(f"\t\t{TEST_TARGET} = {{")
o(f"\t\t\tisa = PBXNativeTarget; buildConfigurationList = {CL_TEST};")
o(f"\t\t\tbuildPhases = ({TEST_SRC_PHASE} /* Sources */, {TEST_FWK_PHASE} /* Frameworks */);")
o(f"\t\t\tbuildRules = (); dependencies = ({XC_TARGET_DEP} /* PBXTargetDependency */); name = ParagonOSTests;")
o("\t\t\tpackageProductDependencies = ();")
o(f"\t\t\tproductReference = {TEST_REF}; productType = \"com.apple.product-type.bundle.unit-test\";")
o("\t\t};")
o(f"\t\t{WIDGET_TARGET} = {{")
o(f"\t\t\tisa = PBXNativeTarget; buildConfigurationList = {CL_WIDGET};")
o(f"\t\t\tbuildPhases = ({WIDGET_SRC_PHASE} /* Sources */, {WIDGET_FWK_PHASE} /* Frameworks */, {WIDGET_RES_PHASE} /* Resources */);")
o("\t\t\tbuildRules = (); dependencies = (); name = ParagonOSWidgets;")
o("\t\t\tpackageProductDependencies = ();")
o(f"\t\t\tproductReference = {WIDGET_REF}; productType = \"com.apple.product-type.app-extension\";")
o("\t\t};")
o("/* End PBXNativeTarget section */")

o("\n/* Begin PBXProject section */")
o(f"\t\t{PROJ} = {{")
o(f"\t\t\tisa = PBXProject; buildConfigurationList = {CL_PROJ}; compatibilityVersion = \"Xcode 14.0\";")
o("\t\t\tdevelopmentRegion = pl; hasScannedForEncodings = 0;")
o("\t\t\tknownRegions = (en, Base, pl, uk);")
o(f"\t\t\tmainGroup = {MAIN_GRP}; productRefGroup = {PROD_GRP};")
o(f"\t\t\tpackageReferences = ({X509_PKG} /* XCRemoteSwiftPackageReference \"swift-certificates\" */);")
o("\t\t\tprojectDirPath = \"\"; projectRoot = \"\";")
o(f"\t\t\ttargets = ({TARGET} /* ParagonOS */, {TEST_TARGET} /* ParagonOSTests */, {WIDGET_TARGET} /* ParagonOSWidgets */);")
o("\t\t};")
o("/* End PBXProject section */")

o("\n/* Begin PBXResourcesBuildPhase section */")
res_files = ", ".join(f"{res_bf[f]} /* {f} in Resources */" for f in RES)
o(f"\t\t{RES_PHASE} = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({res_files}); runOnlyForDeploymentPostprocessing = 0; }};")
widget_res_files = ", ".join(f"{widget_res_bf[f]} /* {f} in Resources */" for f in WIDGET_RES)
o(f"\t\t{WIDGET_RES_PHASE} = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({widget_res_files}); runOnlyForDeploymentPostprocessing = 0; }};")
o("/* End PBXResourcesBuildPhase section */")

o("\n/* Begin PBXSourcesBuildPhase section */")
src_files = ", ".join(f"{swift_bf[f]} /* {f} in Sources */" for f in SWIFT)
o(f"\t\t{SRC_PHASE} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({src_files}); runOnlyForDeploymentPostprocessing = 0; }};")
test_src_files = ", ".join(f"{test_bf[f]} /* {f} in Sources */" for f in TEST_SWIFT)
o(f"\t\t{TEST_SRC_PHASE} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({test_src_files}); runOnlyForDeploymentPostprocessing = 0; }};")
widget_src_files = ", ".join(
    [f"{widget_bf[f]} /* {f} in Sources */" for f in WIDGET_SWIFT]
    + [f"{widget_shared_bf[f]} /* {f} in Sources */" for f in WIDGET_SHARED]
)
o(f"\t\t{WIDGET_SRC_PHASE} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({widget_src_files}); runOnlyForDeploymentPostprocessing = 0; }};")
o("/* End PBXSourcesBuildPhase section */")

o("\n/* Begin PBXTargetDependency section */")
o(f"\t\t{XC_TARGET_DEP} = {{")
o("\t\t\tisa = PBXTargetDependency;")
o(f"\t\t\ttarget = {TARGET} /* ParagonOS */;")
o(f"\t\t\ttargetProxy = {CONTAINER_PROXY} /* PBXContainerItemProxy */;")
o("\t\t};")
o(f"\t\t{WIDGET_TARGET_DEP} = {{")
o("\t\t\tisa = PBXTargetDependency;")
o(f"\t\t\ttarget = {WIDGET_TARGET} /* ParagonOSWidgets */;")
o(f"\t\t\ttargetProxy = {WIDGET_CONTAINER_PROXY} /* PBXContainerItemProxy */;")
o("\t\t};")
o("/* End PBXTargetDependency section */")

def emit_config(gid, name, settings: dict):
    o(f"\t\t{gid} = {{")
    o("\t\t\tisa = XCBuildConfiguration;")
    o(f"\t\t\tname = {name};")
    o("\t\t\tbuildSettings = {")
    o(f"\t\t\t\tCURRENT_PROJECT_VERSION = {BUILD_NUMBER};")
    for key, value in settings.items():
        o(f"\t\t\t\t{key} = {value};")
    o("\t\t\t};")
    o("\t\t};")


o("\n/* Begin XCBuildConfiguration section */")
emit_config(
    DBG_PROJ,
    "Debug",
    {
        "ALWAYS_SEARCH_USER_PATHS": "NO",
        "CLANG_ENABLE_MODULES": "YES",
        "COPY_PHASE_STRIP": "NO",
        "DEBUG_INFORMATION_FORMAT": "dwarf",
        "ENABLE_TESTABILITY": "YES",
        "GCC_DYNAMIC_NO_PIC": "NO",
        "GCC_OPTIMIZATION_LEVEL": "0",
        "IPHONEOS_DEPLOYMENT_TARGET": "18.0",
        "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE",
        "ONLY_ACTIVE_ARCH": "YES",
        "SDKROOT": "iphoneos",
        "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG",
        "SWIFT_OPTIMIZATION_LEVEL": '"-Onone"',
        "SWIFT_VERSION": "5.0",
        "VERSIONING_SYSTEM": '"apple-generic"',
    },
)
emit_config(
    REL_PROJ,
    "Release",
    {
        "ALWAYS_SEARCH_USER_PATHS": "NO",
        "CLANG_ENABLE_MODULES": "YES",
        "COPY_PHASE_STRIP": "NO",
        "DEBUG_INFORMATION_FORMAT": '"dwarf-with-dsym"',
        "IPHONEOS_DEPLOYMENT_TARGET": "18.0",
        "SDKROOT": "iphoneos",
        "SWIFT_COMPILATION_MODE": "wholemodule",
        "SWIFT_VERSION": "5.0",
        "VALIDATE_PRODUCT": "YES",
        "VERSIONING_SYSTEM": '"apple-generic"',
    },
)

tgt_settings = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_ENTITLEMENTS": "ParagonOS/Resources/ParagonOS.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "VERSIONING_SYSTEM": '"apple-generic"',
    "DEVELOPMENT_TEAM": "NW3YW69KL9",
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": "ParagonOS/Resources/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": '"ParagonOS™"',
    "INFOPLIST_KEY_LSApplicationCategoryType": '"public.app-category.finance"',
    "IPHONEOS_DEPLOYMENT_TARGET": "18.0",
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks")',
    "MARKETING_VERSION": "1.0.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "pl.paragonos.app",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": '"1,2"',
}
tgt_settings_release = dict(tgt_settings)
tgt_settings_release["CODE_SIGN_ENTITLEMENTS"] = '"ParagonOS/Resources/ParagonOS-Release.entitlements"'
test_settings = {
    "BUNDLE_LOADER": '"$(TEST_HOST)"',
    "CODE_SIGN_STYLE": "Automatic",
    "DEVELOPMENT_TEAM": "NW3YW69KL9",
    "GENERATE_INFOPLIST_FILE": "YES",
    "IPHONEOS_DEPLOYMENT_TARGET": "18.0",
    "MARKETING_VERSION": "1.0.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "pl.paragonos.app.tests",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": '"1,2"',
    "TEST_HOST": '"$(BUILT_PRODUCTS_DIR)/ParagonOS.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/ParagonOS"',
}
widget_settings_dict = {
    "APPLICATION_EXTENSION_API_ONLY": "YES",
    "CODE_SIGN_ENTITLEMENTS": "ParagonOSWidgets/ParagonOSWidgets.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "VERSIONING_SYSTEM": '"apple-generic"',
    "DEVELOPMENT_TEAM": "NW3YW69KL9",
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": "ParagonOSWidgets/Info.plist",
    "IPHONEOS_DEPLOYMENT_TARGET": "18.0",
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks")',
    "MARKETING_VERSION": "1.0.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "pl.paragonos.app.widgets",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SKIP_INSTALL": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": '"1,2"',
}
emit_config(DBG_TGT, "Debug", tgt_settings)
emit_config(REL_TGT, "Release", tgt_settings_release)
emit_config(DBG_TEST, "Debug", test_settings)
emit_config(REL_TEST, "Release", test_settings)
emit_config(DBG_WIDGET, "Debug", widget_settings_dict)
emit_config(REL_WIDGET, "Release", widget_settings_dict)
o("/* End XCBuildConfiguration section */")

o("\n/* Begin XCConfigurationList section */")
o(f"\t\t{CL_PROJ} = {{isa = XCConfigurationList; buildConfigurations = ({DBG_PROJ} /* Debug */, {REL_PROJ} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_TGT} = {{isa = XCConfigurationList; buildConfigurations = ({DBG_TGT} /* Debug */, {REL_TGT} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_TEST} = {{isa = XCConfigurationList; buildConfigurations = ({DBG_TEST} /* Debug */, {REL_TEST} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_WIDGET} = {{isa = XCConfigurationList; buildConfigurations = ({DBG_WIDGET} /* Debug */, {REL_WIDGET} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o("/* End XCConfigurationList section */")

o("\n/* Begin XCRemoteSwiftPackageReference section */")
o(f"\t\t{X509_PKG} /* XCRemoteSwiftPackageReference \"swift-certificates\" */ = {{")
o("\t\t\tisa = XCRemoteSwiftPackageReference;")
o('\t\t\trepositoryURL = "https://github.com/apple/swift-certificates.git";')
o("\t\t\trequirement = {")
o("\t\t\t\tkind = upToNextMajorVersion;")
o("\t\t\t\tminimumVersion = 1.17.1;")
o("\t\t\t};")
o("\t\t};")
o("/* End XCRemoteSwiftPackageReference section */")

o("\n/* Begin XCSwiftPackageProductDependency section */")
o(f"\t\t{X509_PROD} /* X509 */ = {{")
o("\t\t\tisa = XCSwiftPackageProductDependency;")
o(f"\t\t\tpackage = {X509_PKG} /* XCRemoteSwiftPackageReference \"swift-certificates\" */;")
o("\t\t\tproductName = X509;")
o("\t\t};")
o("/* End XCSwiftPackageProductDependency section */")

o("\t};")
o(f"\trootObject = {PROJ};")
o("}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n")

scheme_dir = OUT.parent / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
(scheme_dir / "ParagonOS.xcscheme").write_text(
    f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{TARGET}"
               BuildableName = "ParagonOS.app"
               BlueprintName = "ParagonOS"
               ReferencedContainer = "container:ParagonOS.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES"
      shouldAutocreateTestPlan = "YES">
      <Testables>
         <TestableReference
            skipped = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{TEST_TARGET}"
               BuildableName = "ParagonOSTests.xctest"
               BlueprintName = "ParagonOSTests"
               ReferencedContainer = "container:ParagonOS.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{TARGET}"
            BuildableName = "ParagonOS.app"
            BlueprintName = "ParagonOS"
            ReferencedContainer = "container:ParagonOS.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
      <StoreKitConfigurationFileReference
         identifier = "../../../ParagonOS/Resources/ParagonOS.storekit">
      </StoreKitConfigurationFileReference>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{TARGET}"
            BuildableName = "ParagonOS.app"
            BlueprintName = "ParagonOS"
            ReferencedContainer = "container:ParagonOS.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
      <PreActions>
         <ExecutionAction
            ActionType = "Xcode.IDEStandardExecutionActionsCore.ExecutionActionType.ShellScriptAction">
            <ActionContent
               title = "Bump TestFlight build"
               scriptText = "cd &quot;${{PROJECT_DIR}}&quot;&#10;xcrun agvtool next-version -all&#10;">
               <EnvironmentBuildable>
                  <BuildableReference
                     BuildableIdentifier = "primary"
                     BlueprintIdentifier = "{TARGET}"
                     BuildableName = "ParagonOS.app"
                     BlueprintName = "ParagonOS"
                     ReferencedContainer = "container:ParagonOS.xcodeproj">
                  </BuildableReference>
               </EnvironmentBuildable>
            </ActionContent>
         </ExecutionAction>
      </PreActions>
   </ArchiveAction>
</Scheme>
"""
)

workspace_dir = OUT.parent / "project.xcworkspace"
workspace_dir.mkdir(parents=True, exist_ok=True)
(workspace_dir / "contents.xcworkspacedata").write_text(
    """<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
"""
)

print(f"Generated {OUT} with {len(SWIFT)} Swift files + {len(TEST_SWIFT)} tests + {len(RES)} resources + widget {len(WIDGET_SWIFT)}")
assert widget_settings_dict["PRODUCT_BUNDLE_IDENTIFIER"] == "pl.paragonos.app.widgets"
