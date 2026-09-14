import UIKit

enum ShortcutLaunch {
    static var pending: UIApplicationShortcutItem?
}

enum HomeQuickActions {
    static let scanDeposit = "scan.deposit"
    static let scanReceipt = "scan.receipt"
    static let scanLoyalty = "scan.loyalty"
    static let checkout = "checkout"
    static let map = "map"

    @MainActor
    static func refresh(snapshot: HomeSnapshot) {
        var items: [UIApplicationShortcutItem] = [
            UIApplicationShortcutItem(
                type: scanDeposit,
        localizedTitle: String(localized: "Skanuj kwitek"),
                localizedSubtitle: String(localized: "Po butelkomacie"),
                icon: UIApplicationShortcutIcon(systemImageName: "waterbottle.fill"),
                userInfo: nil
            ),
            UIApplicationShortcutItem(
                type: scanReceipt,
                localizedTitle: String(localized: "Skanuj paragon"),
                localizedSubtitle: nil,
                icon: UIApplicationShortcutIcon(systemImageName: "doc.text.viewfinder"),
                userInfo: nil
            ),
            UIApplicationShortcutItem(
                type: scanLoyalty,
                localizedTitle: String(localized: "Skanuj kartę"),
                localizedSubtitle: nil,
                icon: UIApplicationShortcutIcon(systemImageName: "creditcard.viewfinder"),
                userInfo: nil
            )
        ]
        if let card = snapshot.cards.first(where: { $0.id == snapshot.lastCardID }) ?? snapshot.cards.first {
            items.append(
                UIApplicationShortcutItem(
                    type: checkout,
                    localizedTitle: String(localized: "\(card.name) przy kasie"),
                    localizedSubtitle: String(localized: "Pokaż kod karty"),
                    icon: UIApplicationShortcutIcon(systemImageName: "barcode.viewfinder"),
                    userInfo: ["kind": "card" as NSString, "id": card.id.uuidString as NSString]
                )
            )
        } else if let ticket = snapshot.nextTicket {
            items.append(
                UIApplicationShortcutItem(
                    type: checkout,
                    localizedTitle: String(localized: "Pokaż kaucję przy kasie"),
                    localizedSubtitle: ticket.brand,
                    icon: UIApplicationShortcutIcon(systemImageName: "barcode"),
                    userInfo: ["kind": "ticket" as NSString, "id": ticket.id.uuidString as NSString]
                )
            )
        } else {
            items.append(
                UIApplicationShortcutItem(
                    type: map,
                    localizedTitle: String(localized: "Butelkomaty"),
                    localizedSubtitle: String(localized: "Mapa punktów zwrotu"),
                    icon: UIApplicationShortcutIcon(systemImageName: "map.fill"),
                    userInfo: nil
                )
            )
        }
        UIApplication.shared.shortcutItems = items
    }

    static func captureIncoming(_ item: UIApplicationShortcutItem) {
        ShortcutLaunch.pending = item
        switch item.type {
        case scanDeposit:
            LaunchSplashPolicy.skipNext = true
            PendingLaunch.saveScan(.deposit)
        case scanReceipt:
            LaunchSplashPolicy.skipNext = true
            PendingLaunch.saveScan(.receipt)
        case scanLoyalty:
            LaunchSplashPolicy.skipNext = true
            PendingLaunch.saveScan(.loyalty)
        default:
            break
        }
    }

    @MainActor
    static func handle(_ item: UIApplicationShortcutItem, wallet: WalletModel) {
        ShortcutLaunch.pending = nil
        PendingLaunch.clearScan()
        switch item.type {
        case scanDeposit:
            wallet.openScanner(for: .deposit)
        case scanReceipt:
            wallet.openScanner(for: .receipt)
        case scanLoyalty:
            wallet.openScanner(for: .loyalty)
        case map:
            wallet.requestedTab = .wallet
            wallet.walletPath.append(WalletRoute.bottleMap)
        case checkout:
            let info = item.userInfo ?? [:]
            let kind = info["kind"] as? String
            let raw = info["id"] as? String
            if kind == "card", let raw, let id = UUID(uuidString: raw) {
                wallet.requestedTab = .cards
                wallet.showLoyaltyCheckoutFor = id
            } else if kind == "ticket", let raw, let id = UUID(uuidString: raw) {
                wallet.requestedTab = .wallet
                wallet.showCheckoutFor = id
            } else {
                wallet.requestedTab = .wallet
                wallet.walletPath.append(WalletRoute.bottleMap)
            }
        default:
            break
        }
    }
}
