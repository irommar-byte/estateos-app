import CoreData
import Foundation
import SwiftData

enum CloudSyncPhase: Equatable {
    case idle
    case setup
    case exporting
    case importing
    case failed
}

@MainActor
final class CloudSyncMonitor: ObservableObject {
    static let shared = CloudSyncMonitor()

    @Published private(set) var phase: CloudSyncPhase = .idle
    @Published private(set) var lastSuccessAt: Date?
    @Published private(set) var errorText: String?
    @Published private(set) var usesCloudKit = true
    @Published private(set) var containerError: String?

    private var observers: [NSObjectProtocol] = []
    private var inflight = 0
    private let lastSuccessKey = "paragonos.cloud.lastSuccess"

    var isInProgress: Bool { inflight > 0 }

    var statusTitle: String {
        if usesCloudKit == false {
            return containerError == nil ? "Tylko to urządzenie" : "iCloud niedostępny"
        }
        if isInProgress {
            switch phase {
            case .exporting: return "Wysyłanie…"
            case .importing: return "Pobieranie…"
            case .setup: return "Łączenie z iCloud…"
            default: return "Synchronizacja…"
            }
        }
        if errorText != nil { return "Nie udało się" }
        if lastSuccessAt != nil { return "Aktualne" }
        return "Oczekuje"
    }

    var lastSuccessText: String? {
        guard let lastSuccessAt else { return nil }
        return lastSuccessAt.formatted(.relative(presentation: .named, unitsStyle: .abbreviated))
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
    }

    func reportContainerFailure(_ error: Error) {
        reportContainerFailureMessage(error.localizedDescription)
    }

    func reportContainerFailureMessage(_ message: String) {
        usesCloudKit = false
        containerError = message
        phase = .failed
        errorText = "Nie udało się włączyć iCloud na tym urządzeniu. Dane zostają lokalnie."
    }

    func markLocalOnly() {
        usesCloudKit = false
        phase = .idle
        errorText = "Brak konta iCloud. Kaucje, paragony i karty zostają na tym urządzeniu."
    }

    func requestExport(from context: ModelContext) {
        try? context.save()
        if isInProgress == false {
            inflight = 1
            phase = .exporting
            objectWillChange.send()
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 8_000_000_000)
                if self.inflight == 1, self.phase == .exporting {
                    self.inflight = 0
                    self.phase = self.errorText == nil ? .idle : .failed
                }
            }
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
        } else {
            phase = .failed
            errorText = Self.polish(error: event.error)
        }
    }

    private static func polish(error: Error?) -> String {
        guard let error else {
            return "iCloud nie dokończył synchronizacji. Sprawdź sieć i konto Apple."
        }
        let text = error.localizedDescription
        let lowered = text.lowercased()
        if lowered.contains("not authenticated") || lowered.contains("account") {
            return "Zaloguj się do iCloud w Ustawieniach iPhone’a."
        }
        if lowered.contains("network") || lowered.contains("offline") || lowered.contains("internet") {
            return "Brak sieci. Synchronizacja wróci, gdy będzie internet."
        }
        if lowered.contains("quota") {
            return "iCloud nie ma miejsca. Zwolnij miejsce w iCloud i spróbuj ponownie."
        }
        if lowered.contains("schema") || lowered.contains("record type") || lowered.contains("unknown item") {
            return "iCloud nie przyjął zapisu. Spróbuj ponownie za chwilę."
        }
        return text
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
