#!/usr/bin/env python3
"""Builds the pbxproj sections of the GalleryOSTV (Apple TV) target.

Used by generate_xcode_project.py (fresh project) and by add_tvos_target.py
(injects the same target into the hand-maintained GalleryOS(TM) project).
"""
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TV_SRC = ROOT / "GalleryOSTV"
TEAM = "NW3YW69KL9"

# Files from the iOS app that the tvOS target compiles as well.
SHARED_FILES = [
    "GalleryOS/Sync/LibraryCatalog.swift",
    "GalleryOS/Sync/ServerTransport.swift",
    "GalleryOS/Sync/GalleryNetwork.swift",
    "GalleryOS/Sync/FolderTransports.swift",
    "GalleryOS/Library/PhotoModel.swift",
    "GalleryOS/Core/GalleryKeychain.swift",
    "GalleryOS/Core/AppleTVLink.swift",
]

# Pure logic written for the Apple TV that the iOS test target also compiles (so it can be unit tested).
IOS_COMPILES_TV = [
    "Data/TVCatalog.swift",
    "Data/TVSearch.swift",
]

TV_RESOURCES = ["Resources/Assets.xcassets"]


def gid():
    return uuid.uuid4().hex[:24].upper()


def q(value: str) -> str:
    if value.isalnum() or value in {"YES", "NO"} or set(value) <= set("0123456789."):
        return value
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def tv_swift_files():
    return sorted(p.relative_to(TV_SRC).as_posix() for p in TV_SRC.rglob("*.swift"))


