#!/usr/bin/env python3
from __future__ import annotations
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent
PBX = ROOT / "EstateOS.xcodeproj" / "project.pbxproj"
SCHEME = ROOT / "EstateOS.xcodeproj" / "xcshareddata" / "xcschemes" / "EstateOS-tvOS.xcscheme"
IDS = {
    "ext_target": "A1B2C3D4E5F6478990ABCD01",
    "ext_product": "B2C3D4E5F6A7489901ABCD02",
    "ext_sources": "C3D4E5F6A7B8490A12ABCD03",
    "ext_frameworks": "D4E5F6A7B8C9501B23ABCD04",
    "ext_config_list": "E5F6A7B8C9D0612C34ABCD05",
    "ext_debug": "F6A7B8C9D0E1723D45ABCD06",
    "ext_release": "07B8C9D0E1F2834E56ABCD07",
    "ext_group": "18C9D0E1F2A3945F67ABCD08",
    "embed_phase": "29D0E1F2A3B4056078ABCD09",
    "embed_build": "3AE1F2A3B4C5167189ABCD0A",
    "dep_target": "4BF2A3B4C5D6278290ABCD0B",
    "dep_proxy": "5C03B4C5D6E7389301ABCD0C",
    "fr_content": "7E25D6E7F8095A1523ABCD0E",
    "fr_shelf": "8F36E7F80916B2634ABCD0F",
    "fr_info": "9037F8091727C3745ABCD10",
    "fr_ent": "A148091827384856ABCD11",
    "fr_ent_sim": "B259182938495967ABCD12",
    "fr_tvservices": "C36A293A4A5A6A78ABCD13",
    "bf_content": "D47B3A4B5B6B7C89ABCD14",
    "bf_shelf": "E58C4B5C6C7D8D90ABCD15",
    "bf_tvservices_app": "07AE6D7E8E9FAFB2ABCD17",
    "bf_tvservices_ext": "18BF7E8F9FA0B0C3ABCD18",
}

def patch_pbxproj(text):
    i = IDS
    if i["ext_target"] in text:
        return text
    build_files = f"""
\t\t{i['bf_content']} /* ContentProvider.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {i['fr_content']} /* ContentProvider.swift */; }};
\t\t{i['bf_shelf']} /* ShelfImageRenderer.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {i['fr_shelf']} /* ShelfImageRenderer.swift */; }};
\t\t{i['embed_build']} /* EstateOSTopShelf.appex in Embed App Extensions */ = {{isa = PBXBuildFile; fileRef = {i['ext_product']} /* EstateOSTopShelf.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};
\t\t{i['bf_tvservices_app']} /* TVServices.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {i['fr_tvservices']} /* TVServices.framework */; }};
\t\t{i['bf_tvservices_ext']} /* TVServices.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {i['fr_tvservices']} /* TVServices.framework */; }};
"""
    text = text.replace("/* End PBXBuildFile section */", build_files + "\t\t/* End PBXBuildFile section */")
    file_refs = f"""
\t\t{i['ext_product']} /* EstateOSTopShelf.appex */ = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = EstateOSTopShelf.appex; sourceTree = BUILT_PRODUCTS_DIR; }};
\t\t{i['fr_content']} /* ContentProvider.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentProvider.swift; sourceTree = "<group>"; }};
\t\t{i['fr_shelf']} /* ShelfImageRenderer.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ShelfImageRenderer.swift; sourceTree = "<group>"; }};
\t\t{i['fr_info']} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};
\t\t{i['fr_ent']} /* EstateOSTopShelf.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = EstateOSTopShelf.entitlements; sourceTree = "<group>"; }};
\t\t{i['fr_ent_sim']} /* EstateOSTopShelf-Simulator.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = "EstateOSTopShelf-Simulator.entitlements"; sourceTree = "<group>"; }};
\t\t{i['fr_tvservices']} /* TVServices.framework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = TVServices.framework; path = System/Library/Frameworks/TVServices.framework; sourceTree = SDKROOT; }};
"""
    text = text.replace("/* End PBXFileReference section */", file_refs + "\t\t/* End PBXFileReference section */")
    text = text.replace("\t\t\tfiles = (\n\t\t\t);", "\t\t\tfiles = (\n\t\t\t\t" + i['bf_tvservices_app'] + " /* TVServices.framework in Frameworks */,\n\t\t\t);", 1)
    ext_frameworks = f"""
\t\t{i['ext_frameworks']} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{i['bf_tvservices_ext']} /* TVServices.framework in Frameworks */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
    text = text.replace("/* End PBXFrameworksBuildPhase section */", ext_frameworks + "\t\t/* End PBXFrameworksBuildPhase section */")
    ext_group = f"""
