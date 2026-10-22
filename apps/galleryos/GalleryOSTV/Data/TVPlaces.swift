import CoreLocation
import MapKit
import Foundation

/// Names for photo locations, resolved lazily (a few kilometres per cluster) and cached on disk.
final class TVPlaces: @unchecked Sendable {
    private let file: URL
    private let lock = NSLock()
    private var names: [String: String]
    private var clusterOf: [String: String] = [:]
    private var folded: [String: String] = [:]
    private var running = false

    init(folder: URL) {
        file = folder.appendingPathComponent("places.json")
        if let data = try? Data(contentsOf: file),
           let stored = try? JSONDecoder().decode([String: String].self, from: data) {
            names = stored
        } else {
            names = [:]
        }
    }

    static func key(_ latitude: Double, _ longitude: Double) -> String {
        TVCatalog.cellKey(latitude, longitude)
    }

    func name(latitude: Double, longitude: Double) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return names[Self.key(latitude, longitude)]
    }

    func allNames() -> [String: String] {
        lock.withLock { names }
    }

    /// Fixed names for the layout preview; nothing is geocoded.
    func seed(_ values: [String: String]) {
        lock.withLock { names.merge(values) { _, new in new } }
    }

    func blob() -> [String: String] {
        lock.lock()
        defer { lock.unlock() }
        return folded
    }

    func index(_ photos: [PhotoRef], changed: @escaping @Sendable () -> Void) {
        var clusters: [String: (count: Int, latitude: Double, longitude: Double)] = [:]
        var mapping: [String: String] = [:]
        for photo in photos {
            guard let latitude = photo.latitude, let longitude = photo.longitude, let hash = photo.cloudHash else { continue }
            let key = Self.key(latitude, longitude)
            mapping[hash] = key
            let current = clusters[key]
            clusters[key] = ((current?.count ?? 0) + 1, latitude, longitude)
        }
        lock.lock()
        clusterOf = mapping
        refreshFolded()
        let shouldStart = !running
        if shouldStart { running = true }
        let pending = clusters.filter { names[$0.key] == nil }.sorted { $0.value.count > $1.value.count }
        lock.unlock()
        guard shouldStart else { return }
        Task.detached(priority: .background) { [self] in
            await resolve(pending.prefix(300).map { ($0.key, $0.value.latitude, $0.value.longitude) }, changed: changed)
            finish()
        }
    }

    private func finish() {
        lock.withLock { running = false }
    }

    private func remember(_ key: String, _ name: String) {
        lock.withLock {
            names[key] = name
            refreshFolded()
        }
    }

    private func refreshFolded() {
        var result: [String: String] = [:]
        for (hash, key) in clusterOf {
            if let name = names[key] { result[hash] = TVSearch.fold(name) }
        }
        folded = result
    }

    private func resolve(_ pending: [(String, Double, Double)], changed: @escaping @Sendable () -> Void) async {
        var sinceSave = 0
        for (key, latitude, longitude) in pending {
            if Task.isCancelled { break }
            let location = CLLocation(latitude: latitude, longitude: longitude)
            let parts: [String]
            if #available(tvOS 26.0, *) {
                parts = await Self.modernParts(location)
            } else if let marks = try? await CLGeocoder().reverseGeocodeLocation(location), let mark = marks.first {
                parts = [mark.locality, mark.administrativeArea].compactMap { $0 }.filter { !$0.isEmpty }
            } else {
                parts = []
            }
            if !parts.isEmpty {
                remember(key, parts.joined(separator: ", "))
                sinceSave += 1
                if sinceSave % 10 == 0 { save(); changed() }
            }
            try? await Task.sleep(nanoseconds: 1_300_000_000)
        }
        save()
        changed()
    }

    @available(tvOS 26.0, *)
    private static func modernParts(_ location: CLLocation) async -> [String] {
        guard let request = MKReverseGeocodingRequest(location: location) else { return [] }
        request.preferredLocale = Localization.locale
        guard let item = try? await request.mapItems.first, let address = item.addressRepresentations else { return [] }
        return [address.cityName, address.regionName].compactMap { $0 }.filter { !$0.isEmpty }
    }

    private func save() {
        lock.lock()
        let snapshot = names
        lock.unlock()
        if let data = try? JSONEncoder().encode(snapshot) {
            try? FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? data.write(to: file, options: .atomic)
        }
    }
}
