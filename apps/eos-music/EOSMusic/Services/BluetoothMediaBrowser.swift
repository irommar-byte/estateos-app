import AVFoundation
import Foundation
import MediaPlayer
import os

/// Eksponuje kolejkę odtwarzania i bibliotekę playlist do BMW iDrive / NBT / HUD przez Bluetooth (AVRCP browse).
///
/// Różnica vs Apple Music:
/// - Apple Music = systemowy iPod/iAP — auto pokazuje całą playlistę.
/// - My = `MPPlayableContentManager` (trzecia aplikacja). NBT często zgłasza
///   `enforcedContentItemsCount = 1` i/lub `enforcedContentTreeDepth = 1`.
///
/// Strategia:
/// 1. Drzewo browse: zagnieżdżona playlista → utwory (1 kontener w root = OK przy limicie 1).
/// 2. Wewnątrz kontenera nigdy nie tnij kolejki do 1.
/// 3. `nowPlayingIdentifiers` = **cała playlista w kolejności odtwarzania** (jak Apple Music).
///    Rotacja „bieżący na 0” + zerowanie tablicy zostawiało na NBT 1 utwór bez scrolla pokrętłem.
/// 4. Nie przeładowuj drzewa przy skipie / ticku czasu — tylko przy zmianie składu kolejki.
@MainActor
final class BluetoothMediaBrowser: NSObject {
    static let shared = BluetoothMediaBrowser()

    typealias LibraryPlayHandler = @MainActor ([MusicTrack], Int, MusicFolder?) async -> Void

    var playFromLibrary: LibraryPlayHandler?

    private enum QueueBrowseLayout: Sendable {
        case nestedPlaylist
        case flatQueue
    }

    private struct BrowseItem: Sendable {
        let identifier: String
        let title: String
        let subtitle: String
        let isContainer: Bool
        let isPlayable: Bool
        let isStreaming: Bool
        let playbackProgress: Double?
        let orderIndex: Int?
        let libraryFolderId: String?
        let libraryTrackIndex: Int?
    }

    private struct LibraryPlaylistNode {
        let folder: MusicFolder
        let tracks: [MusicTrack]
    }

    private enum BrowseRoot: Sendable {
        case activeQueue(
            layout: QueueBrowseLayout,
            container: BrowseItem,
            tracks: [BrowseItem]
        )
        case library(playlistItems: [BrowseItem], trackItemsByPlaylist: [[BrowseItem]], playlists: [LibraryPlaylistNode])
    }

    private struct BrowseSnapshot: Sendable {
        let root: BrowseRoot
        let nowPlayingIdentifier: String?
    }

    private weak var engine: MusicPlaybackEngine?
    private var libraryPlaylists: [LibraryPlaylistNode] = []
    private var snapshot: BrowseSnapshot?
    private var isActive = false
    /// Zawsze nested dla aktywnej kolejki — flat + NBT count=1 = tylko 1 utwór na ekranie.
    private var queueBrowseLayout: QueueBrowseLayout = .nestedPlaylist
    private var maxBrowseItems = 100
    private var contentLimitsEnforced = false
    private var enforcedContentItemsCount = Int.max
    private var enforcedContentTreeDepth = Int.max
    private let limitsLock = NSLock()
    nonisolated(unsafe) private var threadSafeLimits = (enforced: false, count: 100, depth: 2)
    nonisolated(unsafe) private var threadSafeQueueLayout: QueueBrowseLayout = .nestedPlaylist
    nonisolated(unsafe) private var threadSafeMaxItems = 100

    private let snapshotLock = NSLock()
    nonisolated(unsafe) private var threadSafeSnapshot: BrowseSnapshot?
    private var routeObserver: NSObjectProtocol?
    private var lastQueueSignature: String?
    private var lastProgressPublishAt: Date = .distantPast

    private static let log = Logger(subsystem: "pl.nostalgie.eosmusic", category: "BTBrowse")

    private override init() {
        super.init()
    }

    static func queueContentIdentifier(orderIndex: Int) -> String {
        BluetoothNowPlayingQueue.queueContentIdentifier(orderIndex: orderIndex)
    }

    static func playlistContentIdentifier(folderId: String) -> String {
        BluetoothNowPlayingQueue.playlistContentIdentifier(folderId: folderId)
    }

    static func libraryTrackContentIdentifier(folderId: String, trackIndex: Int) -> String {
        BluetoothNowPlayingQueue.libraryTrackContentIdentifier(folderId: folderId, trackIndex: trackIndex)
    }

