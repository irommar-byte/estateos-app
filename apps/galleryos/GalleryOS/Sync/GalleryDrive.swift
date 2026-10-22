import Foundation
import ImageIO
import SwiftUI
import UIKit

/// What one pendrive does for the library, remembered between plugs.
struct DriveProfile: Codable, Equatable {
    var id: String
    /// A full copy of the server library, in the server's own format: a portable GalleryOS server.
    var mirror = true
    /// Copies what is new by itself whenever the pendrive is plugged in.
    var autoCopy = true
    var lastCopy: Date?
    var photos = 0
    var bytes: Int64 = 0
}

struct DriveSpace: Equatable {
    var free: Int64
    var total: Int64
    var format: String?
}

/// What the wizard learns about a freshly chosen pendrive.
struct DriveInspection: Equatable {
    var name: String
    var space: DriveSpace?
    var writable: Bool
    /// Photos already in a GalleryOS library on it (a pendrive used before, or by another device).
    var existingPhotos: Int
}

/// One copy job on a pendrive, as the console and the hub show it.
struct DriveJob: Equatable {
    var driveID: String
    var done = 0
    var total = 0
    var copiedFiles = 0
    var copiedBytes: Int64 = 0
    var stage: String
    var finished = false
    var failure: String?

    var fraction: Double { total > 0 ? min(1, Double(done) / Double(total)) : 0 }
}

/// Pendrives as part of the library: each one remembered by its bookmark, noticed the moment it is
/// plugged in, and kept as an exact copy of the server catalog (journals, previews, originals,
/// byte for byte, encrypted where the server's files are). Because the layout is the server's own,
/// the pendrive is a portable GalleryOS server: it opens as a library of its own anywhere.
@MainActor
final class DriveCenter: ObservableObject {
    static let shared = DriveCenter()

    @Published private(set) var profiles: [String: DriveProfile] = [:]
    @Published private(set) var present: Set<String> = []
    @Published private(set) var spaces: [String: DriveSpace] = [:]
    @Published private(set) var job: DriveJob?
    /// Bumped when a pendrive is plugged in, for the console's "it lit up" moment.
    @Published private(set) var arrivals = 0

    private let profileKey = "galleryos.drives.profiles"
    private var watcher: Task<Void, Never>?
    private var copyTask: Task<Void, Never>?
    private var checkedOnce = false

    private init() {
        if let data = UserDefaults.standard.data(forKey: profileKey),
           let stored = try? JSONDecoder().decode([String: DriveProfile].self, from: data) {
            profiles = stored
        }
        // A pendrive used to replace the server as the copy target. It never received anything
        // the server already had. From now on it is a mirror next to the server.
        SpareDisks.shared.selectServer()
    }

    var drives: [SpareDisk] { SpareDisks.shared.disks }

    /// The pendrive the console shows: the one plugged in now, else the last one added.
    var current: SpareDisk? {
        drives.last { present.contains($0.id) } ?? drives.last
    }

    func profile(_ id: String) -> DriveProfile {
        profiles[id] ?? DriveProfile(id: id)
    }

    func update(_ profile: DriveProfile) {
        profiles[profile.id] = profile
        persist()
    }

    var copying: Bool { job.map { !$0.finished && $0.failure == nil } ?? false }

    /// How much a full copy of the server library takes.
    func librarySize() -> Int64 {
        LibraryEngine.shared.mirrorCatalog().reduce(Int64(0)) { sum, asset in
            sum + asset.resources.reduce(Int64(0)) { $0 + Int64($1.bytes) }
        }
    }

    // MARK: Noticing a pendrive

    /// Watches for pendrives while the app is on screen. Cheap: one look every few seconds.
    func setActive(_ active: Bool) {
        if active {
            guard watcher == nil else { return }
            watcher = Task { @MainActor [weak self] in
                while !Task.isCancelled {
                    self?.check()
                    try? await Task.sleep(for: .seconds(4))
                }
            }
        } else {
            watcher?.cancel()
            watcher = nil
        }
    }

    func check() {
        var now = Set<String>()
        for drive in drives {
            guard let url = Self.resolve(drive.bookmark) else { continue }
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            if (try? url.checkResourceIsReachable()) == true {
                now.insert(drive.id)
                spaces[drive.id] = Self.space(of: url)
            }
        }
        let arrived = now.subtracting(present)
        if now != present {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { present = now }
        }
        defer { checkedOnce = true }
        guard checkedOnce, !arrived.isEmpty else { return }
        arrivals += 1
        for id in arrived {
            guard let drive = drives.first(where: { $0.id == id }) else { continue }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            let profile = profile(id)
            let starts = profile.mirror && profile.autoCopy && LibraryEngine.shared.serverReady
            ServerLink.shared.announce(
                L("Pendrive \(drive.name) podłączony"),
                detail: starts ? L("Dociągam kopię biblioteki…") : L("Biblioteka USB jest gotowa"),
                symbol: "mediastick",
                tint: .orange
            )
            if starts { copy(id) }
        }
    }

    // MARK: Adding and forgetting

