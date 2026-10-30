import ActivityKit
import CloudKit
import CoreData
import Foundation
import SwiftData
import UIKit

enum CloudSyncPhase: Equatable {
    case idle
    case setup
    case exporting
    case importing
    case failed
}

enum CloudSyncIslandState: Equatable {
    case hidden
    case running
    case success
    case failure
}

@MainActor
final class CloudSyncMonitor: ObservableObject {
    static let shared = CloudSyncMonitor()

    @Published private(set) var phase: CloudSyncPhase = .idle
    @Published private(set) var lastSuccessAt: Date?
    @Published private(set) var errorText: String?
    @Published private(set) var usesCloudKit = true
    @Published private(set) var containerError: String?
    @Published private(set) var island: CloudSyncIslandState = .hidden
    @Published private(set) var syncProgress: Double = 0

    private var observers: [NSObjectProtocol] = []
    private var inflight = 0
    private var islandHideTask: Task<Void, Never>?
    private var islandGeneration = 0
    private var userIslandSession = false
    private let lastSuccessKey = "paragonos.cloud.lastSuccess"

    var isInProgress: Bool { inflight > 0 }

    var visibleError: String? {
        guard phase == .failed else { return nil }
        return errorText ?? containerError
    }

    var statusTitle: String {
        CloudSyncStatusCopy.title(
            usesCloudKit: usesCloudKit,
            hasContainerError: containerError != nil,
            inProgress: isInProgress,
            phase: phase,
            hasSuccess: lastSuccessAt != nil
        )
    }

    var lastSuccessText: String? {
        guard let lastSuccessAt else { return nil }
        return PolishDates.relativePast(lastSuccessAt)
    }

    init() {
        lastSuccessAt = UserDefaults.standard.object(forKey: lastSuccessKey) as? Date
        start()
    }

    func start() {
        guard observers.isEmpty else { return }
        observers.append(
            NotificationCenter.default.addObserver(
                forName: NSPersistentCloudKitContainer.eventChangedNotification,
                object: nil,
                queue: .main
            ) { [weak self] note in
                Task { @MainActor in
                    self?.handle(note)
                }
            }
        )
        Task { await FamilySyncLiveActivityCenter.shared.discardStale() }
    }

    func reportContainerFailure(_ error: Error) {
        reportContainerFailureMessage(error.localizedDescription)
    }

    func reportContainerFailureMessage(_ message: String) {
        usesCloudKit = false
        containerError = Self.stripRawCloudKit(message)
        phase = .failed
        errorText = String(localized: "Nie udało się włączyć iCloud na tym urządzeniu. Dane zostają lokalnie.")
    }

    func markLocalOnly() {
        usesCloudKit = false
        phase = .idle
        errorText = String(localized: "Brak konta iCloud. Kaucje, paragony i karty zostają na tym urządzeniu.")
    }

