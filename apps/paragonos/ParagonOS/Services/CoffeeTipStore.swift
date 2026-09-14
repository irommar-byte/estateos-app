import Foundation
import StoreKit
import UIKit

enum CoffeeSize: String, CaseIterable, Identifiable {
    case small
    case medium
    case large

    var id: String { productID }

    var productID: String {
        switch self {
        case .small: return "pl.paragonos.app.coffee.small"
        case .medium: return "pl.paragonos.app.coffee.medium"
        case .large: return "pl.paragonos.app.coffee.large"
        }
    }

    var fallbackPrice: String {
        switch self {
        case .small: return "5 zł"
        case .medium: return "10 zł"
        case .large: return "20 zł"
        }
    }

    var title: String {
        switch self {
        case .small: return "Mała"
        case .medium: return "Średnia"
        case .large: return "Duża"
        }
    }
}

@MainActor
final class CoffeeTipStore: ObservableObject {
    @Published var products: [Product] = []
    @Published var selected: CoffeeSize = .medium
    @Published var isPurchasing = false
    @Published var isLoading = false
    @Published var message: String?
    @Published var lastThankYouAt: Date?
    @Published var showThankYou = false

    static let shared = CoffeeTipStore()

    static var activeScene: UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let ids = CoffeeSize.allCases.map(\.productID)
            let loaded = try await Product.products(for: ids)
            products = CoffeeSize.allCases.compactMap { size in
                loaded.first { $0.id == size.productID }
            }
            if products.isEmpty == false {
                message = nil
            }
        } catch {
            products = []
        }
    }

    func product(for size: CoffeeSize) -> Product? {
        products.first { $0.id == size.productID }
    }

    func price(for size: CoffeeSize) -> String {
        product(for: size)?.displayPrice ?? size.fallbackPrice
    }

    func purchase(_ size: CoffeeSize) async -> Bool {
        guard isPurchasing == false else { return false }
        isPurchasing = true
        message = nil
        defer { isPurchasing = false }
        selected = size
        if product(for: size) == nil {
            await load()
        }
        guard let product = product(for: size) else {
            message = String(localized: "Nie udało się otworzyć płatności Apple.")
            return false
        }
        do {
            let result: Product.PurchaseResult
            if let scene = Self.activeScene {
                result = try await product.purchase(confirmIn: scene)
            } else {
                result = try await product.purchase()
            }
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await transaction.finish()
                lastThankYouAt = .now
                QuietPromptStore.markCoffeeSuccess()
                showThankYou = true
                return true
            case .userCancelled:
                message = String(localized: "Innym razem.")
                return false
            case .pending:
                message = String(localized: "Płatność czeka na potwierdzenie.")
                return false
            @unknown default:
                message = String(localized: "Nie udało się otworzyć płatności Apple.")
                return false
            }
        } catch {
            message = String(localized: "Nie udało się otworzyć płatności Apple.")
            return false
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }
}
