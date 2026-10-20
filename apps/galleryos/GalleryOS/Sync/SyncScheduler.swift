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
            return "Czeka na ładowanie"
        }
        guard needsNetwork else { return nil }
        if !online { return "Brak sieci" }
        if wifiOnly, !onWiFi { return "Czeka na Wi-Fi" }
        if constrained, !onWiFi { return "Oszczędzanie danych" }
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
        content.title = "Synchronizacja skończona"
        content.body = "Wysłano \(TransferText.groupedPublic(count)) \(word(count)). Możesz zablokować telefon."
        content.sound = .default
        let request = UNNotificationRequest(identifier: "galleryos.sync.done", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private static func word(_ count: Int) -> String {
        if count == 1 { return "zdjęcie" }
        let tens = count % 100
        if (2...4).contains(count % 10), !(12...14).contains(tens) { return "zdjęcia" }
        return "zdjęć"
    }
}

enum SyncScheduler {
    static let processingIdentifier = "pl.galleryos.app.library-sync"
    static let continuedIdentifier = "pl.galleryos.app.sync.library"
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
        BGTaskScheduler.shared.register(forTaskWithIdentifier: continuedIdentifier, using: nil) { task in
            guard let task = task as? BGContinuedProcessingTask else { return }
            let gate = TaskFinish()
            let expired = GateFlag()
            task.expirationHandler = {
                expired.raise()
                // Complete on this queue. Waiting for the main thread (it may be stuck on one
                // photo) is exactly what iOS reports as "Niepowodzenie" before killing the app.
                if SyncRun.isCopying {
                    _ = SyncScheduler.submitContinued(subtitle: "Wznawiam wysyłanie")
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
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: processingIdentifier)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: continuedIdentifier)
    }

    static func schedule() {
        guard SyncPolicy.uploadsEnabled else { return }
        submitProcessing(after: 15 * 60)
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
        let line = subtitle.isEmpty ? "Wysyłanie" : subtitle
        if submitContinued(subtitle: line, strategy: .fail) { return true }
        return submitContinued(subtitle: line, strategy: .queue)
    }

    private static func submitContinued(
        subtitle: String,
        strategy: BGContinuedProcessingTaskRequest.SubmissionStrategy
    ) -> Bool {
        let request = BGContinuedProcessingTaskRequest(
            identifier: continuedIdentifier,
            title: "Wysyłanie zdjęć",
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
