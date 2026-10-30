import Foundation
import UserNotifications

@MainActor
final class ExpiryNotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ExpiryNotificationService()
    static let categoryID = "PARAGONOS_EXPIRY"
    static let redeemActionID = "PARAGONOS_MARK_REDEEMED"

    private let center = UNUserNotificationCenter.current()

    func configure() {
        center.delegate = self
        let redeem = UNNotificationAction(
            identifier: Self.redeemActionID,
            title: "Oznacz jako wykorzystany",
            options: [.authenticationRequired]
        )
        let category = UNNotificationCategory(
            identifier: Self.categoryID,
            actions: [redeem],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([category])
    }

    func registerCategoriesIfNeeded() async {}

    func requestAuthorization() async {
        if ParagonUIDemo.isEnabled { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func reschedule(tickets: [Ticket], receipts: [Receipt] = [], settings: NotificationSettings, now: Date = .now) async {
        center.removeAllPendingNotificationRequests()
        let calendar = Calendar.current
        let depositDays = NotificationSettings.normalized(settings.depositReminderDays)
        if depositDays.isEmpty == false {
            for ticket in tickets {
                let status = TicketStatusEngine.resolved(stored: ticket.storedStatus, expiresAt: ticket.expiresAt, now: now)
                guard status == .active, let expiresAt = ticket.expiresAt else { continue }
                let retailer = RetailerCatalog.policy(id: ticket.retailerID).name
                let amount = MoneyFormat.string(ticket.amount)
                for daysBefore in depositDays {
                    await schedule(
                        ticket: ticket,
                        expiresAt: expiresAt,
                        daysBefore: daysBefore,
                        retailer: retailer,
                        amount: amount,
                        calendar: calendar,
                        now: now
                    )
                }
            }
        }
        let warrantyDays = NotificationSettings.normalized(settings.warrantyReminderDays)
        let returnDays = NotificationSettings.normalized(settings.returnReminderDays)
        for receipt in receipts {
            if let date = receipt.resolvedWarrantyUntil {
                for daysBefore in warrantyDays {
                    await scheduleReceipt(receipt, fireDate: date, daysBefore: daysBefore, kind: .warranty, calendar: calendar, now: now)
                }
            }
            if let date = receipt.resolvedReturnUntil {
                for daysBefore in returnDays {
                    await scheduleReceipt(receipt, fireDate: date, daysBefore: daysBefore, kind: .returning, calendar: calendar, now: now)
                }
            }
        }
    }

    private func schedule(
        ticket: Ticket,
        expiresAt: Date,
        daysBefore: Int,
        retailer: String,
        amount: String,
        calendar: Calendar,
        now: Date
    ) async {
        guard let fireDay = calendar.date(byAdding: .day, value: -daysBefore, to: calendar.startOfDay(for: expiresAt)) else { return }
        var components = calendar.dateComponents([.year, .month, .day], from: fireDay)
        components.hour = 9
        components.minute = 0
        guard let fireDate = calendar.date(from: components), fireDate > now else { return }

        let content = UNMutableNotificationContent()
        content.title = Brand.displayName
        content.sound = .default
        content.categoryIdentifier = Self.categoryID
        content.userInfo = ["ticketID": ticket.id.uuidString]
        content.threadIdentifier = ticket.id.uuidString
        switch daysBefore {
        case 0:
            content.body = "Kwitek \(retailer) na \(amount) wygasa dzisiaj."
        case 1:
            content.body = "Kwitek \(retailer) na \(amount) wygasa jutro."
        default:
            content.body = "Kwitek \(retailer) na \(amount) wygasa za \(daysBefore) dni."
        }

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let id = "expiry.\(ticket.id.uuidString).\(daysBefore)"
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        try? await center.add(request)
    }

    private enum ReceiptReminderKind {
        case warranty
        case returning
    }

    private func scheduleReceipt(
        _ receipt: Receipt,
        fireDate expiresAt: Date,
        daysBefore: Int,
        kind: ReceiptReminderKind,
        calendar: Calendar,
        now: Date
    ) async {
        guard let fireDay = calendar.date(byAdding: .day, value: -daysBefore, to: calendar.startOfDay(for: expiresAt)) else { return }
        var components = calendar.dateComponents([.year, .month, .day], from: fireDay)
        components.hour = 9
        components.minute = 0
        guard let fireDate = calendar.date(from: components), fireDate > now else { return }

        let content = UNMutableNotificationContent()
        content.title = Brand.displayName
        content.sound = .default
        content.userInfo = ["receiptID": receipt.id.uuidString]
        content.threadIdentifier = receipt.id.uuidString
        let amount = MoneyFormat.string(receipt.amount)
        switch kind {
        case .warranty:
            content.body = daysBefore == 0
                ? "Gwarancja \(receipt.merchantName) (\(amount)) kończy się dzisiaj."
                : "Gwarancja \(receipt.merchantName) (\(amount)) kończy się za \(daysBefore) dni."
        case .returning:
            content.body = "Termin zwrotu \(receipt.merchantName) (\(amount)) mija za \(daysBefore) dni."
        }

        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let id = "receipt.\(kind == .warranty ? "warranty" : "return").\(receipt.id.uuidString).\(daysBefore)"
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        try? await center.add(request)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let ticketID = response.notification.request.content.userInfo["ticketID"] as? String
        let receiptID = response.notification.request.content.userInfo["receiptID"] as? String
        if response.actionIdentifier == Self.redeemActionID, let ticketID {
            NotificationCenter.default.post(name: .paragonMarkRedeemed, object: ticketID)
        } else if let ticketID {
            NotificationCenter.default.post(name: .paragonOpenTicket, object: ticketID)
        } else if let receiptID {
            NotificationCenter.default.post(name: .paragonOpenReceipt, object: receiptID)
        }
    }
}

extension Notification.Name {
    static let paragonMarkRedeemed = Notification.Name("paragonos.markRedeemed")
    static let paragonOpenTicket = Notification.Name("paragonos.openTicket")
    static let paragonOpenReceipt = Notification.Name("paragonos.openReceipt")
    static let paragonOpenScanner = Notification.Name("paragonos.openScanner")
    static let paragonFamilyRemoteChange = Notification.Name("paragonos.familyRemoteChange")
    static let paragonShortcut = Notification.Name("paragonos.shortcut")
}

struct NotificationSettings: Equatable {
    var depositReminderDays: [Int]
    var warrantyReminderDays: [Int]
    var returnReminderDays: [Int]

    static let maxPerKind = 4
    static let maxDaysBefore = 90

    static let `default` = NotificationSettings(
        depositReminderDays: [7, 1, 0],
        warrantyReminderDays: [30, 7],
        returnReminderDays: [3]
    )

    static func normalized(_ days: [Int]) -> [Int] {
        Array(
            Set(days.filter { $0 >= 0 && $0 <= maxDaysBefore })
        )
        .sorted(by: >)
        .prefix(maxPerKind)
        .map { $0 }
    }

    static let presets = [0, 1, 2, 3, 7, 14, 21, 30, 45, 60, 90]

    static func label(for daysBefore: Int) -> String {
        switch daysBefore {
        case 0:
            return "W dniu terminu"
        case 1:
            return "1 dzień przed"
        default:
            return "\(daysBefore) dni przed"
        }
    }

    static func compactLabel(for daysBefore: Int) -> String {
        switch daysBefore {
        case 0:
            return "w dniu"
        case 1:
            return "1 dzień"
        default:
            return "\(daysBefore) dni"
        }
    }

    static func summary(for days: [Int]) -> String {
        let items = normalized(days).map { compactLabel(for: $0) }
        if items.isEmpty { return "Wyłączone" }
        return items.joined(separator: " · ")
    }
}