    func requestExport(from context: ModelContext, userInitiated: Bool = false) {
        try? context.save()
        // Clear sticky English/raw errors so a manual retry can recover cleanly.
        if errorText?.contains("CKErrorDomain") == true || phase == .failed {
            errorText = nil
            if inflight == 0 { phase = .idle }
        }
        if userInitiated == false { stampLastSuccess() }
        if userInitiated {
            userIslandSession = true
            presentIsland(.running)
        }
        if isInProgress == false {
            inflight = 1
            phase = .exporting
            guard userInitiated == false else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                if self.phase == .exporting, self.errorText == nil {
                    self.noteLocalSyncCompleted()
                } else if self.inflight == 1, self.phase == .exporting {
                    self.inflight = 0
                    self.phase = .failed
                }
            }
        }
    }

    func stampLastSuccess() {
        lastSuccessAt = Date()
        UserDefaults.standard.set(lastSuccessAt, forKey: lastSuccessKey)
    }

    /// Family "Synchronizuj teraz" — stamp Ostatnio even when CloudKit is quiet.
    func noteLocalSyncCompleted(success: Bool = true) {
        inflight = 0
        let showIsland = userIslandSession || island == .running
        userIslandSession = false
        if success == false || phase == .failed {
            syncProgress = 1
            if showIsland { presentIsland(.failure) }
            return
        }
        syncProgress = 1
        stampLastSuccess()
        phase = .idle
        errorText = nil
        if showIsland { presentIsland(.success) }
    }

    /// The family sync uses discrete, real units of work (each attempted upload
    /// plus each category downloaded). The Dynamic Island therefore represents
    /// actual completed work, not elapsed time or a fake indeterminate spinner.
    func beginFamilySync(totalUnits: Int) {
        syncProgress = 0
        updateFamilySync(completedUnits: 0, totalUnits: totalUnits, phase: .exporting)
    }

    func updateFamilySync(
        completedUnits: Int,
        totalUnits: Int,
        phase: CloudSyncPhase
    ) {
        self.phase = phase
        let total = max(totalUnits, 1)
        syncProgress = min(max(Double(completedUnits) / Double(total), 0), 1)
        guard island == .running || userIslandSession else { return }
        let title = CloudSyncIslandCopy.title(state: .running, phase: phase)
        Task { @MainActor in
            await FamilySyncLiveActivityCenter.shared.updateRunning(
                title: title,
                progress: self.syncProgress
            )
        }
    }

    /// Called only by the Live Activity's own 45s absolute-last-resort watchdog.
    /// Resets local state without re-entering the presentIsland chain.
    func forceCloseIsland() {
        islandHideTask?.cancel()
        islandGeneration += 1
        userIslandSession = false
        inflight = 0
        if phase == .exporting || phase == .setup || phase == .importing {
            phase = .failed
            errorText = String(localized: "iCloud nie dokończył synchronizacji. Sprawdź sieć i konto Apple.")
        }
        island = .hidden
    }

    func presentIsland(_ state: CloudSyncIslandState) {
        islandHideTask?.cancel()
        islandGeneration += 1
        let generation = islandGeneration
        if state == .running { userIslandSession = true }
        island = state
        let title = CloudSyncIslandCopy.title(state: state, phase: phase)
        Task { @MainActor in
            let usedLive = await FamilySyncLiveActivityCenter.shared.present(state, title: title)
            guard generation == self.islandGeneration else { return }
            if usedLive {
                if state == .success {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                } else if state == .failure {
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
                if state == .success || state == .failure || state == .hidden {
                    self.island = .hidden
                    FamilySyncLiveActivityCenter.shared.markIdle()
                }
                return
            }
            self.showInAppIsland(state)
        }
    }

    private func showInAppIsland(_ state: CloudSyncIslandState) {
        island = state
        guard state == .success || state == .failure else { return }
        let nanos: UInt64 = state == .success ? 1_650_000_000 : 2_400_000_000
        islandHideTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: nanos)
            guard Task.isCancelled == false, self.island == state else { return }
            self.island = .hidden
        }
    }

    private func handle(_ note: Notification) {
        guard let event = note.userInfo?[NSPersistentCloudKitContainer.eventNotificationUserInfoKey]
            as? NSPersistentCloudKitContainer.Event else { return }
        if event.endDate == nil {
            inflight += 1
            usesCloudKit = true
            switch event.type {
            case .setup: phase = .setup
            case .import: phase = .importing
            case .export: phase = .exporting
            default: phase = .setup
            }
            return
        }
        inflight = max(0, inflight - 1)
        if event.succeeded {
            errorText = nil
            containerError = nil
            lastSuccessAt = event.endDate ?? Date()
            UserDefaults.standard.set(lastSuccessAt, forKey: lastSuccessKey)
            if inflight == 0 {
                phase = .idle
            }
            return
        }

        if Self.isSoftFailure(event.error) {
            // CloudKit retries partial / busy errors itself — don't paint the Family screen red.
            if inflight == 0 {
                phase = .idle
            }
            return
        }

        phase = .failed
        errorText = Self.polish(error: event.error)
    }

    private static func isSoftFailure(_ error: Error?) -> Bool {
        guard let error else { return true }
        if let ck = error as? CKError {
            switch ck.code {
            case .partialFailure, .zoneBusy, .requestRateLimited, .serviceUnavailable,
                 .networkFailure, .networkUnavailable, .serverResponseLost:
                return true
            default:
                break
            }
        }
        let ns = error as NSError
        if ns.domain == CKErrorDomain {
            // 2 = partialFailure, 3/4 = network, 6 = serviceUnavailable, 7 = requestRateLimited, 23 = zoneBusy
            return [2, 3, 4, 6, 7, 23].contains(ns.code)
        }
        return false
    }

    private static func polish(error: Error?) -> String {
        guard let error else {
            return String(localized: "iCloud nie dokończył synchronizacji. Sprawdź sieć i konto Apple.")
        }

        if let ck = error as? CKError {
            if ck.code == .partialFailure,
               let nested = ck.partialErrorsByItemID?.values,
               let first = nested.compactMap({ $0 as Error }).first {
                let nestedMessage = polish(error: first)
                if nestedMessage.contains("CKErrorDomain") == false {
                    return nestedMessage
                }
            }
            switch ck.code {
            case .partialFailure:
                return String(localized: "Część danych jeszcze się dogrywa w iCloud. Sprawdź sieć i naciśnij Synchronizuj teraz.")
            case .networkUnavailable, .networkFailure, .serviceUnavailable, .serverResponseLost:
                return String(localized: "Brak sieci. Synchronizacja wróci, gdy będzie internet.")
            case .notAuthenticated:
                return String(localized: "Zaloguj się do iCloud w Ustawieniach iPhone’a.")
            case .quotaExceeded:
                return String(localized: "iCloud nie ma miejsca. Zwolnij miejsce w iCloud i spróbuj ponownie.")
            case .zoneBusy, .requestRateLimited, .serverRecordChanged:
                return String(localized: "iCloud jest zajęty. Spróbuj ponownie za chwilę.")
            case .incompatibleVersion, .badContainer, .missingEntitlement:
                return String(localized: "Ta wersja nie dokończy synchronizacji. Zaktualizuj ParagonOS i spróbuj ponownie.")
            case .unknownItem, .invalidArguments:
                return String(localized: "iCloud nie przyjął zapisu. Spróbuj ponownie za chwilę.")
            default:
                break
            }
        }

        let ns = error as NSError
        if ns.domain == CKErrorDomain {
            switch ns.code {
            case 2:
                return String(localized: "Część danych jeszcze się dogrywa w iCloud. Sprawdź sieć i naciśnij Synchronizuj teraz.")
            case 3, 4, 6:
                return String(localized: "Brak sieci. Synchronizacja wróci, gdy będzie internet.")
            case 9:
                return String(localized: "Zaloguj się do iCloud w Ustawieniach iPhone’a.")
            case 25:
                return String(localized: "iCloud nie ma miejsca. Zwolnij miejsce w iCloud i spróbuj ponownie.")
            default:
                break
            }
        }

        let text = error.localizedDescription
        let lowered = text.lowercased()
        if lowered.contains("not authenticated") || lowered.contains("account") {
            return String(localized: "Zaloguj się do iCloud w Ustawieniach iPhone’a.")
        }
        if lowered.contains("network") || lowered.contains("offline") || lowered.contains("internet") {
            return String(localized: "Brak sieci. Synchronizacja wróci, gdy będzie internet.")
        }
        if lowered.contains("quota") {
            return String(localized: "iCloud nie ma miejsca. Zwolnij miejsce w iCloud i spróbuj ponownie.")
        }
        if lowered.contains("schema") || lowered.contains("record type") || lowered.contains("unknown item") {
            return String(localized: "iCloud nie przyjął zapisu. Spróbuj ponownie za chwilę.")
        }
        return stripRawCloudKit(text)
    }

    private static func stripRawCloudKit(_ text: String) -> String {
        let lowered = text.lowercased()
        if lowered.contains("ckerrordomain") || lowered.contains("ckerror") {
            return String(localized: "iCloud nie dokończył synchronizacji. Sprawdź sieć i konto Apple.")
        }
        return text
    }
}

