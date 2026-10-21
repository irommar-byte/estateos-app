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
            Text("Jedno stuknięcie. Nowe Apple ID zakłada konto, a znane od razu wchodzi.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 8) {
                Text("Albo nazwa i hasło")
                    .font(.subheadline.weight(.semibold))
                TextField("Nazwa", text: $name)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .padding(14)
                    .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                SecureField("Hasło", text: $password)
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
                            Text("Kontynuuj")
                                .font(.body.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).count < 2 || password.count < 4)
                Text("Jeśli konta nie ma, powstanie. Jeśli jest, wejdziesz tym hasłem.")
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
            Text("Konto służy tylko do znajomych i albumów. Biblioteka zostaje na QNAP.")
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
                    onFailure("Apple nie potwierdziło tożsamości.")
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
        .accessibilityLabel("Wejdź przez Apple ID")
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
                Text("Najpierw konto. Jeśli serwer był już ustawiony, wróci sam. Potem dopiero połączenie.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button {
                    enterPasskey()
                } label: {
                    Label("Zaloguj się z Face ID", systemImage: "faceid")
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
                    Text("Albo nazwa i hasło")
                        .font(.subheadline.weight(.semibold))
                    TextField("Nazwa", text: $name)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    SecureField("Hasło", text: $password)
                        .textContentType(.password)
                        .padding(14)
                        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .onSubmit { enterPassword() }
                    Button(action: enterPassword) {
                        Text(busy ? "Chwila…" : "Kontynuuj")
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
                Button("Później", action: onLater)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 24)
            }
            .padding(.horizontal, 28)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .alert("Zapisać klucz Face ID?", isPresented: $offerKey) {
            Button("Zapisz") {
                Task {
                    _ = await account.registerPasskey()
                    onEntered()
                }
            }
            Button("Nie teraz", role: .cancel) {
                UserDefaults.standard.set(true, forKey: PasskeyCeremony.offeredKey)
                onEntered()
            }
        } message: {
            Text("Następnym razem wejdziesz tym iPhone’em, bez hasła.")
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
    @State private var backup = true
    @State private var outsideHome = false
    @State private var charging = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Kiedy zapisywać kopię")
                        .font(.title2.bold())
                    Text("To samo ustawisz później w synchronizacji.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    choice("Kopia zapasowa", "Nowe zdjęcia i filmy idą same. Wyłączone — tylko to, co wskażesz chmurką.", on: $backup)
                    choice("Także poza domem", "Włączone idzie przez komórkę i DDNS. Wyłączone zostaje w sieci lokalnej.", on: $outsideHome)
                        .disabled(!backup)
                        .opacity(backup ? 1 : 0.45)
                    choice("Tylko podczas ładowania", "Kopia rusza, gdy \(ThisDevice.name) jest podłączony do prądu.", on: $charging)
                        .disabled(!backup)
                        .opacity(backup ? 1 : 0.45)
                }
                .padding(22)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .galleryBottomBar(edge: .bottom) {
                Button("Gotowe") {
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
            Text("Podoba się GalleryOS?")
                .font(.title2.bold())
            Text("Gwiazdki zostawisz w App Store. Możesz też wrócić do tego później.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Tak, wystawię gwiazdki") {
                GalleryReview.accepted()
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            Button("Nie teraz") {
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
            throw PasskeyError.failed("Face ID nie zwróciło klucza.")
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
            throw PasskeyError.failed("Nie udało się zapisać klucza.")
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
}

@MainActor
final class GalleryMembership: ObservableObject {
    static let shared = GalleryMembership()
    @Published private(set) var unlocked: Bool
    @Published private(set) var products: [Product] = []
    @Published var message = ""

    private init() {
        GalleryAccess.noteStartIfNeeded()
        unlocked = GalleryAccess.allowed()
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
        GalleryAccess.publish(lifetime: lifetime, until: until)
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
            message = "Plan nie jest jeszcze dostępny w App Store."
            return
        }
        do {
            let result = try await product.purchase()
            if case .success(let verification) = result, case .verified(let transaction) = verification {
                await transaction.finish()
                await refresh()
            }
        } catch {
            message = "Nie udało się dokończyć zakupu."
        }
    }

    func restore() async {
        message = ""
        try? await AppStore.sync()
        await refresh()
        if !unlocked {
            message = "Na tym Apple ID nie ma opłaconego GalleryOS."
        }
    }

    func price(for id: String, fallback: String) -> String {
        products.first { $0.id == id }?.displayPrice ?? fallback
    }
}

struct MembershipGate: View {
    @ObservedObject private var membership = GalleryMembership.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("GalleryOS")
                        .font(.largeTitle.bold())
                    Text("Trzy dni minęły. Zdjęcia zostają na telefonie i na serwerze. GalleryOS i Apple TV otwierają się z jednym z tych planów.")
                        .foregroundStyle(.secondary)
                    plan(
                        id: GalleryProduct.yearly,
                        title: "Rocznie",
                        price: membership.price(for: GalleryProduct.yearly, fallback: "99 zł"),
                        detail: "Dwa miesiące taniej niż płacenie co miesiąc. Apple TV w cenie.",
                        prominent: true
                    )
                    plan(
                        id: GalleryProduct.monthly,
                        title: "Miesięcznie",
                        price: membership.price(for: GalleryProduct.monthly, fallback: "9,99 zł"),
                        detail: "Można zrezygnować, gdy GalleryOS nie jest już potrzebny.",
                        prominent: false
                    )
                    plan(
                        id: GalleryProduct.lifetime,
                        title: "Na stałe",
                        price: membership.price(for: GalleryProduct.lifetime, fallback: "299 zł"),
                        detail: "Raz. Działa dalej na tym Apple ID, w Chmurze rodzinnej i na Apple TV.",
                        prominent: false
                    )
                    Button("Przywróć zakupy") {
                        Task { await membership.restore() }
                    }
                    .frame(maxWidth: .infinity)
                    if !membership.message.isEmpty {
                        Text(membership.message)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
                .padding(24)
            }
            .background(Color(uiColor: .systemGroupedBackground))
        }
    }

    private func plan(id: String, title: String, price: String, detail: String, prominent: Bool) -> some View {
        Button {
            Task { await membership.purchase(id) }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(title).font(.headline)
                    Spacer()
                    Text(price).font(.headline.monospacedDigit())
                }
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(prominent ? Color.white.opacity(0.85) : Color.secondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
        .buttonStyle(.plain)
        .foregroundStyle(prominent ? Color.white : Color.primary)
        .background(prominent ? GalleryTheme.accent : Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
