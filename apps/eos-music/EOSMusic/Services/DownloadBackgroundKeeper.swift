import BackgroundTasks
import Foundation
import UIKit

/// Keeps server-queue polling and Live Activity updates alive after lock.
/// Server ingest continues on EOS; the phone only needs periodic status fetches
/// plus background URLSession / BGTask wakes so ActivityKit can move.
@MainActor
final class DownloadBackgroundKeeper: NSObject, URLSessionDownloadDelegate {
    static let shared = DownloadBackgroundKeeper()
    static let sessionIdentifier = "pl.nostalgie.eosmusic.status-poll"
    static let refreshTaskId = "pl.nostalgie.eosmusic.refresh-downloads"
    static let processTaskId = "pl.nostalgie.eosmusic.process-downloads"

    private weak var monitor: ServerAccountDownloadsMonitor?
    private weak var api: MusicAPIClient?
    private weak var music: MusicDownloadService?
    private weak var movies: MovieDownloadService?

    private var appTask = UIBackgroundTaskIdentifier.invalid
    private var backgroundCompletion: (() -> Void)?
    private var keepAliveTask: Task<Void, Never>?
    private var wakeInFlight = false
    private lazy var pollSession: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: Self.sessionIdentifier)
        config.sessionSendsLaunchEvents = true
        config.isDiscretionary = false
        config.waitsForConnectivity = true
        config.shouldUseExtendedBackgroundIdleMode = true
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 45
        config.allowsExpensiveNetworkAccess = true
        config.allowsConstrainedNetworkAccess = true
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private override init() {
        super.init()
    }

    nonisolated static func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshTaskId, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            Task { @MainActor in
                await DownloadBackgroundKeeper.shared.handleRefresh(task)
            }
        }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: processTaskId, using: nil) { task in
            guard let task = task as? BGProcessingTask else { return }
            Task { @MainActor in
                await DownloadBackgroundKeeper.shared.handleProcess(task)
            }
        }
    }

    func attach(
        monitor: ServerAccountDownloadsMonitor,
        api: MusicAPIClient,
        music: MusicDownloadService,
        movies: MovieDownloadService
    ) {
        self.monitor = monitor
        self.api = api
        self.music = music
        self.movies = movies
    }

    var hasWork: Bool {
        monitor?.hasActiveServerWork == true
            || music?.hasActiveQueue == true
            || movies?.hasActiveBatch == true
    }

    func applicationWillResignActive() {
        guard hasWork else { return }
        startKeepAliveLoop()
        submitBGTasks()
    }

    func applicationDidEnterBackground() {
        guard hasWork else { return }
        startKeepAliveLoop()
        scheduleWake(after: 3)
        submitBGTasks()
    }

    func applicationWillEnterForeground() {
        keepAliveTask?.cancel()
        keepAliveTask = nil
        wakeInFlight = false
        endAppTask()
        Task {
            await monitor?.refreshOnce()
            movies?.resumePersistedBatchIfNeeded()
        }
    }

    func handleEventsForBackgroundURLSession(completionHandler: @escaping () -> Void) {
        backgroundCompletion = completionHandler
        startKeepAliveLoop()
    }

    func noteWorkChanged() {
        if hasWork {
            startKeepAliveLoop()
            if UIApplication.shared.applicationState != .active {
                scheduleWake(after: 3)
                submitBGTasks()
            }
        } else {
            keepAliveTask?.cancel()
            keepAliveTask = nil
            wakeInFlight = false
            let session = pollSession
            session.getAllTasks { tasks in
                tasks.forEach { $0.cancel() }
            }
            endAppTask()
        }
    }

    private func startKeepAliveLoop() {
        guard hasWork else { return }
        holdAppTask()
        if keepAliveTask != nil { return }
        keepAliveTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, self.hasWork else { break }
                await self.monitor?.refreshOnce()
                let remaining = UIApplication.shared.backgroundTimeRemaining
                if remaining < 8, UIApplication.shared.applicationState != .active {
                    self.scheduleWake(after: 2)
                    break
                }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
            self?.keepAliveTask = nil
        }
    }

    private func holdAppTask() {
        guard appTask == .invalid else { return }
        appTask = UIApplication.shared.beginBackgroundTask(withName: "EOSMusic.DownloadKeepAlive") { [weak self] in
            Task { @MainActor in
                self?.endAppTask()
                self?.scheduleWake(after: 2)
                self?.submitBGTasks()
            }
        }
    }

    private func endAppTask() {
        guard appTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(appTask)
        appTask = .invalid
    }

    private func scheduleWake(after seconds: TimeInterval) {
        guard hasWork, !wakeInFlight, let request = api?.activeDownloadsURLRequest() else { return }
        wakeInFlight = true
        var req = request
        req.timeoutInterval = 20
        let session = pollSession
        session.getAllTasks { [weak self] tasks in
            if tasks.contains(where: { $0.state == .running || $0.state == .suspended }) {
                Task { @MainActor in self?.wakeInFlight = true }
                return
            }
            let task = session.downloadTask(with: req)
            task.earliestBeginDate = Date().addingTimeInterval(seconds)
            task.countOfBytesClientExpectsToSend = 200
            task.countOfBytesClientExpectsToReceive = 120_000
            task.resume()
        }
    }

    private func submitBGTasks() {
        guard hasWork else { return }
        let refresh = BGAppRefreshTaskRequest(identifier: Self.refreshTaskId)
        refresh.earliestBeginDate = Date().addingTimeInterval(15)
        try? BGTaskScheduler.shared.submit(refresh)

        let process = BGProcessingTaskRequest(identifier: Self.processTaskId)
        process.requiresNetworkConnectivity = true
        process.requiresExternalPower = false
        process.earliestBeginDate = Date().addingTimeInterval(20)
        try? BGTaskScheduler.shared.submit(process)
    }

    private func handleRefresh(_ task: BGAppRefreshTask) async {
        submitBGTasks()
        task.expirationHandler = {
            Task { @MainActor in
                DownloadBackgroundKeeper.shared.scheduleWake(after: 2)
            }
        }
        await monitor?.refreshOnce()
        movies?.resumePersistedBatchIfNeeded()
        if hasWork {
            startKeepAliveLoop()
            scheduleWake(after: 4)
        }
        task.setTaskCompleted(success: true)
    }

    private func handleProcess(_ task: BGProcessingTask) async {
        submitBGTasks()
        task.expirationHandler = {
            Task { @MainActor in
                DownloadBackgroundKeeper.shared.scheduleWake(after: 2)
            }
        }
        await monitor?.refreshOnce()
        movies?.resumePersistedBatchIfNeeded()
        if hasWork {
            startKeepAliveLoop()
            scheduleWake(after: 4)
        }
        task.setTaskCompleted(success: true)
    }

    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        let data = try? Data(contentsOf: location)
        Task { @MainActor in
            self.wakeInFlight = false
            await self.applyPollData(data)
            if self.hasWork {
                self.startKeepAliveLoop()
                self.scheduleWake(after: 4)
            } else {
                self.endAppTask()
            }
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        Task { @MainActor in
            if error != nil {
                self.wakeInFlight = false
                if self.hasWork {
                    self.scheduleWake(after: 8)
                }
            }
        }
    }

    nonisolated func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        Task { @MainActor in
            let done = self.backgroundCompletion
            self.backgroundCompletion = nil
            done?()
        }
    }

    private func applyPollData(_ data: Data?) async {
        if let data, let response = try? JSONDecoder().decode(ActiveServerDownloadsResponse.self, from: data) {
            monitor?.applyDecoded(response)
        } else {
            await monitor?.refreshOnce()
        }
    }
}
