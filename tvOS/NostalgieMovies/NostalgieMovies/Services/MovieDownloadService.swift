import SwiftUI
import Combine

enum MovieDownloadItemState: Equatable {
    case pending
    case downloading(progress: Double)
    case done
    case failed(String)
    case skipped
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
}

struct MovieDownloadBatch: Identifiable, Equatable {
    let id: UUID
    let label: String
    let thumbnail: String?
    let contextKey: String?
    var items: [MovieDownloadQueueItem]
    let format: MediaDownloadFormat
    let quality: MediaQualityOption
    let allQualityOptions: [MediaQualityOption]
    var isCancelled = false
    var isFinished = false
}

@MainActor
final class MovieDownloadService: ObservableObject {
    @Published private(set) var activeBatch: MovieDownloadBatch?
    @Published private(set) var statusMessage: String?

    private var batchTask: Task<Void, Never>?
    private var currentJobId: String?
    private weak var app: AppModel?

    func attach(app: AppModel) {
        self.app = app
    }

    var isRunning: Bool {
        guard let batch = activeBatch else { return false }
        return !batch.isFinished && !batch.isCancelled && batchTask != nil
    }

    var hasActiveBatch: Bool {
        activeBatch != nil
    }

    func batchMatches(contextKey: String?) -> Bool {
        guard let batch = activeBatch, let contextKey else { return false }
        return batch.contextKey == contextKey
    }

