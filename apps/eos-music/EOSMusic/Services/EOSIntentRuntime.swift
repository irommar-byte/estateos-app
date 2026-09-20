import Foundation
import WidgetKit
import ActivityKit

@MainActor
final class EOSIntentRuntime {
    static let shared = EOSIntentRuntime()

    private weak var app: AppModel?
    private var readyContinuations: [CheckedContinuation<AppModel, Error>] = []
    private var snapshotRevision = 0

    enum RuntimeError: Error {
        case timeout
        case unavailable
    }

    func attach(_ app: AppModel) {
        self.app = app
        SiriPlaybackBridge.shared.app = app
        ShazamIdentifyController.shared.bind(app)
        for continuation in readyContinuations {
            continuation.resume(returning: app)
        }
        readyContinuations.removeAll()
        publishSnapshot()
        Task { await ShazamRecognitionCoordinator.shared.flushOutbox(using: app) }
    }

    func waitForApp(timeout: TimeInterval = 4) async throws -> AppModel {
        if let app { return app }
        return try await withThrowingTaskGroup(of: AppModel.self) { group in
            group.addTask { @MainActor in
                try await withCheckedThrowingContinuation { continuation in
                    self.readyContinuations.append(continuation)
                }
            }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                throw RuntimeError.timeout
            }
            guard let result = try await group.next() else { throw RuntimeError.timeout }
            group.cancelAll()
            return result
        }
    }

    func restoreSessionForIntent() async throws -> AppModel {
        let app = try await waitForApp()
        guard let session = SessionStore.load() else {
            throw EOSIntentRoutingError.notLoggedIn
        }
        app.api.setToken(session.token)
        if app.user == nil {
            app.hydrateForIntent(session: session)
        }
        return app
    }

    func performShazamHeadless() async throws -> String {
        let app = try await restoreSessionForIntent()
        let status = await ShazamRecognitionCoordinator.shared.startHeadless(app: app)
        publishSnapshot()
        reloadControls()
        return status
    }

    func cancelShazam() async {
        await ShazamRecognitionCoordinator.shared.cancel()
        publishSnapshot()
        reloadControls()
    }

    func setPlaying(_ playing: Bool) async throws {
        let app = try await restoreSessionForIntent()
        guard let engine = app.playback.engine else {
            throw EOSIntentRoutingError.noCurrentTrack
        }
        try await SiriPlaybackBridge.shared.setPlaying(playing, engine: engine)
        publishSnapshot()
        reloadControls()
    }

    func skipNext() async throws -> String {
        let app = try await restoreSessionForIntent()
        guard let engine = app.playback.engine else {
            throw EOSIntentRoutingError.noCurrentTrack
        }
        let title = try await SiriPlaybackBridge.shared.skipNext(engine: engine)
        publishSnapshot()
        reloadControls()
        return title
    }

    func setFavoriteCurrent(_ enabled: Bool) async throws {
        let app = try await restoreSessionForIntent()
        guard let track = app.playback.engine?.currentTrack else {
            throw EOSIntentRoutingError.noCurrentTrack
        }
        try await app.setFavorite(track.asFavoriteItem, enabled: enabled)
        publishSnapshot()
        reloadControls()
    }

    func publishSnapshot() {
        guard let app else { return }
        snapshotRevision += 1
        let track = app.playback.engine?.currentTrack
        let engine = app.playback.engine
        let coordinator = ShazamRecognitionCoordinator.shared
        let snapshot = EOSControlSnapshot(
            schemaVersion: EOSAppGroup.schemaVersion,
            revision: snapshotRevision,
            updatedAt: Date(),
            title: track?.title ?? "",
            artist: track?.artist ?? "",
            trackURL: track?.url ?? "",
            isPlaying: engine?.isPlaying ?? false,
            isFavorite: track.map { app.isFavorite($0.url) } ?? false,
            hasCurrentTrack: track != nil,
            isLoggedIn: SessionStore.load() != nil,
            shazamPhase: coordinator.phase,
            shazamMessage: coordinator.statusMessage,
            microphoneReady: coordinator.microphoneReady,
            queueAvailable: app.downloads.hasActiveQueue,
            lastSafeError: coordinator.lastSafeError
        )
        Task {
            try? await EOSAppGroupStore.shared.save(snapshot)
        }
    }

    func reloadControls() {
        if #available(iOS 18.0, *) {
            for kind in EOSControlKind.all {
                ControlCenter.shared.reloadControls(ofKind: kind)
            }
        }
    }
}

extension MusicPlaybackTrack {
    var asFavoriteItem: FavoriteItem {
        FavoriteItem(
            id: url,
            type: "music",
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: nil,
            detail: artist,
            duration: duration
        )
    }
}
