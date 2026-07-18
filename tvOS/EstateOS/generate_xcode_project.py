#!/usr/bin/env python3
"""Generates EstateOS.xcodeproj for tvOS EstateOS MVP app."""
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "EstateOS"
OUT = ROOT / "EstateOS.xcodeproj" / "project.pbxproj"

SWIFT = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*.swift"))
RES = [
    "Resources/Assets.xcassets",
]


def gid():
    return uuid.uuid4().hex[:24].upper()


PROJ = gid()
TARGET = gid()
SRC_PHASE = gid()
RES_PHASE = gid()
FWK_PHASE = gid()
APP_REF = gid()
MAIN_GRP = gid()
APP_GRP = gid()
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
    o(
        f"\t\t{swift_bf[f]} /* {f} in Sources */ = "
        f"{{isa = PBXBuildFile; fileRef = {swift_ref[f]} /* {f} */; }};"
    )
for f in RES:
    o(
        f"\t\t{res_bf[f]} /* {f} in Resources */ = "
        f"{{isa = PBXBuildFile; fileRef = {res_ref[f]} /* {f} */; }};"
    )
o("/* End PBXBuildFile section */")

o("\n/* Begin PBXFileReference section */")
o(
    f"\t\t{APP_REF} /* EstateOS.app */ = "
    "{isa = PBXFileReference; explicitFileType = wrapper.application; "
    "includeInIndex = 0; path = EstateOS.app; sourceTree = BUILT_PRODUCTS_DIR; };"
)
for f in SWIFT:
    o(
        f"\t\t{swift_ref[f]} /* {f} */ = "
        f"{{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; "
        f"path = {Path(f).name}; sourceTree = \"<group>\"; }};"
    )
for f in RES:
    t = "folder.assetcatalog" if f.endswith(".xcassets") else "text.plist.xml"
    o(
        f"\t\t{res_ref[f]} /* {f} */ = "
        f"{{isa = PBXFileReference; lastKnownFileType = {t}; "
        f"path = {Path(f).name}; sourceTree = \"<group>\"; }};"
    )
o("/* End PBXFileReference section */")

o("\n/* Begin PBXFrameworksBuildPhase section */")
o(
    f"\t\t{FWK_PHASE} = "
    "{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; "
    "files = (); runOnlyForDeploymentPostprocessing = 0; };"
)
o("/* End PBXFrameworksBuildPhase section */")

o("\n/* Begin PBXGroup section */")
o(
    f"\t\t{PROD_GRP} = "
    f"{{isa = PBXGroup; children = ({APP_REF} /* EstateOS.app */); "
    "name = Products; sourceTree = \"<group>\"; };"
)
o(
    f"\t\t{MAIN_GRP} = "
    f"{{isa = PBXGroup; children = ({APP_GRP} /* EstateOS */, {PROD_GRP} /* Products */); "
    "sourceTree = \"<group>\"; };"
)

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
    o(
        f"\t\t{folders[key]} = "
        f"{{isa = PBXGroup; children = ({', '.join(children)}); "
        f"path = {name}; sourceTree = \"<group>\"; }};"
    )

top_children = []
for f in SWIFT + RES:
    if "/" not in f:
        ref = swift_ref.get(f) or res_ref.get(f)
        top_children.append(f"{ref} /* {Path(f).name} */")
for sub in sorted(folders):
    if sub and "/" not in sub:
        top_children.append(f"{folders[sub]} /* {sub} */")
o(
    f"\t\t{APP_GRP} = "
    f"{{isa = PBXGroup; children = ({', '.join(top_children)}); "
    "path = EstateOS; sourceTree = \"<group>\"; };"
)
o("/* End PBXGroup section */")

o("\n/* Begin PBXNativeTarget section */")
o(f"\t\t{TARGET} = {{")
o(f"\t\t\tisa = PBXNativeTarget; buildConfigurationList = {CL_TGT};")
o(
    f"\t\t\tbuildPhases = ({SRC_PHASE} /* Sources */, {FWK_PHASE} /* Frameworks */, {RES_PHASE} /* Resources */);"
)
o("\t\t\tbuildRules = (); dependencies = (); name = EstateOS;")
o(
    f"\t\t\tproductReference = {APP_REF}; productType = \"com.apple.product-type.application\";"
)
o("\t\t};")
o("/* End PBXNativeTarget section */")

o("\n/* Begin PBXProject section */")
o(f"\t\t{PROJ} = {{")
o(
    f"\t\t\tisa = PBXProject; buildConfigurationList = {CL_PROJ}; compatibilityVersion = \"Xcode 14.0\";"
)
o("\t\t\tdevelopmentRegion = en; hasScannedForEncodings = 0;")
o(f"\t\t\tmainGroup = {MAIN_GRP}; productRefGroup = {PROD_GRP};")
o("\t\t\tprojectDirPath = \"\"; projectRoot = \"\";")
o(f"\t\t\ttargets = ({TARGET} /* EstateOS */);")
o("\t\t};")
o("/* End PBXProject section */")

o("\n/* Begin PBXResourcesBuildPhase section */")
res_files = ", ".join(f"{res_bf[f]} /* {f} in Resources */" for f in RES)
o(
    f"\t\t{RES_PHASE} = "
    f"{{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({res_files}); runOnlyForDeploymentPostprocessing = 0; }};"
)
o("/* End PBXResourcesBuildPhase section */")