\t\t{i['ext_group']} /* EstateOSTopShelf */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t{i['fr_content']} /* ContentProvider.swift */,
\t\t\t\t{i['fr_shelf']} /* ShelfImageRenderer.swift */,
\t\t\t\t{i['fr_info']} /* Info.plist */,
\t\t\t\t{i['fr_ent']} /* EstateOSTopShelf.entitlements */,
\t\t\t\t{i['fr_ent_sim']} /* EstateOSTopShelf-Simulator.entitlements */,
\t\t\t);
\t\t\tpath = EstateOSTopShelf;
\t\t\tsourceTree = "<group>";
\t\t}};
"""
    text = text.replace("\t\t\t\t720A3E9177DB4F30B495B8EF /* EstateOS */,\n\t\t\t\t3B97D9C97B6149CF92EC6CDF /* Products */,",
                        "\t\t\t\t720A3E9177DB4F30B495B8EF /* EstateOS */,\n\t\t\t\t" + i['ext_group'] + " /* EstateOSTopShelf */,\n\t\t\t\t3B97D9C97B6149CF92EC6CDF /* Products */,")
    text = text.replace("/* End PBXGroup section */", ext_group + "\t\t/* End PBXGroup section */")
    text = text.replace("\t\t\t\t5E4D8575F4164289BB62E555 /* EstateOS.app */,\n\t\t\t);",
                        "\t\t\t\t5E4D8575F4164289BB62E555 /* EstateOS.app */,\n\t\t\t\t" + i['ext_product'] + " /* EstateOSTopShelf.appex */,\n\t\t\t);")
    embed_phase = f"""
