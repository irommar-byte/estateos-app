import Foundation

enum AppGroup {
    static let id = "group.pl.paragonos.app"
    static let snapshotName = "home-snapshot.json"
    static let lastCardKey = "paragonos.lastCheckoutCard"

    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }
}

struct HomeSnapshot: Codable, Equatable {
    var nextTicket: SnapshotTicket?
    var cards: [SnapshotCard]
    var lastCardID: UUID?
}

struct SnapshotTicket: Codable, Equatable, Identifiable {
    var id: UUID
    var brand: String
    var amount: Double
    var expiresAt: Date?
}

struct SnapshotCard: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String
}

enum WidgetDeepLink: Equatable {
    case scanDeposit
    case scanReceipt
    case scanLoyalty
    case map
    case checkoutTicket(UUID)
    case checkoutCard(UUID)

    var url: URL {
        switch self {
        case .scanDeposit:
            return URL(string: "paragonos://scan/deposit")!
        case .scanReceipt:
            return URL(string: "paragonos://scan/receipt")!
        case .scanLoyalty:
            return URL(string: "paragonos://scan/loyalty")!
        case .map:
            return URL(string: "paragonos://map")!
        case .checkoutTicket(let id):
            return URL(string: "paragonos://checkout/ticket/\(id.uuidString)")!
        case .checkoutCard(let id):
            return URL(string: "paragonos://checkout/card/\(id.uuidString)")!
        }
    }

    static func parse(_ url: URL) -> WidgetDeepLink? {
        guard url.scheme == "paragonos" else { return nil }
        let host = url.host ?? ""
        let parts = url.path.split(separator: "/").map(String.init)
        switch host {
        case "scan":
            switch parts.first {
            case "deposit": return .scanDeposit
            case "receipt": return .scanReceipt
            case "loyalty": return .scanLoyalty
            default: return .scanDeposit
            }
        case "map":
            return .map
        case "checkout":
            guard parts.count >= 2, let id = UUID(uuidString: parts[1]) else { return nil }
            if parts[0] == "ticket" { return .checkoutTicket(id) }
            if parts[0] == "card" { return .checkoutCard(id) }
            return nil
        default:
            return nil
        }
    }
}

enum ScanDepositControlLink {
    static var url: URL { WidgetDeepLink.scanDeposit.url }
}

enum HomeSnapshotStore {
    static func load() -> HomeSnapshot {
        let url = AppGroup.container?.appendingPathComponent(AppGroup.snapshotName)
        if let url, let data = try? Data(contentsOf: url),
           let snapshot = try? JSONDecoder().decode(HomeSnapshot.self, from: data) {
            return snapshot
        }
        return HomeSnapshot(nextTicket: nil, cards: [], lastCardID: nil)
    }

    static func save(_ snapshot: HomeSnapshot) {
        guard let url = AppGroup.container?.appendingPathComponent(AppGroup.snapshotName),
              let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
