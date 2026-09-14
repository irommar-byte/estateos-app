import Foundation
import UIKit
#if canImport(SwiftUI)
import SwiftUI
#endif

enum AppGroup {
    static let id = "group.pl.paragonos.app"
    static let snapshotName = "home-snapshot.json"
    static let lastCardKey = "paragonos.lastCheckoutCard"
    static let stampsFolder = "stamps"

    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }
}

struct HomeSnapshot: Codable, Equatable {
    var nextTicket: SnapshotTicket?
    var cards: [SnapshotCard]
    var lastCardID: UUID?
    var tickets: [SnapshotTicket]

    init(
        nextTicket: SnapshotTicket? = nil,
        cards: [SnapshotCard] = [],
        lastCardID: UUID? = nil,
        tickets: [SnapshotTicket] = []
    ) {
        self.nextTicket = nextTicket
        self.cards = cards
        self.lastCardID = lastCardID
        self.tickets = tickets
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        nextTicket = try container.decodeIfPresent(SnapshotTicket.self, forKey: .nextTicket)
        cards = try container.decodeIfPresent([SnapshotCard].self, forKey: .cards) ?? []
        lastCardID = try container.decodeIfPresent(UUID.self, forKey: .lastCardID)
        tickets = try container.decodeIfPresent([SnapshotTicket].self, forKey: .tickets) ?? []
    }

    var stampSlots: [WidgetStampSlot] {
        var slots: [WidgetStampSlot] = cards.prefix(6).map { .card($0) }
        if slots.count < 6 {
            for ticket in tickets where slots.count < 6 {
                if slots.contains(where: { $0.matchesTicket(ticket.id) }) { continue }
                slots.append(.ticket(ticket))
            }
        }
        while slots.count < 6 {
            slots.append(.empty(slots.count))
        }
        return slots
    }
}

enum WidgetStampSlot: Equatable, Identifiable {
    case card(SnapshotCard)
    case ticket(SnapshotTicket)
    case empty(Int)

    var id: String {
        switch self {
        case .card(let card): return "card-\(card.id.uuidString)"
        case .ticket(let ticket): return "ticket-\(ticket.id.uuidString)"
        case .empty(let index): return "empty-\(index)"
        }
    }

    func matchesTicket(_ id: UUID) -> Bool {
        if case .ticket(let ticket) = self { return ticket.id == id }
        return false
    }

    var deepLink: URL {
        switch self {
        case .card(let card):
            return WidgetDeepLink.checkoutCard(card.id).url
        case .ticket(let ticket):
            return WidgetDeepLink.checkoutTicket(ticket.id).url
        case .empty:
            return WidgetDeepLink.scanLoyalty.url
        }
    }
}

struct SnapshotTicket: Codable, Equatable, Identifiable {
    var id: UUID
    var brand: String
    var amount: Double
    var expiresAt: Date?
    var brandID: String?
    var colorHex: String?

    init(
        id: UUID,
        brand: String,
        amount: Double,
        expiresAt: Date?,
        brandID: String? = nil,
        colorHex: String? = nil
    ) {
        self.id = id
        self.brand = brand
        self.amount = amount
        self.expiresAt = expiresAt
        self.brandID = brandID
        self.colorHex = colorHex
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        brand = try container.decode(String.self, forKey: .brand)
        amount = try container.decode(Double.self, forKey: .amount)
        expiresAt = try container.decodeIfPresent(Date.self, forKey: .expiresAt)
        brandID = try container.decodeIfPresent(String.self, forKey: .brandID)
        colorHex = try container.decodeIfPresent(String.self, forKey: .colorHex)
    }
}

struct SnapshotCard: Codable, Equatable, Identifiable {
    var id: UUID
    var name: String
    var colorHex: String?
    var programID: String?

    init(id: UUID, name: String, colorHex: String? = nil, programID: String? = nil) {
        self.id = id
        self.name = name
        self.colorHex = colorHex
        self.programID = programID
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        colorHex = try container.decodeIfPresent(String.self, forKey: .colorHex)
        programID = try container.decodeIfPresent(String.self, forKey: .programID)
    }
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

enum ScanReceiptControlLink {
    static var url: URL { WidgetDeepLink.scanReceipt.url }
}

enum WidgetStampStore {
    static func directory() -> URL? {
        AppGroup.container?.appendingPathComponent(AppGroup.stampsFolder, isDirectory: true)
    }

    static func fileURL(id: UUID) -> URL? {
        directory()?.appendingPathComponent("\(id.uuidString).png")
    }

    static func save(id: UUID, png: Data) {
        guard let directory = directory(), let url = fileURL(id: id) else { return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? png.write(to: url, options: .atomic)
    }

    static func image(id: UUID) -> UIImage? {
        guard let url = fileURL(id: id), let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }
}

enum HomeSnapshotStore {
    static func load() -> HomeSnapshot {
        let url = AppGroup.container?.appendingPathComponent(AppGroup.snapshotName)
        if let url, let data = try? Data(contentsOf: url),
           let snapshot = try? JSONDecoder().decode(HomeSnapshot.self, from: data) {
            return snapshot
        }
        return HomeSnapshot()
    }

    static func save(_ snapshot: HomeSnapshot) {
        guard let url = AppGroup.container?.appendingPathComponent(AppGroup.snapshotName),
              let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }
}

#if canImport(SwiftUI)
extension Color {
    init(paragonHex hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b: Double
        switch cleaned.count {
        case 3:
            r = Double((int >> 8) & 0xF) / 15
            g = Double((int >> 4) & 0xF) / 15
            b = Double(int & 0xF) / 15
        case 6, 8:
            r = Double((int >> 16) & 0xFF) / 255
            g = Double((int >> 8) & 0xFF) / 255
            b = Double(int & 0xFF) / 255
        default:
            r = 0.25
            g = 0.25
            b = 0.25
        }
        self.init(red: r, green: g, blue: b)
    }
}
#endif