\t\t{i['embed_phase']} /* Embed App Extensions */ = {{
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 16;
\t\t\tfiles = (
\t\t\t\t{i['embed_build']} /* EstateOSTopShelf.appex in Embed App Extensions */,
\t\t\t);
\t\t\tname = "Embed App Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
    text = text.replace("/* Begin PBXResourcesBuildPhase section */",
                        "/* Begin PBXCopyFilesBuildPhase section */" + embed_phase + "\t\t/* End PBXCopyFilesBuildPhase section */\n\n/* Begin PBXResourcesBuildPhase section */")
    ext_target = f"""
\t\t{i['ext_target']} /* EstateOSTopShelf */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {i['ext_config_list']} /* Build configuration list for PBXNativeTarget "EstateOSTopShelf" */;
\t\t\tbuildPhases = (
\t\t\t\t{i['ext_sources']} /* Sources */,
\t\t\t\t{i['ext_frameworks']} /* Frameworks */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = EstateOSTopShelf;
\t\t\tproductName = EstateOSTopShelf;
\t\t\tproductReference = {i['ext_product']} /* EstateOSTopShelf.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t}};
"""
    text = text.replace("/* End PBXNativeTarget section */", ext_target + "\t\t/* End PBXNativeTarget section */")
    text = text.replace("\t\t\t\t641E00C84CC14B519761E76B /* Resources */,\n\t\t\t);",
                        "\t\t\t\t641E00C84CC14B519761E76B /* Resources */,\n\t\t\t\t" + i['embed_phase'] + " /* Embed App Extensions */,\n\t\t\t);")
    text = text.replace("\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = EstateOS;",
                        "\t\t\tdependencies = (\n\t\t\t\t" + i['dep_target'] + " /* PBXTargetDependency */,\n\t\t\t);\n\t\t\tname = EstateOS;")
    text = text.replace("\t\t\t\ttargets = (\n\t\t\t\tAAFB9280618C4171AB8C35D8 /* EstateOS */,\n\t\t\t);",
                        "\t\t\t\ttargets = (\n\t\t\t\tAAFB9280618C4171AB8C35D8 /* EstateOS */,\n\t\t\t\t" + i['ext_target'] + " /* EstateOSTopShelf */,\n\t\t\t);")
    ext_sources = f"""
\t\t{i['ext_sources']} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{i['bf_content']} /* ContentProvider.swift in Sources */,
\t\t\t\t{i['bf_shelf']} /* ShelfImageRenderer.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
"""
    text = text.replace("/* End PBXSourcesBuildPhase section */", ext_sources + "\t\t/* End PBXSourcesBuildPhase section */")
    dep_section = f"""
/* Begin PBXContainerItemProxy section */
\t\t{i['dep_proxy']} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 61C7E5D900E44E96BCE68C71 /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {i['ext_target']};
\t\t\tremoteInfo = EstateOSTopShelf;
\t\t}};
/* End PBXContainerItemProxy section */

/* Begin PBXTargetDependency section */
\t\t{i['dep_target']} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {i['ext_target']} /* EstateOSTopShelf */;
\t\t\ttargetProxy = {i['dep_proxy']} /* PBXContainerItemProxy */;
\t\t}};
/* End PBXTargetDependency section */

"""
    text = text.replace("/* Begin PBXProject section */", dep_section + "/* Begin PBXProject section */")
    ent = "\t\t\t\tCODE_SIGN_ENTITLEMENTS = EstateOS/Resources/EstateOS.entitlements;\n\t\t\t\t\"CODE_SIGN_ENTITLEMENTS[sdk=appletvsimulator*]\" = \"EstateOS/Resources/EstateOS-Simulator.entitlements\";\n"
    for mid in ("43E786C6CF10491FB559DD0F /* Debug */", "25C52440F4024401834C78BC /* Release */"):
        text = text.replace(f"\t\t{mid} = {{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {{\n\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = \"App Icon & Top Shelf Image\";",
                            f"\t\t{mid} = {{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {{\n\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = \"App Icon & Top Shelf Image\";\n" + ent)
    ext_debug = f"""
\t\t{i['ext_debug']} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tCODE_SIGN_ENTITLEMENTS = EstateOSTopShelf/EstateOSTopShelf.entitlements;
\t\t\t\t"CODE_SIGN_ENTITLEMENTS[sdk=appletvsimulator*]" = "EstateOSTopShelf/EstateOSTopShelf-Simulator.entitlements";
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=appletvos*]" = "iPhone Distribution";
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\tCURRENT_PROJECT_VERSION = 2;
\t\t\t\tDEVELOPMENT_TEAM = "";
\t\t\t\t"DEVELOPMENT_TEAM[sdk=appletvos*]" = NW3YW69KL9;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = EstateOSTopShelf/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks");
\t\t\t\tMARKETING_VERSION = 1.3;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = pl.estateos.app.EstateOSTopShelf;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "";
\t\t\t\t"PROVISIONING_PROFILE_SPECIFIER[sdk=appletvos*]" = "EstateOS-tvOS-TopShelf-AppStore";
\t\t\t\tSDKROOT = appletvos;
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 3;
\t\t\t\tTVOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t}};
\t\t\tname = Debug;
\t\t}};
"""
    ext_release = ext_debug.replace(i['ext_debug'], i['ext_release']).replace("name = Debug;", "name = Release;")
    ext_config_list = f"""
\t\t{i['ext_config_list']} /* Build configuration list for PBXNativeTarget "EstateOSTopShelf" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{i['ext_debug']} /* Debug */,
\t\t\t\t{i['ext_release']} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
"""
    text = text.replace("/* End XCBuildConfiguration section */", ext_debug + ext_release + "\t\t/* End XCBuildConfiguration section */")
    text = text.replace("/* End XCConfigurationList section */", ext_config_list + "\t\t/* End XCConfigurationList section */")
    return text

def patch_scheme():
    scheme = SCHEME.read_text(encoding="utf-8")
    if IDS["ext_target"] in scheme:
        return
    ext_entry = f"""         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{IDS['ext_target']}"
               BuildableName = "EstateOSTopShelf.appex"
               BlueprintName = "EstateOSTopShelf"
               ReferencedContainer = "container:EstateOS.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
"""
    scheme = scheme.replace("      </BuildActionEntries>", ext_entry + "      </BuildActionEntries>", 1)
    SCHEME.write_text(scheme, encoding="utf-8")

text = PBX.read_text(encoding="utf-8")
new_text = patch_pbxproj(text)
PBX.write_text(new_text, encoding="utf-8")
patch_scheme()
print("Patched pbxproj and scheme")
