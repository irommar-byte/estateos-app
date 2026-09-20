import AVFoundation
import Foundation
import ShazamKit

@MainActor
final class ShazamRecognitionCoordinator {
    static let shared = ShazamRecognitionCoordinator()

    private(set) var phase: EOSShazamPhase = .idle
    private(set) var statusMessage = ""
    private(set) var lastSafeError = ""
    private(set) var microphoneReady = false
    private var reducer = ShazamReducerState()
    private var sessionTask: Task<Void, Never>?
    private var audioMatcher: ShazamAudioMatcher?
    private weak var app: AppModel?

    func bind(_ app: AppModel) {
        self.app = app
        refreshMicrophoneReady()
        Task { await flushOutbox(using: app) }
    }

    func refreshMicrophoneReady() {
        microphoneReady = AVAudioApplication.shared.recordPermission == .granted
    }

    func startFromUI(app: AppModel) {
        self.app = app
        ShazamIdentifyController.shared.isPresented = true
        Task { _ = await run(app: app, allowForegroundPrompt: true) }
    }

    func startHeadless(app: AppModel) async -> String {
        self.app = app
        return await run(app: app, allowForegroundPrompt: false)
    }

    func cancel() async {
        sessionTask?.cancel()
        audioMatcher?.stop()
        audioMatcher = nil
        AudioSession.endShazamCapture()
        phase = .idle
        statusMessage = "Anulowano"
        ShazamLiveActivityController.shared.endExisting()
        ShazamIdentifyController.shared.applyExternal(
            title: "Anulowano",
            artist: "",
            status: "Anulowano",
            success: false,
            listening: false
        )
    }

