import Foundation

extension Ticket {
    func resolvedStatus(now: Date = .now) -> TicketLifecycleStatus {
        TicketStatusEngine.resolved(stored: storedStatus, expiresAt: expiresAt, now: now)
    }
}

enum TicketStatusEngine {
    static func resolved(
        stored: TicketLifecycleStatus,
        expiresAt: Date?,
        now: Date = .now
    ) -> TicketLifecycleStatus {
        if stored == .redeemed { return .redeemed }
        if let expiresAt, expiresAt < now { return .expired }
        return .active
    }

    static func markRedeemed(now: Date = .now) -> (status: TicketLifecycleStatus, at: Date) {
        (.redeemed, now)
    }
}
