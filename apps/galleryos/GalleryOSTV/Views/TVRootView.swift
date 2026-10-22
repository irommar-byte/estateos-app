import StoreKit
import SwiftUI

struct TVRootView: View {
    @EnvironmentObject private var session: TVSession
    @State private var intro = true

    var body: some View {
        ZStack {
            TVTheme.background.ignoresSafeArea()
            switch session.state {
            case .checking:
                TVLaunchView()
            case .needsPairing:
                TVPairingView()
                    .transition(.opacity)
            case .locked:
                TVLockedView()
                    .transition(.opacity)
            case .ready:
                TVReadyView()
                    .transition(.opacity)
            }
            if intro {
                LaunchCinema {
                    withAnimation(.easeIn(duration: 0.35)) { intro = false }
                }
                .transition(.opacity)
                .zIndex(2)
                .ignoresSafeArea()
            }
        }
        .animation(TVTheme.spring, value: session.state)
    }
}

/// Plans live on the same App Store products as the iPhone app. When Apple TV shares the purchase
/// (Universal Purchase) the products load here and can be bought with the remote; otherwise the
/// screen explains that the iPhone opens it and keeps listening for that.
@MainActor
final class TVMembership: ObservableObject {
    static let shared = TVMembership()
    static let yearly = "pl.galleryos.app.yearly"
    static let monthly = "pl.galleryos.app.monthly"
    static let lifetime = "pl.galleryos.app.lifetime"
    static let order = [yearly, monthly, lifetime]

    @Published private(set) var products: [Product] = []
    @Published var message = ""
    @Published private(set) var busy = false
    private var updates: Task<Void, Never>?

    private init() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
                await self?.refresh()
            }
        }
    }

    /// Only ever widens access: a missing purchase on this device must not erase the one
    /// the iPhone published to iCloud.
    func refresh() async {
        var lifetime = false
        var until: Date?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, transaction.revocationDate == nil else { continue }
            if transaction.productID == Self.lifetime {
                lifetime = true
            } else if let expiration = transaction.expirationDate, expiration > .now {
                until = max(until ?? expiration, expiration)
            }
        }
        if lifetime || until != nil {
            GalleryAccess.publish(lifetime: lifetime, until: until)
        }
    }

    /// Network call: only from the locked screen, never on the launch path.
    func loadProducts() async {
        if products.isEmpty {
            let loaded = (try? await Product.products(for: Self.order)) ?? []
            products = loaded.sorted { (Self.order.firstIndex(of: $0.id) ?? 0) < (Self.order.firstIndex(of: $1.id) ?? 0) }
        }
    }

    func purchase(_ product: Product) async {
        message = ""
        busy = true
        defer { busy = false }
        do {
            switch try await product.purchase() {
            case .success(.verified(let transaction)):
                await transaction.finish()
                await refresh()
            case .success(.unverified):
                message = L("App Store nie potwierdził zakupu. Wybierz Przywróć zakupy.")
            case .pending:
                message = L("Zakup czeka na zgodę. GalleryOS otworzy się sam, gdy przyjdzie.")
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            message = L("Nie udało się dokończyć zakupu.")
        }
    }

    func restore() async {
        message = ""
        busy = true
        defer { busy = false }
        try? await AppStore.sync()
        await refresh()
        if !GalleryAccess.allowed() {
            message = L("Na tym Apple ID nie ma jeszcze opłaconego GalleryOS.")
        }
    }

    static func title(_ id: String) -> String {
        switch id {
        case yearly: return L("Rocznie")
        case monthly: return L("Miesięcznie")
        default: return L("GalleryOS™ Ultimate")
        }
    }

    static func detail(_ product: Product) -> String {
        guard let period = product.subscription?.subscriptionPeriod else {
            return L("Jednorazowo, bez odnawiania")
        }
        let unit: String
        switch period.unit {
        case .year: unit = L("rok")
        case .month: unit = L("miesiąc")
        case .week: unit = L("tydzień")
        default: unit = L("dzień")
        }
        return L("Subskrypcja odnawiana co \(unit)")
    }
}

struct TVLockedView: View {
    @EnvironmentObject private var session: TVSession
    @ObservedObject private var membership = TVMembership.shared
    @FocusState private var focus: String?

