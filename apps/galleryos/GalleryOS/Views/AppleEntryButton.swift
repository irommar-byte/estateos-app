import AuthenticationServices
import CryptoKit
import StoreKit
import SwiftUI
import UIKit

struct AccountEntryForm: View {
    @ObservedObject private var account = ShareAccount.shared
    @State private var name = ""
    @State private var password = ""
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            AppleEntryButton(busy: busy) { credential in
                busy = true
                Task {
                    await account.signIn(with: credential)
                    busy = false
                }
            } onFailure: { text in
                account.message = text
            }
            Text(L("Jedno stuknięcie. Nowe Apple ID zakłada konto, a znane od razu wchodzi."))
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 8) {
                Text(L("Albo nazwa i hasło"))
                    .font(.subheadline.weight(.semibold))
                TextField(L("Nazwa"), text: $name)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .padding(14)
                    .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                SecureField(L("Hasło"), text: $password)
                    .textContentType(.password)
                    .submitLabel(.continue)
                    .padding(14)
                    .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .onSubmit { continueAccount() }
                Button {
                    continueAccount()
                } label: {
                    Group {
                        if busy {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(L("Kontynuuj"))
                                .font(.body.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 || password.count < 4)
                Text(L("Jeśli konta nie ma, powstanie. Jeśli jest, wejdziesz tym hasłem."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !account.message.isEmpty {
                Text(account.message)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(L("Konto służy tylko do znajomych i albumów. Biblioteka zostaje na QNAP."))
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    private func continueAccount() {
        busy = true
        Task {
            await account.enter(name: name, password: password)
            busy = false
        }
    }
}

struct AppleEntryButton: View {
    var busy: Bool
    var onCredential: (AppleIdentity.Credential) -> Void
    var onFailure: (String) -> Void
    @Environment(\.colorScheme) private var scheme
    @State private var nonce = NonceBox()

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            let raw = AppleIdentity.makeNonce()
            nonce.value = raw
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleIdentity.hashed(raw)
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard
                    let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                    let tokenData = credential.identityToken,
                    let token = String(data: tokenData, encoding: .utf8)
                else {
                    onFailure(L("Apple nie potwierdziło tożsamości."))
                    return
                }
                let person = credential.fullName
                let given = person?.givenName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let family = person?.familyName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                onCredential(AppleIdentity.Credential(token: token, nonce: nonce.value, givenName: given, familyName: family))
            case .failure(let error):
                let text = AccountFailure.message(for: error)
                if !text.isEmpty { onFailure(text) }
            }
        }
        .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
        .frame(height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .disabled(busy)
        .opacity(busy ? 0.55 : 1)
        .accessibilityLabel(L("Wejdź przez Apple ID"))
    }
}

private final class NonceBox {
    var value = ""
}

enum AppleIdentity {
    struct Credential {
        var token: String
        var nonce: String
        var givenName: String
        var familyName: String
        var name: String {
            [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
        }
    }

    static func makeNonce(length: Int = 32) -> String {
        let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return String(bytes.map { alphabet[Int($0) % alphabet.count] })
    }

    static func hashed(_ nonce: String) -> String {
        SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

enum AccountGate {
    static let skippedKey = "galleryos.account.skipped"
}

enum SyncChoices {
    static let doneKey = "galleryos.sync.choices.done"

    static var shouldAsk: Bool {
        guard !UserDefaults.standard.bool(forKey: doneKey) else { return false }
        let settings = DestinationSettings.load()
        return settings.connected && settings.kind != DestinationKind.none && settings.kind != DestinationKind.folder
    }

    @MainActor
    static func finish(backup: Bool, outsideHome: Bool, charging: Bool) {
        SyncPolicy.wifiOnly = !outsideHome
        SyncPolicy.chargingOnly = charging
        UserDefaults.standard.set(true, forKey: doneKey)
        LibraryEngine.shared.setUploadsEnabled(backup)
    }
}

enum GalleryReview {
    private static let installedKey = "galleryos.review.installed"
    private static let sessionsKey = "galleryos.review.sessions"
    private static let nextKey = "galleryos.review.next"

    static func noteLaunch() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: installedKey) == nil {
            defaults.set(Date().timeIntervalSince1970, forKey: installedKey)
        }
        defaults.set(defaults.integer(forKey: sessionsKey) + 1, forKey: sessionsKey)
    }

    static func due() -> Bool {
        let defaults = UserDefaults.standard
        let installed = defaults.double(forKey: installedKey)
        guard installed > 0 else { return false }
        if defaults.double(forKey: nextKey) > Date().timeIntervalSince1970 { return false }
        if defaults.integer(forKey: sessionsKey) < 4 { return false }
        return Date().timeIntervalSince1970 - installed >= 3 * 24 * 60 * 60
    }

    static func later() {
        UserDefaults.standard.set(Date().timeIntervalSince1970 + 90 * 24 * 60 * 60, forKey: nextKey)
    }

    @MainActor
    static func accepted() {
        UserDefaults.standard.set(Date().timeIntervalSince1970 + 180 * 24 * 60 * 60, forKey: nextKey)
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        if let scene {
            AppStore.requestReview(in: scene)
        }
    }
}

struct StartGate: View {
    var onEntered: () -> Void
    var onLater: () -> Void
    @ObservedObject private var account = ShareAccount.shared
    @State private var name = ""
    @State private var password = ""
    @State private var busy = false
    @State private var offerKey = false

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                BrandWordmark(size: .largeTitle)
                    .padding(.top, 28)
                Text(L("Najpierw konto. Jeśli serwer był już ustawiony, wróci sam. Potem dopiero połączenie."))
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button {
                    enterPasskey()
                } label: {
                    Label(L("Zaloguj się z Face ID"), systemImage: "faceid")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .disabled(busy)
                AppleEntryButton(busy: busy) { credential in
                    busy = true
                    Task {
                        await account.signIn(with: credential)
                        busy = false
                        if account.signedIn { entered() }
                    }
                } onFailure: { text in
                    account.message = text
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(L("Albo nazwa i hasło"))
                        .font(.subheadline.weight(.semibold))
                    TextField(L("Nazwa"), text: $name)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    SecureField(L("Hasło"), text: $password)
                        .textContentType(.password)
                        .padding(14)
                        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .onSubmit { enterPassword() }
                    Button(action: enterPassword) {
                        Text(busy ? L("Chwila…") : L("Kontynuuj"))
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                    }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.roundedRectangle(radius: 14))
                    .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 || password.count < 4)
                }
                if !account.message.isEmpty {
                    Text(account.message)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
                Button(L("Później"), action: onLater)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 24)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .alert(L("Zapisać klucz Face ID?"), isPresented: $offerKey) {
            Button(L("Zapisz")) {
                Task {
                    _ = await account.registerPasskey()
                    onEntered()
                }
            }
            Button(L("Nie teraz"), role: .cancel) {
                UserDefaults.standard.set(true, forKey: PasskeyCeremony.offeredKey)
                onEntered()
            }
        } message: {
            Text(L("Następnym razem wejdziesz tym \(ThisDevice.instrumental), bez hasła."))
        }
    }

    private func enterPasskey() {
        busy = true
        Task {
            await account.signInWithPasskey()
            busy = false
            if account.signedIn { entered() }
        }
    }

    private func enterPassword() {
        busy = true
        Task {
            await account.enter(name: name, password: password)
            busy = false
            if account.signedIn { entered() }
        }
    }

    private func entered() {
        let offered = UserDefaults.standard.bool(forKey: PasskeyCeremony.offeredKey)
        let ready = UserDefaults.standard.bool(forKey: PasskeyCeremony.readyKey)
        if !offered && !ready {
            offerKey = true
            return
        }
        onEntered()
    }
}

struct SyncChoicesSheet: View {
    var onDone: () -> Void
    // Start from what is set now, so "Gotowe" never undoes a change made in the sync panel.
    @State private var backup = SyncPolicy.uploadsEnabled
    @State private var outsideHome = !SyncPolicy.wifiOnly
    @State private var charging = SyncPolicy.chargingOnly

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(L("Kiedy zapisywać kopię"))
                        .font(.title2.bold())
                    Text(L("To samo ustawisz później w synchronizacji."))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    choice(L("Kopia zapasowa"), L("Nowe zdjęcia i filmy idą same. Wyłączone — tylko to, co wskażesz chmurką."), on: $backup)
                    choice(L("Także poza domem"), L("Włączone idzie przez komórkę i DDNS. Wyłączone zostaje w sieci lokalnej."), on: $outsideHome)
                        .disabled(!backup)
                        .opacity(backup ? 1 : 0.45)
                    choice(L("Tylko podczas ładowania"), L("Kopia rusza, gdy \(ThisDevice.name) jest podłączony do prądu."), on: $charging)
                        .disabled(!backup)
                        .opacity(backup ? 1 : 0.45)
                }
                .padding(22)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .galleryBottomBar(edge: .bottom) {
                Button(L("Gotowe")) {
                    SyncChoices.finish(backup: backup, outsideHome: outsideHome, charging: charging)
                    onDone()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, 22)
                .padding(.bottom, 8)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        // A swipe would bring it back on every visit to the Library; one tap on "Gotowe" settles it.
        .interactiveDismissDisabled()
    }

    private func choice(_ title: String, _ detail: String, on: Binding<Bool>) -> some View {
        Toggle(isOn: on) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .tint(GalleryTheme.accent)
        .padding(16)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct ReviewPrompt: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "star.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(GalleryTheme.accent)
                .padding(.top, 8)
            Text(L("Podoba się GalleryOS?"))
                .font(.title2.bold())
            Text(L("Gwiazdki zostawisz w App Store. Możesz też wrócić do tego później."))
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(L("Tak, wystawię gwiazdki")) {
                GalleryReview.accepted()
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            Button(L("Nie teraz")) {
                GalleryReview.later()
                dismiss()
            }
            .font(.body.weight(.medium))
        }
        .padding(28)
        .presentationDetents([.medium])
    }
}

enum PasskeyError: Error {
    case cancelled
    case failed(String)
}

struct PasskeyStart: Decodable {
    var sessionId: String
    var challenge: String
    var rpId: String
}

struct PasskeyRegisterStart: Decodable {
    var sessionId: String
    var challenge: String
    var rpId: String
    var userID: String
    var name: String
}

struct AssertionBody: Encodable {
    var clientDataJSON: String
    var authenticatorData: String
    var signature: String
    var userHandle: String
}

struct RegistrationBody: Encodable {
    var clientDataJSON: String
    var attestationObject: String
}

struct PasskeyFinish: Encodable {
    var sessionId: String
    var id: String
    var response: Response

    enum Response: Encodable {
        case assertion(AssertionBody)
        case registration(RegistrationBody)

        func encode(to encoder: Encoder) throws {
            switch self {
            case .assertion(let body): try body.encode(to: encoder)
            case .registration(let body): try body.encode(to: encoder)
            }
        }
    }
}

enum Base64URL {
    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func decode(_ text: String) -> Data? {
        var padded = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let remainder = padded.count % 4
        if remainder > 0 { padded += String(repeating: "=", count: 4 - remainder) }
        return Data(base64Encoded: padded)
    }
}

final class PasskeyCeremony: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = PasskeyCeremony()
    static let readyKey = "galleryos.passkey.ready"
    static let offeredKey = "galleryos.passkey.offered"
    private var continuation: CheckedContinuation<ASAuthorization, Error>?

    func assert(challenge: Data) async throws -> (id: String, response: AssertionBody) {
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: "estateos.pl")
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        let authorization = try await perform(request)
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion else {
            throw PasskeyError.failed(L("Face ID nie zwróciło klucza."))
        }
        return (
            Base64URL.encode(credential.credentialID),
            AssertionBody(
                clientDataJSON: Base64URL.encode(credential.rawClientDataJSON),
                authenticatorData: Base64URL.encode(credential.rawAuthenticatorData),
                signature: Base64URL.encode(credential.signature),
                userHandle: Base64URL.encode(credential.userID ?? Data())
            )
        )
    }

    func register(challenge: Data, name: String, userID: Data) async throws -> (id: String, response: RegistrationBody) {
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: "estateos.pl")
        let request = provider.createCredentialRegistrationRequest(challenge: challenge, name: name, userID: userID)
        let authorization = try await perform(request)
        guard let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration,
              let attestation = credential.rawAttestationObject else {
            throw PasskeyError.failed(L("Nie udało się zapisać klucza."))
        }
        return (
            Base64URL.encode(credential.credentialID),
            RegistrationBody(
                clientDataJSON: Base64URL.encode(credential.rawClientDataJSON),
                attestationObject: Base64URL.encode(attestation)
            )
        )
    }

    private func perform(_ request: ASAuthorizationRequest) async throws -> ASAuthorization {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        continuation?.resume(returning: authorization)
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let code = (error as? ASAuthorizationError)?.code
        if code == .canceled || code == .unknown {
            continuation?.resume(throwing: PasskeyError.cancelled)
        } else {
            continuation?.resume(throwing: PasskeyError.failed(error.localizedDescription))
        }
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
        return scene?.keyWindow ?? UIWindow()
    }
}

