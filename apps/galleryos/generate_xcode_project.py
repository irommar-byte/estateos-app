#!/usr/bin/env python3
"""Generates GalleryOS.xcodeproj from the Swift sources."""
import uuid
from pathlib import Path

import tvos_project

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "GalleryOS"
TEST_SRC = ROOT / "GalleryOSTests"
PROJECT = ROOT / "GalleryOS.xcodeproj"
PBX = PROJECT / "project.pbxproj"

SWIFT = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*.swift"))
TESTS = sorted(p.relative_to(TEST_SRC).as_posix() for p in TEST_SRC.rglob("*.swift"))
RES = ["Resources/Assets.xcassets", "Resources/PrivacyInfo.xcprivacy"]


def gid():
    return uuid.uuid4().hex[:24].upper()


def q(value: str) -> str:
    if value.isalnum() or value in {"YES", "NO"} or set(value) <= set("0123456789."):
        return value
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


PROJ, TARGET, TEST_TARGET = gid(), gid(), gid()
SRC_PHASE, TEST_SRC_PHASE = gid(), gid()
RES_PHASE, FWK_PHASE, TEST_FWK_PHASE = gid(), gid(), gid()
APP_REF, TEST_REF = gid(), gid()
MAIN_GRP, APP_GRP, TEST_GRP, PROD_GRP = gid(), gid(), gid(), gid()
CL_PROJ, CL_TGT, CL_TEST = gid(), gid(), gid()
DBG_PROJ, REL_PROJ = gid(), gid()
DBG_TGT, REL_TGT, DBG_TEST, REL_TEST = gid(), gid(), gid(), gid()
PROXY, DEP = gid(), gid()
WIDGET, WIDGET_SRC, WIDGET_FWK, WIDGET_RES, WIDGET_REF = gid(), gid(), gid(), gid(), gid()
WIDGET_GRP, EMBED, WIDGET_DEP, WIDGET_PROXY = gid(), gid(), gid(), gid()
CL_WIDGET, DBG_WIDGET, REL_WIDGET = gid(), gid(), gid()
WIDGET_FILES = [
    "GalleryOSWidget/GalleryWidgetBundle.swift",
    "GalleryOSWidget/SyncLiveActivityWidget.swift",
    "GalleryOS/Sync/SyncActivityAttributes.swift",
]
widget_ref = {path: gid() for path in WIDGET_FILES}
widget_bf = {path: gid() for path in WIDGET_FILES}
CITADEL_PKG, NIO_PKG = gid(), gid()
CITADEL_PROD, NIO_PROD = gid(), gid()
CITADEL_BF, NIO_BF = gid(), gid()

swift_ref = {path: gid() for path in SWIFT}
swift_bf = {path: gid() for path in SWIFT}
test_ref = {path: gid() for path in TESTS}
test_bf = {path: gid() for path in TESTS}
res_ref = {path: gid() for path in RES}
res_bf = {path: gid() for path in RES}

TV_IDS, TV = tvos_project.build(
    {path: swift_ref[path.removeprefix("GalleryOS/")] for path in tvos_project.SHARED_FILES}
)

lines = []


def o(text=""):
    lines.append(text)


o("// !$*UTF8*$!")
o("{")
o("\tarchiveVersion = 1;")
o("\tclasses = {};")
o("\tobjectVersion = 56;")
o("\tobjects = {")
o("\n/* Begin PBXBuildFile section */")
for path in SWIFT:
    o(f"\t\t{swift_bf[path]} /* {Path(path).name} in Sources */ = {{isa = PBXBuildFile; fileRef = {swift_ref[path]} /* {Path(path).name} */; }};")
for path in TESTS:
    o(f"\t\t{test_bf[path]} /* {Path(path).name} in Sources */ = {{isa = PBXBuildFile; fileRef = {test_ref[path]} /* {Path(path).name} */; }};")
for path in RES:
    o(f"\t\t{res_bf[path]} /* {Path(path).name} in Resources */ = {{isa = PBXBuildFile; fileRef = {res_ref[path]} /* {Path(path).name} */; }};")
