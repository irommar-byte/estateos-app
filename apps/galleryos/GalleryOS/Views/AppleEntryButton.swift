import AuthenticationServices
import CryptoKit
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
