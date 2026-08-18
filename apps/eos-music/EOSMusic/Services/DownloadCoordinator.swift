import Foundation

/// FIFO download scheduler with separate caps for server-acquire vs device transfers.
actor DownloadCoordinator {
    static let shared = DownloadCoordinator()

    enum Kind: Sendable {
        case serverAcquire
        case deviceTransfer
    }

    private struct Waiter {
        let id: UUID
        let trackUrl: String
        let kind: Kind
        let continuation: CheckedContinuation<Void, Error>
    }

    private let maxServerAcquire = 2
    private let maxDeviceTransfers = 2

    private var fifo: [Waiter] = []
    private var activeAcquire: Set<String> = []
    private var activeTransfer: Set<String> = []
    /// Full pipelines currently running (dedup key = trackUrl).
    private var activePipelines: Set<String> = []
    private var cancelledUrls: Set<String> = []
    /// Second callers waiting for an in-flight pipeline to finish.
    private var pipelineWaiters: [String: [CheckedContinuation<Void, Error>]] = [:]

    private var libraryChangedHandler: (() async -> Void)?
    private var libraryDebounceTask: Task<Void, Never>?

    // MARK: - Public API

    /// Enqueues a full download pipeline. Deduplicates by `trackUrl` (FIFO; late callers await the first).
    func enqueueDownload(
        trackUrl: String,
        operation: @escaping () async throws -> Void
    ) async throws {
        if activePipelines.contains(trackUrl) {
            EOSPerfLog.download.debug("dedup wait track=\(trackUrl, privacy: .public)")
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                pipelineWaiters[trackUrl, default: []].append(cont)
            }
            return
        }

        cancelledUrls.remove(trackUrl)
        activePipelines.insert(trackUrl)
        EOSPerfLog.download.info("enqueue track=\(trackUrl, privacy: .public) active=\(self.activePipelines.count)")

        let result: Result<Void, Error>
        do {
            try checkCancelled(trackUrl)
            try await runWithRetry(trackUrl: trackUrl, operation: operation)
            result = .success(())
        } catch {
            result = .failure(error)
        }

        activePipelines.remove(trackUrl)
        let waiters = pipelineWaiters.removeValue(forKey: trackUrl) ?? []
        for waiter in waiters {
            switch result {
            case .success:
                waiter.resume()
            case .failure(let error):
                waiter.resume(throwing: error)
            }
        }
        try result.get()
    }

    /// Runs `operation` under a phase slot (max 2 acquire / max 2 transfer).
    func withPhaseSlot<T>(
        trackUrl: String,
        kind: Kind,
        operation: () async throws -> T
    ) async throws -> T {
        try await acquireSlot(trackUrl: trackUrl, kind: kind)
        defer { releaseSlot(trackUrl: trackUrl, kind: kind) }
        try checkCancelled(trackUrl)
        return try await operation()
    }

    func cancel(trackUrl: String) {
        cancelledUrls.insert(trackUrl)
        EOSPerfLog.download.info("cancel track=\(trackUrl, privacy: .public)")

        var remaining: [Waiter] = []
        for waiter in fifo {
            if waiter.trackUrl == trackUrl {
                waiter.continuation.resume(throwing: CancellationError())
            } else {
                remaining.append(waiter)
            }
        }
        fifo = remaining

        if let waiters = pipelineWaiters.removeValue(forKey: trackUrl) {
            for waiter in waiters {
                waiter.resume(throwing: CancellationError())
            }
        }
    }

    func hasActiveDownloads() -> Bool {
        !activePipelines.isEmpty || !activeAcquire.isEmpty || !activeTransfer.isEmpty || !fifo.isEmpty
    }

    func setLibraryChangedHandler(_ handler: (() async -> Void)?) {
        libraryChangedHandler = handler
    }

    /// Debounced (500ms) library refresh callback.
    func notifyLibraryChanged() {
        libraryDebounceTask?.cancel()
        libraryDebounceTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled else { return }
            let handler = libraryChangedHandler
            await handler?()
            EOSPerfLog.download.debug("libraryChanged (debounced)")
        }
    }

    /// Convenience: schedule a one-shot debounced callback without replacing the stored handler.
    func notifyLibraryChanged(_ handler: @escaping () async -> Void) {
        libraryDebounceTask?.cancel()
        libraryDebounceTask = Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard !Task.isCancelled else { return }
            await handler()
            EOSPerfLog.download.debug("libraryChanged (debounced one-shot)")
        }
    }

    func isCancelled(_ trackUrl: String) -> Bool {
        cancelledUrls.contains(trackUrl)
    }

    // MARK: - Retry

    func runWithRetry(
        trackUrl: String,
        maxAttempts: Int = 5,
        operation: @escaping () async throws -> Void
    ) async throws {
        var attempt = 0
        while true {
            try checkCancelled(trackUrl)
            do {
                try await operation()
                return
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                guard let delay = DownloadRetryPolicy.delayNanoseconds(afterAttempt: attempt, maxAttempts: maxAttempts) else {
                    EOSPerfLog.download.error("retry exhausted track=\(trackUrl, privacy: .public) error=\(error.localizedDescription, privacy: .public)")
                    throw error
                }
                EOSPerfLog.download.warning("retry attempt=\(attempt) track=\(trackUrl, privacy: .public) sleepMs=\(delay / 1_000_000)")
                attempt += 1
                try await Task.sleep(nanoseconds: delay)
            }
        }
    }

    // MARK: - Slots

    private func acquireSlot(trackUrl: String, kind: Kind) async throws {
        try checkCancelled(trackUrl)
        if canStart(kind: kind) {
            markActive(trackUrl: trackUrl, kind: kind)
            return
        }

        let id = UUID()
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            fifo.append(Waiter(id: id, trackUrl: trackUrl, kind: kind, continuation: cont))
            EOSPerfLog.download.debug("queued kind=\(String(describing: kind), privacy: .public) track=\(trackUrl, privacy: .public) depth=\(self.fifo.count)")
            pump()
        }
        try checkCancelled(trackUrl)
    }

    private func releaseSlot(trackUrl: String, kind: Kind) {
        switch kind {
        case .serverAcquire:
            activeAcquire.remove(trackUrl)
        case .deviceTransfer:
            activeTransfer.remove(trackUrl)
        }
        pump()
    }

    private func pump() {
        var index = 0
        while index < fifo.count {
            let waiter = fifo[index]
            guard canStart(kind: waiter.kind) else {
                index += 1
                continue
            }
            fifo.remove(at: index)
            markActive(trackUrl: waiter.trackUrl, kind: waiter.kind)
            waiter.continuation.resume()
        }
    }

    private func canStart(kind: Kind) -> Bool {
        switch kind {
        case .serverAcquire:
            return activeAcquire.count < maxServerAcquire
        case .deviceTransfer:
            return activeTransfer.count < maxDeviceTransfers
        }
    }

    private func markActive(trackUrl: String, kind: Kind) {
        switch kind {
        case .serverAcquire:
            activeAcquire.insert(trackUrl)
        case .deviceTransfer:
            activeTransfer.insert(trackUrl)
        }
    }

    private func checkCancelled(_ trackUrl: String) throws {
        if cancelledUrls.contains(trackUrl) || Task.isCancelled {
            cancelledUrls.remove(trackUrl)
            throw CancellationError()
        }
    }
}