    /// What is on the chosen folder: its name, space, format, and a GalleryOS library already there.
    func inspect(_ url: URL) async -> DriveInspection {
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        let name = (try? url.resourceValues(forKeys: [.volumeNameKey]).volumeName) ?? url.lastPathComponent
        let probe = url.appendingPathComponent(".galleryos-probe")
        let writable = (try? Data("ok".utf8).write(to: probe)) != nil
        try? FileManager.default.removeItem(at: probe)
        let existing = await Self.countPhotos(in: url)
        return DriveInspection(name: name, space: Self.space(of: url), writable: writable, existingPhotos: existing)
    }

    @discardableResult
    func add(bookmark: Data, name: String, mirror: Bool, autoCopy: Bool) -> String {
        let id = SpareDisks.shared.remember(data: bookmark, name: name)
        var profile = profile(id)
        profile.mirror = mirror
        profile.autoCopy = autoCopy
        update(profile)
        checkedOnce = false
        check()
        return id
    }

    func forget(_ id: String) {
        if job?.driveID == id { cancel() }
        SpareDisks.shared.forget(id)
        profiles[id] = nil
        present.remove(id)
        persist()
    }

    // MARK: The copy

    func copy(_ id: String) {
        guard copyTask == nil, let drive = drives.first(where: { $0.id == id }) else { return }
        copyTask = Task { @MainActor [weak self] in
            await self?.runCopy(drive)
            self?.copyTask = nil
        }
    }

    func cancel() {
        copyTask?.cancel()
        copyTask = nil
        if var job, !job.finished {
            job.failure = L("Zatrzymane. Następnym razem dokończę od tego miejsca.")
            self.job = job
        }
    }

    private func runCopy(_ disk: SpareDisk) async {
        job = DriveJob(driveID: disk.id, stage: L("Łączę się z serwerem…"))
        var drive: FolderTransport?
        var server: CatalogTransport?
        do {
            let opened = try FolderTransport.resolve(bookmark: disk.bookmark)
            drive = opened
            try await opened.open()
            let source = try await LibraryEngine.shared.openSideTransport()
            server = source
            let assets = LibraryEngine.shared.mirrorCatalog()
            job?.total = assets.count
            job?.stage = L("Kopiuję oryginały")
            var missing = 0
            var stored: Int64 = 0
            for (index, asset) in assets.enumerated() {
                try Task.checkCancellation()
                var files: [(String, Int)] = [(CatalogPaths.thumb(hash: asset.hash), 0)]
                for resource in asset.resources {
                    files.append((CatalogPaths.original(hash: resource.hash, ext: resource.ext), resource.bytes))
                }
                for (path, expected) in files {
                    if let have = try await opened.byteCount(path), have > 0, expected <= 0 || have == expected {
                        stored += Int64(have)
                        continue
                    }
                    do {
                        let written = try await Self.copyFile(path, from: source, to: opened)
                        stored += written
                        job?.copiedFiles += 1
                        job?.copiedBytes += written
                    } catch is CancellationError {
                        throw CancellationError()
                    } catch {
                        // A preview the server never made, or one file that will not come: the
                        // rest still goes. The next copy tries it again.
                        missing += 1
                    }
                }
                job?.done = index + 1
            }
            job?.stage = L("Zapisuję katalog")
            for name in try await source.list(CatalogPaths.state) where name.hasPrefix("journal-") {
                let path = "\(CatalogPaths.state)/\(name)"
                _ = try? await Self.copyFile(path, from: source, to: opened)
            }
            var profile = profile(disk.id)
            profile.lastCopy = .now
            profile.photos = assets.count
            profile.bytes = stored
            update(profile)
            job?.stage = missing > 0
                ? L("Gotowe. \(PhotoFormat.grouped(missing)) plików dojdzie przy następnej kopii.")
                : L("Gotowe. Pendrive to pełna kopia biblioteki.")
            job?.finished = true
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            ServerLink.shared.announce(L("Kopia na pendrive gotowa"), detail: disk.name, symbol: "checkmark", tint: .orange)
        } catch is CancellationError {
            job?.failure = L("Zatrzymane. Następnym razem dokończę od tego miejsca.")
        } catch {
            job?.failure = SyncPause.message(for: error)
        }
        if let server { await server.close() }
        if let drive { await drive.close() }
        if let url = Self.resolve(disk.bookmark) {
            let accessing = url.startAccessingSecurityScopedResource()
            spaces[disk.id] = Self.space(of: url)
            if accessing { url.stopAccessingSecurityScopedResource() }
        }
    }