enum CloudSyncStatusCopy {
    static func title(
        usesCloudKit: Bool,
        hasContainerError: Bool,
        inProgress: Bool,
        phase: CloudSyncPhase,
        hasSuccess: Bool
    ) -> String {
        if usesCloudKit == false {
            return AppLocale.string(hasContainerError ? "iCloud niedostępny" : "Tylko to urządzenie")
        }
        if inProgress {
            switch phase {
            case .exporting: return AppLocale.string("Wysyłanie…")
            case .importing: return AppLocale.string("Pobieranie…")
            case .setup: return AppLocale.string("Łączenie z iCloud…")
            default: return AppLocale.string("Synchronizacja…")
            }
        }
        if phase == .failed { return AppLocale.string("Nie udało się") }
        if hasSuccess { return AppLocale.string("Aktualne") }
        return AppLocale.string("Oczekuje")
    }
}

enum CloudSyncIslandCopy {
    static func title(state: CloudSyncIslandState, phase: CloudSyncPhase) -> String {
        switch state {
        case .hidden:
            return ""
        case .running:
            switch phase {
            case .importing: return "Pobieranie"
            case .setup: return "Łączenie"
            default: return "Wysyłanie"
            }
        case .success:
            return "Aktualne"
        case .failure:
            return "Spróbuj"
        }
    }

