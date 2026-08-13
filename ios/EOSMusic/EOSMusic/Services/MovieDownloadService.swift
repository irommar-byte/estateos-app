import Foundation
import UIKit

enum MovieDownloadItemState: Equatable {
    case pending
    case downloading(progress: Double)
    case pullingPhone(progress: Double)
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
    let destination: OnlineMovieDownloadDestination
    var isCancelled = false
    var isFinished = false
}

@MainActor
final class MovieDownloadService: ObservableObject {
    @Published private(set) var activeBatch: MovieDownloadBatch?
    @Published private(set) var statusMessage: String?

    private var batchTask: Task<Void, Never>?
    private var currentJobId: String?
    private weak var api: MusicAPIClient?
    private weak var onlineMovies: OnlineMoviesController?

    func attach(api: MusicAPIClient, onlineMovies: OnlineMoviesController) {
        self.api = api
        self.onlineMovies = onlineMovies
    }

    var isRunning: Bool {
        guard let batch = activeBatch else { return false }
        return !batch.isFinished && !batch.isCancelled && batchTask != nil
    }

    var hasActiveBatch: Bool { activeBatch != nil }

    func batchMatches(contextKey: String?) -> Bool {
        guard let batch = activeBatch, let contextKey else { return false }
        return batch.contextKey == contextKey
    }

    func itemState(for url: String) -> MovieDownloadItemState {
        activeBatch?.items.first(where: { $0.id == url })?.state ?? .pending
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
            case .done, .skipped:
                sum += 1
            case .downloading(let p), .pullingPhone(let p):
                let pct = p <= 1 ? p * 100 : p
                sum += min(max(pct, 0), 100) / 100
            default:
                break
            }
        }
        return sum / Double(batch.items.count)
    }

    var activeItemTitle: String? {
        activeBatch?.items.first(where: {
            switch $0.state {
            case .downloading, .pullingPhone: return true
            default: return false
            }
        })?.title
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
        batchTask = Task { await runBatch() }
    }

    func cancelBatch() {
        guard var batch = activeBatch else { return }
        batch.isCancelled = true
        activeBatch = batch
        if let currentJobId {
            Task { try? await api?.cancelJob(jobId: currentJobId) }
        }
        batchTask?.cancel()
        statusMessage = "Zatrzymano pobieranie."
    }

    func clearFinishedBatch() {
        guard activeBatch?.isFinished == true || activeBatch?.isCancelled == true else { return }
        activeBatch = nil
        statusMessage = nil
    }

    private func runBatch() async {
        guard let api, let onlineMovies else { return }
        guard var batch = activeBatch else { return }
        await onlineMovies.refreshDownloads()

        for index in batch.items.indices {
            if Task.isCancelled || batch.isCancelled { break }

            let item = batch.items[index]
            if onlineMovies.jobId(for: item.url) != nil {
                batch.items[index].state = .skipped
                activeBatch = batch
                continue
            }

            batch.items[index].state = .downloading(progress: 0)
            activeBatch = batch

            do {
                let height = MediaQualityOption.apiHeight(for: batch.quality, options: batch.quality.id == "best" ? [] : [batch.quality])
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
                currentJobId = start.jobId

                if start.ready != true {
                    try await waitForJob(jobId: start.jobId, itemIndex: index)
                } else {
                    batch.items[index].state = .downloading(progress: 100)
                    activeBatch = batch
                }

                _ = try await api.linkMovieDownload(
                    url: item.url,
                    title: item.title,
                    downloadJobId: start.jobId,
                    thumbnail: item.thumbnail,
                    source: item.source
                )
                await onlineMovies.refreshDownloads()

                if batch.destination == .serverAndPhone {
                    batch.items[index].state = .pullingPhone(progress: 0)
                    activeBatch = batch
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
                        jobId: start.jobId,
                        onProgress: { [weak self] pct in
                            Task { @MainActor in
                                guard var b = self?.activeBatch else { return }
                                b.items[index].state = .pullingPhone(progress: pct)
                                self?.activeBatch = b
                            }
                        }
                    )
                }

                batch.items[index].state = .done
                activeBatch = batch
            } catch {
                if batch.isCancelled || Task.isCancelled { break }
                batch.items[index].state = .failed(error.localizedDescription)
                activeBatch = batch
                statusMessage = "Nie udało się pobrać «\(item.title)»."
            }
            currentJobId = nil
        }

        batch.isFinished = true
        activeBatch = batch
        if batch.isCancelled {
            statusMessage = "Zatrzymano — \(completedCount)/\(batch.items.count) na serwerze."
        } else if failedCount > 0 {
            statusMessage = "Błędy: \(failedCount)/\(batch.items.count). Reszta w MOVIES/."
        } else {
            statusMessage = "Gotowe — \(completedCount) pozycji w MOVIES/."
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        batchTask = nil
    }

    private func waitForJob(jobId: String, itemIndex: Int) async throws {
        guard let api else { return }
        let deadline = Date().addingTimeInterval(45 * 60)
        var poll = 0
        while Date() < deadline {
            if Task.isCancelled || activeBatch?.isCancelled == true {
                throw APIError.server("Anulowano.")
            }
            let job = try await api.fetchJobStatus(jobId: jobId)
            if let progress = job.progress, var batch = activeBatch {
                batch.items[itemIndex].state = .downloading(progress: min(max(progress, 0), 100))
                activeBatch = batch
            }
            if job.status == "error" {
                throw APIError.server(job.error ?? "Pobieranie nie powiodło się.")
            }
            if job.ready == true || job.status == "done" { return }
            poll += 1
            let delay: UInt64 = poll < 30 ? 500_000_000 : 1_000_000_000
            try await Task.sleep(nanoseconds: delay)
        }
        throw APIError.server("Przekroczono czas oczekiwania na pobranie.")
    }
}