    static func activePlaylistContainerIdentifier() -> String {
        BluetoothNowPlayingQueue.activePlaylistContainerIdentifier()
    }

    static func stablePersistentID(_ seed: String) -> NSNumber {
        var hasher = Hasher()
        hasher.combine(seed)
        let raw = UInt64(bitPattern: Int64(hasher.finalize()))
        return NSNumber(value: raw)
    }

    /// Opublikuj kolejkę zanim AVPlayer wystartuje — NBT czyta listę przy pierwszym połączeniu BT.
    func preparePlaybackSession(engine: MusicPlaybackEngine) {
        attach(engine: engine)
    }

    func activate() {
        guard !isActive else { return }
        let manager = MPPlayableContentManager.shared()
        manager.dataSource = self
        manager.delegate = self
        isActive = true
        installRouteObserverIfNeeded()
        publishRuntimeConfig()
        notifyContentChanged()
        Self.log.info("BT browse activated")
    }

    func attach(engine: MusicPlaybackEngine?) {
        self.engine = engine
        rebuildSnapshot(forceNotify: true)
    }

    func updateLibrary(folders: [MusicFolder], tracks: [MusicTrack]) {
        let grouped = Dictionary(grouping: tracks, by: \.folderId)
        libraryPlaylists = folders.compactMap { folder in
            let folderTracks = grouped[folder.id] ?? []
            guard !folderTracks.isEmpty else { return nil }
            return LibraryPlaylistNode(folder: folder, tracks: folderTracks)
        }
        rebuildSnapshot(forceNotify: true)
    }

    func reloadQueue(from engine: MusicPlaybackEngine? = nil) {
        if let engine { self.engine = engine }
        rebuildSnapshot(forceNotify: false)
    }

    /// Lekki update postępu bieżącego utworu — bez pełnego przeładowania drzewa (NBT tego nie lubi).
    func touchCurrentProgress(from engine: MusicPlaybackEngine) {
        self.engine = engine
        let now = Date()
        guard now.timeIntervalSince(lastProgressPublishAt) >= 4 else { return }
        lastProgressPublishAt = now
        rebuildSnapshot(forceNotify: false, progressOnly: true)
    }

