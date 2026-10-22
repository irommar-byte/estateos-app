import BackgroundTasks
import Foundation
import UIKit
import UserNotifications

enum SyncPolicy {
    private static let enabledKey = "galleryos.sync.enabled"
    private static let wifiKey = "galleryos.sync.wifiOnly"
    private static let chargeKey = "galleryos.sync.chargingOnly"

    static var uploadsEnabled: Bool {
        get {
            guard UserDefaults.standard.object(forKey: enabledKey) != nil else { return true }
            return UserDefaults.standard.bool(forKey: enabledKey)
        }
        set { UserDefaults.standard.set(newValue, forKey: enabledKey) }
    }

    static var wifiOnly: Bool {
        get { UserDefaults.standard.bool(forKey: wifiKey) }
        set { UserDefaults.standard.set(newValue, forKey: wifiKey) }
    }

    static var chargingOnly: Bool {
        get { UserDefaults.standard.bool(forKey: chargeKey) }
        set { UserDefaults.standard.set(newValue, forKey: chargeKey) }
    }

    static var charging: Bool {
        let state = UIDevice.current.batteryState
        return state == .charging || state == .full
    }

    static func blockReason(needsNetwork: Bool, online: Bool, onWiFi: Bool, constrained: Bool) -> String? {
        if chargingOnly, !charging {
            return L("Czeka na ładowanie")
        }
        guard needsNetwork else { return nil }
        if !online { return L("Brak sieci") }
        if wifiOnly, !onWiFi { return L("Czeka na Wi-Fi") }
        if constrained, !onWiFi { return L("Oszczędzanie danych") }
        return nil
    }

    /// While on, the screen stays awake until the queue reaches 100%, then a notification says it can lock.
    static var keepUnlocked: Bool {
        get {
            guard UserDefaults.standard.object(forKey: "galleryos.sync.keepUnlocked") != nil else { return true }
            return UserDefaults.standard.bool(forKey: "galleryos.sync.keepUnlocked")
        }
        set { UserDefaults.standard.set(newValue, forKey: "galleryos.sync.keepUnlocked") }
    }
}

/// Readable from the system expiration callback, which must not hop to the main thread first.
enum SyncRun {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var copying = false

    static func setCopying(_ value: Bool) {
        lock.lock()
        copying = value
        lock.unlock()
    }

    static var isCopying: Bool {
        lock.lock()
        defer { lock.unlock() }
        return copying
    }
}

