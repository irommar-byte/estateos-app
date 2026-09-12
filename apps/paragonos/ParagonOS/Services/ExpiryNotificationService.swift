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

    func requestAuthorization() async {
        _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }

    func reschedule(tickets: [Ticket], receipts: [Receipt] = [], settings: NotificationSettings, now: Date = .now) async {
        center.removeAllPendingNotificationRequests()
        let calendar = Calendar.current
        if settings.reminder7Days || settings.reminder1Day || settings.reminderOnDay {
            for ticket in tickets {
                let status = TicketStatusEngine.resolved(stored: ticket.storedStatus, expiresAt: ticket.expiresAt, now: now)
                guard status == .active, let expiresAt = ticket.expiresAt else { continue }
                let retailer = RetailerCatalog.policy(id: ticket.retailerID).name
                let amount = MoneyFormat.string(ticket.amount)
                if settings.reminder7Days {
                    await schedule(ticket: ticket, expiresAt: expiresAt, daysBefore: 7, retailer: retailer, amount: amount, calendar: calendar, now: now)
                }
                if settings.reminder1Day {
                    await schedule(ticket: ticket, expiresAt: expiresAt, daysBefore: 1, retailer: retailer, amount: amount, calendar: calendar, now: now)
                }
                if settings.reminderOnDay {
                    await schedule(ticket: ticket, expiresAt: expiresAt, daysBefore: 0, retailer: retailer, amount: amount, calendar: calendar, now: now)
                }
            }
        }
        for receipt in receipts {
            if settings.warrantyReminder30, let date = receipt.warrantyUntil {
                await scheduleReceipt(receipt, fireDate: date, daysBefore: 30, kind: .warranty, calendar: calendar, now: now)
            }
            if settings.warrantyReminder7, let date = receipt.warrantyUntil {
                await scheduleReceipt(receipt, fireDate: date, daysBefore: 7, kind: .warranty, calendar: calendar, now: now)
            }
            if settings.returnReminder3, let date = receipt.returnUntil {
                await scheduleReceipt(receipt, fireDate: date, daysBefore: 3, kind: .returning, calendar: calendar, now: now)
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
}

struct NotificationSettings: Equatable {
    var reminder7Days: Bool
    var reminder1Day: Bool
    var reminderOnDay: Bool
    var warrantyReminder30: Bool
    var warrantyReminder7: Bool
    var returnReminder3: Bool

    static let `default` = NotificationSettings(
        reminder7Days: true,
        reminder1Day: true,
        reminderOnDay: true,
        warrantyReminder30: true,
        warrantyReminder7: true,
        returnReminder3: true
    )
}