    private func installRouteObserverIfNeeded() {
        guard routeObserver == nil else { return }
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.rebuildSnapshot(forceNotify: true)
            }
        }
    }

    private func nbtTitle(_ raw: String, maxLength: Int = 48) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > maxLength else { return trimmed }
        return String(trimmed.prefix(max(1, maxLength - 1))) + "…"
    }

    private func capped<T>(_ items: [T]) -> [T] {
        Array(items.prefix(maxBrowseItems))
    }

    /// Limit dzieci w drzewie. Dla utworów aktywnej kolejki **nigdy** nie stosuj
    /// `enforcedContentItemsCount` z NBT (często = 1 → tylko bieżący utwór).
    private nonisolated func childCount(requested: Int, isActiveQueueTracks: Bool) -> Int {
        let config = readRuntimeConfig()
        return BluetoothNowPlayingQueue.childCount(
            requested: requested,
            isActiveQueueTracks: isActiveQueueTracks,
            limitsEnforced: config.limits.enforced,
            enforcedCount: config.limits.count,
            maxItems: config.maxItems
        )
    }

    private func queueSignature(rows: [PlaybackQueueRow], layout: QueueBrowseLayout) -> String {
        BluetoothNowPlayingQueue.structureSignature(
            layout: String(describing: layout),
            trackIDs: rows.map(\.track.id)
        )
    }

    private func rebuildSnapshot(forceNotify: Bool, progressOnly: Bool = false) {
        let snap: BrowseSnapshot?

        if let engine, !engine.playbackQueueRows.isEmpty {
            let rows = capped(engine.playbackQueueRows)
            let duration = engine.liveDuration()
            let elapsed = engine.livePlaybackTime()
            let playlistTitle = engine.queueSourceTitle ?? "Kolejka odtwarzania"

            // Zawsze nested dla kolejki — Apple Music też pokazuje playlistę jako folder.
            let layout: QueueBrowseLayout = .nestedPlaylist
            queueBrowseLayout = layout

            let trackItems = rows.map { row -> BrowseItem in
                let subtitleParts = [row.track.artist, row.track.album].compactMap { $0 }.filter { !$0.isEmpty }
                let progress: Double? = {
                    guard row.isCurrent, duration > 0 else { return nil }
                    return min(1, max(0, elapsed / duration))
                }()
                let prefix = row.isCurrent ? "▶ " : ""
                return BrowseItem(
                    identifier: Self.queueContentIdentifier(orderIndex: row.orderIndex),
                    title: nbtTitle(prefix + row.track.title),
                    subtitle: subtitleParts.isEmpty
                        ? "Utwór \(row.displayNumber)/\(rows.count)"
                        : nbtTitle(subtitleParts.joined(separator: " · "), maxLength: 64),
                    isContainer: false,
                    isPlayable: true,
                    isStreaming: false,
                    playbackProgress: progress,
                    orderIndex: row.orderIndex,
                    libraryFolderId: nil,
                    libraryTrackIndex: nil
                )
            }

            let container = BrowseItem(
                identifier: Self.activePlaylistContainerIdentifier(),
                title: nbtTitle(playlistTitle),
                subtitle: "\(trackItems.count) utworów · EOS Music",
                isContainer: true,
                isPlayable: false,
                isStreaming: false,
                playbackProgress: nil,
                orderIndex: nil,
                libraryFolderId: nil,
                libraryTrackIndex: nil
            )

            let currentID = rows.first(where: \.isCurrent).map { Self.queueContentIdentifier(orderIndex: $0.orderIndex) }
            let signature = queueSignature(rows: rows, layout: layout)
            let structureChanged = signature != lastQueueSignature

            snap = BrowseSnapshot(
                root: .activeQueue(layout: layout, container: container, tracks: trackItems),
                nowPlayingIdentifier: currentID
            )

            snapshot = snap
            publishSnapshot(snap)
            publishRuntimeConfig()
            updateNowPlayingIdentifiers(from: snap)

            if forceNotify || structureChanged {
                lastQueueSignature = signature
                notifyContentChanged()
                Self.log.info(
                    "Queue published tracks=\(trackItems.count, privacy: .public) current=\(currentID ?? "-", privacy: .public) limits=\(self.contentLimitsEnforced, privacy: .public)/\(self.enforcedContentItemsCount, privacy: .public)/depth=\(self.enforcedContentTreeDepth, privacy: .public)"
                )
            } else if progressOnly {
                // Tylko metadane postępu — bez beginUpdates (NBT resetuje listę).
            }
        } else if !libraryPlaylists.isEmpty {
            let playlistItems = libraryPlaylists.map { node -> BrowseItem in
                BrowseItem(
                    identifier: Self.playlistContentIdentifier(folderId: node.folder.id),
                    title: nbtTitle(node.folder.name),
                    subtitle: "\(node.tracks.count) utworów · EOS Music",
                    isContainer: true,
                    isPlayable: false,
                    isStreaming: false,
                    playbackProgress: nil,
                    orderIndex: nil,
                    libraryFolderId: node.folder.id,
                    libraryTrackIndex: nil
                )
            }
            let trackItemsByPlaylist = libraryPlaylists.map { node in
                capped(node.tracks).enumerated().map { index, track in
                    let subtitleParts = [track.artist, track.album].compactMap { $0 }.filter { !$0.isEmpty }
                    return BrowseItem(
                        identifier: Self.libraryTrackContentIdentifier(folderId: node.folder.id, trackIndex: index),
                        title: nbtTitle(track.title),
                        subtitle: subtitleParts.isEmpty
                            ? "Utwór \(index + 1)"
                            : nbtTitle(subtitleParts.joined(separator: " · "), maxLength: 64),
                        isContainer: false,
                        isPlayable: true,
                        isStreaming: false,
                        playbackProgress: nil,
                        orderIndex: nil,
                        libraryFolderId: node.folder.id,
                        libraryTrackIndex: index
                    )
                }
            }
            snap = BrowseSnapshot(
                root: .library(
                    playlistItems: playlistItems,
                    trackItemsByPlaylist: trackItemsByPlaylist,
                    playlists: libraryPlaylists
                ),
                nowPlayingIdentifier: nil
            )
            lastQueueSignature = nil
            snapshot = snap
            publishSnapshot(snap)
            updateNowPlayingIdentifiers(from: snap)
            if forceNotify {
                notifyContentChanged()
            }
        } else {
            snap = nil
            lastQueueSignature = nil
            snapshot = nil
            publishSnapshot(nil)
            updateNowPlayingIdentifiers(from: nil)
            if forceNotify {
                notifyContentChanged()
            }
        }
    }

    private func publishRuntimeConfig() {
        limitsLock.lock()
        threadSafeLimits = (contentLimitsEnforced, enforcedContentItemsCount, enforcedContentTreeDepth)
        threadSafeQueueLayout = queueBrowseLayout
        threadSafeMaxItems = maxBrowseItems
        limitsLock.unlock()
    }

    private nonisolated func readRuntimeConfig() -> (
        limits: (enforced: Bool, count: Int, depth: Int),
        layout: QueueBrowseLayout,
        maxItems: Int
    ) {
        limitsLock.lock()
        defer { limitsLock.unlock() }
        return (threadSafeLimits, threadSafeQueueLayout, threadSafeMaxItems)
    }

    private func publishSnapshot(_ snap: BrowseSnapshot?) {
        snapshotLock.lock()
        threadSafeSnapshot = snap
        snapshotLock.unlock()
    }

    private nonisolated func readSnapshot() -> BrowseSnapshot? {
        snapshotLock.lock()
        defer { snapshotLock.unlock() }
        return threadSafeSnapshot
    }

    private func updateNowPlayingIdentifiers(from snap: BrowseSnapshot?) {
        guard isActive else { return }
        guard let snap else {
            MPPlayableContentManager.shared().nowPlayingIdentifiers = []
            return
        }

        var ids: [String] = []
        switch snap.root {
        case .activeQueue(_, _, let tracks):
            // Kolejność playlisty + ExternalContentIdentifier = bieżący.
            // Rotacja (bieżący pierwszy) na NBT = 1 pozycja bez listy pokrętłem.
            ids = BluetoothNowPlayingQueue.nowPlayingIdentifiers(trackCount: tracks.count)
        case .library:
            if let trackID = snap.nowPlayingIdentifier {
                ids.append(trackID)
            }
        }

        let manager = MPPlayableContentManager.shared()
        guard BluetoothNowPlayingQueue.identifiersChanged(previous: manager.nowPlayingIdentifiers, next: ids) else {
            return
        }
        manager.nowPlayingIdentifiers = ids
        Self.log.info(
            "nowPlayingIdentifiers count=\(ids.count, privacy: .public) first=\(ids.first ?? "-", privacy: .public) current=\(snap.nowPlayingIdentifier ?? "-", privacy: .public)"
        )
    }

    private func notifyContentChanged() {
        guard isActive else { return }
        let manager = MPPlayableContentManager.shared()
        manager.beginUpdates()
        manager.endUpdates()
    }

    private nonisolated func makeContentItem(_ item: BrowseItem) -> MPContentItem {
        let content = MPContentItem(identifier: item.identifier)
        content.title = item.title
        content.subtitle = item.subtitle
        content.isContainer = item.isContainer
        content.isPlayable = item.isPlayable
        content.isStreamingContent = item.isStreaming
        if let progress = item.playbackProgress {
            content.playbackProgress = Float(progress)
        }
        return content
    }

    private func orderIndex(for indexPath: IndexPath, in snap: BrowseSnapshot) -> Int? {
        guard case .activeQueue(let layout, _, let tracks) = snap.root else { return nil }
        switch layout {
        case .flatQueue:
            guard indexPath.count == 1, tracks.indices.contains(indexPath[0]) else { return nil }
            return tracks[indexPath[0]].orderIndex
        case .nestedPlaylist:
            guard indexPath.count == 2, indexPath[0] == 0, tracks.indices.contains(indexPath[1]) else { return nil }
            return tracks[indexPath[1]].orderIndex
        }
    }

    private func librarySelection(for indexPath: IndexPath, in snap: BrowseSnapshot) -> (tracks: [MusicTrack], index: Int, folder: MusicFolder)? {
        guard case .library(_, _, let playlists) = snap.root else { return nil }
        guard indexPath.count == 2, playlists.indices.contains(indexPath[0]) else { return nil }
        let playlist = playlists[indexPath[0]]
        let trackIndex = indexPath[1]
        guard playlist.tracks.indices.contains(trackIndex) else { return nil }
        return (playlist.tracks, trackIndex, playlist.folder)
    }

    private nonisolated func item(for identifier: String, in snap: BrowseSnapshot) -> BrowseItem? {
        switch snap.root {
        case .activeQueue(_, let container, let tracks):
            if container.identifier == identifier { return container }
            return tracks.first { $0.identifier == identifier }
        case .library(let playlistItems, let trackItemsByPlaylist, _):
            if let hit = playlistItems.first(where: { $0.identifier == identifier }) { return hit }
            for tracks in trackItemsByPlaylist {
                if let hit = tracks.first(where: { $0.identifier == identifier }) { return hit }
            }
            return nil
        }
    }

    private nonisolated func browseError(code: Int, message: String) -> NSError {
        NSError(domain: "EOSMusic.Browse", code: code, userInfo: [NSLocalizedDescriptionKey: message])
    }
}