    static func symbol(_ state: CloudSyncIslandState) -> String {
        switch state {
        case .hidden, .running: return "icloud.fill"
        case .success: return "checkmark"
        case .failure: return "exclamationmark"
        }
    }

    static func accessibility(state: CloudSyncIslandState, phase: CloudSyncPhase) -> String {
        let title = title(state: state, phase: phase)
        if title.isEmpty { return "iCloud" }
        return "iCloud, \(title)"
    }
}

@MainActor
final class FamilySyncLiveActivityCenter: ObservableObject {
    static let shared = FamilySyncLiveActivityCenter()

    @Published private(set) var isPresenting = false

    private var activity: Activity<FamilySyncActivityAttributes>?
    private var usingLive = false
    private var startedAt: Date?
    private var chain: Task<Bool, Never> = Task { false }
    private var watchdogTask: Task<Void, Never>?
    private var currentProgress: Double = 0
    private var runningTitle: String = ""

    static var prefersSystemIslandNow: Bool {
        FamilySyncLiveActivityPolicy.prefersSystemIsland(
            isPhone: UIDevice.current.userInterfaceIdiom == .phone,
            activitiesEnabled: ActivityAuthorizationInfo().areActivitiesEnabled,
            hasDynamicIsland: hasDynamicIslandHardware
        )
    }

    static var hasDynamicIslandHardware: Bool {
        let inset = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .map(\.safeAreaInsets.top)
            .max() ?? 0
        return inset >= 54
    }

    func present(_ state: CloudSyncIslandState, title: String) async -> Bool {
        let previous = chain
        let task = Task { @MainActor in
            _ = await previous.value
            return await self.presentLocked(state, title: title)
        }
        chain = task
        return await task.value
    }

    func discardStale() async {
        watchdogTask?.cancel()
        usingLive = false
        isPresenting = false
        activity = nil
        startedAt = nil
        for leftover in Activity<FamilySyncActivityAttributes>.activities {
            await leftover.end(nil, dismissalPolicy: .immediate)
        }
    }

