import Photos

/// Which Photos albums GalleryOS should surface. Keeps user albums and useful smart albums,
/// and hides shared / stream / system clutter that competes with GalleryOS Znajomi and trash.
enum AlbumEligibility {
    static func allows(_ collection: PHAssetCollection, smart: Bool) -> Bool {
        if smart {
            return allowsSmart(collection.assetCollectionSubtype)
                && allowsTitle(collection.localizedTitle)
        }
        return allowsUserAlbum(collection)
    }

    static func allowsSmart(_ subtype: PHAssetCollectionSubtype) -> Bool {
        switch subtype {
        case .smartAlbumUserLibrary,
             .smartAlbumAllHidden,
             .smartAlbumUnableToUpload,
             .albumMyPhotoStream,
             .albumCloudShared,
             .albumSyncedEvent,
             .albumSyncedFaces,
             .albumSyncedAlbum:
            return false
        default:
            return true
        }
    }

    static func allowsUserAlbum(_ collection: PHAssetCollection) -> Bool {
        let subtype = collection.assetCollectionSubtype
        switch subtype {
        case .albumCloudShared,
             .albumMyPhotoStream,
             .albumSyncedEvent,
             .albumSyncedFaces,
             .albumSyncedAlbum:
            return false
        default:
            return allowsTitle(collection.localizedTitle)
        }
    }

    static func allowsTitle(_ localizedTitle: String?) -> Bool {
        let title = (localizedTitle ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if title.isEmpty { return true }
        // System clutter Photos injects into the album list on some locales.
        let blocked: Set<String> = [
            "ukryte", "hidden",
            "ostatnio usunięte", "recently deleted",
            "nie można wysłać", "unable to upload",
            "moje strumienie zdjęć", "my photo stream",
            "współdzielone", "shared album", "shared albums",
        ]
        if blocked.contains(title) { return false }
        if title.hasPrefix("współdziel") { return false }
        return true
    }
}
