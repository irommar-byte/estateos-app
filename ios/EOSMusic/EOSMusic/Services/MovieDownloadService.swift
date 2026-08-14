import Foundation
import UIKit

enum MovieDownloadItemState: Equatable {
    case idle
    case pending
    /// Submitted to EOS server — download continues even when the app is closed.
    case queuedOnServer
    case downloading(progress: Double)
    case pullingPhone(progress: Double)
    case done
    case failed(String)
    case skipped
    case cancelled
}

struct MovieDownloadQueueItem: Identifiable, Equatable {
    let id: String
    let url: String
    let title: String
    let thumbnail: String?
    let source: String?
    var state: MovieDownloadItemState

    init(
        url: String,
        title: String,
        thumbnail: String?,
        source: String?,
        state: MovieDownloadItemState = .pending
    ) {
        self.id = url
        self.url = url
        self.title = title
        self.thumbnail = thumbnail
        self.source = source
        self.state = state
    }

    var progressPercent: Double? {
        switch state {
        case .downloading(let p), .pullingPhone(let p):
            return min(100, max(0, p <= 1 ? p * 100 : p))
        default:
            return nil
        }
    }

    var phaseBadge: String? {
        switch state {
        case .downloading: return "SERWER"
        case .pullingPhone: return "iPHONE"
        case .pending: return "KOLEJKA"
        case .queuedOnServer: return "SERWER"
        case .done: return "GOTOWE"
        case .skipped: return "POMINIĘTE"
        case .cancelled: return "ANULOWANE"
        case .failed: return "BŁĄD"
        case .idle: return nil
        }
    }
}

struct MovieDownloadBatch: Identifiable, Equatable {
    let id: UUID
    let label: String
    let thumbnail: String?
    let contextKey: String?
    var items: [MovieDownloadQueueItem]
    let format: MediaDownloadFormat
    let quality: MediaQualityOption
    let destination: OnlineMovieDownloadDestination
    var isCancelled = false
    var isFinished = false
    /// `true` when the batch was reconstructed from GET /api/downloads/active (other device / app relaunch).
    var isRemoteSynced = false
}

// MARK: - Persistence (survives app kill / hours in background)

private struct PersistedMovieDownloadSnapshot: Codable {
    let batch: PersistedMovieDownloadBatch
    let jobIdsByURL: [String: String]
    let cancelledItemIds: [String]
    let savedAt: Date
}

private struct PersistedMovieDownloadBatch: Codable {
    let id: UUID
    let label: String
    let thumbnail: String?
    let contextKey: String?
    let items: [PersistedMovieDownloadQueueItem]
    let formatId: String
    let formatKind: String
    let formatContainer: String
    let formatLabel: String
    let quality: MediaQualityOption
    let destinationRaw: String
    let isCancelled: Bool
    let isFinished: Bool
}

private struct PersistedMovieDownloadQueueItem: Codable {
    let url: String
    let title: String
    let thumbnail: String?
    let source: String?
    let stateTag: String
    let progress: Double?
    let error: String?
}

private enum MovieDownloadPersistence {
    static let key = "eos.movieDownloadBatch.v1"