    /// One file from the server straight to the pendrive: films go to disk in pieces, never whole
    /// into memory.
    private static func copyFile(_ path: String, from server: CatalogTransport, to drive: CatalogTransport) async throws -> Int64 {
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent("drive-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: temp) }
        if let streaming = server as? StreamingTransport, let target = streaming.streamTarget(path) {
            var request = URLRequest(url: target.url)
            for (field, value) in target.headers { request.setValue(value, forHTTPHeaderField: field) }
            let response = try await GalleryNetwork.shared.download(for: request, to: temp)
            guard (200..<300).contains(response.statusCode) else {
                throw LibraryError(message: L("Serwer nie oddał pliku."))
            }
        } else {
            let data = try await server.readFile(path)
            try data.write(to: temp)
        }
        try await drive.writeFile(path, from: temp)
        let size = (try? FileManager.default.attributesOfItem(atPath: temp.path)[.size] as? NSNumber)?.int64Value ?? 0
        return size
    }

    // MARK: Helpers

    private func persist() {
        if let data = try? JSONEncoder().encode(profiles) {
            UserDefaults.standard.set(data, forKey: profileKey)
        }
    }

    static func resolve(_ bookmark: Data) -> URL? {
        var stale = false
        return try? URL(resolvingBookmarkData: bookmark, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
    }

    static func space(of url: URL) -> DriveSpace? {
        let keys: Set<URLResourceKey> = [.volumeAvailableCapacityKey, .volumeTotalCapacityKey, .volumeLocalizedFormatDescriptionKey]
        guard let values = try? url.resourceValues(forKeys: keys),
              let total = values.volumeTotalCapacity, total > 0 else { return nil }
        return DriveSpace(free: Int64(values.volumeAvailableCapacity ?? 0), total: Int64(total),
                          format: values.volumeLocalizedFormatDescription)
    }

    /// Photos in a GalleryOS library on this folder (0 when there is none).
    static func countPhotos(in url: URL) async -> Int {
        let state = url.appendingPathComponent(CatalogPaths.state, isDirectory: true)
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: state.path) else { return 0 }
        var lines: [JournalLine] = []
        for name in names where name.hasPrefix("journal-") {
            guard let raw = try? Data(contentsOf: state.appendingPathComponent(name)) else { continue }
            lines += JournalCodec.decode(VaultCrypto.open(raw) ?? raw)
        }
        return LibraryRules.merge(lines).values.filter { $0.deletedAt == nil }.count
    }
}

// MARK: The library on a pendrive

/// A pendrive opened as a library of its own, read exactly like the server.
@MainActor
final class DriveSession: ObservableObject {
    let drive: SpareDisk
    @Published private(set) var assets: [LibraryAsset] = []
    @Published private(set) var loading = true
    @Published private(set) var failure: String?
    private var transport: FolderTransport?
    private let thumbs = NSCache<NSString, UIImage>()

    init(drive: SpareDisk) {
        self.drive = drive
    }

    func open() async {
        loading = true
        do {
            let opened = try FolderTransport.resolve(bookmark: drive.bookmark)
            transport = opened
            var lines: [JournalLine] = []
            for name in try await opened.list(CatalogPaths.state) where name.hasPrefix("journal-") {
                let raw = try await opened.readFile("\(CatalogPaths.state)/\(name)")
                lines += JournalCodec.decode(VaultCrypto.open(raw) ?? raw)
            }
            let merged = LibraryRules.merge(lines).values.filter { asset in
                asset.deletedAt == nil && (!asset.hidden || GalleryOwner.owns(asset))
            }
            assets = merged.sorted { $0.created > $1.created }
            failure = nil
        } catch {
            failure = L("Nie mogę otworzyć pendrive’a. Podłącz go i spróbuj jeszcze raz.")
        }
        loading = false
    }

    func close() async {
        await transport?.close()
        transport = nil
    }

    func thumbnail(_ asset: LibraryAsset) async -> UIImage? {
        let key = asset.hash as NSString
        if let hit = thumbs.object(forKey: key) { return hit }
        guard let transport else { return nil }
        guard let raw = try? await transport.readFile(CatalogPaths.thumb(hash: asset.hash)),
              let image = UIImage(data: VaultCrypto.open(raw) ?? raw) else { return nil }
        thumbs.setObject(image, forKey: key)
        return image
    }

    /// The full photo, scaled for the screen.
    func picture(_ asset: LibraryAsset) async -> UIImage? {
        guard let transport, let primary = asset.primary else { return nil }
        let path = CatalogPaths.original(hash: primary.hash, ext: primary.ext)
        guard let raw = try? await transport.readFile(path) else { return nil }
        let data = VaultCrypto.open(raw) ?? raw
        return await Task.detached(priority: .userInitiated) {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 2600,
            ]
            guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
            return UIImage(cgImage: image)
        }.value
    }

    /// A film ready to play: straight from the pendrive, or opened into a temporary file when the
    /// server stores it sealed.
    func film(_ asset: LibraryAsset) async -> URL? {
        guard let transport, let primary = asset.primary,
              let url = transport.localURL(CatalogPaths.original(hash: primary.hash, ext: primary.ext)) else { return nil }
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        let head = (try? handle.read(upToCount: 8)) ?? Data()
        try? handle.close()
        guard VaultCrypto.isSealed(head) else { return url }
        guard let key = VaultCrypto.key else { return nil }
        let out = FileManager.default.temporaryDirectory.appendingPathComponent("usb-\(primary.hash).\(primary.ext)")
        if FileManager.default.fileExists(atPath: out.path) { return out }
        return await Task.detached(priority: .userInitiated) {
            (try? VaultCrypto.openFile(url, to: out, key: key)) != nil ? out : nil
        }.value
    }
}
