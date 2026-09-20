import Foundation

actor ShazamOutbox {
    static let shared = ShazamOutbox()

    private var items: [PendingShazamAdd] = []
    private var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return dir.appendingPathComponent("shazam-outbox.json")
    }

    init() {
        items = (try? JSONDecoder().decode([PendingShazamAdd].self, from: Data(contentsOf: url))) ?? []
    }

    func enqueue(_ item: PendingShazamAdd) throws {
        if items.contains(where: { $0.id == item.id }) { return }
        items.append(item)
        try persist()
    }

    func pending() -> [PendingShazamAdd] {
        items
    }

    func remove(_ id: String) throws {
        items.removeAll { $0.id == id }
        try persist()
    }

    private func persist() throws {
        let data = try JSONEncoder().encode(items)
        try data.write(to: url, options: .atomic)
    }
}