// MARK: - Browse tree (NBT: playlista → utwory)

extension BluetoothMediaBrowser: MPPlayableContentDataSource {
    nonisolated func numberOfChildItems(at indexPath: IndexPath) -> Int {
        guard let snap = readSnapshot() else { return 0 }

        switch snap.root {
        case .activeQueue(let queueLayout, _, let tracks):
            switch queueLayout {
            case .nestedPlaylist:
                // Root: 1 playlista (pasuje do NBT count=1). Wewnątrz: pełna kolejka.
                if indexPath.isEmpty { return 1 }
                if indexPath.count == 1, indexPath[0] == 0 {
                    return childCount(requested: tracks.count, isActiveQueueTracks: true)
                }
                return 0
            case .flatQueue:
                if indexPath.isEmpty {
                    return childCount(requested: tracks.count, isActiveQueueTracks: true)
                }
                return 0
            }

        case .library(let playlistItems, let trackItemsByPlaylist, _):
            if indexPath.isEmpty {
                if readRuntimeConfig().limits.enforced, readRuntimeConfig().limits.depth <= 1 {
                    return childCount(requested: trackItemsByPlaylist.first?.count ?? 0, isActiveQueueTracks: false)
                }
                return childCount(requested: playlistItems.count, isActiveQueueTracks: false)
            }
            if indexPath.count == 1, trackItemsByPlaylist.indices.contains(indexPath[0]) {
                return childCount(requested: trackItemsByPlaylist[indexPath[0]].count, isActiveQueueTracks: false)
            }
            return 0
        }
    }