enum GalleryProduct {
    static let monthly = "pl.galleryos.app.monthly"
    static let yearly = "pl.galleryos.app.yearly"
    static let lifetime = "pl.galleryos.app.lifetime"
    static let all = [yearly, monthly, lifetime]

    static func title(_ id: String) -> String {
        switch id {
        case lifetime: return L("GalleryOS™ Ultimate")
        case yearly: return L("GalleryOS™ · rok")
        default: return L("GalleryOS™ · miesiąc")
        }
    }
}

@MainActor
final class GalleryMembership: ObservableObject {
    static let shared = GalleryMembership()
    @Published private(set) var unlocked: Bool
    /// Set after a successful purchase; the root shows the full-screen welcome for this plan.
    @Published var celebration: String?
    @Published private(set) var products: [Product] = []
    @Published var message = ""
    private var updates: Task<Void, Never>?

    private init() {
        GalleryAccess.noteStartIfNeeded()
        unlocked = GalleryAccess.allowed()
        // Purchases approved later (Ask to Buy), offer codes and renewals arrive here.
        // Without listening they stayed unfinished until the next return to the app.
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                }
                await self?.refresh()
            }
        }
    }

    func refresh() async {
        GalleryAccess.noteStartIfNeeded()
        var lifetime = false
        var until: Date?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result, transaction.revocationDate == nil else { continue }
            if transaction.productID == GalleryProduct.lifetime {
                lifetime = true
            } else if let expiration = transaction.expirationDate {
                if let current = until {
                    until = max(current, expiration)
                } else {
                    until = expiration
                }
            }
        }
        // Only widen what iCloud says: Apple TV may have bought the plan on its own record.
        if lifetime || (until ?? .distantPast) > .now {
            GalleryAccess.publish(lifetime: lifetime, until: until)
        }
        unlocked = lifetime || (until ?? .distantPast) > .now || GalleryAccess.allowed()
        if products.isEmpty {
            products = (try? await Product.products(for: GalleryProduct.all)) ?? []
            products.sort { lhs, rhs in
                GalleryProduct.all.firstIndex(of: lhs.id) ?? 0 < GalleryProduct.all.firstIndex(of: rhs.id) ?? 0
            }
        }
    }

    func purchase(_ id: String) async {
        message = ""
        if products.isEmpty { await refresh() }
        guard let product = products.first(where: { $0.id == id }) else {
            message = L("Plan nie jest jeszcze dostępny w App Store.")
            return
        }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(.verified(let transaction)):
                await transaction.finish()
                await refresh()
                celebration = GalleryProduct.title(id)
            case .success(.unverified):
                message = L("App Store nie potwierdził zakupu. Spróbuj Przywróć zakupy.")
            case .pending:
                message = L("Zakup czeka na zatwierdzenie. GalleryOS odblokuje się sam, gdy przyjdzie zgoda.")
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
        try? await AppStore.sync()
        await refresh()
        if !unlocked {
            message = L("Na tym Apple ID nie ma opłaconego GalleryOS.")
        }
    }

    func price(for id: String, fallback: String) -> String {
        products.first { $0.id == id }?.displayPrice ?? fallback
    }
}

