import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var app: AppModel
    @FocusState private var focusedField: Field?

    enum Field: Hashable { case login, password, remember, submit }

    @State private var login = ""
    @State private var password = ""
    @State private var rememberMe = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        HStack(alignment: .center, spacing: 96) {
            brandPanel
            loginPanel
        }
        .padding(.horizontal, 88)
        .padding(.vertical, 72)
        .onAppear {
            if let saved = CredentialsStore.load() {
                login = saved.login
                password = saved.password
                rememberMe = true
            }
            focusedField = login.isEmpty ? .login : .submit
        }
    }

    private var brandPanel: some View {
        VStack(alignment: .leading, spacing: 24) {
            Image(systemName: "play.tv.fill")
                .font(.system(size: 52, weight: .light))
                .foregroundStyle(NostalgieTheme.accentSecondary.opacity(0.9))

            VStack(alignment: .leading, spacing: 8) {
                Text("NOSTALGIE™")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                    .tracking(1.4)
                Text("MOVIES")
                    .font(.system(size: 64, weight: .bold))
                    .tracking(-1)
            }

            Text("Filmy i seriale z TVP, CDA-HD\ni YouTube — na dużym ekranie.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .lineSpacing(4)

            HStack(spacing: 10) {
                SourceBadgeView(source: "tvp")
                SourceBadgeView(source: "cda-hd")
                SourceBadgeView(source: "youtube")
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: 540, alignment: .leading)
    }

    private var loginPanel: some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Zaloguj się")
                    .font(.title.weight(.bold))
                Text("Kontem Nostalgie Legacy")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 18) {
                fieldBlock(title: "Login gry") {
                    styledField(isFocused: focusedField == .login) {
                        TextField("Wpisz login", text: $login)
                            .textContentType(.none)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }
                    .focused($focusedField, equals: .login)
                }

                fieldBlock(title: "Hasło") {
                    styledField(isFocused: focusedField == .password) {
                        SecureField("Wpisz hasło", text: $password)
                            .textContentType(.none)
                    }
                    .focused($focusedField, equals: .password)
                }
            }

            Button {
                rememberMe.toggle()
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: rememberMe ? "checkmark.square.fill" : "square")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(rememberMe ? NostalgieTheme.accentSecondary : .secondary)
                    Text("Zapamiętaj login i hasło na tym Apple TV")
                        .font(.body)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 6)
                .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            .focused($focusedField, equals: .remember)

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                    .foregroundStyle(NostalgieTheme.accent)
                    .font(.callout)
            }

            Button(action: submit) {
                HStack(spacing: 12) {
                    if isLoading {
                        ProgressView()
                    }
                    Text(isLoading ? "Logowanie…" : "Wejdź")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(isLoading || login.isEmpty || password.isEmpty)
            .focused($focusedField, equals: .submit)
        }
        .padding(40)
        .frame(width: 520)
        .glassPanel(cornerRadius: 24)
    }

    private func fieldBlock<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.8)
            content()
        }
    }

    private func styledField<F: View>(isFocused: Bool, @ViewBuilder content: () -> F) -> some View {
        content()
            .textFieldStyle(.plain)
            .font(.title3)
            .padding(.horizontal, 22)
            .padding(.vertical, 18)
            .background(isFocused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                    .stroke(isFocused ? Color.white.opacity(0.9) : Color.white.opacity(0.08), lineWidth: isFocused ? 3 : 1)
            }
            .animation(NostalgieTheme.focusAnimation, value: isFocused)
    }

    private func submit() {
        Task {
            isLoading = true
            errorMessage = nil
            defer { isLoading = false }
            do {
                try await app.login(login: login, password: password)
                if rememberMe {
                    try? CredentialsStore.save(login: login, password: password)
                } else {
                    CredentialsStore.clear()
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