    private func presentLocked(_ state: CloudSyncIslandState, title: String) async -> Bool {
        switch state {
        case .hidden:
            if usingLive {
                await end(immediate: true)
                usingLive = false
                isPresenting = false
                return true
            }
            return false
        case .running:
            guard Self.prefersSystemIslandNow else {
                usingLive = false
                isPresenting = false
                return false
            }
            isPresenting = true
            let started = await start(title: title)
            usingLive = started
            if started == false { isPresenting = false }
            return started
        case .success, .failure:
            if usingLive {
                await finish(state, title: title)
                usingLive = false
                return true
            }
            return false
        }
    }

    func markIdle() {
        isPresenting = false
    }

    /// Receives measured work progress from `WalletModel`. Unlike the former
    /// timer-driven presentation, this is only advanced after a real upload or
    /// a real category fetch completes.
    func updateRunning(title: String, progress: Double) async {
        runningTitle = title
        currentProgress = FamilyRingProgress.clamped(progress)
        guard usingLive, let activity else { return }
        let content = ActivityContent(
            state: FamilySyncActivityAttributes.ContentState.running(
                title,
                progress: currentProgress
            ),
            staleDate: Date().addingTimeInterval(90)
        )
        await activity.update(content)
    }

    private func start(title: String) async -> Bool {
        await end(immediate: true)
        runningTitle = title
        let content = ActivityContent(
            state: FamilySyncActivityAttributes.ContentState.running(title, progress: currentProgress),
            staleDate: Date().addingTimeInterval(90)
        )
        do {
            activity = try Activity.request(
                attributes: FamilySyncActivityAttributes(topic: "icloud"),
                content: content,
                pushType: nil
            )
            startedAt = Date()
            beginWatchdog()
            return true
        } catch {
            activity = nil
            startedAt = nil
            return false
        }
    }

    /// Absolute last resort: if something upstream ever hangs despite its own
    /// bounded timeouts, this guarantees the Live Activity still leaves the
    /// screen instead of "wisi wszędzie" forever.
    private func beginWatchdog() {
        watchdogTask?.cancel()
        let watchedID = activity?.id
        watchdogTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 45_000_000_000)
            guard let self, Task.isCancelled == false, self.activity?.id == watchedID else { return }
            await self.finish(.failure, title: "Spróbuj")
            self.usingLive = false
            self.isPresenting = false
            CloudSyncMonitor.shared.forceCloseIsland()
        }
    }

    private func finish(_ state: CloudSyncIslandState, title: String) async {
        watchdogTask?.cancel()
        let contentState: FamilySyncActivityAttributes.ContentState = {
            switch state {
            case .success: return FamilySyncActivityAttributes.ContentState.success(title)
            case .failure: return FamilySyncActivityAttributes.ContentState.failure(title)
            default: return FamilySyncActivityAttributes.ContentState.running(title, progress: currentProgress)
            }
        }()
        if let startedAt {
            let remaining = max(0, 1.1 - Date().timeIntervalSince(startedAt))
            if remaining > 0 {
                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
            }
        }
        let hold: TimeInterval = state == .failure ? 2.2 : 1.8
        let content = ActivityContent(state: contentState, staleDate: nil)
        if let activity {
            await activity.end(content, dismissalPolicy: .after(.now.addingTimeInterval(hold)))
        }
        activity = nil
        startedAt = nil
    }

    private func end(immediate: Bool) async {
        watchdogTask?.cancel()
        let current = activity
        activity = nil
        startedAt = nil
        currentProgress = 0
        if let current {
            await current.end(nil, dismissalPolicy: immediate ? .immediate : .default)
        }
        for leftover in Activity<FamilySyncActivityAttributes>.activities where leftover.id != current?.id {
            await leftover.end(nil, dismissalPolicy: .immediate)
        }
    }
}

enum AsyncTimeout {
    static func value<T>(
        seconds: TimeInterval,
        operation: @escaping () async -> T
    ) async -> T? {
        await withTaskGroup(of: Optional<T>.self) { group in
            group.addTask { Optional(await operation()) }
            group.addTask {
                let nanos = UInt64(max(seconds, 0.1) * 1_000_000_000)
                try? await Task.sleep(nanoseconds: nanos)
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }
}