o(f"\t\t{CITADEL_BF} /* Citadel in Frameworks */ = {{isa = PBXBuildFile; productRef = {CITADEL_PROD} /* Citadel */; }};")
o(f"\t\t{NIO_BF} /* NIO in Frameworks */ = {{isa = PBXBuildFile; productRef = {NIO_PROD} /* NIO */; }};")
o(f"\t\t{EMBED} /* GalleryOSWidget.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {WIDGET_REF} /* GalleryOSWidget.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};")
for path in WIDGET_FILES:
    o(f"\t\t{widget_bf[path]} /* {Path(path).name} in Sources */ = {{isa = PBXBuildFile; fileRef = {widget_ref[path]} /* {Path(path).name} */; }};")
lines.extend(TV["PBXBuildFile"])
o("/* End PBXBuildFile section */")

o("\n/* Begin PBXContainerItemProxy section */")
o(f"\t\t{PROXY} /* PBXContainerItemProxy */ = {{")
o("\t\t\tisa = PBXContainerItemProxy;")
o(f"\t\t\tcontainerPortal = {PROJ} /* Project object */;")
o("\t\t\tproxyType = 1;")
o(f"\t\t\tremoteGlobalIDString = {TARGET};")
o("\t\t\tremoteInfo = GalleryOS;")
o("\t\t};")
o("/* End PBXContainerItemProxy section */")