enum SyncNotice {
    static func allow() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func finished(count: Int) {
        let content = UNMutableNotificationContent()
        content.title = L("Synchronizacja skończona")
        content.body = L("Wysłano \(TransferText.groupedPublic(count)) \(word(count)). Możesz zablokować telefon.")
        content.sound = .default
        let request = UNNotificationRequest(identifier: "galleryos.sync.done", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private static func word(_ count: Int) -> String {
        Plural.pick(count, L("zdjęcie"), L("zdjęcia"), L("zdjęć"))
    }
}

enum SyncScheduler {
    static let processingIdentifier = "pl.galleryos.app.library-sync"
    static let continuedIdentifier = "pl.galleryos.app.sync.library"
    /// Short wake-ups iOS grants through Background App Refresh (the "fetch" mode).
    static let refreshIdentifier = "pl.galleryos.app.refresh"
    private static var registered = false

    static func register() {
        guard !registered else { return }
        registered = true
        BGTaskScheduler.shared.register(forTaskWithIdentifier: processingIdentifier, using: nil) { task in
            guard let task = task as? BGProcessingTask else { return }
            let gate = TaskFinish()
            let job = Task { @MainActor in
                LibraryEngine.shared.kick()
                await LibraryEngine.shared.waitUntilIdle()
            }
            task.expirationHandler = {
                DispatchQueue.main.async {
                    LibraryEngine.shared.stayAwake()
                }
                gate.finish { task.setTaskCompleted(success: true) }
            }
            Task {
                _ = await job.value
                if await LibraryEngine.shared.stillCopying() {
                    scheduleWhilePowered()
                }
                gate.finish { task.setTaskCompleted(success: true) }
            }
        }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshIdentifier, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            // Ask for the next wake-up first; iOS only grants one request at a time.
            scheduleRefresh()
            let gate = TaskFinish()
            let job = Task { @MainActor in
                await LibraryEngine.shared.refreshInBackground()
            }
            task.expirationHandler = {
                job.cancel()
                DispatchQueue.main.async {
                    LibraryEngine.shared.prepareForBackground()
                }
                gate.finish { task.setTaskCompleted(success: false) }
            }
            Task {
                _ = await job.value
                if await LibraryEngine.shared.stillCopying() {
                    scheduleWhilePowered()
                }
                gate.finish { task.setTaskCompleted(success: true) }
            }
        }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: continuedIdentifier, using: nil) { task in
            guard #available(iOS 26.0, *) else {
                task.setTaskCompleted(success: true)
                return
            }
            guard let task = task as? BGContinuedProcessingTask else { return }
            let gate = TaskFinish()
            let expired = GateFlag()
            task.expirationHandler = {
                expired.raise()
                // Complete on this queue. Waiting for the main thread (it may be stuck on one
                // photo) is exactly what iOS reports as "Niepowodzenie" before killing the app.
                if SyncRun.isCopying {
                    _ = SyncScheduler.submitContinued(subtitle: L("Wznawiam wysyłanie"))
                    SyncScheduler.scheduleWhilePowered()
                }
                gate.finish { task.setTaskCompleted(success: true) }
                DispatchQueue.main.async {
                    LibraryEngine.shared.handoffContinued()
                    LibraryEngine.shared.prepareForBackground()
                }
            }
            Task { @MainActor in
                let generation = LibraryEngine.shared.bind(task)
                while LibraryEngine.shared.stillCopying(), !expired.isRaised {
                    LibraryEngine.shared.keepCopying()
                    LibraryEngine.shared.tickContinued(generation)
                    if let reason = LibraryEngine.shared.blockedReason {
                        LibraryEngine.shared.retitleContinued(reason)
                    }
                    try? await Task.sleep(nanoseconds: 500_000_000)
                }
                if expired.isRaised { return }
                LibraryEngine.shared.finishContinued()
                gate.finish { task.setTaskCompleted(success: true) }
            }
        }
    }

    static func cancelAutomatic() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: refreshIdentifier)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: processingIdentifier)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: continuedIdentifier)
    }

    static func schedule() {
        guard SyncPolicy.uploadsEnabled else { return }
        submitProcessing(after: 15 * 60)
    }

    /// Background App Refresh: a short run every so often to pick up new photos.
    static func scheduleRefresh() {
        guard SyncPolicy.uploadsEnabled else { return }
        let request = BGAppRefreshTaskRequest(identifier: refreshIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 20 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func scheduleSoon() {
        scheduleWhilePowered()
    }

    static func scheduleWhilePowered() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let state = UIDevice.current.batteryState
        let charging = state == .charging || state == .full
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: processingIdentifier)
        let request = BGProcessingTaskRequest(identifier: processingIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = charging
        request.earliestBeginDate = Date(timeIntervalSinceNow: 1)
        try? BGTaskScheduler.shared.submit(request)
    }

    @discardableResult
    static func submitContinued(subtitle: String) -> Bool {
        guard #available(iOS 26.0, *) else { return false }
        let line = subtitle.isEmpty ? L("Wysyłanie") : subtitle
        if submitContinued(subtitle: line, strategy: .fail) { return true }
        return submitContinued(subtitle: line, strategy: .queue)
    }

    @available(iOS 26.0, *)
    private static func submitContinued(
        subtitle: String,
        strategy: BGContinuedProcessingTaskRequest.SubmissionStrategy
    ) -> Bool {
        let request = BGContinuedProcessingTaskRequest(
            identifier: continuedIdentifier,
            title: L("Wysyłanie zdjęć"),
            subtitle: subtitle
        )
        request.strategy = strategy
        do {
            try BGTaskScheduler.shared.submit(request)
            return true
        } catch {
            return false
        }
    }

    private static func submitProcessing(after delay: TimeInterval) {
        let request = BGProcessingTaskRequest(identifier: processingIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = SyncPolicy.chargingOnly
        request.earliestBeginDate = Date(timeIntervalSinceNow: delay)
        try? BGTaskScheduler.shared.submit(request)
    }
}

private final class GateFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var raised = false

    func raise() {
        lock.lock()
        raised = true
        lock.unlock()
    }

    var isRaised: Bool {
        lock.lock()
        defer { lock.unlock() }
        return raised
    }
}

private final class TaskFinish: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func finish(_ body: () -> Void) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        body()
    }
}