/// The plan screen. Opens on its own when the free days end, and any time from the sync console.
/// Lifetime is the hero: one purchase, no subscription, every device on the Apple ID.
struct MembershipGate: View {
    @ObservedObject private var membership = GalleryMembership.shared
    /// Opened from the sync console at any time (plans, status, restore), not only when the trial ends.
    var closable = false
    @Environment(\.dismiss) private var dismiss
    @State private var chosen = GalleryProduct.lifetime
    @State private var buying = false
    @State private var storefront = ""
    @State private var glow = false
    @AppStorage(GalleryAccess.simulateKey) private var simulateEnded = false

    private let gold = LinearGradient(
        colors: [Color(red: 1.0, green: 0.86, blue: 0.52), Color(red: 0.86, green: 0.62, blue: 0.24), Color(red: 1.0, green: 0.84, blue: 0.5)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    header
                    benefits
                    VStack(spacing: 12) {
                        planCard(
                            id: GalleryProduct.lifetime,
                            title: L("GalleryOS™ Ultimate"),
                            badge: L("NA STAŁE"),
                            line: lifetimeLine,
                            price: membership.price(for: GalleryProduct.lifetime, fallback: "…"),
                            period: L("jednorazowo")
                        )
                        planCard(
                            id: GalleryProduct.yearly,
                            title: L("Rocznie"),
                            badge: savingBadge,
                            line: yearlyLine,
                            price: membership.price(for: GalleryProduct.yearly, fallback: "…"),
                            period: L("na rok")
                        )
                        planCard(
                            id: GalleryProduct.monthly,
                            title: L("Miesięcznie"),
                            badge: nil,
                            line: L("Bez zobowiązań. Anulujesz w każdej chwili."),
                            price: membership.price(for: GalleryProduct.monthly, fallback: "…"),
                            period: L("na miesiąc")
                        )
                    }
                    buyButton
                    if !membership.message.isEmpty {
                        Text(membership.message)
                            .font(.footnote)
                            .foregroundStyle(.orange)
                            .multilineTextAlignment(.center)
                    }
                    footer
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 30)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(backdrop.ignoresSafeArea())
            .toolbar {
                if closable {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(L("Gotowe")) { dismiss() }
                    }
                }
            }
            .task {
                await membership.refresh()
                if let code = await Storefront.current?.countryCode { storefront = code }
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { glow = true }
            }
        }
        .overlay {
            // Opened as a sheet, the welcome plays here, above everything, then the sheet closes.
            if closable, let plan = membership.celebration {
                PurchaseCelebration(plan: plan) {
                    membership.celebration = nil
                    dismiss()
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.5), value: membership.celebration)
        .environment(\.colorScheme, .dark)
    }

    // MARK: Pieces

    private var backdrop: some View {
        ZStack {
            Color(red: 0.03, green: 0.03, blue: 0.05)
            RadialGradient(colors: [Color(red: 0.86, green: 0.62, blue: 0.24).opacity(glow ? 0.28 : 0.16), .clear], center: .top, startRadius: 20, endRadius: 520)
            RadialGradient(colors: [Color(red: 0.35, green: 0.3, blue: 0.9).opacity(0.18), .clear], center: .bottomTrailing, startRadius: 20, endRadius: 480)
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(gold)
                    .frame(width: 78, height: 78)
                    .shadow(color: Color(red: 0.95, green: 0.72, blue: 0.3).opacity(glow ? 0.7 : 0.35), radius: glow ? 26 : 14)
                Image(systemName: "crown.fill")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Color(red: 0.25, green: 0.16, blue: 0.04))
                    .symbolEffect(.bounce, options: .nonRepeating, value: glow)
            }
            .padding(.top, 18)
            Text("GalleryOS™")
                .font(.system(size: 34, weight: .bold, design: .serif))
            Text(L("Twoja galeria. Twój serwer. Bez abonamentu za chmurę."))
                .font(.headline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Label(GalleryAccess.statusLine, systemImage: membership.unlocked ? "checkmark.seal.fill" : "clock.fill")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(membership.unlocked ? Color.green : Color.orange)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(.white.opacity(0.08)))
        }
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 12) {
            benefit("iphone.and.arrow.forward", L("iPhone, iPad i Apple TV"), L("Jeden plan na wszystkie urządzenia z Twoim Apple ID."))
            benefit("externaldrive.fill.badge.checkmark", L("Kopia bez limitów"), L("Oryginały na Twoim serwerze – tyle, ile ma dysk, nie abonament."))
            benefit("person.3.fill", L("Chmura rodzinna"), L("Do sześciu osób w rodzinie, bez dopłat."))
            benefit("lock.shield.fill", L("Prywatnie"), L("Bez reklam, bez śledzenia. Zdjęcia nigdy nie trafiają do nas."))
        }
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.05)))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(.white.opacity(0.08), lineWidth: 1))
    }

    private func benefit(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(gold)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func planCard(id: String, title: String, badge: String?, line: String, price: String, period: String) -> some View {
        let selected = chosen == id
        let hero = id == GalleryProduct.lifetime
        return Button {
            UISelectionFeedbackGenerator().selectionChanged()
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { chosen = id }
        } label: {
            HStack(alignment: .center, spacing: 14) {
                ZStack {
                    Circle().strokeBorder(selected ? AnyShapeStyle(gold) : AnyShapeStyle(Color.white.opacity(0.25)), lineWidth: 2)
                    if selected {
                        Circle().fill(gold).padding(5).transition(.scale)
                    }
                }
                .frame(width: 24, height: 24)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(title).font(.headline)
                        if let badge {
                            Text(badge)
                                .font(.system(size: 9.5, weight: .heavy))
                                .tracking(0.6)
                                .foregroundStyle(hero ? Color(red: 0.25, green: 0.16, blue: 0.04) : .white)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(hero ? AnyShapeStyle(gold) : AnyShapeStyle(Color.green.opacity(0.75))))
                        }
                    }
                    Text(line)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(price)
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .monospacedDigit()
                    Text(period)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(selected ? Color.white.opacity(0.1) : Color.white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(selected ? AnyShapeStyle(gold) : AnyShapeStyle(Color.white.opacity(0.08)), lineWidth: selected ? 1.6 : 1)
            )
            .scaleEffect(selected ? 1 : 0.985)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var buyButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            buying = true
            Task {
                await membership.purchase(chosen)
                buying = false
            }
        } label: {
            ZStack {
                if buying {
                    ProgressView().tint(Color(red: 0.25, green: 0.16, blue: 0.04))
                } else {
                    VStack(spacing: 2) {
                        Text(buyTitle).font(.headline)
                        Text(buySubtitle).font(.caption.weight(.medium)).opacity(0.75)
                    }
                }
            }
            .foregroundStyle(Color(red: 0.22, green: 0.14, blue: 0.03))
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(gold)
                    .overlay(
                        // A slow light sweep across the button.
                        TimelineView(.animation(minimumInterval: 1 / 30)) { context in
                            let t = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3.2) / 3.2
                            GeometryReader { proxy in
                                LinearGradient(colors: [.clear, .white.opacity(0.45), .clear], startPoint: .leading, endPoint: .trailing)
                                    .frame(width: 70)
                                    .rotationEffect(.degrees(18))
                                    .offset(x: CGFloat(t) * (proxy.size.width + 140) - 140)
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .allowsHitTesting(false)
                    )
            )
            .shadow(color: Color(red: 0.95, green: 0.72, blue: 0.3).opacity(0.35), radius: 18, y: 6)
        }
        .buttonStyle(.plain)
        .disabled(buying)
    }

    /// Prices come only from the App Store (the buyer's own currency); none are written in the app.
    private var buyTitle: String {
        let title: String
        switch chosen {
        case GalleryProduct.lifetime: title = L("Kup GalleryOS™ Ultimate")
        case GalleryProduct.yearly: title = L("Wybieram rok")
        default: title = L("Wybieram miesiąc")
        }
        guard let price = product(chosen)?.displayPrice else { return title }
        return "\(title) · \(price)"
    }

    private var buySubtitle: String {
        chosen == GalleryProduct.lifetime ? L("Raz i spokój. Bez odnawiania.") : L("Subskrypcja odnawiana automatycznie")
    }

    private var footer: some View {
        VStack(spacing: 12) {
            Button(L("Przywróć zakupy")) {
                Task { await membership.restore() }
            }
            .font(.subheadline.weight(.semibold))
            Text(L("Plany Rocznie i Miesięcznie to subskrypcje odnawiane automatycznie. Opłata pobierana jest z konta Apple ID po potwierdzeniu zakupu; subskrypcja odnawia się, dopóki nie zostanie anulowana w Ustawieniach co najmniej 24 godziny przed końcem okresu. GalleryOS™ Ultimate to zakup jednorazowy, na zawsze."))
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            HStack(spacing: 18) {
                Link(L("Warunki użytkowania"), destination: GalleryLegal.terms)
                Link(L("Polityka prywatności"), destination: GalleryLegal.privacy)
            }
            .font(.caption.weight(.medium))
            if !storefront.isEmpty {
                Text(L("Ceny w walucie Twojego konta App Store (\(storefront))."))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            simulation
        }
        .padding(.top, 4)
    }

    /// Shows what happens when the free days run out, without touching the real trial.
    private var simulation: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: Binding(
                get: { simulateEnded },
                set: { value in
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                    GalleryAccess.simulateEnded = value
                    simulateEnded = value
                    Task { await membership.refresh() }
                }
            )) {
                Label(L("Symuluj koniec okresu próbnego"), systemImage: "hourglass.bottomhalf.filled")
                    .font(.subheadline.weight(.semibold))
            }
            .tint(.orange)
            Text(simulateEnded
                 ? L("Aplikacja i Apple TV na tym Apple ID zachowują się jak po 3 dniach. Wyłącz, a wróci Twój prawdziwy okres próbny. Kupione plany działają zawsze.")
                 : L("Podgląd tego, co zobaczysz po 3 dniach. Prawdziwy okres próbny się nie zmienia."))
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.orange.opacity(simulateEnded ? 0.14 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.orange.opacity(0.25), lineWidth: 1))
        .padding(.top, 8)
        // The switch lives in iCloud: another device on this Apple ID may have flipped it.
        .onAppear { simulateEnded = GalleryAccess.simulateEnded }
    }

    // MARK: Numbers from the real App Store prices

    private func product(_ id: String) -> Product? {
        membership.products.first { $0.id == id }
    }

    /// "Tyle co 30 miesięcy" – how lifetime compares with paying monthly.
    private var lifetimeLine: String {
        guard let life = product(GalleryProduct.lifetime), let month = product(GalleryProduct.monthly), month.price > 0 else {
            return L("Jeden zakup i spokój na zawsze. Bez subskrypcji.")
        }
        let months = Int(NSDecimalNumber(decimal: life.price / month.price).doubleValue.rounded())
        return Plural.pick(months,
                           L("Raz i spokój na zawsze – tyle co \(months) miesiąc abonamentu."),
                           L("Raz i spokój na zawsze – tyle co \(months) miesiące abonamentu."),
                           L("Raz i spokój na zawsze – tyle co \(months) miesięcy abonamentu."))
    }

    private var yearlyLine: String {
        guard let year = product(GalleryProduct.yearly) else { return L("Dwanaście miesięcy w niższej cenie.") }
        let perMonth = (year.price / 12).formatted(year.priceFormatStyle)
        return L("Tylko \(perMonth) miesięcznie, płatne raz w roku.")
    }

    private var savingBadge: String? {
        guard let year = product(GalleryProduct.yearly), let month = product(GalleryProduct.monthly), month.price > 0 else { return nil }
        let saving = 1 - NSDecimalNumber(decimal: year.price / (month.price * 12)).doubleValue
        guard saving >= 0.05 else { return nil }
        return "−\(Int((saving * 100).rounded()))%"
    }
}