def build(shared_refs):
    """shared_refs maps each SHARED_FILES path to the existing PBXFileReference id."""
    swift = tv_swift_files()
    ids = {
        "target": gid(), "product": gid(), "group": gid(),
        "src_phase": gid(), "fwk_phase": gid(), "res_phase": gid(),
        "list": gid(), "debug": gid(), "release": gid(),
    }
    tv_ref = {p: gid() for p in swift}
    tv_bf = {p: gid() for p in swift}
    res_ref = {p: gid() for p in TV_RESOURCES}
    res_bf = {p: gid() for p in TV_RESOURCES}
    shared_bf = {p: gid() for p in SHARED_FILES}
    plist_ref, ent_ref = gid(), gid()
    ios_bf = {p: gid() for p in IOS_COMPILES_TV}

    sections = {name: [] for name in [
        "PBXBuildFile", "PBXFileReference", "PBXGroup", "PBXNativeTarget",
        "PBXFrameworksBuildPhase", "PBXResourcesBuildPhase", "PBXSourcesBuildPhase",
        "XCBuildConfiguration", "XCConfigurationList",
    ]}

    for p in swift:
        n = Path(p).name
        sections["PBXBuildFile"].append(f"\t\t{tv_bf[p]} /* {n} in Sources (tvOS) */ = {{isa = PBXBuildFile; fileRef = {tv_ref[p]} /* {n} */; }};")
        sections["PBXFileReference"].append(f"\t\t{tv_ref[p]} /* {n} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {q(p)}; sourceTree = \"<group>\"; }};")
    for p in IOS_COMPILES_TV:
        n = Path(p).name
        sections["PBXBuildFile"].append(f"\t\t{ios_bf[p]} /* {n} in Sources (iOS) */ = {{isa = PBXBuildFile; fileRef = {tv_ref[p]} /* {n} */; }};")
    for p in SHARED_FILES:
        n = Path(p).name
        sections["PBXBuildFile"].append(f"\t\t{shared_bf[p]} /* {n} in Sources (tvOS) */ = {{isa = PBXBuildFile; fileRef = {shared_refs[p]} /* {n} */; }};")
    for p in TV_RESOURCES:
        n = Path(p).name
        sections["PBXBuildFile"].append(f"\t\t{res_bf[p]} /* {n} in Resources (tvOS) */ = {{isa = PBXBuildFile; fileRef = {res_ref[p]} /* {n} */; }};")
        sections["PBXFileReference"].append(f"\t\t{res_ref[p]} /* {n} */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = {q(p)}; sourceTree = \"<group>\"; }};")
    sections["PBXFileReference"].append(f"\t\t{plist_ref} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Resources/Info.plist; sourceTree = \"<group>\"; }};")
    sections["PBXFileReference"].append(f"\t\t{ids['product']} /* GalleryOSTV.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = GalleryOSTV.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    sections["PBXFileReference"].append(f"\t\t{ent_ref} /* GalleryOSTV.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = GalleryOSTV.entitlements; sourceTree = \"<group>\"; }};")

    children = ", ".join(
        [f"{tv_ref[p]} /* {Path(p).name} */" for p in swift]
        + [f"{res_ref[p]} /* {Path(p).name} */" for p in TV_RESOURCES]
        + [f"{plist_ref} /* Info.plist */", f"{ent_ref} /* GalleryOSTV.entitlements */"]
    )
    sections["PBXGroup"].append(f"\t\t{ids['group']} /* GalleryOSTV */ = {{isa = PBXGroup; children = ({children}); path = GalleryOSTV; sourceTree = \"<group>\"; }};")

    src_files = ", ".join(
        [f"{tv_bf[p]} /* {Path(p).name} in Sources (tvOS) */" for p in swift]
        + [f"{shared_bf[p]} /* {Path(p).name} in Sources (tvOS) */" for p in SHARED_FILES]
    )
    res_files = ", ".join(f"{res_bf[p]} /* {Path(p).name} in Resources (tvOS) */" for p in TV_RESOURCES)
    sections["PBXSourcesBuildPhase"].append(f"\t\t{ids['src_phase']} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({src_files}); runOnlyForDeploymentPostprocessing = 0; }};")
    sections["PBXFrameworksBuildPhase"].append(f"\t\t{ids['fwk_phase']} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};")
    sections["PBXResourcesBuildPhase"].append(f"\t\t{ids['res_phase']} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({res_files}); runOnlyForDeploymentPostprocessing = 0; }};")

    sections["PBXNativeTarget"].append(
        f"\t\t{ids['target']} /* GalleryOSTV */ = {{\n"
        "\t\t\tisa = PBXNativeTarget;\n"
        f"\t\t\tbuildConfigurationList = {ids['list']} /* Build configuration list for PBXNativeTarget \"GalleryOSTV\" */;\n"
        f"\t\t\tbuildPhases = ({ids['src_phase']} /* Sources */, {ids['fwk_phase']} /* Frameworks */, {ids['res_phase']} /* Resources */);\n"
        "\t\t\tbuildRules = ();\n"
        "\t\t\tdependencies = ();\n"
        "\t\t\tname = GalleryOSTV;\n"
        "\t\t\tproductName = GalleryOSTV;\n"
        f"\t\t\tproductReference = {ids['product']} /* GalleryOSTV.app */;\n"
        "\t\t\tproductType = \"com.apple.product-type.application\";\n"
        "\t\t};"
    )

    common = {
        "ASSETCATALOG_COMPILER_APPICON_NAME": '"App Icon & Top Shelf Image"',
        "CODE_SIGN_ENTITLEMENTS": "GalleryOSTV/GalleryOSTV.entitlements",
        "CODE_SIGN_STYLE": "Automatic",
        "CURRENT_PROJECT_VERSION": "1",
        "DEVELOPMENT_TEAM": TEAM,
        "GENERATE_INFOPLIST_FILE": "NO",
        "INFOPLIST_FILE": "GalleryOSTV/Resources/Info.plist",
        "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks")',
        "MARKETING_VERSION": "1.0",
        "PRODUCT_BUNDLE_IDENTIFIER": "pl.galleryos.app.tv",
        "PRODUCT_NAME": '"$(TARGET_NAME)"',
        "SDKROOT": "appletvos",
        "SUPPORTED_PLATFORMS": '"appletvos appletvsimulator"',
        "SWIFT_EMIT_LOC_STRINGS": "YES",
        "SWIFT_VERSION": "5.0",
        "TARGETED_DEVICE_FAMILY": "3",
        "TVOS_DEPLOYMENT_TARGET": "26.0",
    }
    for key, name in (("debug", "Debug"), ("release", "Release")):
        body = "\n".join(f"\t\t\t\t{k} = {v};" for k, v in common.items())
        sections["XCBuildConfiguration"].append(
            f"\t\t{ids[key]} /* {name} */ = {{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {{\n{body}\n\t\t\t}};\n\t\t\tname = {name};\n\t\t}};"
        )
    sections["XCConfigurationList"].append(
        f"\t\t{ids['list']} /* Build configuration list for PBXNativeTarget \"GalleryOSTV\" */ = {{isa = XCConfigurationList; buildConfigurations = ({ids['debug']} /* Debug */, {ids['release']} /* Release */); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};"
    )
    ids["ios_sources"] = [f"{ios_bf[p]} /* {Path(p).name} in Sources (iOS) */" for p in IOS_COMPILES_TV]
    return ids, sections


def scheme(target_id, container):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
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
               BlueprintIdentifier = "{target_id}"
               BuildableName = "GalleryOSTV.app"
               BlueprintName = "GalleryOSTV"
               ReferencedContainer = "container:{container}">
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
            BlueprintIdentifier = "{target_id}"
            BuildableName = "GalleryOSTV.app"
            BlueprintName = "GalleryOSTV"
            ReferencedContainer = "container:{container}">
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
            BlueprintIdentifier = "{target_id}"
            BuildableName = "GalleryOSTV.app"
            BlueprintName = "GalleryOSTV"
            ReferencedContainer = "container:{container}">
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
