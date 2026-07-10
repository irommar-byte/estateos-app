import AuthenticationServices
import Foundation
import ObjectiveC
import SwiftUI
import UIKit

struct AppleSignInResult {
    let identityToken: String
    let authorizationCode: String?
    let userId: String
    let email: String?
    let fullName: String?
}

struct AppleAccountLink: Codable, Equatable {
    let userId: String
    let email: String?
    let fullName: String?
    let linkedAt: Date
}

enum AppleSignInError: LocalizedError {
    case cancelled
    case noCredential
    case invalidToken
    case notLinked

    var errorDescription: String? {
        switch self {
        case .cancelled: return "Logowanie Apple anulowane."
        case .noCredential: return "Brak danych logowania Apple."
        case .invalidToken: return "Nieprawidłowy token Apple."
        case .notLinked: return "To konto Apple nie jest jeszcze powiązane z kontem Nostalgie™."
        }
    }
}

@MainActor
final class AppleSignInService: NSObject, ObservableObject {
    static let shared = AppleSignInService()

    @Published private(set) var linkedAccount: AppleAccountLink?

    private let keychainService = "pl.nostalgie.eosmusic.apple"
    private let keychainAccount = "linked-account"

    private override init() {
        super.init()
        linkedAccount = loadLink()
    }

    var isLinked: Bool { linkedAccount != nil }

    func signIn() async throws -> AppleSignInResult {
        try await withCheckedThrowingContinuation { continuation in
            let provider = ASAuthorizationAppleIDProvider()
            let request = provider.createRequest()
            request.requestedScopes = [.fullName, .email]

            let controller = ASAuthorizationController(authorizationRequests: [request])
            let delegate = AppleAuthDelegate { result in
                continuation.resume(with: result)
            }
            controller.delegate = delegate
            controller.presentationContextProvider = self
            objc_setAssociatedObject(controller, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN)
            controller.performRequests()
        }
    }

    func storeLink(_ link: AppleAccountLink) throws {
        linkedAccount = link
        let data = try JSONEncoder().encode(link)
        try KeychainHelper.save(data, service: keychainService, account: keychainAccount)
    }

    func clearLink() {
        linkedAccount = nil
        KeychainHelper.delete(service: keychainService, account: keychainAccount)
    }

    func refreshCredentialState() async {
        guard let userId = linkedAccount?.userId else { return }
        let provider = ASAuthorizationAppleIDProvider()
        let state = await withCheckedContinuation { (continuation: CheckedContinuation<ASAuthorizationAppleIDProvider.CredentialState, Never>) in
            provider.getCredentialState(forUserID: userId) { state, _ in
                continuation.resume(returning: state)
            }
        }
        if state == .revoked || state == .notFound {
            clearLink()
        }
    }

    private func loadLink() -> AppleAccountLink? {
        guard let data = KeychainHelper.load(service: keychainService, account: keychainAccount) else { return nil }
        return try? JSONDecoder().decode(AppleAccountLink.self, from: data)
    }
}

extension AppleSignInService: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            return scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }
}

private final class AppleAuthDelegate: NSObject, ASAuthorizationControllerDelegate {
    private let completion: (Result<AppleSignInResult, Error>) -> Void

    init(completion: @escaping (Result<AppleSignInResult, Error>) -> Void) {
        self.completion = completion
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            completion(.failure(AppleSignInError.noCredential))
            return
        }
        let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        let name = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        completion(.success(AppleSignInResult(
            identityToken: token,
            authorizationCode: code,
            userId: credential.user,
            email: credential.email,
            fullName: name.isEmpty ? nil : name
        )))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            completion(.failure(AppleSignInError.cancelled))
        } else {
            completion(.failure(error))
        }
    }
}

// MARK: - Sign in with Apple button (UIKit wrapper for full-width tap)

struct SignInWithAppleButtonView: UIViewRepresentable {
    let type: ASAuthorizationAppleIDButton.ButtonType
    let style: ASAuthorizationAppleIDButton.Style
    let onTap: () -> Void

    func makeUIView(context: Context) -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: type, style: style)
        button.cornerRadius = 12
        button.addTarget(context.coordinator, action: #selector(Coordinator.tapped), for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: ASAuthorizationAppleIDButton, context: Context) {
        context.coordinator.onTap = onTap
    }

    func makeCoordinator() -> Coordinator { Coordinator(onTap: onTap) }

    final class Coordinator: NSObject {
        var onTap: () -> Void
        init(onTap: @escaping () -> Void) { self.onTap = onTap }
        @objc func tapped() { onTap() }
    }
}
