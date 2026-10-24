import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var app: AppModel
    @State private var login = ""
    @State private var password = ""
    @State private var remember = true
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showAppleLinkSheet = false
    @State private var pendingApple: AppleSignInResult?
    @FocusState private var linkField: LinkField?

    private enum LinkField { case login, password }

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
                    Text("Przy pierwszym logowaniu przez Apple ID zapisany login Nostalgie™ uzupełni się sam.")
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
        .sheet(isPresented: $showAppleLinkSheet, onDismiss: {
            if pendingApple != nil, app.user == nil {
                linkField = nil
            }
        }) {
            appleLinkSheet
        }
    }

    private var appleLinkSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("To pierwsze logowanie przez Apple ID. Login i hasło Nostalgie™ bierzemy z zapisanego hasła tej aplikacji.")
                    .font(.subheadline)
                    .foregroundStyle(EOSTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                TextField("Login", text: $login)
                    .textContentType(.username)
                    .keyboardType(.asciiCapable)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($linkField, equals: .login)
                    .padding()
                    .eosCard()
                    .submitLabel(.next)
                    .onSubmit { linkField = .password }

                SecureField("Hasło", text: $password)
                    .textContentType(.password)
                    .focused($linkField, equals: .password)
                    .padding()
                    .eosCard()
                    .submitLabel(.go)
                    .onSubmit { Task { await completeAppleLink() } }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(EOSTheme.accent)
                }

                Button {
                    Task { await completeAppleLink() }
                } label: {
                    Group {
                        if isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Powiąż i zaloguj")
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

                Spacer(minLength: 0)
            }
            .padding(24)
            .navigationTitle("Powiąż konto Apple")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") {
                        pendingApple = nil
                        showAppleLinkSheet = false
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            if login.isEmpty {
                linkField = .login
            }
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
            } catch let error as APIError where isAppleNotLinked(error) {
                pendingApple = apple
                await linkAppleWithSavedCredentials()
            }
        } catch {
            if case AppleSignInError.cancelled = error { return }
            errorMessage = error.localizedDescription
        }
    }

    private func isAppleNotLinked(_ error: APIError) -> Bool {
        guard case .server(let message) = error else { return false }
        let text = message.lowercased()
        return text.contains("powiązan") || text.contains("pierwszym użyciu")
    }

    /// Najpierw nasz keychain, potem hasło zapisane przez iOS dla tej aplikacji — bez pustego formularza.
    private func linkAppleWithSavedCredentials() async {
        if let saved = CredentialsStore.load(), !saved.login.isEmpty, !saved.password.isEmpty {
            login = saved.login
            password = saved.password
            await completeAppleLink(showFormOnFailure: true)
            return
        }

        try? await Task.sleep(nanoseconds: 400_000_000)
        do {
            let saved = try await AppleSignInService.shared.requestSavedPassword()
            login = saved.login
            password = saved.password
            await completeAppleLink(showFormOnFailure: true)
        } catch is CancellationError {
            showAppleLinkSheet = true
        } catch AppleSignInError.cancelled {
            showAppleLinkSheet = true
        } catch {
            showAppleLinkSheet = true
        }
    }

    private func completeAppleLink(showFormOnFailure: Bool = false) async {
        guard let apple = pendingApple else { return }
        let ownsSpinner = !isLoading
        if ownsSpinner { isLoading = true }
        errorMessage = nil
        defer { if ownsSpinner { isLoading = false } }
        do {
            let trimmedLogin = login.trimmingCharacters(in: .whitespaces)
            try await app.loginWithApple(
                identityToken: apple.identityToken,
                login: trimmedLogin,
                password: password
            )
            try saveAppleLink(from: apple)
            if remember, !trimmedLogin.isEmpty, !password.isEmpty {
                try? CredentialsStore.save(login: trimmedLogin, password: password)
            }
            pendingApple = nil
            showAppleLinkSheet = false
        } catch {
            errorMessage = error.localizedDescription
            if showFormOnFailure {
                showAppleLinkSheet = true
            }
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