o("\n/* Begin PBXSourcesBuildPhase section */")
src_files = ", ".join(f"{swift_bf[f]} /* {f} in Sources */" for f in SWIFT)
o(
    f"\t\t{SRC_PHASE} = "
    f"{{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({src_files}); runOnlyForDeploymentPostprocessing = 0; }};"
)
o("/* End PBXSourcesBuildPhase section */")

o("\n/* Begin XCBuildConfiguration section */")
o(
    f"\t\t{DBG_PROJ} = "
    "{isa = XCBuildConfiguration; name = Debug; buildSettings = {ALWAYS_SEARCH_USER_PATHS = NO; "
    "CLANG_ENABLE_MODULES = YES; COPY_PHASE_STRIP = NO; DEBUG_INFORMATION_FORMAT = dwarf; ENABLE_TESTABILITY = YES; "
    "GCC_DYNAMIC_NO_PIC = NO; GCC_OPTIMIZATION_LEVEL = 0; MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE; "
    "ONLY_ACTIVE_ARCH = YES; SDKROOT = appletvos; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; SWIFT_OPTIMIZATION_LEVEL = \"-Onone\"; }; };"
)
o(
    f"\t\t{REL_PROJ} = "
    "{isa = XCBuildConfiguration; name = Release; buildSettings = {ALWAYS_SEARCH_USER_PATHS = NO; CLANG_ENABLE_MODULES = YES; "
    "COPY_PHASE_STRIP = NO; DEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\"; SDKROOT = appletvos; SWIFT_COMPILATION_MODE = wholemodule; VALIDATE_PRODUCT = YES; }; };"
)

tgt_settings = (
    "ASSETCATALOG_COMPILER_APPICON_NAME = \"App Icon & Top Shelf Image\"; "
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; "
    "CODE_SIGN_STYLE = Automatic; DEVELOPMENT_TEAM = NW3YW69KL9; CURRENT_PROJECT_VERSION = 1; "
    "GENERATE_INFOPLIST_FILE = NO; "
    "INFOPLIST_FILE = EstateOS/Resources/Info.plist; "
    "LD_RUNPATH_SEARCH_PATHS = (\"$(inherited)\", \"@executable_path/Frameworks\"); "
    "MARKETING_VERSION = 1.0.0; PRODUCT_BUNDLE_IDENTIFIER = pl.estateos.app.tvos; "
    "PRODUCT_NAME = \"$(TARGET_NAME)\"; SDKROOT = appletvos; SWIFT_EMIT_LOC_STRINGS = YES; "
    "SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = 3; TVOS_DEPLOYMENT_TARGET = 17.0;"
)
o(
    f"\t\t{DBG_TGT} = "
    f"{{isa = XCBuildConfiguration; name = Debug; buildSettings = {{{tgt_settings} }}; }};"
)
o(
    f"\t\t{REL_TGT} = "
    f"{{isa = XCBuildConfiguration; name = Release; buildSettings = {{{tgt_settings} }}; }};"
)
o("/* End XCBuildConfiguration section */")

o("\n/* Begin XCConfigurationList section */")
o(
    f"\t\t{CL_PROJ} = "
    f"{{isa = XCConfigurationList; buildConfigurations = ({DBG_PROJ} /* Debug */, {REL_PROJ} /* Release */); "
    "defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };"
)
o(
    f"\t\t{CL_TGT} = "
    f"{{isa = XCConfigurationList; buildConfigurations = ({DBG_TGT} /* Debug */, {REL_TGT} /* Release */); "
    "defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };"
)
o("/* End XCConfigurationList section */")

o("\t};")
o(f"\trootObject = {PROJ};")
o("}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n")

scheme_dir = OUT.parent / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
scheme_path = scheme_dir / "EstateOS-tvOS.xcscheme"
scheme_path.write_text(
    f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.7">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries>
      <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">
        <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{TARGET}" BuildableName="EstateOS.app" BlueprintName="EstateOS" ReferencedContainer="container:EstateOS.xcodeproj"/>
      </BuildActionEntry>
    </BuildActionEntries>
  </BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES" shouldAutocreateTestPlan="YES"/>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">
    <BuildableProductRunnable runnableDebuggingMode="0">
      <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{TARGET}" BuildableName="EstateOS.app" BlueprintName="EstateOS" ReferencedContainer="container:EstateOS.xcodeproj"/>
    </BuildableProductRunnable>
  </LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES">
    <BuildableProductRunnable runnableDebuggingMode="0">
      <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{TARGET}" BuildableName="EstateOS.app" BlueprintName="EstateOS" ReferencedContainer="container:EstateOS.xcodeproj"/>
    </BuildableProductRunnable>
  </ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
"""
)

workspace_dir = OUT.parent / "project.xcworkspace"
workspace_dir.mkdir(parents=True, exist_ok=True)
(workspace_dir / "contents.xcworkspacedata").write_text(
    """<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
  <FileRef location="self:"/>
</Workspace>
"""
)

print(f"Wrote {OUT} ({len(SWIFT)} Swift files)")
