import Foundation

/// Photos newest first. `symbol` marks a media-type collection (Filmy, Live Photos…).
struct TVAlbum: Identifiable, Hashable {
    var id: String { name }
    let name: String
    let photos: [PhotoRef]
    var symbol: String? = nil

    /// Newest still picture, so a cover is never a black first video frame.
    var cover: PhotoRef { photos.first { !$0.traits.isVideo } ?? photos[0] }
    var newest: Date { photos.first?.created ?? .distantPast }
    var oldest: Date { photos.last?.created ?? .distantPast }

    static func == (lhs: TVAlbum, rhs: TVAlbum) -> Bool {
        lhs.name == rhs.name
            && lhs.photos.count == rhs.photos.count
            && lhs.photos.first?.id == rhs.photos.first?.id
            && lhs.photos.last?.id == rhs.photos.last?.id
    }
    func hash(into hasher: inout Hasher) {
        hasher.combine(name)
        hasher.combine(photos.count)
        hasher.combine(photos.first?.id)
    }
}

/// One spot on the map: a town once geocoded, otherwise a ~10 km square.
struct TVPlace: Identifiable, Hashable {
    let id: String
    let name: String?
    let latitude: Double
    let longitude: Double
    /// Newest first.
    let photos: [PhotoRef]

    var cover: PhotoRef { photos.first { !$0.traits.isVideo } ?? photos[0] }

    static func == (lhs: TVPlace, rhs: TVPlace) -> Bool {
        lhs.id == rhs.id && lhs.name == rhs.name && lhs.photos.count == rhs.photos.count
    }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct TVSnapshot: Sendable {
    var model: GridModel
    var albums: [TVAlbum]
    var mediaTypes: [TVAlbum]
    var favorites: [PhotoRef]
    var assets: [String: LibraryAsset]
    var blobs: [String: String]
    var videos: Int
}

/// Pure functions that turn journal lines into what the Apple TV screens show.
enum TVCatalog {
    /// Keeps the newest line per asset. Returns true when something changed.
    @discardableResult
    static func merge(_ incoming: [JournalLine], into lines: inout [String: JournalLine]) -> Bool {
        var changed = false
        for line in incoming where !line.asset.hash.isEmpty {
            let hash = line.asset.hash
            if let current = lines[hash], !isNewer(line, than: current) { continue }
            // Deleted for good stays deleted, whatever an older copy says later. Only a new upload
            // made after the purge brings the photo back.
            if let current = lines[hash], LibraryRules.isPurged(current.asset), !LibraryRules.isPurged(line.asset),
               (line.asset.uploadedAt ?? .distantPast) <= current.at { continue }
            lines[hash] = line
            changed = true
        }
        return changed
    }

    static func isNewer(_ lhs: JournalLine, than rhs: JournalLine) -> Bool {
        if lhs.at != rhs.at { return lhs.at > rhs.at }
        if lhs.device != rhs.device { return lhs.device > rhs.device }
        return lhs.seq > rhs.seq
    }

    /// Newest first. Every word has to match something about the photo.
    static func search(_ text: String, photos: [PhotoRef], blobs: [String: String], extra: [String: String]) -> [PhotoRef] {
        let tokens = TVSearch.tokens(text)
        guard !tokens.isEmpty else { return [] }
        let matched = photos.filter { photo in
            guard let hash = photo.cloudHash else { return false }
            let blob = (blobs[hash] ?? "") + " " + (extra[hash] ?? "")
            return tokens.allSatisfy { blob.contains($0) }
        }
        return Array(matched.reversed())
    }

    static func build(from list: [LibraryAsset]) -> TVSnapshot {
        let visible = list.filter { $0.deletedAt == nil && $0.primary != nil && !$0.hidden }
        var byHash: [String: LibraryAsset] = [:]
        for asset in visible { byHash[asset.hash] = asset }
        let photos = visible.map { $0.photoRef() }
        let model = GridModel(photos: photos)
        var albumBuckets: [String: [PhotoRef]] = [:]
        for asset in visible {
            for name in asset.albumNames where !name.isEmpty {
                albumBuckets[name, default: []].append(asset.photoRef())
            }
        }
        // Like Photos: the album that got a new picture most recently comes first.
        let albums = albumBuckets.map { name, items -> TVAlbum in
            TVAlbum(name: name, photos: items.sorted { $0.created > $1.created })
        }.sorted { lhs, rhs in
            if lhs.newest != rhs.newest { return lhs.newest > rhs.newest }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        let newestFirst = Array(model.all.reversed())
        let favorites = newestFirst.filter(\.isFavorite)
        var blobs: [String: String] = [:]
        blobs.reserveCapacity(visible.count)
        for asset in visible {
            blobs[asset.hash] = TVSearch.blob(for: asset)
        }
        return TVSnapshot(
            model: model,
            albums: albums,
            mediaTypes: mediaTypes(from: newestFirst),
            favorites: favorites,
            assets: byHash,
            blobs: blobs,
            videos: photos.filter { $0.traits.isVideo }.count
        )
    }

    /// The „Typy multimediów” row from Photos. Empty kinds are left out.
    static func mediaTypes(from newestFirst: [PhotoRef]) -> [TVAlbum] {
        let kinds: [(String, String, PhotoTraits)] = [
            (L("Filmy"), "video", .video),
            (L("Live Photos"), "livephoto", .live),
            (L("Portrety"), "cube", .portrait),
            (L("Selfie"), "person.crop.square", .selfie),
            (L("Panoramy"), "pano", .panorama),
            (L("Animowane"), "square.stack.3d.forward.dottedline", .animated),
            (L("Zrzuty ekranu"), "camera.viewfinder", .screenshot)
        ]
        return kinds.compactMap { name, symbol, trait in
            let items = newestFirst.filter { $0.traits.contains(trait) }
            return items.isEmpty ? nil : TVAlbum(name: name, photos: items, symbol: symbol)
        }
    }

    /// ~10 km square used for geocoding and map grouping.
    static func cellKey(_ latitude: Double, _ longitude: Double) -> String {
        String(format: "%.1f,%.1f", (latitude * 10).rounded() / 10, (longitude * 10).rounded() / 10)
    }

    /// Groups located photos by town (or ~10 km square until the town is known).
    static func places(from photos: [PhotoRef], names: [String: String]) -> [TVPlace] {
        struct Bucket { var latitude = 0.0, longitude = 0.0, photos: [PhotoRef] = [], name: String? }
        var buckets: [String: Bucket] = [:]
        for photo in photos {
            guard let latitude = photo.latitude, let longitude = photo.longitude,
                  abs(latitude) > 0.0001 || abs(longitude) > 0.0001 else { continue }
            let cell = cellKey(latitude, longitude)
            let name = names[cell]
            let key = name ?? cell
            var bucket = buckets[key] ?? Bucket(name: name)
            bucket.latitude += latitude
            bucket.longitude += longitude
            bucket.photos.append(photo)
            buckets[key] = bucket
        }
        return buckets.map { key, bucket in
            let count = Double(bucket.photos.count)
            return TVPlace(
                id: key,
                name: bucket.name,
                latitude: bucket.latitude / count,
                longitude: bucket.longitude / count,
                photos: bucket.photos.sorted { $0.created > $1.created }
            )
        }.sorted { lhs, rhs in
            if lhs.photos.count != rhs.photos.count { return lhs.photos.count > rhs.photos.count }
            return lhs.id < rhs.id
        }
    }
}