    var body: some View {
        VStack(spacing: 36) {
            TVWordmark(size: 72)
            Text(membership.products.isEmpty
                 ? L("Trzy dni próbne minęły. Apple TV otworzy bibliotekę, gdy na iPhonie z tym samym Apple ID będzie opłacony GalleryOS.")
                 : L("Trzy dni próbne minęły. Wybierz plan — obejmuje iPhone’a, iPada i Apple TV na tym Apple ID."))
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 1100)

            if GalleryAccess.simulateEnded {
                Label(L("To symulacja włączona w GalleryOS na iPhonie (Plan GalleryOS). Wyłącz ją tam, a Apple TV otworzy się samo."), systemImage: "hourglass.bottomhalf.filled")
                    .font(.callout)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 1100)
            }

            if !membership.products.isEmpty {
                HStack(spacing: 40) {
                    ForEach(membership.products, id: \.id) { product in
                        Button {
                            Task { await membership.purchase(product) }
                        } label: {
                            VStack(spacing: 12) {
                                Text(TVMembership.title(product.id)).font(.headline)
                                Text(product.displayPrice).font(.title2.weight(.semibold).monospacedDigit())
                                Text(TVMembership.detail(product))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(width: 340, height: 190)
                        }
                        .buttonStyle(.card)
                        .focused($focus, equals: product.id)
                        .disabled(membership.busy)
                    }
                }
            }

            HStack(spacing: 32) {
                Button(L("Sprawdź ponownie")) {
                    Task { await session.recheckAccess() }
                }
                .focused($focus, equals: "check")
                Button(L("Przywróć zakupy")) {
                    Task {
                        await membership.restore()
                        await session.recheckAccess()
                    }
                }
                .focused($focus, equals: "restore")
            }
            .disabled(membership.busy)

            if !membership.message.isEmpty {
                Text(membership.message)
                    .font(.callout)
                    .foregroundStyle(.orange)
            }
            if !membership.products.isEmpty {
                Text(L("Subskrypcja odnawia się automatycznie, dopóki nie zostanie anulowana w Ustawieniach Apple ID co najmniej 24 godziny przed końcem okresu. Warunki: \(GalleryLegal.short(GalleryLegal.terms)) · Prywatność: \(GalleryLegal.short(GalleryLegal.privacy))"))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 1300)
            }
        }
        .padding(60)
        .onAppear {
            focus = membership.products.first?.id ?? "check"
        }
        .task { await membership.loadProducts() }
    }
}

struct TVLaunchView: View {
    var body: some View {
        VStack(spacing: 28) {
            TVWordmark(size: 72)
            ProgressView()
        }
    }
}

/// Main content once a server is paired: tabs, plus a full screen state while nothing is loaded yet.
struct TVReadyView: View {
    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var session: TVSession

    var body: some View {
        ZStack {
            if library.isEmpty {
                switch library.phase {
                case .failed(let message):
                    TVProblemView(message: message)
                case .ready:
                    TVEmptyView()
                default:
                    TVConnectingView()
                }
            } else {
                TVMainTabs()
            }
        }
        .animation(TVTheme.spring, value: library.isEmpty)
    }
}

struct TVConnectingView: View {
    @EnvironmentObject private var session: TVSession

    var body: some View {
        VStack(spacing: 30) {
            TVWordmark(size: 72)
            ProgressView()
            Text(L("Łączę z \(session.server?.title ?? "serwerem")"))
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }
}

struct TVEmptyView: View {
    @EnvironmentObject private var library: TVLibrary

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 96))
                .foregroundStyle(TVTheme.accent)
            Text(L("Biblioteka jest jeszcze pusta"))
                .font(.title)
            Text(L("Zdjęcia pojawią się tutaj, gdy iPhone skopiuje je na serwer."))
                .font(.title3)
                .foregroundStyle(.secondary)
            Button(L("Odśwież")) { library.refresh() }
        }
        .multilineTextAlignment(.center)
    }
}

struct TVProblemView: View {
    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var session: TVSession
    let message: String

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 96))
                .foregroundStyle(.orange)
            Text(L("Nie mogę połączyć z serwerem"))
                .font(.title)
            Text(message)
                .font(.title3)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 1000)
            HStack(spacing: 28) {
                Button(L("Spróbuj ponownie")) { library.retry() }
                Button(L("Sparuj od nowa"), role: .destructive) { session.forget() }
            }
        }
        .multilineTextAlignment(.center)
    }
}
