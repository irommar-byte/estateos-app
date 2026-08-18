import Foundation

/// Precomputed library projections — avoids O(n log n) / O(n²) work in SwiftUI bodies.
struct LibraryAlphabetSection<Item: Identifiable>: Identifiable, Equatable where Item: Equatable {
    let key: String
    let items: [Item]
    var id: String { key }
}

enum LibrarySnapshotBuilder {
    static func alphabetSections<Item: Identifiable>(
        from items: [Item],
        name: (Item) -> String
    ) -> [LibraryAlphabetSection<Item>] where Item: Equatable {
        EOSPerfLog.measure("LibraryAlphabet.group") {
            LibraryAlphabet.group(items, name: name).map {
                LibraryAlphabetSection(key: $0.key, items: $0.items)
            }
        }
    }

    static func displayIndices<Item>(
        sections: [LibraryAlphabetSection<Item>]
    ) -> [Item.ID: Int] where Item: Identifiable {
        var map: [Item.ID: Int] = [:]
        var global = 0
        for section in sections {
            for item in section.items {
                global += 1
                map[item.id] = global
            }
        }
        return map
    }
}
