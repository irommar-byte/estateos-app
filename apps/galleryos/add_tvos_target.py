#!/usr/bin/env python3
"""Adds the GalleryOSTV (Apple TV) target and the new shared files to the hand-maintained
GalleryOS(TM).xcodeproj. Safe to run again: it exits when the target is already there."""
import re
import sys
from pathlib import Path

import tvos_project

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT / "GalleryOS\u2122.xcodeproj"
PBX = PROJECT / "project.pbxproj"

NEW_IOS_FILES = ["Core/AppleTVLink.swift", "Views/AppleTVSheet.swift"]
NEW_TEST_FILES = ["AppleTVLinkTests.swift", "TVCatalogTests.swift"]

text = PBX.read_text(encoding="utf-8")
if "GalleryOSTV" in text:
    print("GalleryOSTV already present, nothing to do")
    sys.exit(0)


def insert_before(marker: str, new_lines, text: str) -> str:
    assert marker in text, marker
    block = "\n".join(new_lines) + "\n"
    return text.replace(marker, block + marker, 1)


def file_ref(rel: str) -> str:
    match = re.search(r"\n\t\t([0-9A-F]{24}) /\* " + re.escape(rel) + r" \*/ = \{isa = PBXFileReference", text)
    if not match:
        raise SystemExit(f"no file reference for {rel}")
    return match.group(1)


# 1. new iOS and test files (only those that exist) -------------------------------------------
new_ios = []
new_tests = []
for rel in NEW_IOS_FILES:
    if (ROOT / "GalleryOS" / rel).exists() and f"/* {rel} */" not in text:
        new_ios.append((rel, tvos_project.gid(), tvos_project.gid()))
for rel in NEW_TEST_FILES:
    if (ROOT / "GalleryOSTests" / rel).exists() and f"/* {rel} */" not in text:
        new_tests.append((rel, tvos_project.gid(), tvos_project.gid()))

for rel, ref, bf in new_ios + new_tests:
    text = insert_before(
        "/* End PBXBuildFile section */",
        [f"\t\t{bf} /* {rel} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref} /* {rel} */; }};"],
        text,
    )
    text = insert_before(
        "/* End PBXFileReference section */",
        [f"\t\t{ref} /* {rel} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {tvos_project.q(rel)}; sourceTree = \"<group>\"; }};"],
        text,
    )

# children of the GalleryOS group and the tests group
brand = file_ref("Core/Brand.swift")
for rel, ref, bf in new_ios:
    text = text.replace(f"\t\t\t\t{brand} /* Core/Brand.swift */,\n", f"\t\t\t\t{brand} /* Core/Brand.swift */,\n\t\t\t\t{ref} /* {rel} */,\n", 1)
catalog_tests = file_ref("GalleryCatalogTests.swift")
for rel, ref, bf in new_tests:
    text = text.replace(f"\t\t\t\t{catalog_tests} /* GalleryCatalogTests.swift */,\n", f"\t\t\t\t{catalog_tests} /* GalleryCatalogTests.swift */,\n\t\t\t\t{ref} /* {rel} */,\n", 1)

# sources phases: the one that lists Core/Brand.swift is the app, the one with GalleryCatalogTests the tests
brand_bf = re.search(r"\n\t\t\t\t([0-9A-F]{24}) /\* Core/Brand.swift in Sources \*/,", text).group(1)
for rel, ref, bf in new_ios:
    text = text.replace(
        f"\t\t\t\t{brand_bf} /* Core/Brand.swift in Sources */,\n",
        f"\t\t\t\t{brand_bf} /* Core/Brand.swift in Sources */,\n\t\t\t\t{bf} /* {rel} in Sources */,\n",
        1,
    )
tests_bf = re.search(r"\n\t\t\t\t([0-9A-F]{24}) /\* GalleryCatalogTests.swift in Sources \*/,", text).group(1)
for rel, ref, bf in new_tests:
    text = text.replace(
        f"\t\t\t\t{tests_bf} /* GalleryCatalogTests.swift in Sources */,\n",
        f"\t\t\t\t{tests_bf} /* GalleryCatalogTests.swift in Sources */,\n\t\t\t\t{bf} /* {rel} in Sources */,\n",
        1,
    )

# 2. the tvOS target -----------------------------------------------------------------------------
shared = {}
for path in tvos_project.SHARED_FILES:
    rel = path.removeprefix("GalleryOS/")
    if rel == "Core/AppleTVLink.swift":
        shared[path] = next(ref for r, ref, _ in new_ios if r == rel) if new_ios else file_ref(rel)
    else:
        shared[path] = file_ref(rel)

ids, sections = tvos_project.build(shared)

for name in [
    "PBXBuildFile", "PBXFileReference", "PBXFrameworksBuildPhase", "PBXGroup", "PBXNativeTarget",
    "PBXResourcesBuildPhase", "PBXSourcesBuildPhase", "XCBuildConfiguration", "XCConfigurationList",
]:
    text = insert_before(f"/* End {name} section */", sections[name], text)

# iOS app also compiles the pure TV logic so it can be tested on iOS
ios_lines = [l for l in sections["PBXBuildFile"] if "(iOS)" in l]
for line in ios_lines:
    bf = line.split()[0]
    text = text.replace(
        f"\t\t\t\t{brand_bf} /* Core/Brand.swift in Sources */,\n",
        f"\t\t\t\t{brand_bf} /* Core/Brand.swift in Sources */,\n\t\t\t\t{bf} /* {line.split('/*')[1].split('*/')[0].strip()} */,\n",
        1,
    )

# products group, main group, project targets
products = re.search(r"\n\t\t([0-9A-F]{24}) /\* Products \*/ = \{\n\t\t\tisa = PBXGroup;", text).group(1)
widget_product = re.search(r"\n\t\t\t\t([0-9A-F]{24}) /\* GalleryOSWidget.appex \*/,\n\t\t\t\);\n\t\t\tname = Products;", text).group(1)
text = text.replace(
    f"\t\t\t\t{widget_product} /* GalleryOSWidget.appex */,\n\t\t\t);\n\t\t\tname = Products;",
    f"\t\t\t\t{widget_product} /* GalleryOSWidget.appex */,\n\t\t\t\t{ids['product']} /* GalleryOSTV.app */,\n\t\t\t);\n\t\t\tname = Products;",
    1,
)
text = text.replace(
    f"\t\t\t\t{products} /* Products */,\n\t\t\t);\n\t\t\tsourceTree = \"<group>\";",
    f"\t\t\t\t{ids['group']} /* GalleryOSTV */,\n\t\t\t\t{products} /* Products */,\n\t\t\t);\n\t\t\tsourceTree = \"<group>\";",
    1,
)
targets = re.search(r"\t\t\ttargets = \(\n((?:\t\t\t\t[^\n]+\n)+)\t\t\t\);", text)
text = text.replace(
    targets.group(0),
    targets.group(0).replace("\t\t\t);", f"\t\t\t\t{ids['target']} /* GalleryOSTV */,\n\t\t\t);"),
    1,
)

PBX.write_text(text, encoding="utf-8")

schemes = PROJECT / "xcshareddata" / "xcschemes"
schemes.mkdir(parents=True, exist_ok=True)
(schemes / "GalleryOSTV.xcscheme").write_text(
    tvos_project.scheme(ids["target"], PROJECT.name), encoding="utf-8"
)
print("Added GalleryOSTV to", PBX.name)