    func flushOutbox(using app: AppModel) async {
        let pending = await ShazamOutbox.shared.pending()
        for item in pending {
            do {
                try await addPending(item, app: app)
                try await ShazamOutbox.shared.remove(item.id)
            } catch {
                EOSLog.shazam.error("outbox retry failed \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    private func run(app: AppModel, allowForegroundPrompt: Bool) async -> String {
        if sessionTask != nil || phase == .listening || phase == .preparingActivity {
            statusMessage = "Już słucham"
            return statusMessage
        }
        let operation = UUID()
        guard reducer.begin(operation) else {
            statusMessage = reducer.message
            return statusMessage
        }
        phase = .preparingActivity
        statusMessage = "Słucham…"
        refreshMicrophoneReady()

        if !microphoneReady {
            if allowForegroundPrompt {
                let granted = await AVAudioApplication.requestRecordPermission()
                microphoneReady = granted
                if !granted {
                    return fail(operation, .noMicrophone)
                }
            } else {
                phase = .needsSetup
                statusMessage = "Dokończ konfigurację w EOS Music"
                lastSafeError = statusMessage
                ShazamIdentifyController.shared.isPresented = true
                return statusMessage
            }
        }

        let activityOK = ShazamLiveActivityController.shared.start(operationId: operation.uuidString)
        if !activityOK && !allowForegroundPrompt {
            return fail(operation, .activityUnavailable)
        }
        if !activityOK && allowForegroundPrompt {
            ShazamIdentifyController.shared.isPresented = true
        }
        if !AudioSessionLeasePolicy.canStartMicrophone(hasLiveActivity: activityOK || allowForegroundPrompt, permissionGranted: microphoneReady) {
            return fail(operation, activityOK ? .noMicrophone : .activityUnavailable)
        }

        return await withTaskGroup(of: String.self) { group in
            group.addTask { @MainActor in
                await self.listenAndAdd(operation: operation, app: app)
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                return await self.timeout(operation)
            }
            let first = await group.next() ?? self.fail(operation, .notRecognized)
            group.cancelAll()
            return first
        }
    }

    private func listenAndAdd(operation: UUID, app: AppModel) async -> String {
        sessionTask = Task {}
        defer {
            sessionTask = nil
            audioMatcher?.stop()
            audioMatcher = nil
            AudioSession.endShazamCapture()
        }
        do {
            AudioSession.activateForShazamCapture()
            reducer.markListening(id: operation)
            phase = .listening
            ShazamLiveActivityController.shared.update(phase: .listening, message: "Słucham…")
            ShazamIdentifyController.shared.applyExternal(
                title: "Słucham…",
                artist: "",
                status: "",
                success: nil,
                listening: true
            )
            let item = try await recognize()
            guard !Task.isCancelled, reducer.operationId == operation else {
                return statusMessage
            }
            phase = .recognized
            let pending = PendingShazamAdd(
                id: operation.uuidString,
                title: item.title ?? "Utwór",
                artist: item.artist,
                appleMusicID: item.appleMusicID,
                isrc: item.isrc,
                webURL: item.webURL?.absoluteString,
                createdAt: Date()
            )
            try? await ShazamOutbox.shared.enqueue(pending)
            ShazamLiveActivityController.shared.update(
                phase: .recognized,
                message: "Rozpoznano",
                title: pending.title,
                artist: pending.artist ?? ""
            )
            let message = try await addPending(pending, app: app)
            try? await ShazamOutbox.shared.remove(pending.id)
            reducer.finish(id: operation, phase: phase, message: message)
            ShazamLiveActivityController.shared.finish(phase: phase, message: message, title: pending.title, artist: pending.artist ?? "")
            EOSIntentRuntime.shared.publishSnapshot()
            EOSIntentRuntime.shared.reloadControls()
            return message
        } catch is CancellationError {
            return statusMessage
        } catch let error as ShazamIdentifyError {
            return fail(operation, error)
        } catch {
            return fail(operation, ShazamIdentifyError.isNetwork(error) ? .noNetwork : .notRecognized)
        }
    }

    private func timeout(_ operation: UUID) -> String {
        guard reducer.operationId == operation, phase == .listening || phase == .preparingActivity else {
            return statusMessage
        }
        sessionTask?.cancel()
        audioMatcher?.stop()
        return fail(operation, .notRecognized)
    }

    private func fail(_ operation: UUID, _ error: ShazamIdentifyError) -> String {
        reducer.timeout(id: operation)
        phase = .failed
        statusMessage = "Nie dodano do SHAZAM · \(error.reason)"
        lastSafeError = statusMessage
        AudioSession.endShazamCapture()
        ShazamLiveActivityController.shared.finish(phase: .failed, message: statusMessage)
        ShazamIdentifyController.shared.applyExternal(
            title: error.titleLine,
            artist: "",
            status: statusMessage,
            success: false,
            listening: false
        )
        EOSIntentRuntime.shared.publishSnapshot()
        EOSIntentRuntime.shared.reloadControls()
        return statusMessage
    }

    private func recognize() async throws -> SHMediaItem {
        let events = AsyncStream<ShazamMatcherEvent> { continuation in
            let matcher = ShazamAudioMatcher { event in
                continuation.yield(event)
            }
            audioMatcher = matcher
            do {
                try matcher.start()
            } catch {
                continuation.yield(.failed(error))
                continuation.finish()
                return
            }
            continuation.onTermination = { @Sendable _ in
                matcher.stop()
            }
        }
        let started = Date()
        var bestItem: SHMediaItem?
        var bestCandidate: ShazamMatchConfirmPolicy.Candidate?
        var agreeingCount = 0

        func acceptIfReady() -> SHMediaItem? {
            let elapsed = Date().timeIntervalSince(started)
            guard ShazamMatchConfirmPolicy.shouldAccept(
                elapsed: elapsed,
                agreeingCount: agreeingCount,
                hasCandidate: bestItem != nil
            ) else { return nil }
            return bestItem
        }

        for await event in events {
            if Task.isCancelled { throw CancellationError() }
            switch event {
            case .match(let item):
                let elapsed = Date().timeIntervalSince(started)
                guard ShazamMatchConfirmPolicy.shouldConsiderMatch(elapsed: elapsed) else { continue }
                let incoming = ShazamMatchConfirmPolicy.Candidate(
                    title: item.title ?? "",
                    artist: item.artist ?? "",
                    appleMusicID: item.appleMusicID ?? "",
                    isrc: item.isrc ?? ""
                )
                let applied = ShazamMatchConfirmPolicy.applyIncoming(
                    current: bestCandidate,
                    incoming: incoming,
                    agreeingCount: agreeingCount
                )
                let changed = bestCandidate?.identity != applied.candidate.identity
                bestCandidate = applied.candidate
                agreeingCount = applied.agreeingCount
                if changed || bestItem == nil {
                    bestItem = item
                }
                if let accepted = acceptIfReady() {
                    audioMatcher?.stop()
                    return accepted
                }
            case .noMatch(let error):
                if let error, ShazamIdentifyError.isNetwork(error) { throw ShazamIdentifyError.noNetwork }
                if let accepted = acceptIfReady() {
                    audioMatcher?.stop()
                    return accepted
                }
            case .failed(let error):
                if ShazamIdentifyError.isNetwork(error) { throw ShazamIdentifyError.noNetwork }
                if let accepted = acceptIfReady() {
                    audioMatcher?.stop()
                    return accepted
                }
                throw error
            case .timeout:
                if let accepted = acceptIfReady() {
                    audioMatcher?.stop()
                    return accepted
                }
                if let bestItem, Date().timeIntervalSince(started) >= ShazamMatchConfirmPolicy.minimumListenSeconds {
                    audioMatcher?.stop()
                    return bestItem
                }
                throw ShazamIdentifyError.notRecognized
            case .level:
                if let accepted = acceptIfReady() {
                    audioMatcher?.stop()
                    return accepted
                }
            }
        }
        if let bestItem, Date().timeIntervalSince(started) >= ShazamMatchConfirmPolicy.minimumListenSeconds {
            return bestItem
        }
        throw ShazamIdentifyError.notRecognized
    }

    private func addPending(_ pending: PendingShazamAdd, app: AppModel) async throws -> String {
        phase = .resolvingCatalog
        let folderId = try await app.ensureShazamFolderId()
        await app.refreshFolderTracks(folderId: folderId)
        let songs = try await collectCatalogSongs(pending: pending, api: app.api)
        guard let song = ShazamCatalogMatcher.bestSong(
            title: pending.title,
            artist: pending.artist,
            appleMusicID: pending.appleMusicID,
            isrc: pending.isrc,
            webURL: pending.webURL.flatMap(URL.init(string:)),
            songs: songs
        ) else {
            phase = .failed
            statusMessage = "Nie dodano do SHAZAM · brak w katalogu"
            lastSafeError = statusMessage
            throw ShazamIdentifyError.notRecognized
        }
        if app.folderContains(folderId: folderId, url: song.url)
            || app.folderContainsSameRecording(folderId: folderId, title: song.title, artist: song.uploader ?? song.detail) {
            phase = .alreadyPresent
            statusMessage = "Już jest na liście SHAZAM"
            ShazamIdentifyController.shared.applyExternal(
                title: song.title,
                artist: song.uploader ?? pending.artist ?? "",
                status: statusMessage,
                success: false,
                listening: false
            )
            return statusMessage
        }
        phase = .adding
        do {
            try await app.addTrackToFolder(
                folderId: folderId,
                track: song.payload,
                announcePlaylistName: nil,
                queueServerCopy: true
            )
            phase = .added
            statusMessage = "Dodano do SHAZAM · \(song.title)"
            ShazamIdentifyController.shared.applyExternal(
                title: song.title,
                artist: song.uploader ?? pending.artist ?? "",
                status: statusMessage,
                success: true,
                listening: false
            )
            return statusMessage
        } catch {
            if ShazamIdentifyError.isNetwork(error) {
                phase = .queuedOffline
                statusMessage = "Rozpoznano — dodam po odzyskaniu sieci"
                lastSafeError = statusMessage
                return statusMessage
            }
            throw error
        }
    }

    private func collectCatalogSongs(pending: PendingShazamAdd, api: MusicAPIClient) async throws -> [SearchResultItem] {
        var songs: [SearchResultItem] = []
        var seen = Set<String>()
        func append(_ extra: [SearchResultItem]) {
            for song in extra where seen.insert(song.url).inserted {
                songs.append(song)
            }
        }
        if let appleMusicID = pending.appleMusicID, !appleMusicID.isEmpty {
            if let search = try? await api.searchMusicCatalog(query: appleMusicID) {
                append(search.songs)
            }
        }
        if let artist = pending.artist, !artist.isEmpty {
            if let search = try? await api.searchMusicCatalog(query: "\(pending.title) \(artist)") {
                append(search.songs)
            }
        }
        append(try await api.searchMusicCatalog(query: pending.title).songs)
        return songs
    }
}
