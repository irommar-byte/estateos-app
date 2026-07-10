#!/usr/bin/env python3
"""Generates EOSMusic.xcodeproj from Swift sources."""
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "EOSMusic"
OUT = ROOT / "EOSMusic.xcodeproj" / "project.pbxproj"

SWIFT = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*.swift"))
RES = [
    "Resources/Assets.xcassets",
    "Resources/GoogleOAuth.plist",
]


def gid():
    return uuid.uuid4().hex[:24].upper()


# IDs
PROJ = gid()
TARGET = gid()
SRC_PHASE = gid()
RES_PHASE = gid()
FWK_PHASE = gid()
APP_REF = gid()
MAIN_GRP = gid()
EOS_GRP = gid()
PROD_GRP = gid()
CL_PROJ = gid()
CL_TGT = gid()
DBG_PROJ = gid()
REL_PROJ = gid()
DBG_TGT = gid()
REL_TGT = gid()

swift_ref = {f: gid() for f in SWIFT}
swift_bf = {f: gid() for f in SWIFT}
res_ref = {f: gid() for f in RES}
res_bf = {f: gid() for f in RES}

# folder groups
folders = {"": EOS_GRP}
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
for f in RES:
    o(f"\t\t{res_bf[f]} /* {f} in Resources */ = {{isa = PBXBuildFile; fileRef = {res_ref[f]} /* {f} */; }};")
o("/* End PBXBuildFile section */")

