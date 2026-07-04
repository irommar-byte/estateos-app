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
    @State private var appeared = false

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            Spacer(minLength: 0)

            HStack(alignment: .center, spacing: 88) {
                brandPanel
                    .frame(width: 460, alignment: .leading)
                loginPanel
                    .frame(width: 480)
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 14)
        .onAppear {
            withAnimation(NostalgieTheme.contentSpring.delay(0.05)) {
                appeared = true
            }
            if let saved = CredentialsStore.load() {
                login = saved.login
                password = saved.password
                rememberMe = true
            }
            focusedField = login.isEmpty ? .login : .submit
        }
    }

    private var brandPanel: some View {
        VStack(alignment: .leading, spacing: 22) {
            appIconTile

            VStack(alignment: .leading, spacing: 4) {
                Text(AppConfig.brandMark)
                    .font(NostalgieFont.caption)
                    .foregroundStyle(NostalgieTheme.accentSecondary)
                    .tracking(2.2)
                Text(AppConfig.brandProduct)
                    .font(NostalgieFont.hero)
                    .tracking(-0.5)
            }

            Text("Filmy, seriale i muzyka\nw jednym miejscu — na dużym ekranie.")
                .font(NostalgieFont.body)
                .foregroundStyle(.secondary)
                .lineSpacing(3)

            HStack(spacing: 8) {
                SourceBadgeView(source: "tvp")
                SourceBadgeView(source: "cda-hd")
                SourceBadgeView(source: "youtube")
                SourceBadgeView(source: "apple-music")
            }
            .padding(.top, 4)
        }
    }

    private var appIconTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [NostalgieTheme.accent, NostalgieTheme.accentSecondary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 88, height: 88)
                .shadow(color: NostalgieTheme.accent.opacity(0.35), radius: 22, y: 10)
            Image(systemName: "play.tv.fill")
                .font(NostalgieFont.rounded(40, weight: .medium))
                .foregroundStyle(.white)
        }
    }

    private var loginPanel: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Zaloguj się")
                    .font(NostalgieFont.sectionTitle)
                Text("Kontem EstateOS")
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 14) {
                fieldBlock(title: "Login") {
                    NostalgieTextField(
                        placeholder: "Wpisz login",
                        text: $login,
                        isFocused: focusedField == .login
                    )
                    .focused($focusedField, equals: .login)
                }

                fieldBlock(title: "Hasło") {
                    NostalgieTextField(
                        placeholder: "Wpisz hasło",
                        text: $password,
                        isSecure: true,
                        isFocused: focusedField == .password
                    )
                    .focused($focusedField, equals: .password)
                }
            }

            rememberRow

            if let errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                    .foregroundStyle(NostalgieTheme.accent)
                    .font(NostalgieFont.caption)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            Button(action: submit) {
                HStack(spacing: 10) {
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
        .padding(30)
        .glassPanel(.sheet)
        .animation(NostalgieTheme.contentSpring, value: errorMessage)
    }

    private var rememberRow: some View {
        Button {
            rememberMe.toggle()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: rememberMe ? "checkmark.circle.fill" : "circle")
                    .font(NostalgieFont.rounded(.headline, weight: .semibold))
                    .foregroundStyle(rememberMe ? NostalgieTheme.accentSecondary : .secondary)
                Text("Zapamiętaj na tym Apple TV")
                    .font(NostalgieFont.metadata)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .fill(focusedField == .remember ? NostalgieTheme.cardFocused : Color.clear)
            }
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .stroke(focusedField == .remember ? Color.white.opacity(0.85) : Color.clear, lineWidth: 2)
            }
            .animation(NostalgieTheme.focusSpring, value: focusedField == .remember)
        }
        .buttonStyle(.plain)
        .focused($focusedField, equals: .remember)
    }

    private func fieldBlock<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(NostalgieFont.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .tracking(0.6)
            content()
        }
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