o("\n/* Begin PBXFileReference section */")
o(f"\t\t{APP_REF} /* GalleryOS.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = GalleryOS.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
o(f"\t\t{TEST_REF} /* GalleryOSTests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = GalleryOSTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};")
o(f"\t\t{WIDGET_REF} /* GalleryOSWidget.appex */ = {{isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; includeInIndex = 0; path = GalleryOSWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};")
for path in WIDGET_FILES:
    o(f"\t\t{widget_ref[path]} /* {Path(path).name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {q(path)}; sourceTree = \"<group>\"; }};")
for path in SWIFT:
    name = Path(path).name
    o(f"\t\t{swift_ref[path]} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {q(path)}; sourceTree = \"<group>\"; }};")
for path in TESTS:
    name = Path(path).name
    o(f"\t\t{test_ref[path]} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {q(path)}; sourceTree = \"<group>\"; }};")
for path in RES:
    name = Path(path).name
    kind = "folder.assetcatalog" if path.endswith(".xcassets") else "text.xml"
    o(f"\t\t{res_ref[path]} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = {kind}; path = {q(path)}; sourceTree = \"<group>\"; }};")
lines.extend(TV["PBXFileReference"])
o("/* End PBXFileReference section */")

o("\n/* Begin PBXFrameworksBuildPhase section */")
o(f"\t\t{FWK_PHASE} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({CITADEL_BF} /* Citadel in Frameworks */, {NIO_BF} /* NIO in Frameworks */); runOnlyForDeploymentPostprocessing = 0; }};")
o(f"\t\t{TEST_FWK_PHASE} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};")
lines.extend(TV["PBXFrameworksBuildPhase"])
o("/* End PBXFrameworksBuildPhase section */")

o("\n/* Begin PBXGroup section */")
app_children = ", ".join(
    [f"{swift_ref[path]} /* {Path(path).name} */" for path in SWIFT]
    + [f"{res_ref[path]} /* {Path(path).name} */" for path in RES]
)
test_children = ", ".join(f"{test_ref[path]} /* {Path(path).name} */" for path in TESTS)
o(f"\t\t{APP_GRP} = {{isa = PBXGroup; children = ({app_children}); path = GalleryOS; sourceTree = \"<group>\"; }};")
o(f"\t\t{TEST_GRP} = {{isa = PBXGroup; children = ({test_children}); path = GalleryOSTests; sourceTree = \"<group>\"; }};")
widget_children = ", ".join(f"{widget_ref[path]} /* {Path(path).name} */" for path in WIDGET_FILES)
o(f"\t\t{WIDGET_GRP} = {{isa = PBXGroup; children = ({widget_children}); name = GalleryOSWidget; sourceTree = \"<group>\"; }};")
o(f"\t\t{PROD_GRP} = {{isa = PBXGroup; children = ({APP_REF} /* GalleryOS.app */, {TEST_REF} /* GalleryOSTests.xctest */, {WIDGET_REF} /* GalleryOSWidget.appex */, {TV_IDS['product']} /* GalleryOSTV.app */); name = Products; sourceTree = \"<group>\"; }};")
o(f"\t\t{MAIN_GRP} = {{isa = PBXGroup; children = ({APP_GRP} /* GalleryOS */, {TEST_GRP} /* GalleryOSTests */, {WIDGET_GRP} /* GalleryOSWidget */, {TV_IDS['group']} /* GalleryOSTV */, {PROD_GRP} /* Products */); sourceTree = \"<group>\"; }};")
lines.extend(TV["PBXGroup"])
o("/* End PBXGroup section */")

o("\n/* Begin PBXNativeTarget section */")
o(f"\t\t{TARGET} /* GalleryOS */ = {{")
o("\t\t\tisa = PBXNativeTarget;")
o(f"\t\t\tbuildConfigurationList = {CL_TGT} /* Build configuration list for PBXNativeTarget \"GalleryOS\" */;")
o(f"\t\t\tbuildPhases = ({SRC_PHASE} /* Sources */, {FWK_PHASE} /* Frameworks */, {RES_PHASE} /* Resources */, {WIDGET_RES} /* Embed Foundation Extensions */);")
o("\t\t\tbuildRules = ();")
o(f"\t\t\tdependencies = ({WIDGET_DEP} /* PBXTargetDependency */);")
o("\t\t\tname = GalleryOS;")
o(f"\t\t\tpackageProductDependencies = ({CITADEL_PROD} /* Citadel */, {NIO_PROD} /* NIO */);")
o("\t\t\tproductName = GalleryOS;")
o(f"\t\t\tproductReference = {APP_REF} /* GalleryOS.app */;")
o("\t\t\tproductType = \"com.apple.product-type.application\";")
o("\t\t};")
o(f"\t\t{TEST_TARGET} /* GalleryOSTests */ = {{")
o("\t\t\tisa = PBXNativeTarget;")
o(f"\t\t\tbuildConfigurationList = {CL_TEST} /* Build configuration list for PBXNativeTarget \"GalleryOSTests\" */;")
o(f"\t\t\tbuildPhases = ({TEST_SRC_PHASE} /* Sources */, {TEST_FWK_PHASE} /* Frameworks */);")
o("\t\t\tbuildRules = ();")
o(f"\t\t\tdependencies = ({DEP} /* PBXTargetDependency */);")
o("\t\t\tname = GalleryOSTests;")
o("\t\t\tproductName = GalleryOSTests;")
o(f"\t\t\tproductReference = {TEST_REF} /* GalleryOSTests.xctest */;")
o("\t\t\tproductType = \"com.apple.product-type.bundle.unit-test\";")
o("\t\t};")
o(f"\t\t{WIDGET} /* GalleryOSWidget */ = {{")
o("\t\t\tisa = PBXNativeTarget;")
o(f"\t\t\tbuildConfigurationList = {CL_WIDGET} /* Build configuration list for PBXNativeTarget \"GalleryOSWidget\" */;")
o(f"\t\t\tbuildPhases = ({WIDGET_SRC} /* Sources */, {WIDGET_FWK} /* Frameworks */);")
o("\t\t\tbuildRules = ();")
o("\t\t\tdependencies = ();")
o("\t\t\tname = GalleryOSWidget;")
o("\t\t\tproductName = GalleryOSWidget;")
o(f"\t\t\tproductReference = {WIDGET_REF} /* GalleryOSWidget.appex */;")
o("\t\t\tproductType = \"com.apple.product-type.app-extension\";")
o("\t\t};")
lines.extend(TV["PBXNativeTarget"])
o("/* End PBXNativeTarget section */")

o("\n/* Begin PBXProject section */")
o(f"\t\t{PROJ} /* Project object */ = {{")
o("\t\t\tisa = PBXProject;")
o("\t\t\tattributes = {BuildIndependentTargetsInParallel = 1; LastUpgradeCheck = 2700; };")
o(f"\t\t\tbuildConfigurationList = {CL_PROJ} /* Build configuration list for PBXProject \"GalleryOS\" */;")
o("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
o("\t\t\tdevelopmentRegion = pl;")
o("\t\t\thasScannedForEncodings = 0;")
o("\t\t\tknownRegions = (en, Base, pl);")
o(f"\t\t\tmainGroup = {MAIN_GRP};")
o(f"\t\t\tpackageReferences = ({CITADEL_PKG} /* XCRemoteSwiftPackageReference \"Citadel\" */, {NIO_PKG} /* XCRemoteSwiftPackageReference \"swift-nio\" */);")
o(f"\t\t\tproductRefGroup = {PROD_GRP} /* Products */;")
o("\t\t\tprojectDirPath = \"\";")
o("\t\t\tprojectRoot = \"\";")
o(f"\t\t\ttargets = ({TARGET} /* GalleryOS */, {TEST_TARGET} /* GalleryOSTests */, {WIDGET} /* GalleryOSWidget */, {TV_IDS['target']} /* GalleryOSTV */);")
o("\t\t};")
o("/* End PBXProject section */")

o("\n/* Begin PBXResourcesBuildPhase section */")
res_files = ", ".join(f"{res_bf[path]} /* {Path(path).name} in Resources */" for path in RES)
o(f"\t\t{RES_PHASE} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({res_files}); runOnlyForDeploymentPostprocessing = 0; }};")
lines.extend(TV["PBXResourcesBuildPhase"])
o("/* End PBXResourcesBuildPhase section */")

o("\n/* Begin PBXCopyFilesBuildPhase section */")
o(f"\t\t{WIDGET_RES} /* Embed Foundation Extensions */ = {{")
o("\t\t\tisa = PBXCopyFilesBuildPhase;")
o("\t\t\tbuildActionMask = 2147483647;")
o("\t\t\tdstPath = \"\";")
o("\t\t\tdstSubfolderSpec = 13;")
o(f"\t\t\tfiles = ({EMBED} /* GalleryOSWidget.appex in Embed Foundation Extensions */);")
o("\t\t\tname = \"Embed Foundation Extensions\";")
o("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
o("\t\t};")
o("/* End PBXCopyFilesBuildPhase section */")

o("\n/* Begin PBXSourcesBuildPhase section */")
src_files = ", ".join([f"{swift_bf[path]} /* {Path(path).name} in Sources */" for path in SWIFT] + TV_IDS["ios_sources"])
test_files = ", ".join(f"{test_bf[path]} /* {Path(path).name} in Sources */" for path in TESTS)
o(f"\t\t{SRC_PHASE} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({src_files}); runOnlyForDeploymentPostprocessing = 0; }};")
o(f"\t\t{TEST_SRC_PHASE} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({test_files}); runOnlyForDeploymentPostprocessing = 0; }};")
widget_sources = ", ".join(f"{widget_bf[path]} /* {Path(path).name} in Sources */" for path in WIDGET_FILES)
o(f"\t\t{WIDGET_SRC} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({widget_sources}); runOnlyForDeploymentPostprocessing = 0; }};")
o(f"\t\t{WIDGET_FWK} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};")
lines.extend(TV["PBXSourcesBuildPhase"])
o("/* End PBXSourcesBuildPhase section */")

o("\n/* Begin PBXTargetDependency section */")
o(f"\t\t{DEP} /* PBXTargetDependency */ = {{isa = PBXTargetDependency; target = {TARGET} /* GalleryOS */; targetProxy = {PROXY} /* PBXContainerItemProxy */; }};")
o(f"\t\t{WIDGET_PROXY} /* PBXContainerItemProxy */ = {{isa = PBXContainerItemProxy; containerPortal = {PROJ} /* Project object */; proxyType = 1; remoteGlobalIDString = {WIDGET}; remoteInfo = GalleryOSWidget; }};")
o(f"\t\t{WIDGET_DEP} /* PBXTargetDependency */ = {{isa = PBXTargetDependency; target = {WIDGET} /* GalleryOSWidget */; targetProxy = {WIDGET_PROXY} /* PBXContainerItemProxy */; }};")
o("/* End PBXTargetDependency section */")

def emit_config(identifier, name, settings):
    o(f"\t\t{identifier} /* {name} */ = {{")
    o("\t\t\tisa = XCBuildConfiguration;")
    o("\t\t\tbuildSettings = {")
    for key, value in settings.items():
        o(f"\t\t\t\t{key} = {value};")
    o("\t\t\t};")
    o(f"\t\t\tname = {name};")
    o("\t\t};")


o("\n/* Begin XCBuildConfiguration section */")
project_debug = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "CLANG_ENABLE_MODULES": "YES",
    "COPY_PHASE_STRIP": "NO",
    "DEBUG_INFORMATION_FORMAT": "dwarf",
    "ENABLE_TESTABILITY": "YES",
    "GCC_DYNAMIC_NO_PIC": "NO",
    "GCC_OPTIMIZATION_LEVEL": "0",
    "IPHONEOS_DEPLOYMENT_TARGET": "26.0",
    "ONLY_ACTIVE_ARCH": "YES",
    "SDKROOT": "iphoneos",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG",
    "SWIFT_OPTIMIZATION_LEVEL": '"-Onone"',
    "SWIFT_VERSION": "5.0",
}
project_release = {
    "ALWAYS_SEARCH_USER_PATHS": "NO",
    "CLANG_ENABLE_MODULES": "YES",
    "COPY_PHASE_STRIP": "NO",
    "DEBUG_INFORMATION_FORMAT": '"dwarf-with-dsym"',
    "IPHONEOS_DEPLOYMENT_TARGET": "26.0",
    "SDKROOT": "iphoneos",
    "SWIFT_COMPILATION_MODE": "wholemodule",
    "SWIFT_VERSION": "5.0",
    "VALIDATE_PRODUCT": "YES",
}
target = {
    "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
    "CODE_SIGN_ENTITLEMENTS": "GalleryOS/GalleryOS.entitlements",
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "DEVELOPMENT_TEAM": "NW3YW69KL9",
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": "GalleryOS/Resources/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName": '"GalleryOS™"',
    "INFOPLIST_KEY_LSApplicationCategoryType": '"public.app-category.photography"',
    "IPHONEOS_DEPLOYMENT_TARGET": "26.0",
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks")',
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "pl.galleryos.app",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SUPPORTED_PLATFORMS": '"iphoneos iphonesimulator"',
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": '"1,2"',
}
test = {
    "BUNDLE_LOADER": '"$(TEST_HOST)"',
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "DEVELOPMENT_TEAM": "NW3YW69KL9",
    "GENERATE_INFOPLIST_FILE": "YES",
    "IPHONEOS_DEPLOYMENT_TARGET": "26.0",
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "pl.galleryos.app.tests",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SDKROOT": "iphoneos",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": '"1,2"',
    "TEST_HOST": '"$(BUILT_PRODUCTS_DIR)/GalleryOS.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/GalleryOS"',
}
emit_config(DBG_PROJ, "Debug", project_debug)
emit_config(REL_PROJ, "Release", project_release)
emit_config(DBG_TGT, "Debug", target)
emit_config(REL_TGT, "Release", target)
emit_config(DBG_TEST, "Debug", test)
emit_config(REL_TEST, "Release", test)
widget_settings = {
    "CODE_SIGN_STYLE": "Automatic",
    "CURRENT_PROJECT_VERSION": "1",
    "DEVELOPMENT_TEAM": "NW3YW69KL9",
    "GENERATE_INFOPLIST_FILE": "NO",
    "INFOPLIST_FILE": "GalleryOSWidget/Info.plist",
    "IPHONEOS_DEPLOYMENT_TARGET": "26.0",
    "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks")',
    "MARKETING_VERSION": "1.0",
    "PRODUCT_BUNDLE_IDENTIFIER": "pl.galleryos.app.live",
    "PRODUCT_NAME": '"$(TARGET_NAME)"',
    "SKIP_INSTALL": "YES",
    "SWIFT_EMIT_LOC_STRINGS": "YES",
    "SWIFT_VERSION": "5.0",
    "TARGETED_DEVICE_FAMILY": '"1,2"',
}
emit_config(DBG_WIDGET, "Debug", widget_settings)
emit_config(REL_WIDGET, "Release", widget_settings)
lines.extend(TV["XCBuildConfiguration"])
o("/* End XCBuildConfiguration section */")

o("\n/* Begin XCConfigurationList section */")
o(f"\t\t{CL_PROJ} /* Build configuration list for PBXProject \"GalleryOS\" */ = {{isa = XCConfigurationList; buildConfigurations = ({DBG_PROJ} /* Debug */, {REL_PROJ} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_TGT} /* Build configuration list for PBXNativeTarget \"GalleryOS\" */ = {{isa = XCConfigurationList; buildConfigurations = ({DBG_TGT} /* Debug */, {REL_TGT} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_TEST} /* Build configuration list for PBXNativeTarget \"GalleryOSTests\" */ = {{isa = XCConfigurationList; buildConfigurations = ({DBG_TEST} /* Debug */, {REL_TEST} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_WIDGET} /* Build configuration list for PBXNativeTarget \"GalleryOSWidget\" */ = {{isa = XCConfigurationList; buildConfigurations = ({DBG_WIDGET} /* Debug */, {REL_WIDGET} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
lines.extend(TV["XCConfigurationList"])
o("/* End XCConfigurationList section */")

o("\n/* Begin XCRemoteSwiftPackageReference section */")
o(f"\t\t{CITADEL_PKG} /* XCRemoteSwiftPackageReference \"Citadel\" */ = {{")
o("\t\t\tisa = XCRemoteSwiftPackageReference;")
o("\t\t\trepositoryURL = \"https://github.com/orlandos-nl/Citadel\";")
o("\t\t\trequirement = {kind = exactVersion; version = 0.12.1; };")
o("\t\t};")
o(f"\t\t{NIO_PKG} /* XCRemoteSwiftPackageReference \"swift-nio\" */ = {{")
o("\t\t\tisa = XCRemoteSwiftPackageReference;")
o("\t\t\trepositoryURL = \"https://github.com/apple/swift-nio.git\";")
o("\t\t\trequirement = {kind = upToNextMajorVersion; minimumVersion = 2.81.0; };")
o("\t\t};")
o("/* End XCRemoteSwiftPackageReference section */")

o("\n/* Begin XCSwiftPackageProductDependency section */")
o(f"\t\t{CITADEL_PROD} /* Citadel */ = {{")
o("\t\t\tisa = XCSwiftPackageProductDependency;")
o(f"\t\t\tpackage = {CITADEL_PKG} /* XCRemoteSwiftPackageReference \"Citadel\" */;")
o("\t\t\tproductName = Citadel;")
o("\t\t};")
o(f"\t\t{NIO_PROD} /* NIO */ = {{")
o("\t\t\tisa = XCSwiftPackageProductDependency;")
o(f"\t\t\tpackage = {NIO_PKG} /* XCRemoteSwiftPackageReference \"swift-nio\" */;")
o("\t\t\tproductName = NIO;")
o("\t\t};")
o("/* End XCSwiftPackageProductDependency section */")
o("\t};")
o(f"\trootObject = {PROJ} /* Project object */;")
o("}")

PROJECT.mkdir(exist_ok=True)
PBX.write_text("\n".join(lines) + "\n", encoding="utf-8")

scheme_dir = PROJECT / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
scheme = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "2700"
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
               BuildableName = "GalleryOS.app"
               BlueprintName = "GalleryOS"
               ReferencedContainer = "container:GalleryOS.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO"
            parallelizable = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{TEST_TARGET}"
               BuildableName = "GalleryOSTests.xctest"
               BlueprintName = "GalleryOSTests"
               ReferencedContainer = "container:GalleryOS.xcodeproj">
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
            BuildableName = "GalleryOS.app"
            BlueprintName = "GalleryOS"
            ReferencedContainer = "container:GalleryOS.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
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
            BuildableName = "GalleryOS.app"
            BlueprintName = "GalleryOS"
            ReferencedContainer = "container:GalleryOS.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
(scheme_dir / "GalleryOS.xcscheme").write_text(scheme, encoding="utf-8")
(scheme_dir / "GalleryOSTV.xcscheme").write_text(
    tvos_project.scheme(TV_IDS["target"], "GalleryOS.xcodeproj"), encoding="utf-8"
)
print(f"Wrote {PBX} ({len(SWIFT)} sources)")