    nonisolated func contentItem(at indexPath: IndexPath) -> MPContentItem? {
        guard let snap = readSnapshot() else { return nil }

        switch snap.root {
        case .activeQueue(let layout, let container, let tracks):
            switch layout {
            case .nestedPlaylist:
                if indexPath.count == 1, indexPath[0] == 0 { return makeContentItem(container) }
                if indexPath.count == 2, indexPath[0] == 0, tracks.indices.contains(indexPath[1]) {
                    return makeContentItem(tracks[indexPath[1]])
                }
            case .flatQueue:
                if indexPath.count == 1, tracks.indices.contains(indexPath[0]) {
                    return makeContentItem(tracks[indexPath[0]])
                }
            }
            return nil

        case .library(let playlistItems, let trackItemsByPlaylist, _):
            if readRuntimeConfig().limits.enforced, readRuntimeConfig().limits.depth <= 1, indexPath.count == 1 {
                guard let tracks = trackItemsByPlaylist.first, tracks.indices.contains(indexPath[0]) else { return nil }
                return makeContentItem(tracks[indexPath[0]])
            }
            if indexPath.count == 1, playlistItems.indices.contains(indexPath[0]) {
                return makeContentItem(playlistItems[indexPath[0]])
            }
            if indexPath.count == 2,
               trackItemsByPlaylist.indices.contains(indexPath[0]),
               trackItemsByPlaylist[indexPath[0]].indices.contains(indexPath[1]) {
                return makeContentItem(trackItemsByPlaylist[indexPath[0]][indexPath[1]])
            }
            return nil
        }
    }

    nonisolated func contentItem(for identifier: String, completionHandler: @escaping (MPContentItem?, Error?) -> Void) {
        guard let snap = readSnapshot(), let item = item(for: identifier, in: snap) else {
            completionHandler(nil, browseError(code: 404, message: "Nie znaleziono utworu."))
            return
        }
        completionHandler(makeContentItem(item), nil)
    }

    nonisolated func beginLoadingChildItems(at indexPath: IndexPath, completionHandler: @escaping (Error?) -> Void) {
        // Snapshot już w pamięci — synchronicznie (async → wieczne „pobieranie” na NBT).
        completionHandler(nil)
    }

