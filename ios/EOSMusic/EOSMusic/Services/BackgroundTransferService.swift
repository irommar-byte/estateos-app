import Foundation

/// Foreground download session with real byte progress. Background config helper ready for later.
final class BackgroundTransferService: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
    static let shared = BackgroundTransferService()
    static let sessionIdentifier = "pl.nostalgie.eosmusic.downloads"

    private struct Pending {
        let continuation: CheckedContinuation<URL, Error>
        let onProgress: (@Sendable (Double) -> Void)?
        let partURL: URL
        var observation: NSKeyValueObservation?
    }

    private let lock = NSLock()
    private var pendingByTaskId: [Int: Pending] = [:]
    private var taskIdByTrackKey: [String: Int] = [:]

    private lazy var session: URLSession = {
        let config = Self.makeForegroundConfiguration()
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private override init() {
        super.init()
    }

    // MARK: - Configuration

    static func makeForegroundConfiguration() -> URLSessionConfiguration {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForResource = 3600
        config.timeoutIntervalForRequest = 120
        config.allowsExpensiveNetworkAccess = true
        config.allowsConstrainedNetworkAccess = true
        return config
    }

    /// Prepared for future background downloads (BGTask / relaunch).
    static func makeBackgroundConfiguration() -> URLSessionConfiguration {
        let config = URLSessionConfiguration.background(withIdentifier: sessionIdentifier)
        config.waitsForConnectivity = true
        config.timeoutIntervalForResource = 3600
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        config.allowsExpensiveNetworkAccess = true
        config.allowsConstrainedNetworkAccess = true
        return config
    }

    // MARK: - Download

    /// Downloads to a temporary location; caller should atomically move into place.
    /// Writes progress into `partURL` only as a cancel-cleanup marker (removed on cancel/success path).
    func download(
        request: URLRequest,
        partURL: URL,
        trackKey: String? = nil,
        onProgress: (@Sendable (Double) -> Void)? = nil
    ) async throws -> URL {
        if FileManager.default.fileExists(atPath: partURL.path) {
            try? FileManager.default.removeItem(at: partURL)
        }
        // Touch marker so cancel can find orphaned .part paths associated with this transfer.
        FileManager.default.createFile(atPath: partURL.path, contents: Data(), attributes: nil)

        var req = request
        if req.timeoutInterval < 60 {
            req.timeoutInterval = 3600
        }

        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let task = session.downloadTask(with: req)
            let pending = Pending(
                continuation: continuation,
                onProgress: onProgress,
                partURL: partURL,
                observation: nil
            )
            lock.lock()
            pendingByTaskId[task.taskIdentifier] = pending
            if let trackKey {
                taskIdByTrackKey[trackKey] = task.taskIdentifier
            }
            lock.unlock()

            // KVO as a backup progress path (delegate also reports bytes).
            let observation = task.progress.observe(\.fractionCompleted, options: [.new]) { [weak self] progress, _ in
                let fraction = min(1, max(0, progress.fractionCompleted))
                self?.lock.lock()
                let callback = self?.pendingByTaskId[task.taskIdentifier]?.onProgress
                self?.lock.unlock()
                callback?(fraction)
            }
            lock.lock()
            pendingByTaskId[task.taskIdentifier]?.observation = observation
            lock.unlock()

            EOSPerfLog.download.info("transfer start id=\(task.taskIdentifier) session=\(Self.sessionIdentifier, privacy: .public)")
            task.resume()
        }
    }

    func cancel(trackKey: String) {
        lock.lock()
        let taskId = taskIdByTrackKey.removeValue(forKey: trackKey)
        let pending = taskId.flatMap { pendingByTaskId[$0] }
        lock.unlock()

        if let taskId {
            session.getAllTasks { tasks in
                tasks.first(where: { $0.taskIdentifier == taskId })?.cancel()
            }
        }
        if let pending {
            cleanupPart(pending.partURL)
        }
    }

    func cancelAllMatching(partURL: URL) {
        lock.lock()
        let matches = pendingByTaskId.filter { $0.value.partURL == partURL }
        for key in matches.keys {
            pendingByTaskId.removeValue(forKey: key)
        }
        for (track, taskId) in taskIdByTrackKey where matches[taskId] != nil {
            taskIdByTrackKey.removeValue(forKey: track)
        }
        lock.unlock()

        session.getAllTasks { tasks in
            for task in tasks where matches[task.taskIdentifier] != nil {
                task.cancel()
            }
        }
        for match in matches.values {
            cleanupPart(match.partURL)
            match.observation?.invalidate()
            match.continuation.resume(throwing: CancellationError())
        }
    }

    // MARK: - URLSessionDownloadDelegate

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard totalBytesExpectedToWrite > 0 else { return }
        let fraction = min(1, max(0, Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)))
        lock.lock()
        let callback = pendingByTaskId[downloadTask.taskIdentifier]?.onProgress
        lock.unlock()
        callback?(fraction)
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        lock.lock()
        guard let pending = pendingByTaskId.removeValue(forKey: downloadTask.taskIdentifier) else {
            lock.unlock()
            return
        }
        removeTrackKeys(for: downloadTask.taskIdentifier)
        lock.unlock()

        pending.observation?.invalidate()
        cleanupPart(pending.partURL)

        do {
            let tempDir = FileManager.default.temporaryDirectory
            let stable = tempDir.appendingPathComponent("eos-dl-\(UUID().uuidString).tmp")
            if FileManager.default.fileExists(atPath: stable.path) {
                try FileManager.default.removeItem(at: stable)
            }
            try FileManager.default.copyItem(at: location, to: stable)
            EOSPerfLog.download.info("transfer done id=\(downloadTask.taskIdentifier)")
            pending.onProgress?(1)
            pending.continuation.resume(returning: stable)
        } catch {
            pending.continuation.resume(throwing: error)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error else { return }
        lock.lock()
        guard let pending = pendingByTaskId.removeValue(forKey: task.taskIdentifier) else {
            lock.unlock()
            return
        }
        removeTrackKeys(for: task.taskIdentifier)
        lock.unlock()

        pending.observation?.invalidate()
        cleanupPart(pending.partURL)

        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled {
            EOSPerfLog.download.info("transfer cancelled id=\(task.taskIdentifier)")
            pending.continuation.resume(throwing: CancellationError())
        } else {
            EOSPerfLog.download.error("transfer failed id=\(task.taskIdentifier) error=\(error.localizedDescription, privacy: .public)")
            pending.continuation.resume(throwing: error)
        }
    }

    // MARK: - Helpers

    private func removeTrackKeys(for taskId: Int) {
        let keys = taskIdByTrackKey.filter { $0.value == taskId }.map(\.key)
        for key in keys {
            taskIdByTrackKey.removeValue(forKey: key)
        }
    }

    private func cleanupPart(_ partURL: URL) {
        if FileManager.default.fileExists(atPath: partURL.path) {
            try? FileManager.default.removeItem(at: partURL)
        }
    }
}
