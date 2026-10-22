#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

RELEASE_UNSIGNED = """		{id} /* {name} */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				ASSETCATALOG_COMPILER_APPICON_NAME = "App Icon & Top Shelf Image";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = NO;
				CODE_SIGN_ENTITLEMENTS = GalleryOSTV/GalleryOSTV.entitlements;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGN_STYLE = Manual;
				CURRENT_PROJECT_VERSION = 12;
				DEVELOPMENT_TEAM = "";
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = GalleryOSTV/Resources/Info.plist;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = pl.galleryos.app.tv;
				PRODUCT_NAME = "$(TARGET_NAME)";
				PROVISIONING_PROFILE_SPECIFIER = "";
				SDKROOT = appletvos;
				SUPPORTED_PLATFORMS = "appletvos appletvsimulator";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = 3;
				TVOS_DEPLOYMENT_TARGET = 26.0;
			}};
			name = {name};
		}};"""

# --- GalleryOS™.xcodeproj ---
tm = ROOT / "GalleryOS™.xcodeproj" / "project.pbxproj"
text = tm.read_text()
old_release = """		58D9FF502DAF4F04B3835FAF /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = "App Icon & Top Shelf Image";
				CODE_SIGN_ENTITLEMENTS = GalleryOSTV/GalleryOSTV.entitlements;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 11;
				DEVELOPMENT_TEAM = NW3YW69KL9;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = GalleryOSTV/Resources/Info.plist;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = pl.galleryos.app.tv;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SDKROOT = appletvos;
				SUPPORTED_PLATFORMS = "appletvos appletvsimulator";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = 3;
				TVOS_DEPLOYMENT_TARGET = 26.0;
			};
			name = Release;
		};"""
new_release = RELEASE_UNSIGNED.format(id="58D9FF502DAF4F04B3835FAF", name="Release")
if old_release not in text:
    # already patched or different — try replace CURRENT_PROJECT_VERSION on GalleryOSTV blocks
    if "58D9FF502DAF4F04B3835FAF" in text and "CURRENT_PROJECT_VERSION = 12" in text:
        print("GalleryOS™ Release already at build 12")
    else:
        raise SystemExit("GalleryOS™ Release block not found")
else:
    text = text.replace(old_release, new_release)
    text = text.replace(
        "CURRENT_PROJECT_VERSION = 11;\n\t\t\t\tDEVELOPMENT_TEAM = \"\";\n\t\t\t\tGENERATE_INFOPLIST_FILE = NO;\n\t\t\t\tINFOPLIST_FILE = GalleryOSTV/Resources/Info.plist;",
        "CURRENT_PROJECT_VERSION = 12;\n\t\t\t\tDEVELOPMENT_TEAM = \"\";\n\t\t\t\tGENERATE_INFOPLIST_FILE = NO;\n\t\t\t\tINFOPLIST_FILE = GalleryOSTV/Resources/Info.plist;",
        1,
    )
    tm.write_text(text)
    print("patched GalleryOS™ Release → unsigned Manual build 12")

# --- plain GalleryOS.xcodeproj ---
plain = ROOT / "GalleryOS.xcodeproj" / "project.pbxproj"
text = plain.read_text()
pat = re.compile(
    r"\t\t7F8A3A741B254EB78FB1CC1F /\* Debug \*/ = \{.*?\n\t\t\};\n\t\tA07F291707764F1CAA398E84 /\* Release \*/ = \{.*?\n\t\t\};",
    re.S,
)
m = pat.search(text)
if not m:
    raise SystemExit("plain GalleryOSTV configs not found")
# compact LD_RUNPATH form used in plain project
compact = """		{id} /* {name} */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				ASSETCATALOG_COMPILER_APPICON_NAME = "App Icon & Top Shelf Image";
				CODE_SIGNING_ALLOWED = YES;
				CODE_SIGNING_REQUIRED = NO;
				CODE_SIGN_ENTITLEMENTS = GalleryOSTV/GalleryOSTV.entitlements;
				CODE_SIGN_IDENTITY = "-";
				CODE_SIGN_STYLE = Manual;
				CURRENT_PROJECT_VERSION = 12;
				DEVELOPMENT_TEAM = "";
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = GalleryOSTV/Resources/Info.plist;
				LD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks");
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = pl.galleryos.app.tv;
				PRODUCT_NAME = "$(TARGET_NAME)";
				PROVISIONING_PROFILE_SPECIFIER = "";
				SDKROOT = appletvos;
				SUPPORTED_PLATFORMS = "appletvos appletvsimulator";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = 3;
				TVOS_DEPLOYMENT_TARGET = 26.0;
			}};
			name = {name};
		}};"""
repl = (
    compact.format(id="7F8A3A741B254EB78FB1CC1F", name="Debug")
    + "\n"
    + compact.format(id="A07F291707764F1CAA398E84", name="Release")
)
plain.write_text(text[: m.start()] + repl + text[m.end() :])
print("patched GalleryOS.xcodeproj GalleryOSTV Debug+Release")


def patch_scheme(scheme_path: Path, container: str, blueprint: str) -> None:
    text = scheme_path.read_text()
    old = """   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>"""
    if "Sign GalleryOSTV for App Store" in text:
        print(f"scheme already has post-action: {scheme_path.name}")
        return
    if old not in text:
        raise SystemExit(f"ArchiveAction not found in {scheme_path}")
    script = 'bash &quot;${PROJECT_DIR}/scripts/sign_galleryostv_archive.sh&quot; &quot;${ARCHIVE_PATH}&quot;'
    new = f"""   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
      <PostActions>
         <ExecutionAction
            ActionType = "Xcode.IDEStandardExecutionActionsCore.ExecutionActionType.ShellScriptAction">
            <ActionContent
               title = "Sign GalleryOSTV for App Store"
               scriptText = "{script}">
               <EnvironmentBuildable>
                  <BuildableReference
                     BuildableIdentifier = "primary"
                     BlueprintIdentifier = "{blueprint}"
                     BuildableName = "GalleryOSTV.app"
                     BlueprintName = "GalleryOSTV"
                     ReferencedContainer = "container:{container}">
                  </BuildableReference>
               </EnvironmentBuildable>
            </ActionContent>
         </ExecutionAction>
      </PostActions>
   </ArchiveAction>"""
    scheme_path.write_text(text.replace(old, new))
    print(f"patched scheme post-action: {scheme_path}")


patch_scheme(
    ROOT / "GalleryOS™.xcodeproj" / "xcshareddata" / "xcschemes" / "GalleryOSTV.xcscheme",
    "GalleryOS&#x2122;.xcodeproj",
    "23FB374215D64514AE3D588C",
)
patch_scheme(
    ROOT / "GalleryOS.xcodeproj" / "xcshareddata" / "xcschemes" / "GalleryOSTV.xcscheme",
    "GalleryOS.xcodeproj",
    "3758C4200EF54241BC026690",
)