o("\n/* Begin PBXFileReference section */")
o(f"\t\t{APP_REF} /* EOSMusic.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = EOSMusic.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
for f in SWIFT:
    o(f"\t\t{swift_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {Path(f).name}; sourceTree = \"<group>\"; }};")
for f in RES:
    t = "folder.assetcatalog" if f.endswith(".xcassets") else ("text.plist.entitlements" if f.endswith(".entitlements") else "text.plist.xml")
    o(f"\t\t{res_ref[f]} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = {t}; path = {Path(f).name}; sourceTree = \"<group>\"; }};")
o("/* End PBXFileReference section */")

o("\n/* Begin PBXFrameworksBuildPhase section */")
o(f"\t\t{FWK_PHASE} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};")
o("/* End PBXFrameworksBuildPhase section */")

o("\n/* Begin PBXGroup section */")
o(f"\t\t{PROD_GRP} = {{isa = PBXGroup; children = ({APP_REF} /* EOSMusic.app */); name = Products; sourceTree = \"<group>\"; }};")
o(f"\t\t{MAIN_GRP} = {{isa = PBXGroup; children = ({EOS_GRP} /* EOSMusic */, {PROD_GRP} /* Products */); sourceTree = \"<group>\"; }};")

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
o(f"\t\t{EOS_GRP} = {{isa = PBXGroup; children = ({', '.join(top_children)}); path = EOSMusic; sourceTree = \"<group>\"; }};")
o("/* End PBXGroup section */")

o("\n/* Begin PBXNativeTarget section */")
o(f"\t\t{TARGET} = {{")
o(f"\t\t\tisa = PBXNativeTarget; buildConfigurationList = {CL_TGT};")
o(f"\t\t\tbuildPhases = ({SRC_PHASE} /* Sources */, {FWK_PHASE} /* Frameworks */, {RES_PHASE} /* Resources */);")
o("\t\t\tbuildRules = (); dependencies = (); name = EOSMusic;")
o(f"\t\t\tproductReference = {APP_REF}; productType = \"com.apple.product-type.application\";")
o("\t\t};")
o("/* End PBXNativeTarget section */")

o("\n/* Begin PBXProject section */")
o(f"\t\t{PROJ} = {{")
o(f"\t\t\tisa = PBXProject; buildConfigurationList = {CL_PROJ}; compatibilityVersion = \"Xcode 14.0\";")
o("\t\t\tdevelopmentRegion = pl; hasScannedForEncodings = 0;")
o(f"\t\t\tmainGroup = {MAIN_GRP}; productRefGroup = {PROD_GRP};")
o("\t\t\tprojectDirPath = \"\"; projectRoot = \"\";")
o(f"\t\t\ttargets = ({TARGET} /* EOSMusic */);")
o("\t\t};")
o("/* End PBXProject section */")

o("\n/* Begin PBXResourcesBuildPhase section */")
res_files = ", ".join(f"{res_bf[f]} /* {f} in Resources */" for f in RES)
o(f"\t\t{RES_PHASE} = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({res_files}); runOnlyForDeploymentPostprocessing = 0; }};")
o("/* End PBXResourcesBuildPhase section */")

o("\n/* Begin PBXSourcesBuildPhase section */")
src_files = ", ".join(f"{swift_bf[f]} /* {f} in Sources */" for f in SWIFT)
o(f"\t\t{SRC_PHASE} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({src_files}); runOnlyForDeploymentPostprocessing = 0; }};")
o("/* End PBXSourcesBuildPhase section */")

o("\n/* Begin XCBuildConfiguration section */")
o(f"\t\t{DBG_PROJ} = {{isa = XCBuildConfiguration; name = Debug; buildSettings = {{ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; COPY_PHASE_STRIP = NO; DEBUG_INFORMATION_FORMAT = dwarf; ENABLE_TESTABILITY = YES; GCC_DYNAMIC_NO_PIC = NO; GCC_OPTIMIZATION_LEVEL = 0; IPHONEOS_DEPLOYMENT_TARGET = 17.0; MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE; ONLY_ACTIVE_ARCH = YES; SDKROOT = iphoneos; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; SWIFT_OPTIMIZATION_LEVEL = \"-Onone\"; }}; }};")
o(f"\t\t{REL_PROJ} = {{isa = XCBuildConfiguration; name = Release; buildSettings = {{ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; COPY_PHASE_STRIP = NO; DEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\"; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; SWIFT_COMPILATION_MODE = wholemodule; VALIDATE_PRODUCT = YES; }}; }};")

tgt_settings = (
    "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; "
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; "
    "CODE_SIGN_ENTITLEMENTS = EOSMusic/Resources/EOSMusic.entitlements; "
    "CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; "
    "GENERATE_INFOPLIST_FILE = NO; "
    "INFOPLIST_FILE = EOSMusic/Resources/Info.plist; "
    "IPHONEOS_DEPLOYMENT_TARGET = 17.0; "
    "LD_RUNPATH_SEARCH_PATHS = (\"$(inherited)\", \"@executable_path/Frameworks\"); "
    "MARKETING_VERSION = 1.0.0; PRODUCT_BUNDLE_IDENTIFIER = pl.nostalgie.eosmusic; "
    "PRODUCT_NAME = \"$(TARGET_NAME)\"; SWIFT_EMIT_LOC_STRINGS = YES; SWIFT_VERSION = 5.0; "
    "TARGETED_DEVICE_FAMILY = \"1,2\";"
)
o(f"\t\t{DBG_TGT} = {{isa = XCBuildConfiguration; name = Debug; buildSettings = {{{tgt_settings} }}; }};")
o(f"\t\t{REL_TGT} = {{isa = XCBuildConfiguration; name = Release; buildSettings = {{{tgt_settings} }}; }};")
o("/* End XCBuildConfiguration section */")

o("\n/* Begin XCConfigurationList section */")
o(f"\t\t{CL_PROJ} = {{isa = XCConfigurationList; buildConfigurations = ({DBG_PROJ} /* Debug */, {REL_PROJ} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o(f"\t\t{CL_TGT} = {{isa = XCConfigurationList; buildConfigurations = ({DBG_TGT} /* Debug */, {REL_TGT} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};")
o("/* End XCConfigurationList section */")

o("\t};")
o(f"\trootObject = {PROJ};")
o("}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n")

scheme_dir = OUT.parent / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
scheme_path = scheme_dir / "EOSMusic.xcscheme"
scheme_path.write_text(
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
               BuildableName = "EOSMusic.app"
               BlueprintName = "EOSMusic"
               ReferencedContainer = "container:EOSMusic.xcodeproj">
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
            BuildableName = "EOSMusic.app"
            BlueprintName = "EOSMusic"
            ReferencedContainer = "container:EOSMusic.xcodeproj">
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
            BuildableName = "EOSMusic.app"
            BlueprintName = "EOSMusic"
            ReferencedContainer = "container:EOSMusic.xcodeproj">
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

print(f"Wrote {OUT} ({len(SWIFT)} Swift files)")
