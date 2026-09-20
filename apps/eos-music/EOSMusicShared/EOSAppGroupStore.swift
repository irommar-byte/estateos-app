import Foundation

actor EOSAppGroupStore {
    static let shared = EOSAppGroupStore()

    private var overrideDirectory: URL?
    private var writeGeneration = 0

    func setOverrideDirectory(_ url: URL?) {
        overrideDirectory = url
    }

    func directoryURL() -> URL? {
        if let overrideDirectory { return overrideDirectory }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: EOSAppGroup.identifier)
    }

    func snapshotURL() -> URL? {
        directoryURL()?.appendingPathComponent(EOSAppGroup.snapshotFileName)
    }

    func load() -> EOSControlSnapshot {
        guard let url = snapshotURL(),
              let data = try? Data(contentsOf: url) else {
            return .empty
        }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let decoded = try decoder.decode(EOSControlSnapshot.self, from: data)
            if decoded.schemaVersion != EOSAppGroup.schemaVersion {
                return migrate(decoded)
            }
            return decoded
        } catch {
            EOSLog.controlIntent.error("snapshot decode failed")
            return .empty
        }
    }

    func save(_ snapshot: EOSControlSnapshot) throws {
        guard let directory = directoryURL() else {
            throw EOSAppGroupStoreError.containerUnavailable
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent(EOSAppGroup.snapshotFileName)
        writeGeneration += 1
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(snapshot)
        let temp = url.appendingPathExtension("tmp-\(writeGeneration)")
        try data.write(to: temp, options: .atomic)
        if FileManager.default.fileExists(atPath: url.path) {
            _ = try FileManager.default.replaceItemAt(url, withItemAt: temp)
        } else {
            try FileManager.default.moveItem(at: temp, to: url)
        }
    }

    private func migrate(_ snapshot: EOSControlSnapshot) -> EOSControlSnapshot {
        var next = snapshot
        next.schemaVersion = EOSAppGroup.schemaVersion
        return next
    }
}

enum EOSAppGroupStoreError: Error {
    case containerUnavailable
}

enum EOSControlSnapshotReader {
    static func load() -> EOSControlSnapshot {
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: EOSAppGroup.identifier)?
            .appendingPathComponent(EOSAppGroup.snapshotFileName),
              let data = try? Data(contentsOf: url)
        else {
            return .empty
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let decoded = try? decoder.decode(EOSControlSnapshot.self, from: data) else {
            return .empty
        }
        return decoded
    }
}