    static func save(
        batch: MovieDownloadBatch,
        jobIdsByURL: [String: String],
        cancelledItemIds: Set<String>
    ) {
        let snapshot = PersistedMovieDownloadSnapshot(
            batch: PersistedMovieDownloadBatch(batch: batch),
            jobIdsByURL: jobIdsByURL,
            cancelledItemIds: Array(cancelledItemIds),
            savedAt: Date()
        )
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func load() -> PersistedMovieDownloadSnapshot? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(PersistedMovieDownloadSnapshot.self, from: data)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

private extension PersistedMovieDownloadBatch {
    init(batch: MovieDownloadBatch) {
        id = batch.id
        label = batch.label
        thumbnail = batch.thumbnail
        contextKey = batch.contextKey
        items = batch.items.map { PersistedMovieDownloadQueueItem(item: $0) }
        formatId = batch.format.id
        formatKind = batch.format.kind
        formatContainer = batch.format.container
        formatLabel = batch.format.label
        quality = batch.quality
        destinationRaw = batch.destination == .serverAndPhone ? "serverAndPhone" : "server"
        isCancelled = batch.isCancelled
        isFinished = batch.isFinished
    }

    func restore() -> MovieDownloadBatch {
        MovieDownloadBatch(
            id: id,
            label: label,
            thumbnail: thumbnail,
            contextKey: contextKey,
            items: items.map { $0.restore() },
            format: MediaDownloadFormat(
                id: formatId,
                kind: formatKind,
                container: formatContainer,
                label: formatLabel
            ),
            quality: quality,
            destination: destinationRaw == "serverAndPhone" ? .serverAndPhone : .server,
            isCancelled: isCancelled,
            isFinished: isFinished,
            isRemoteSynced: false
        )
    }
}

private extension PersistedMovieDownloadQueueItem {
    init(item: MovieDownloadQueueItem) {
        url = item.url
        title = item.title
        thumbnail = item.thumbnail
        source = item.source
        var prog: Double?
        var err: String?
        switch item.state {
        case .idle: stateTag = "idle"
        case .pending: stateTag = "pending"
        case .queuedOnServer: stateTag = "queuedOnServer"
        case .downloading(let p):
            stateTag = "downloading"
            prog = p
        case .pullingPhone(let p):
            stateTag = "pullingPhone"
            prog = p
        case .done: stateTag = "done"
        case .failed(let msg):
            stateTag = "failed"
            err = msg
        case .skipped: stateTag = "skipped"
        case .cancelled: stateTag = "cancelled"
        }
        progress = prog
        error = err
    }

    func restore() -> MovieDownloadQueueItem {
        var item = MovieDownloadQueueItem(
            url: url,
            title: title,
            thumbnail: thumbnail,
            source: source,
            state: .pending
        )
        switch stateTag {
        case "idle": item.state = .idle
        case "pending": item.state = .pending
        case "queuedOnServer": item.state = .queuedOnServer
        case "downloading": item.state = .downloading(progress: progress ?? 0)
        case "pullingPhone": item.state = .pullingPhone(progress: progress ?? 0)
        case "done": item.state = .done
        case "failed": item.state = .failed(error ?? "Błąd pobierania")
        case "skipped": item.state = .skipped
        case "cancelled": item.state = .cancelled
        default: item.state = .pending
        }
        return item
    }
}

@MainActor
final class MovieDownloadService: ObservableObject {
    @Published private(set) var activeBatch: MovieDownloadBatch?
    @Published private(set) var statusMessage: String?

    private var batchTask: Task<Void, Never>?
    private var currentJobId: String?
    private var currentPhoneTrackKey: String?
    private var cancelledItemIds = Set<String>()
    private var progressAnchor: (date: Date, percent: Double)?
    private var lastProgressSample: (date: Date, percent: Double)?
    private weak var api: MusicAPIClient?
    private weak var onlineMovies: OnlineMoviesController?
    /// jobId keyed by item url — used when syncing remote progress into a local batch.
    private var remoteJobIdsByURL: [String: String] = [:]
    /// jobIds submitted to EOS server (persisted — survives app kill).
    private var itemJobIds: [String: String] = [:]

    func attach(api: MusicAPIClient, onlineMovies: OnlineMoviesController) {
        self.api = api
        self.onlineMovies = onlineMovies
    }

    var hasPersistedUnfinishedBatch: Bool {
        guard let snap = MovieDownloadPersistence.load() else { return false }
        return !snap.batch.isFinished && !snap.batch.isCancelled
    }

    /// Resume a batch saved before app kill / long background.
    func resumePersistedBatchIfNeeded() {
        guard batchTask == nil else { return }
        guard let snap = MovieDownloadPersistence.load() else { return }
        if snap.batch.isFinished || snap.batch.isCancelled {
            MovieDownloadPersistence.clear()
            return
        }
        itemJobIds = snap.jobIdsByURL
        remoteJobIdsByURL.merge(snap.jobIdsByURL) { _, new in new }
        cancelledItemIds = Set(snap.cancelledItemIds)
        activeBatch = snap.batch.restore()
        statusMessage = "Wznawiam pobieranie (\(completedCount)/\(totalCount))…"
        batchTask = Task { await runBatch() }
    }

    var isRunning: Bool {
        guard let batch = activeBatch else { return false }
        if batch.isRemoteSynced {
            return !batch.isFinished && !batch.isCancelled && batch.items.contains {
                switch $0.state {
                case .pending, .queuedOnServer, .downloading, .pullingPhone: return true
                default: return false
                }
            }
        }
        return !batch.isFinished && !batch.isCancelled && batchTask != nil
    }

    var hasActiveBatch: Bool { activeBatch != nil }

    func batchMatches(contextKey: String?) -> Bool {
        guard let batch = activeBatch, let contextKey else { return false }
        return batch.contextKey == contextKey
    }

    func itemState(for url: String) -> MovieDownloadItemState {
        activeBatch?.items.first(where: { $0.id == url })?.state ?? .idle
    }

    /// Postęp bieżącej pozycji (0…100) — serwer lub telefon.
    var activeItemProgress: Double? {
        activeBatch?.items.first(where: { $0.progressPercent != nil })?.progressPercent
    }

    var activeItemPhaseLabel: String? {
        guard let item = activeBatch?.items.first(where: {
            switch $0.state {
            case .downloading, .pullingPhone: return true
            default: return false
            }
        }) else { return nil }
        switch item.state {
        case .downloading: return "Zapis na serwerze EOS"
        case .pullingPhone: return "Kopiuję na iPhone"
        default: return nil
        }
    }

    var activeItemPhaseBadge: String? {
        activeBatch?.items.first(where: {
            switch $0.state {
            case .downloading, .pullingPhone: return true
            default: return false
            }
        })?.phaseBadge
    }

    var failedCount: Int {
        activeBatch?.items.filter {
            if case .failed = $0.state { return true }
            return false
        }.count ?? 0
    }

    var completedCount: Int {
        activeBatch?.items.filter {
            switch $0.state {
            case .done, .skipped: return true
            default: return false
            }
        }.count ?? 0
    }

    var totalCount: Int { activeBatch?.items.count ?? 0 }

    var overallProgress: Double {
        guard let batch = activeBatch, !batch.items.isEmpty else { return 0 }
        var sum = 0.0
        for item in batch.items {
            switch item.state {
            case .done, .skipped, .cancelled:
                sum += 1
            case .downloading(let p), .pullingPhone(let p):
                let pct = p <= 1 ? p * 100 : p
                sum += min(max(pct, 0), 100) / 100
            case .queuedOnServer:
                sum += 0.02
            default:
                break
            }
        }
        return sum / Double(batch.items.count)
    }

    var activeItemTitle: String? {
        activeBatch?.items.first(where: {
            switch $0.state {
            case .downloading, .pullingPhone, .queuedOnServer: return true
            default: return false
            }
        })?.title
    }

    /// Szacunek pozostałego czasu dla aktywnej pozycji.
    var activeETASeconds: TimeInterval? {
        guard let a = progressAnchor, let b = lastProgressSample else { return nil }
        let dp = b.percent - a.percent
        let dt = b.date.timeIntervalSince(a.date)
        guard dp >= 1.0, dt >= 1.2 else { return nil }
        let rate = dp / dt
        guard rate > 0.05 else { return nil }
        let remaining = (100 - b.percent) / rate
        guard remaining.isFinite, remaining > 0, remaining < 24 * 3600 else { return nil }
        return remaining
    }

    var activeETALabel: String? {
        guard let seconds = activeETASeconds else { return nil }
        return Self.formatETA(seconds)
    }

    /// Szacunek bajtów na podstawie jakości i % (gdy API nie podaje rozmiaru w locie).
    var activeBytesLabel: String? {
        guard let pct = activeItemProgress,
              let total = activeBatch?.quality.sizeBytes,
              total > 0 else { return nil }
        let done = Int((Double(total) * pct / 100.0).rounded())
        return "\(Self.formatBytes(done)) / \(Self.formatBytes(total))"
    }

    var activeDetailLine: String {
        var parts: [String] = []
        if let pct = activeItemProgress {
            parts.append(String(format: "%.0f%%", pct))
        }
        if let bytes = activeBytesLabel {
            parts.append(bytes)
        }
        if let eta = activeETALabel {
            parts.append("pozostało \(eta)")
        }
        return parts.joined(separator: " · ")
    }

    func startBatch(
        items: [MovieDownloadQueueItem],
        label: String,
        thumbnail: String?,
        contextKey: String?,
        format: MediaDownloadFormat,
        quality: MediaQualityOption,
        destination: OnlineMovieDownloadDestination = .server
    ) {
        guard !items.isEmpty else { return }
        batchTask?.cancel()
        cancelledItemIds.removeAll()
        resetProgressTiming()
        statusMessage = nil
        activeBatch = MovieDownloadBatch(
            id: UUID(),
            label: label,
            thumbnail: thumbnail,
            contextKey: contextKey,
            items: items,
            format: format,
            quality: quality,
            destination: destination
        )
        itemJobIds.removeAll()
        persistBatch()
        batchTask = Task { await runBatch() }
    }

    func cancelBatch() {
        guard var batch = activeBatch else { return }
        batch.isCancelled = true
        for index in batch.items.indices {
            switch batch.items[index].state {
            case .pending, .queuedOnServer, .downloading, .pullingPhone:
                batch.items[index].state = .cancelled
            default:
                break
            }
        }
        activeBatch = batch
        cancelCurrentNetworkWork()
        // Also cancel any remote-synced job ids we know about.
        let jobIds = Set(remoteJobIdsByURL.values)
        for jobId in jobIds {
            Task { try? await api?.cancelJob(jobId: jobId) }
        }
        batchTask?.cancel()
        statusMessage = "Zatrzymano pobieranie."
        persistBatch()
    }

    /// Anuluje pojedynczą pozycję w kolejce (lub aktywną).
    func cancelItem(id: String) {
        guard var batch = activeBatch else { return }
        guard let index = batch.items.firstIndex(where: { $0.id == id }) else { return }

        switch batch.items[index].state {
        case .done, .skipped, .cancelled:
            return
        case .failed:
            return
        default:
            break
        }

        cancelledItemIds.insert(id)
        let wasActive: Bool = {
            switch batch.items[index].state {
            case .downloading, .pullingPhone: return true
            default: return false
            }
        }()

        batch.items[index].state = .cancelled
        activeBatch = batch

        if let jobId = remoteJobIdsByURL[id] ?? remoteJobIdsByURL[batch.items[index].url] {
            Task { try? await api?.cancelJob(jobId: jobId) }
        }

        if wasActive {
            cancelCurrentNetworkWork()
            // runBatch wyjdzie z wait/pull przez cancel i przejdzie dalej
        }
    }

    func clearFinishedBatch() {
        guard activeBatch?.isFinished == true || activeBatch?.isCancelled == true else { return }
        activeBatch = nil
        statusMessage = nil
        cancelledItemIds.removeAll()
        itemJobIds.removeAll()
        resetProgressTiming()
        MovieDownloadPersistence.clear()
    }

    private func persistBatch() {
        guard let batch = activeBatch else {
            MovieDownloadPersistence.clear()
            return
        }
        MovieDownloadPersistence.save(
            batch: batch,
            jobIdsByURL: itemJobIds,
            cancelledItemIds: cancelledItemIds
        )
    }

    private func cancelCurrentNetworkWork() {
        if let currentJobId {
            Task { try? await api?.cancelJob(jobId: currentJobId) }
        }
        if let key = currentPhoneTrackKey {
            BackgroundTransferService.shared.cancel(trackKey: key)
        }
    }

    private func runBatch() async {
        guard let api, let onlineMovies else { return }
        guard var batch = activeBatch else { return }
        await onlineMovies.refreshDownloads()

        // Submit every pending item to EOS server immediately — downloads continue when the app is closed.
        await enqueueAllPendingOnServer()

        for index in batch.items.indices {
            if Task.isCancelled || batch.isCancelled { break }
            batch = activeBatch ?? batch
            if cancelledItemIds.contains(batch.items[index].id) {
                batch.items[index].state = .cancelled
                activeBatch = batch
                persistBatch()
                continue
            }

            let item = batch.items[index]
            if case .cancelled = item.state { continue }
            if case .done = item.state { continue }
            if case .skipped = item.state { continue }
            if case .failed = item.state { continue }

            resetProgressTiming()

            if let existingJobId = onlineMovies.jobId(for: item.url) {
                if batch.destination == .serverAndPhone {
                    batch.items[index].state = .pullingPhone(progress: 0)
                    activeBatch = batch
                    persistBatch()
                    do {
                        try await onlineMovies.pullToPhoneAfterServer(
                            selection: OnlineMovieSelection(
                                title: item.title,
                                url: item.url,
                                thumbnail: item.thumbnail,
                                source: item.source,
                                detail: nil,
                                duration: nil,
                                isSerial: false
                            ),
                            jobId: existingJobId,
                            onProgress: { [weak self] pct in
                                Task { @MainActor in
                                    self?.applyProgress(itemIndex: index, phone: true, percent: pct)
                                }
                            }
                        )
                        if cancelledItemIds.contains(item.id) || activeBatch?.isCancelled == true {
                            markCancelled(index: index)
                        } else {
                            batch = activeBatch ?? batch
                            batch.items[index].state = .done
                            activeBatch = batch
                            persistBatch()
                        }
                    } catch is CancellationError {
                        markCancelled(index: index)
                    } catch {
                        if cancelledItemIds.contains(item.id) || activeBatch?.isCancelled == true {
                            markCancelled(index: index)
                        } else {
                            batch = activeBatch ?? batch
                            batch.items[index].state = .failed(error.localizedDescription)
                            activeBatch = batch
                            persistBatch()
                        }
                    }
                } else {
                    batch.items[index].state = .skipped
                    activeBatch = batch
                    persistBatch()
                }
                continue
            }

            batch.items[index].state = .downloading(progress: 0)
            activeBatch = batch
            noteProgress(0)
            persistBatch()

            do {
                let startJobId: String
                let alreadyReady: Bool

                if let known = itemJobIds[item.url] ?? remoteJobIdsByURL[item.url] {
                    startJobId = known
                    alreadyReady = false
                } else {
                    let height = MediaQualityOption.apiHeight(
                        for: batch.quality,
                        options: batch.quality.id == "best" ? [] : [batch.quality]
                    )
                    let start = try await api.startMovieDownload(
                        url: item.url,
                        height: height,
                        title: item.title,
                        thumbnail: item.thumbnail,
                        source: item.source,
                        kind: batch.format.kind,
                        container: batch.format.container,
                        audioBitrate: batch.format.kind == "audio" ? (batch.quality.bitrate ?? 0) : nil
                    )
                    startJobId = start.jobId
                    itemJobIds[item.url] = start.jobId
                    remoteJobIdsByURL[item.url] = start.jobId
                    persistBatch()
                    alreadyReady = start.ready == true
                }

                currentJobId = startJobId

                if cancelledItemIds.contains(item.id) || Task.isCancelled || activeBatch?.isCancelled == true {
                    try? await api.cancelJob(jobId: startJobId)
                    markCancelled(index: index)
                    currentJobId = nil
                    continue
                }

                if !alreadyReady {
                    try await waitForJob(jobId: startJobId, itemIndex: index)
                } else {
                    applyProgress(itemIndex: index, phone: false, percent: 100)
                }

                if cancelledItemIds.contains(item.id) || Task.isCancelled || activeBatch?.isCancelled == true {
                    markCancelled(index: index)
                    currentJobId = nil
                    continue
                }

                _ = try await api.linkMovieDownload(
                    url: item.url,
                    title: item.title,
                    downloadJobId: startJobId,
                    thumbnail: item.thumbnail,
                    source: item.source
                )
                await onlineMovies.refreshDownloads()
                let landed = onlineMovies.downloads.contains {
                    MovieURLMatching.urlsMatch($0.url, item.url)
                        && (($0.bytes ?? 0) > 0 || ($0.downloadJobId?.isEmpty == false))
                }
                if !landed {
                    throw APIError.server("Film nie pojawił się w MOVIES/ na serwerze — spróbuj ponownie.")
                }

                if batch.destination == .serverAndPhone {
                    batch = activeBatch ?? batch
                    batch.items[index].state = .pullingPhone(progress: 0)
                    activeBatch = batch
                    resetProgressTiming()
                    noteProgress(0)
                    persistBatch()
                    let phoneKey = "movie:\(item.url)"
                    currentPhoneTrackKey = phoneKey
                    try await onlineMovies.pullToPhoneAfterServer(
                        selection: OnlineMovieSelection(
                            title: item.title,
                            url: item.url,
                            thumbnail: item.thumbnail,
                            source: item.source,
                            detail: nil,
                            duration: nil,
                            isSerial: false
                        ),
                        jobId: startJobId,
                        onProgress: { [weak self] pct in
                            Task { @MainActor in
                                self?.applyProgress(itemIndex: index, phone: true, percent: pct)
                            }
                        }
                    )
                    currentPhoneTrackKey = nil
                }

                if cancelledItemIds.contains(item.id) || activeBatch?.isCancelled == true {
                    markCancelled(index: index)
                } else {
                    batch = activeBatch ?? batch
                    batch.items[index].state = .done
                    activeBatch = batch
                    persistBatch()
                }
            } catch is CancellationError {
                markCancelled(index: index)
            } catch {
                if cancelledItemIds.contains(item.id) || batch.isCancelled || Task.isCancelled || activeBatch?.isCancelled == true {
                    markCancelled(index: index)
                } else {
                    batch = activeBatch ?? batch
                    batch.items[index].state = .failed(error.localizedDescription)
                    activeBatch = batch
                    statusMessage = "Nie udało się pobrać «\(item.title)»."
                    persistBatch()
                }
            }
            currentJobId = nil
            currentPhoneTrackKey = nil
        }

        batch = activeBatch ?? batch
        batch.isFinished = true
        activeBatch = batch
        if batch.isCancelled {
            statusMessage = "Zatrzymano — \(completedCount)/\(batch.items.count) gotowe."
        } else if failedCount > 0 {
            statusMessage = "Błędy: \(failedCount)/\(batch.items.count). Reszta w MOVIES/."
        } else {
            statusMessage = "Gotowe — \(completedCount) pozycji w MOVIES/."
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        batchTask = nil
        resetProgressTiming()
        persistBatch()
        MovieDownloadPersistence.clear()
    }

    /// Fire-and-forget server jobs for all pending items so EOS keeps working when the app is suspended.
    private func enqueueAllPendingOnServer() async {
        guard let api, let onlineMovies else { return }
        guard var batch = activeBatch, !batch.isRemoteSynced else { return }

        await onlineMovies.refreshDownloads()

        for index in batch.items.indices {
            if Task.isCancelled || batch.isCancelled { break }
            let item = batch.items[index]
            if cancelledItemIds.contains(item.id) { continue }
            switch item.state {
            case .done, .skipped, .cancelled, .failed, .pullingPhone:
                continue
            default:
                break
            }
            if onlineMovies.jobId(for: item.url) != nil { continue }
            if itemJobIds[item.url] != nil {
                if case .pending = batch.items[index].state {
                    batch.items[index].state = .queuedOnServer
                }
                continue
            }

            do {
                let height = MediaQualityOption.apiHeight(
                    for: batch.quality,
                    options: batch.quality.id == "best" ? [] : [batch.quality]
                )
                let start = try await api.startMovieDownload(
                    url: item.url,
                    height: height,
                    title: item.title,
                    thumbnail: item.thumbnail,
                    source: item.source,
                    kind: batch.format.kind,
                    container: batch.format.container,
                    audioBitrate: batch.format.kind == "audio" ? (batch.quality.bitrate ?? 0) : nil
                )
                itemJobIds[item.url] = start.jobId
                remoteJobIdsByURL[item.url] = start.jobId
                if start.ready != true {
                    batch.items[index].state = .queuedOnServer
                }
                activeBatch = batch
                persistBatch()
            } catch {
                // runBatch will retry this item in the sequential pass.
                continue
            }

            try? await Task.sleep(nanoseconds: 250_000_000)
        }
        activeBatch = batch
        persistBatch()
    }

    private func markCancelled(index: Int) {
        guard var batch = activeBatch, batch.items.indices.contains(index) else { return }
        batch.items[index].state = .cancelled
        activeBatch = batch
        persistBatch()
    }

    private func applyProgress(itemIndex: Int, phone: Bool, percent: Double) {
        guard var batch = activeBatch, batch.items.indices.contains(itemIndex) else { return }
        let id = batch.items[itemIndex].id
        if cancelledItemIds.contains(id) || batch.isCancelled { return }
        let pct = min(max(percent, 0), 100)
        batch.items[itemIndex].state = phone ? .pullingPhone(progress: pct) : .downloading(progress: pct)
        activeBatch = batch
        noteProgress(pct)
        persistBatch()
    }

    private func noteProgress(_ percent: Double) {
        let now = Date()
        if let last = lastProgressSample, percent + 0.2 < last.percent {
            progressAnchor = (now, percent)
        } else if progressAnchor == nil {
            progressAnchor = (now, percent)
        }
        lastProgressSample = (now, percent)
    }

    private func resetProgressTiming() {
        progressAnchor = nil
        lastProgressSample = nil
    }

    private func waitForJob(jobId: String, itemIndex: Int) async throws {
        guard let api else { return }
        let absoluteDeadline = Date().addingTimeInterval(8 * 3600)
        let maxIdle: TimeInterval = 45 * 60
        var poll = 0
        var lastProgress: Double = -1
        var lastProgressAt = Date()

        while Date() < absoluteDeadline {
            if Task.isCancelled || activeBatch?.isCancelled == true {
                throw CancellationError()
            }
            if let id = activeBatch?.items[safe: itemIndex]?.id, cancelledItemIds.contains(id) {
                throw CancellationError()
            }
            let job = try await api.fetchJobStatus(jobId: jobId)
            if job.status == "error" {
                throw APIError.server(job.error ?? "Pobieranie nie powiodło się.")
            }

            let rawProgress = job.progress ?? 0
            if rawProgress > lastProgress + 0.3 {
                lastProgress = rawProgress
                lastProgressAt = Date()
            }

            if job.status == "processing" {
                applyProgress(itemIndex: itemIndex, phone: false, percent: min(job.progress ?? 99, 99))
            } else if let progress = job.progress {
                applyProgress(
                    itemIndex: itemIndex,
                    phone: false,
                    percent: min(progress, job.status == "done" ? 100 : 99)
                )
            }

            if job.ready == true || job.status == "done" {
                applyProgress(itemIndex: itemIndex, phone: false, percent: 100)
                return
            }

            if Date().timeIntervalSince(lastProgressAt) > maxIdle {
                throw APIError.server("Pobieranie zatrzymało się — brak postępu przez 45 min.")
            }

            poll += 1
            let delay: UInt64 = poll < 30 ? 500_000_000 : 1_000_000_000
            try await Task.sleep(nanoseconds: delay)
        }
        throw APIError.server("Przekroczono czas oczekiwania na pobranie (8 h).")
    }

    static func formatETA(_ seconds: TimeInterval) -> String {
        let s = Int(seconds.rounded())
        if s < 60 { return "< 1 min" }
        let m = s / 60
        if m < 60 { return "\(m) min" }
        let h = m / 60
        let rm = m % 60
        return rm > 0 ? "\(h) godz. \(rm) min" : "\(h) godz."
    }

    static func formatBytes(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }

    /// Merge GET /api/downloads/active movie jobs into the queue UI (cross-device + after relaunch).
    func applyRemoteServerDownloads(_ remote: [ActiveServerDownload]) {
        let movies = remote.filter { $0.isMovie && !$0.url.isEmpty }
        remoteJobIdsByURL = Dictionary(uniqueKeysWithValues: movies.map { ($0.url, $0.jobId) })
        for movie in movies {
            itemJobIds[movie.url] = movie.jobId
        }

        // Local batch runner owns sequencing — refresh progress for matching URLs.
        if batchTask != nil, var batch = activeBatch, !batch.isRemoteSynced {
            var changed = false
            for item in movies {
                guard let index = batch.items.firstIndex(where: { MovieURLMatching.urlsMatch($0.url, item.url) }) else { continue }
                switch batch.items[index].state {
                case .pullingPhone:
                    continue // phone phase is local-only
                case .done, .skipped, .cancelled:
                    continue
                default:
                    break
                }
                if item.isFailed {
                    batch.items[index].state = .failed(item.error ?? "Anulowano")
                    changed = true
                    continue
                }
                if item.isTerminal {
                    applyProgress(itemIndex: index, phone: false, percent: 100)
                    continue
                }
                applyProgress(itemIndex: index, phone: false, percent: item.progressPercent)
                changed = true
            }
            if changed {
                activeBatch = batch
                persistBatch()
            }
            return
        }

        // Persisted batch without live runner — restart orchestration.
        if batchTask == nil, hasPersistedUnfinishedBatch, activeBatch == nil || activeBatch?.isRemoteSynced == true {
            resumePersistedBatchIfNeeded()
            return
        }

        // No local runner — reconstruct a server-only batch from the account queue.
        let live = movies.filter { !$0.isTerminal }
        let recentDone = movies.filter { $0.isTerminal && !$0.isFailed }
        if live.isEmpty && recentDone.isEmpty {
            if activeBatch?.isRemoteSynced == true {
                if var batch = activeBatch {
                    batch.isFinished = true
                    activeBatch = batch
                }
            }
            return
        }

        let all = live + recentDone
        var items: [MovieDownloadQueueItem] = all.map { remote in
            var item = MovieDownloadQueueItem(
                url: remote.url,
                title: remote.title,
                thumbnail: remote.thumbnail,
                source: nil,
                state: .pending
            )
            if remote.isFailed {
                item.state = .failed(remote.error ?? "Błąd")
            } else if remote.isTerminal {
                item.state = .done
            } else {
                item.state = .downloading(progress: remote.progressPercent)
            }
            return item
        }

        if let existing = activeBatch, existing.isRemoteSynced {
            // Preserve cancelled local marks.
            for index in items.indices {
                if let prev = existing.items.first(where: { $0.url == items[index].url }),
                   case .cancelled = prev.state {
                    items[index].state = .cancelled
                }
            }
        }

        let batch = MovieDownloadBatch(
            id: activeBatch?.isRemoteSynced == true ? (activeBatch?.id ?? UUID()) : UUID(),
            label: "Pobieranie na serwerze EOS",
            thumbnail: items.first?.thumbnail,
            contextKey: "account-server-queue",
            items: items,
            format: .videoMP4,
            quality: MediaQualityOption(id: "best", label: "Best"),
            destination: .server,
            isCancelled: false,
            isFinished: live.isEmpty,
            isRemoteSynced: true
        )
        activeBatch = batch
        if let active = live.first {
            noteProgress(active.progressPercent)
        }
        statusMessage = live.isEmpty ? "Gotowe na serwerze." : nil
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
