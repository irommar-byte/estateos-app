import Foundation
import MediaPlayer

/// Eksponuje kolejkę odtwarzania do BMW iDrive / NBT / HUD przez Bluetooth (AVRCP browse).
/// Działa bez CarPlay — ten sam mechanizm co Apple Music przy połączeniu BT.
@MainActor
final class BluetoothMediaBrowser: NSObject {
    static let shared = BluetoothMediaBrowser()

    private struct QueueSnapshot {
        let containerTitle: String
        let rows: [PlaybackQueueRow]
    }

    private weak var engine: MusicPlaybackEngine?
    private var snapshot: QueueSnapshot?
    private var isActive = false
    /// Kopia kolejki dla wątków systemowych (iDrive pyta poza MainActor).
    private let snapshotLock = NSLock()
    nonisolated(unsafe) private var threadSafeSnapshot: QueueSnapshot?

    private override init() {
        super.init()
    }

    func activate() {
        guard !isActive else { return }
        let manager = MPPlayableContentManager.shared()
        manager.dataSource = self
        manager.delegate = self
        isActive = true
    }

    func attach(engine: MusicPlaybackEngine?) {
        self.engine = engine
        reloadQueue()
    }

    func reloadQueue(from engine: MusicPlaybackEngine? = nil) {
        if let engine { self.engine = engine }
        guard let engine else {
            snapshot = nil
            publishSnapshot(nil)
            notifyContentChanged()
            return
        }
        let snap = QueueSnapshot(
            containerTitle: engine.queueSourceTitle ?? "Kolejka odtwarzania",
            rows: engine.playbackQueueRows
        )
        snapshot = snap
        publishSnapshot(snap)
        notifyContentChanged()
    }

    private func publishSnapshot(_ snap: QueueSnapshot?) {
        snapshotLock.lock()
        threadSafeSnapshot = snap
        snapshotLock.unlock()
    }

    private nonisolated func readSnapshot() -> QueueSnapshot? {
        snapshotLock.lock()
        defer { snapshotLock.unlock() }
        return threadSafeSnapshot
    }

    private func notifyContentChanged() {
        guard isActive else { return }
        let manager = MPPlayableContentManager.shared()
        manager.beginUpdates()
        manager.endUpdates()
    }

    private func orderIndex(for indexPath: IndexPath, in snap: QueueSnapshot) -> Int? {
        guard indexPath.count == 2, indexPath[0] == 0 else { return nil }
        let rowIndex = indexPath[1]
        guard snap.rows.indices.contains(rowIndex) else { return nil }
        return snap.rows[rowIndex].orderIndex
    }
}

// MARK: - Browse tree (playlist → utwory)

extension BluetoothMediaBrowser: MPPlayableContentDataSource {
    nonisolated func numberOfChildItems(at indexPath: IndexPath) -> Int {
        guard let snap = readSnapshot(), !snap.rows.isEmpty else { return 0 }
        if indexPath.count == 0 { return 1 }
        if indexPath.count == 1, indexPath[0] == 0 { return snap.rows.count }
        return 0
    }

    nonisolated func contentItem(at indexPath: IndexPath) -> MPContentItem? {
        guard let snap = readSnapshot() else { return nil }

        if indexPath.count == 1, indexPath[0] == 0 {
            let item = MPContentItem(identifier: "eos-queue-root")
            item.title = snap.containerTitle
            item.subtitle = "\(snap.rows.count) utworów · EOS Music"
            item.isContainer = true
            item.isPlayable = false
            return item
        }

        if indexPath.count == 2, indexPath[0] == 0 {
            let rowIndex = indexPath[1]
            guard snap.rows.indices.contains(rowIndex) else { return nil }
            let row = snap.rows[rowIndex]
            let item = MPContentItem(identifier: "eos-queue-\(row.orderIndex)")
            item.title = row.isCurrent ? "▶ \(row.track.title)" : row.track.title
            let subtitleParts = [row.track.artist, row.track.album].compactMap { $0 }.filter { !$0.isEmpty }
            item.subtitle = subtitleParts.isEmpty ? "Utwór \(row.displayNumber)" : subtitleParts.joined(separator: " · ")
            item.isContainer = false
            item.isPlayable = true
            return item
        }

        return nil
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
            guard let orderIndex = orderIndex(for: indexPath, in: snap) else {
                completionHandler(browseError(code: 404, message: "Nie znaleziono utworu."))
                return
            }
            guard let engine else {
                completionHandler(browseError(code: 503, message: "Odtwarzacz nieaktywny."))
                return
            }
            await engine.jumpToOrderIndex(orderIndex)
            completionHandler(nil)
        }
    }

    nonisolated func playableContentManager(
        _ contentManager: MPPlayableContentManager,
        initializePlaybackQueueWithCompletionHandler completionHandler: @escaping (Error?) -> Void
    ) {
        Task { @MainActor in
            reloadQueue()
            completionHandler(nil)
        }
    }

    private func browseError(code: Int, message: String) -> NSError {
        NSError(domain: "EOSMusic.Browse", code: code, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