/// Full-screen welcome after a purchase: gold light opens from the crown, sparks rise,
/// the plan name settles in. Taps or five seconds close it.
struct PurchaseCelebration: View {
    let plan: String
    let done: () -> Void
    @State private var start = Date()
    @State private var shown = false

    private let gold = LinearGradient(
        colors: [Color(red: 1.0, green: 0.88, blue: 0.56), Color(red: 0.86, green: 0.62, blue: 0.24), Color(red: 1.0, green: 0.84, blue: 0.5)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        TimelineView(.animation) { context in
            let t = context.date.timeIntervalSince(start)
            ZStack {
                Color(red: 0.02, green: 0.02, blue: 0.04)
                // Light rays turning slowly behind the crown.
                AngularGradient(
                    colors: Array(repeating: [Color(red: 1, green: 0.8, blue: 0.4).opacity(0.22), .clear], count: 9).flatMap { $0 },
                    center: .center
                )
                .rotationEffect(.degrees(t * 9))
                .scaleEffect(1.6)
                .mask(RadialGradient(colors: [.white, .clear], center: .center, startRadius: 10, endRadius: 420))
                .opacity(min(1, t / 0.8))
                RadialGradient(colors: [Color(red: 0.95, green: 0.72, blue: 0.3).opacity(0.45), .clear], center: .center, startRadius: 4, endRadius: 260 + 40 * sin(t * 1.6))
                // Golden sparks rising.
                Canvas { canvas, size in
                    for index in 0..<70 {
                        let seed = Double(index) * 12.9898
                        let x = (sin(seed) * 43758.5453).truncatingRemainder(dividingBy: 1)
                        let speed = 0.08 + abs((cos(seed) * 9631.17).truncatingRemainder(dividingBy: 1)) * 0.16
                        let phase = abs((sin(seed * 1.7) * 1234.5).truncatingRemainder(dividingBy: 1))
                        let progress = (t * speed + phase).truncatingRemainder(dividingBy: 1)
                        let px = size.width * abs(x) + sin(t * 1.2 + seed) * 14
                        let py = size.height * (1.05 - progress * 1.15)
                        let r = 1.2 + 2.2 * (1 - progress)
                        let alpha = sin(progress * .pi) * 0.9
                        canvas.fill(Path(ellipseIn: CGRect(x: px - r, y: py - r, width: r * 2, height: r * 2)),
                                    with: .color(Color(red: 1, green: 0.84, blue: 0.5).opacity(alpha)))
                    }
                }
                VStack(spacing: 22) {
                    ZStack {
                        Circle()
                            .fill(gold)
                            .frame(width: 128, height: 128)
                            .shadow(color: Color(red: 0.95, green: 0.72, blue: 0.3).opacity(0.8), radius: 40)
                        Image(systemName: "crown.fill")
                            .font(.system(size: 54, weight: .bold))
                            .foregroundStyle(Color(red: 0.25, green: 0.16, blue: 0.04))
                    }
                    .scaleEffect(shown ? 1 : 0.2)
                    .rotation3DEffect(.degrees(shown ? 0 : -90), axis: (x: 0, y: 1, z: 0))
                    VStack(spacing: 8) {
                        Text(L("Witaj w"))
                            .font(.title3.weight(.medium))
                            .foregroundStyle(.white.opacity(0.7))
                        Text(plan)
                            .font(.system(size: 38, weight: .bold, design: .serif))
                            .foregroundStyle(gold)
                            .multilineTextAlignment(.center)
                        Text(L("iPhone, iPad i Apple TV są odblokowane.\nDziękujemy, że jesteś z nami."))
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.75))
                            .multilineTextAlignment(.center)
                    }
                    .opacity(shown ? 1 : 0)
                    .offset(y: shown ? 0 : 24)
                }
                .padding(32)
            }
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture(perform: done)
        .onAppear {
            start = .now
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.spring(response: 0.9, dampingFraction: 0.62).delay(0.15)) { shown = true }
        }
        .task {
            try? await Task.sleep(for: .seconds(5.5))
            done()
        }
        .environment(\.colorScheme, .dark)
    }
}
