import SwiftUI
import UIKit
import CoreImage.CIFilterBuiltins

struct LoginView: View {
    @EnvironmentObject private var app: AppModel
    @State private var login = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var localError: String?
    @State private var mode: LoginMode = .passkey
    @FocusState private var focusedField: Field?

    enum LoginMode: String, CaseIterable {
        case passkey = "iPhone · Face ID"
        case qr = "iPhone · hasło"
        case password = "E-mail i hasło"

        var icon: String {
            switch self {
            case .passkey: return "faceid"
            case .qr: return "qrcode"
            case .password: return "keyboard"
            }
        }
    }

    enum Field: Hashable {
        case login, password, submit, cancel
    }

    private var backdropURL: URL? {
        app.offers.first.flatMap { EOSOfferMedia.primaryImageURL(for: $0) }
    }

    var body: some View {
        ZStack {
            EOSBackdrop(url: backdropURL, soft: true)
            LinearGradient(colors: [.black.opacity(0.88), .black.opacity(0.6)], startPoint: .leading, endPoint: .trailing)
                .ignoresSafeArea()

            HStack(alignment: .center, spacing: 90) {
                intro
                    .frame(width: 760, alignment: .leading)
                    .focusSection()
                Group {
                    switch mode {
                    case .passkey:
                        qrCard(
                            payload: passkeyQrPayload,
                            code: app.passkeyPairingCode,
                            caption: "Zeskanuj iPhone’em i potwierdź Face ID — telewizor zaloguje się sam."
                        ) { Task { await app.refreshTvPairCode(mode: "passkey") } }
                    case .qr:
                        qrCard(
                            payload: loginQrPayload,
                            code: app.loginPairingCode,
                            caption: "Zeskanuj i zaloguj się na iPhonie hasłem — Apple TV połączy się z kontem."
                        ) { Task { await app.refreshTvPairCode(mode: "password") } }
                    case .password:
                        passwordPane
                    }
                }
                .transition(.opacity.combined(with: .scale(scale: 0.97)))
                .focusSection()
            }
            .foregroundStyle(.white)
            .padding(80)
        }
        .animation(.easeInOut(duration: 0.3), value: mode)
        .onAppear {
            focusedField = mode == .password ? .login : nil
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 26) {
            EOSWordmark(size: 40)
            Text("Zaloguj się")
                .font(.system(size: 76, weight: .bold))
                .tracking(-1)
            VStack(alignment: .leading, spacing: 16) {
                benefit("heart.fill", .pink, "Ulubione z iPhone’a i estateos.pl")
                benefit("sparkles", EOSIntelligence.violet, "„Dla Ciebie” od EstateOS Intelligence")
                benefit("crown.fill", EOSGold.deep, "Status Pro i Twoje ogłoszenia")
            }

            VStack(alignment: .leading, spacing: 14) {
                Text("SPOSÓB LOGOWANIA")
                    .font(.system(size: 16, weight: .heavy))
                    .tracking(2.2)
                    .foregroundStyle(.white.opacity(0.55))
                HStack(spacing: 16) {
                    ForEach(LoginMode.allCases, id: \.self) { item in
                        Button {
                            mode = item
                            localError = nil
                            if item == .password { focusedField = .login }
                        } label: {
                            Label(item.rawValue, systemImage: item.icon)
                                .font(.system(size: 21, weight: .semibold))
                        }
                        .buttonStyle(LoginModeStyle(selected: mode == item))
                    }
                }
            }
            .padding(.top, 18)

            if let localError {
                Label(localError, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 21, weight: .medium))
                    .foregroundStyle(Color(red: 1, green: 0.45, blue: 0.4))
                    .accessibilityLabel("Błąd logowania: \(localError)")
            } else if let status = app.pairingStatusMessage, mode != .password {
                HStack(spacing: 12) {
                    ProgressView().scaleEffect(0.7)
                    Text(status)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65))
                }
            }

            Button("Nie teraz") { app.closeLoginSheet() }
                .eosButton()
                .focused($focusedField, equals: .cancel)
        }
    }

    private func benefit(_ icon: String, _ tint: Color, _ text: String) -> some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 34)
            Text(text).font(.system(size: 25, weight: .medium))
        }
    }

    private func qrCard(payload: String, code: String, caption: String, onRefresh: @escaping () -> Void) -> some View {
        VStack(spacing: 22) {
            ZStack {
                if code.isEmpty {
                    ProgressView().tint(.black)
                } else {
                    QRCodeImage(text: payload)
                }
            }
            .frame(width: 420, height: 420)
            .padding(34)
            .background(RoundedRectangle(cornerRadius: 42, style: .continuous).fill(.white))
            .shadow(color: .black.opacity(0.5), radius: 50, y: 24)
            .id(payload)
            .transition(.opacity)
            .accessibilityLabel("Kod QR do logowania")

            Text(caption)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .frame(width: 480)

            HStack(spacing: 18) {
                Text(code.isEmpty ? "••••••" : code)
                    .font(.system(size: 34, weight: .bold).monospaced())
                    .tracking(4)
                    .accessibilityLabel(code.isEmpty ? "Ładowanie kodu parowania" : "Kod parowania \(code)")
                Button { onRefresh() } label: {
                    Image(systemName: "arrow.clockwise")
                        .accessibilityLabel("Nowy kod")
                }
                .eosButton()
            }
        }
    }

    private var passwordPane: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Konto EstateOS")
                .font(.system(size: 34, weight: .bold))

            field {
                TextField("E-mail", text: $login)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .login)
                    .accessibilityLabel("Adres e-mail")
            }
            field {
                SecureField("Hasło", text: $password)
                    .focused($focusedField, equals: .password)
                    .accessibilityLabel("Hasło")
            }

            Button {
                Task { await submitPasswordLogin() }
            } label: {
                HStack {
                    Spacer()
                    if isLoading { ProgressView() } else { Text("Zaloguj").font(.system(size: 26, weight: .semibold)) }
                    Spacer()
                }
                .frame(height: 50)
            }
            .eosButton()
            .focused($focusedField, equals: .submit)
            .padding(.top, 8)
        }
        .padding(40)
        .frame(width: 660)
        .eosGlassPanel(cornerRadius: 40)
    }

    private func field<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .textFieldStyle(.plain)
            .font(.system(size: 26, weight: .medium))
            .padding(.horizontal, 26)
            .frame(height: 80)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color.white.opacity(0.1)))
    }

    private func submitPasswordLogin() async {
        localError = nil
        let trimmedLogin = login.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedLogin.isEmpty, !password.isEmpty else {
            localError = "Podaj e-mail i hasło."
            return
        }
        isLoading = true
        defer { isLoading = false }
        await app.login(login: trimmedLogin, password: password)
        if let error = app.globalError {
            localError = error
            app.globalError = nil
        } else if app.session == nil {
            localError = "Nie udało się zalogować. Sprawdź dane i spróbuj ponownie."
        }
    }

    private var loginQrPayload: String {
        "https://estateos.pl/login?source=tvos&pair=\(app.loginPairingCode)&authIntent=login"
    }

    private var passkeyQrPayload: String {
        "https://estateos.pl/passkey-login?source=tvos&pair=\(app.passkeyPairingCode)&mode=passkey"
    }
}

/// Login method chip: glass at rest, softly filled when chosen, white when focused.
private struct LoginModeStyle: ButtonStyle {
    var selected: Bool
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 22)
            .padding(.vertical, 14)
            .foregroundStyle(isFocused ? Color.black : .white)
            .background(Capsule().fill(isFocused ? Color.white : Color.white.opacity(selected ? 0.22 : 0.08)))
            .overlay(Capsule().strokeBorder(Color.white.opacity(selected && !isFocused ? 0.55 : 0.12), lineWidth: 1.5))
            .scaleEffect(configuration.isPressed ? 0.97 : (isFocused ? 1.06 : 1))
            .shadow(color: .black.opacity(isFocused ? 0.4 : 0), radius: 18, y: 10)
            .animation(EOSMotion.focus, value: isFocused)
    }
}
