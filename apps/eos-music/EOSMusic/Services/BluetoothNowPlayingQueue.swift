import Foundation

/// Czysta logika kolejki AVRCP / BMW NBT — bez `MPPlayableContentManager`.
///
/// Apple Music na NBT pokazuje **playlistę w kolejności odtwarzania**. Trzecia aplikacja
/// musi to złożyć z `nowPlayingIdentifiers` + `PlaybackQueueIndex`/`AlbumTrackNumber`.
///
/// Pułapki NBT, które dawały tylko 1 utwór + next/prev:
/// 1. Rotacja tablicy (bieżący na indeks 0) — iDrive bierze `identifiers[queueIndex]`
///    i/lub czyta wyłącznie pierwszy element.
/// 2. Wstawienie kontenera playlisty do `nowPlayingIdentifiers`.
/// 3. `beginUpdates` / zerowanie tablicy przy każdej zmianie utworu.
enum BluetoothNowPlayingQueue {
    static let maxIdentifiers = 120
    static let defaultMaxBrowseItems = 100

    static func queueContentIdentifier(orderIndex: Int) -> String {
        "eos-q-\(orderIndex)"
    }

    static func playlistContentIdentifier(folderId: String) -> String {
        "eos-pl-\(folderId)"
    }

    static func libraryTrackContentIdentifier(folderId: String, trackIndex: Int) -> String {
        "eos-tr-\(folderId)-\(trackIndex)"
    }

    static func activePlaylistContainerIdentifier() -> String {
        "eos-queue-root"
    }

    /// Identyfikatory w **kolejności playlisty** (jak Apple Music), nie „bieżący na początku”.
    static func nowPlayingIdentifiers(trackCount: Int, cap: Int = maxIdentifiers) -> [String] {
        guard trackCount > 0 else { return [] }
        let count = min(trackCount, max(1, cap))
        return (0..<count).map(queueContentIdentifier)
    }

    /// Sygnatura struktury drzewa — bez bieżącego utworu, żeby skip nie resetował listy NBT.
    static func structureSignature(layout: String, trackIDs: [String]) -> String {
        "\(layout)-\(trackIDs.count)-\(trackIDs.hashValue)"
    }

    /// Limit dzieci w drzewie browse. Dla aktywnej kolejki nigdy nie tnij do 1–3 z NBT.
    static func childCount(
        requested: Int,
        isActiveQueueTracks: Bool,
        limitsEnforced: Bool,
        enforcedCount: Int,
        maxItems: Int
    ) -> Int {
        let hardCap = max(1, maxItems)
        let wanted = max(0, requested)
        if isActiveQueueTracks {
            return min(wanted, hardCap)
        }
        guard limitsEnforced else { return min(wanted, hardCap) }
        let reported = max(1, enforcedCount)
        if reported <= 3 {
            return min(wanted, hardCap)
        }
        return min(wanted, hardCap, reported)
    }

    static func browseItemCap(limitsEnforced: Bool, enforcedCount: Int) -> Int {
        guard limitsEnforced else { return defaultMaxBrowseItems }
        let reported = max(1, enforcedCount)
        if reported <= 3 { return defaultMaxBrowseItems }
        return min(max(reported, 20), defaultMaxBrowseItems)
    }

    static func identifiersChanged(previous: [String], next: [String]) -> Bool {
        previous != next
    }
}
