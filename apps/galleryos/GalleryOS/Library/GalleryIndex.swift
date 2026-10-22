import Foundation
import Photos
import UniformTypeIdentifiers

struct AlbumRecord: Identifiable, Hashable {
    let id: String
    let title: String
    let count: Int
    let coverID: String?
    let system: Bool
    /// Date of the newest photo, for sorting albums. User albums rarely have `endDate`.
    var latest: Date? = nil
}

struct GallerySnapshot: @unchecked Sendable {
    var assets: [String: PHAsset]
    var grid: GridModel
    var albums: [AlbumRecord]
    var albumMembers: [String: [String]]
    /// Photos that live only in a shared album, a computer sync or another album.
    /// They can open inside that album, but they are not part of this iPhone's camera roll.
    var outside: [PhotoRef]
    var sharedAlbums: Int
    var fromComputer: Int
    var albumOnly: Int
}

enum GalleryIndex {
    static func build() -> GallerySnapshot {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        options.includeHiddenAssets = false
        let fetched = PHAsset.fetchAssets(with: options)
        var refs: [PhotoRef] = []
        var assets: [String: PHAsset] = [:]
        refs.reserveCapacity(fetched.count)
        fetched.enumerateObjects { asset, _, _ in
            let ref = makeRef(asset)
            refs.append(ref)
            assets[ref.id] = asset
        }

        var selfieIDs = Set<String>()
        if let selfies = collection(subtype: .smartAlbumSelfPortraits) {
            let result = PHAsset.fetchAssets(in: selfies, options: nil)
            result.enumerateObjects { asset, _, _ in
                selfieIDs.insert(asset.localIdentifier)
            }
        }
        if !selfieIDs.isEmpty {
            for index in refs.indices where selfieIDs.contains(refs[index].id) {
                refs[index].traits.insert(.selfie)
            }
        }

        var albums: [AlbumRecord] = []
        var members: [String: [String]] = [:]
        var known = Set(assets.keys)
        var extras: [PHAsset] = []
        for smart in [true, false] {
            let loaded = loadAlbums(smart: smart, known: known)
            known.formUnion(loaded.seen)
            extras.append(contentsOf: loaded.extras)
            for record in loaded.records {
                albums.append(record.album)
                members[record.album.id] = record.ids
            }
        }
        var outside: [PhotoRef] = []
        var shared = 0
        var computer = 0
        var albumOnly = 0
        for asset in extras {
            assets[asset.localIdentifier] = asset
            outside.append(makeRef(asset))
            if asset.sourceType.contains(.typeCloudShared) {
                shared += 1
            } else if asset.sourceType.contains(.typeiTunesSynced) {
                computer += 1
            } else {
                albumOnly += 1
            }
        }
        let grid = GridModel(photos: refs)
        return GallerySnapshot(
            assets: assets,
            grid: grid,
            albums: albums,
            albumMembers: members,
            outside: outside,
            sharedAlbums: shared,
            fromComputer: computer,
            albumOnly: albumOnly
        )
    }

    private static func isGIF(_ asset: PHAsset) -> Bool {
        PHAssetResource.assetResources(for: asset).contains { resource in
            let type = resource.uniformTypeIdentifier.lowercased()
            return type == UTType.gif.identifier || type.contains("gif")
        }
    }

    private static func makeRef(_ asset: PHAsset) -> PhotoRef {
        var traits = PhotoTraits()
        let subtypes = asset.mediaSubtypes
        if asset.mediaType == .video { traits.insert(.video) }
        if subtypes.contains(.photoLive) { traits.insert(.live) }
        if subtypes.contains(.photoScreenshot) { traits.insert(.screenshot) }
        if subtypes.contains(.photoPanorama) { traits.insert(.panorama) }
        if subtypes.contains(.photoDepthEffect) { traits.insert(.portrait) }
        if #available(iOS 26.0, tvOS 26.0, *) {
            if asset.contentType.conforms(to: .rawImage) { traits.insert(.raw) }
        } else if PHAssetResource.assetResources(for: asset).contains(where: {
            UTType($0.uniformTypeIdentifier)?.conforms(to: .rawImage) == true
        }) {
            traits.insert(.raw)
        }
        if asset.playbackStyle == .imageAnimated || isGIF(asset) { traits.insert(.animated) }
        return PhotoRef(
            id: asset.localIdentifier,
            created: asset.creationDate ?? .distantPast,
            pixelWidth: asset.pixelWidth,
            pixelHeight: asset.pixelHeight,
            traits: traits,
            isFavorite: asset.isFavorite,
            latitude: asset.location?.coordinate.latitude,
            longitude: asset.location?.coordinate.longitude,
            duration: asset.duration
        )
    }

    private static func collection(subtype: PHAssetCollectionSubtype) -> PHAssetCollection? {
        let result = PHAssetCollection.fetchAssetCollections(with: .smartAlbum, subtype: subtype, options: nil)
        return result.firstObject
    }

    private static func loadAlbums(
        smart: Bool,
        known: Set<String>
    ) -> (records: [(album: AlbumRecord, ids: [String])], extras: [PHAsset], seen: Set<String>) {
        let result = PHAssetCollection.fetchAssetCollections(
            with: smart ? .smartAlbum : .album,
            subtype: .any,
            options: nil
        )
        var records: [(album: AlbumRecord, ids: [String])] = []
        var extras: [PHAsset] = []
        var seen = known
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
        options.includeAssetSourceTypes = [.typeUserLibrary, .typeCloudShared, .typeiTunesSynced]
        result.enumerateObjects { collection, _, _ in
            guard AlbumEligibility.allows(collection, smart: smart) else { return }
            let assets = PHAsset.fetchAssets(in: collection, options: options)
            var ids: [String] = []
            ids.reserveCapacity(assets.count)
            assets.enumerateObjects { asset, _, _ in
                ids.append(asset.localIdentifier)
                if seen.insert(asset.localIdentifier).inserted {
                    extras.append(asset)
                }
            }
            let key = PHAsset.fetchKeyAssets(in: collection, options: nil)?.firstObject?.localIdentifier
            let cover = key.flatMap { ids.contains($0) ? $0 : nil } ?? ids.last
            let title = collection.localizedTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
            let album = AlbumRecord(
                id: collection.localIdentifier,
                title: (title?.isEmpty == false ? title! : L("Album")),
                count: ids.count,
                coverID: cover,
                system: smart,
                latest: assets.lastObject?.creationDate
            )
            records.append((album, ids))
        }
        return (records, extras, seen)
    }
}
