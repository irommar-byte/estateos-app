import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var app: AppModel
    @State private var login = ""
    @State private var password = ""
    @State private var remember = true
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showAppleLinkPrompt = false
    @State private var pendingApple: AppleSignInResult?

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 8) {
                    Text("EOS™")
                        .font(.system(size: 44, weight: .black, design: .rounded))
                        .foregroundStyle(EOSTheme.gradient)
                    Text("Music")
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .foregroundStyle(EOSTheme.textPrimary)
                    Text("Odtwarzaj muzykę z Twojej biblioteki Nostalgie™")
                        .font(.subheadline)
                        .foregroundStyle(EOSTheme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding(.top, 48)

                VStack(spacing: 14) {
                    SignInWithAppleButtonView(type: .signIn, style: .white) {
                        Task { await signInWithApple() }
                    }
                    .frame(height: 50)
                    .disabled(isLoading)

                    HStack {
                        Rectangle().fill(EOSTheme.cardBorder).frame(height: 1)
                        Text("lub login Nostalgie™")
                            .font(.caption)
                            .foregroundStyle(EOSTheme.textMuted)
                        Rectangle().fill(EOSTheme.cardBorder).frame(height: 1)
                    }

                    TextField("Login", text: $login)
                        .textContentType(.username)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .padding()
                        .eosCard()

                    SecureField("Hasło", text: $password)
                        .textContentType(.password)
                        .padding()
                        .eosCard()

                    Toggle("Zapamiętaj mnie", isOn: $remember)
                        .foregroundStyle(EOSTheme.textSecondary)
                        .tint(EOSTheme.accent)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(EOSTheme.accent)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        Group {
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Zaloguj się")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    .buttonStyle(.plain)
                    .background(EOSTheme.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .disabled(isLoading || login.isEmpty || password.isEmpty)
                }
                .padding(.horizontal, 24)

                VStack(spacing: 8) {
                    Text("Przy pierwszym logowaniu przez Apple ID podaj też login Nostalgie™ Legacy, aby powiązać konta.")
                        .font(.caption)
                        .foregroundStyle(EOSTheme.textMuted)
                        .multilineTextAlignment(.center)
                    Link("Polityka prywatności", destination: AppConfig.privacyPolicyURL)
                        .font(.caption)
                        .foregroundStyle(EOSTheme.accentSecondary)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
        }
        .onAppear {
            if let saved = CredentialsStore.load() {
                login = saved.login
                password = saved.password
                remember = true
            }
            Task { await AppleSignInService.shared.refreshCredentialState() }
        }
        .alert("Powiąż konto Apple", isPresented: $showAppleLinkPrompt) {
            TextField("Login Nostalgie™", text: $login)
            SecureField("Hasło", text: $password)
            Button("Anuluj", role: .cancel) { pendingApple = nil }
            Button("Powiąż i zaloguj") { Task { await completeAppleLink() } }
        } message: {
            Text("To pierwsze logowanie przez Apple ID. Podaj dane konta gracza Nostalgie™, aby je powiązać.")
        }
    }

    private func submit() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await app.login(login: login.trimmingCharacters(in: .whitespaces), password: password, remember: remember)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func signInWithApple() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let apple = try await AppleSignInService.shared.signIn()
            do {
                try await app.loginWithApple(identityToken: apple.identityToken)
                try saveAppleLink(from: apple)
            } catch let error as APIError {
                switch error {
                case .server(let msg) where msg.localizedCaseInsensitiveContains("powiązane"):
                    pendingApple = apple
                    showAppleLinkPrompt = true
                default:
                    pendingApple = apple
                    showAppleLinkPrompt = true
                }
            }
        } catch {
            if case AppleSignInError.cancelled = error { return }
            errorMessage = error.localizedDescription
        }
    }

    private func completeAppleLink() async {
        guard let apple = pendingApple else { return }
        isLoading = true
        errorMessage = nil
        defer {
            isLoading = false
            pendingApple = nil
        }
        do {
            try await app.loginWithApple(
                identityToken: apple.identityToken,
                login: login.trimmingCharacters(in: .whitespaces),
                password: password
            )
            try saveAppleLink(from: apple)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveAppleLink(from apple: AppleSignInResult) throws {
        try AppleSignInService.shared.storeLink(AppleAccountLink(
            userId: apple.userId,
            email: apple.email,
            fullName: apple.fullName,
            linkedAt: Date()
        ))
    }
}