    func itemState(for url: String) -> TrackDownloadUIState {
        guard let item = activeBatch?.items.first(where: { $0.id == url }) else { return .idle }
        switch item.state {
        case .pending:
            return .idle
        case .downloading(let progress):
            return .downloading(progress: progress)
        case .done, .skipped:
            return .done
        case .failed(let message):
            return .failed(message)
        }
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

    var totalCount: Int {
        activeBatch?.items.count ?? 0
    }

    var pendingCount: Int {
        max(totalCount - completedCount, 0)
    }

    var overallProgress: Double {
        guard let batch = activeBatch, !batch.items.isEmpty else { return 0 }
        var sum = 0.0
        for item in batch.items {
            switch item.state {
            case .done, .skipped:
                sum += 1
            case .downloading(let progress):
                let pct = progress <= 1.0 ? progress * 100 : progress
                sum += min(max(pct, 0), 100) / 100
            default:
                break
            }
        }
        return sum / Double(batch.items.count)
    }

    var activeItemTitle: String? {
        activeBatch?.items.first(where: {
            if case .downloading = $0.state { return true }
            return false
        })?.title
    }

    func startBatch(
        items: [MovieDownloadQueueItem],
        label: String,
        thumbnail: String?,
        contextKey: String?,
        format: MediaDownloadFormat,
        quality: MediaQualityOption,
        allQualityOptions: [MediaQualityOption]
    ) {
        guard !items.isEmpty else { return }
        batchTask?.cancel()
        statusMessage = nil
        activeBatch = MovieDownloadBatch(
            id: UUID(),
            label: label,
            thumbnail: thumbnail,
            contextKey: contextKey,
            items: items,
            format: format,
            quality: quality,
            allQualityOptions: allQualityOptions
        )
        batchTask = Task { await runBatch() }
    }

    func cancelBatch() {
        guard var batch = activeBatch else { return }
        batch.isCancelled = true
        activeBatch = batch
        if let currentJobId {
            Task { try? await app?.api.cancelJob(jobId: currentJobId) }
        }
        batchTask?.cancel()
        statusMessage = "Zatrzymano pobieranie."
    }

    func clearFinishedBatch() {
        guard activeBatch?.isFinished == true || activeBatch?.isCancelled == true else { return }
        activeBatch = nil
        statusMessage = nil
    }

    func deleteDownload(url: String) async throws {
        if let batch = activeBatch,
           batch.items.contains(where: { $0.id == url }),
           isRunning {
            if batch.items.first(where: { $0.id == url }).map({
                if case .downloading = $0.state { return true }
                return false
            }) == true {
                cancelBatch()
            }
        }
        guard let app else { return }
        try await app.api.deleteMovieDownload(url: url)
        await app.refreshMovieDownloads()
    }

    private func runBatch() async {
        guard let app else { return }
        guard var batch = activeBatch else { return }
        await app.refreshMovieDownloads()

        for index in batch.items.indices {
            if Task.isCancelled || batch.isCancelled { break }

            let item = batch.items[index]
            if app.isMovieDownloaded(url: item.url) {
                batch.items[index].state = .skipped
                activeBatch = batch
                continue
            }

            batch.items[index].state = .downloading(progress: 0)
            activeBatch = batch

            do {
                let started = try await MediaPlaybackLauncher.startDownload(
                    api: app.api,
                    url: item.url,
                    title: item.title,
                    thumbnail: item.thumbnail,
                    source: item.source,
                    format: batch.format,
                    quality: batch.quality,
                    allOptions: batch.allQualityOptions
                )
                let jobId = started.jobId
                currentJobId = jobId
                if started.ready == true || started.reused == true {
                    batch.items[index].state = .downloading(progress: 100)
                    activeBatch = batch
                } else {
                    try await waitForJob(jobId: jobId, itemIndex: index)
                }
                _ = try? await app.api.linkMovieDownload(
                    url: item.url,
                    title: item.title,
                    downloadJobId: jobId,
                    thumbnail: item.thumbnail,
                    source: item.source
                )
                batch.items[index].state = .done
                activeBatch = batch
                await app.refreshMovieDownloads()
            } catch {
                if batch.isCancelled || Task.isCancelled {
                    break
                }
                batch.items[index].state = .failed(error.localizedDescription)
                activeBatch = batch
                statusMessage = "Nie udało się pobrać «\(item.title)»."
            }
            currentJobId = nil
        }

        batch.isFinished = true
        activeBatch = batch
        if batch.isCancelled {
            statusMessage = "Zatrzymano — \(completedCount)/\(batch.items.count) w Bibliotece (MOVIES)."
        } else if batch.items.contains(where: { if case .failed = $0.state { return true }; return false }) {
            statusMessage = "Błędy: \(failedCount)/\(batch.items.count). Udane są w zakładce Biblioteka."
        } else {
            statusMessage = "Gotowe — \(completedCount) w Bibliotece. Odtwarzaj offline natychmiast."
        }
        batchTask = nil
    }

    private func waitForJob(jobId: String, itemIndex: Int) async throws {
        guard let app else { return }
        let deadline = Date().addingTimeInterval(900)
        var poll = 0
        while Date() < deadline {
            if Task.isCancelled || activeBatch?.isCancelled == true {
                throw APIError.server("Anulowano.")
            }
            do {
                let job = try await app.api.fetchJobStatus(jobId: jobId)
                if let progress = job.progress, var batch = activeBatch {
                    let pct = progress <= 1.0 ? progress * 100 : progress
                    batch.items[itemIndex].state = .downloading(progress: min(max(pct, 0), 100))
                    activeBatch = batch
                }
                if job.status == "error" {
                    throw APIError.server(job.error ?? "Pobieranie nie powiodło się.")
                }
                if job.ready == true || job.status == "done" {
                    return
                }
            } catch {
                await app.refreshMovieDownloads()
                if let url = activeBatch?.items[itemIndex].url, app.isMovieDownloaded(url: url) {
                    if var batch = activeBatch {
                        batch.items[itemIndex].state = .downloading(progress: 100)
                        activeBatch = batch
                    }
                    return
                }
                if poll > 4 {
                    throw error
                }
            }
            poll += 1
            let delayNs: UInt64 = poll < 30 ? 500_000_000 : 1_000_000_000
            try await Task.sleep(nanoseconds: delayNs)
        }
        throw APIError.server("Przekroczono czas oczekiwania na pobranie.")
    }
}