    nonisolated func childItemsDisplayPlaybackProgress(at indexPath: IndexPath) -> Bool {
        guard let snap = readSnapshot() else { return false }
        guard case .activeQueue(let layout, _, let tracks) = snap.root else { return false }
        switch layout {
        case .flatQueue:
            return indexPath.isEmpty && !tracks.isEmpty
        case .nestedPlaylist:
            return indexPath.count == 1 && indexPath[0] == 0 && !tracks.isEmpty
        }
    }
}

// MARK: - Odtwarzanie wybranego utworu z iDrive / kierownicy / HUD

extension BluetoothMediaBrowser: MPPlayableContentDelegate {
    nonisolated func playableContentManager(
        _ contentManager: MPPlayableContentManager,
        initiatePlaybackOfContentItemAt indexPath: IndexPath,
        completionHandler: @escaping (Error?) -> Void
    ) {
        Task { @MainActor in
            guard let snap = snapshot else {
                completionHandler(browseError(code: 503, message: "Brak aktywnej kolejki."))
                return
            }

            if let orderIndex = orderIndex(for: indexPath, in: snap) {
                guard let engine else {
                    completionHandler(browseError(code: 503, message: "Odtwarzacz nieaktywny."))
                    return
                }
                await engine.jumpToOrderIndex(orderIndex)
                completionHandler(nil)
                return
            }

            // Klik w kontener playlisty = graj od bieżącego / od początku.
            if case .activeQueue(_, _, let tracks) = snap.root,
               indexPath.count == 1, indexPath[0] == 0,
               let engine, !tracks.isEmpty {
                let start = tracks.first(where: { $0.identifier == snap.nowPlayingIdentifier })?.orderIndex
                    ?? tracks.first?.orderIndex
                    ?? 0
                await engine.jumpToOrderIndex(start)
                completionHandler(nil)
                return
            }

            if let selection = librarySelection(for: indexPath, in: snap) {
                guard let playFromLibrary else {
                    completionHandler(browseError(code: 503, message: "Biblioteka niedostępna."))
                    return
                }
                await playFromLibrary(selection.tracks, selection.index, selection.folder)
                completionHandler(nil)
                return
            }

            if case .library = snap.root,
               contentLimitsEnforced,
               enforcedContentTreeDepth <= 1,
               indexPath.count == 1,
               let first = libraryPlaylists.first,
               first.tracks.indices.contains(indexPath[0]) {
                guard let playFromLibrary else {
                    completionHandler(browseError(code: 503, message: "Biblioteka niedostępna."))
                    return
                }
                await playFromLibrary(first.tracks, indexPath[0], first.folder)
                completionHandler(nil)
                return
            }

            completionHandler(browseError(code: 404, message: "Nie znaleziono utworu."))
        }
    }

    nonisolated func playableContentManager(
        _ contentManager: MPPlayableContentManager,
        initializePlaybackQueueWithCompletionHandler completionHandler: @escaping (Error?) -> Void
    ) {
        Task { @MainActor in
            rebuildSnapshot(forceNotify: true)
            completionHandler(nil)
        }
    }

    nonisolated func playableContentManager(
        _ contentManager: MPPlayableContentManager,
        didUpdate context: MPPlayableContentManagerContext
    ) {
        Task { @MainActor in
            contentLimitsEnforced = context.contentLimitsEnforced
            enforcedContentItemsCount = context.enforcedContentItemsCount
            enforcedContentTreeDepth = context.enforcedContentTreeDepth

            // NIGDY nie przełączaj aktywnej kolejki na flatQueue — przy count=1 ginie cała playlista.
            queueBrowseLayout = .nestedPlaylist

            if context.contentLimitsEnforced {
                maxBrowseItems = BluetoothNowPlayingQueue.browseItemCap(
                    limitsEnforced: true,
                    enforcedCount: context.enforcedContentItemsCount
                )
            } else {
                maxBrowseItems = BluetoothNowPlayingQueue.defaultMaxBrowseItems
            }

            Self.log.info(
                "Context update enforced=\(context.contentLimitsEnforced, privacy: .public) count=\(context.enforcedContentItemsCount, privacy: .public) depth=\(context.enforcedContentTreeDepth, privacy: .public) endpoint=\(context.endpointAvailable, privacy: .public)"
            )

            publishRuntimeConfig()
            rebuildSnapshot(forceNotify: true)
        }
    }
}
