import SwiftUI
import CoreImage.CIFilterBuiltins

struct LoginView: View {
    @EnvironmentObject private var app: AppModel
    @State private var login = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var localError: String?
    @State private var mode: LoginMode = .passkey
    @FocusState private var focusedField: Field?

    private let ciContext = CIContext()
    private let qrFilter = CIFilter.qrCodeGenerator()

    enum LoginMode: String, CaseIterable {
        case passkey = "Passkey (iPhone)"
        case password = "Hasło"
    }

    enum Field: Hashable {
        case login, password, submit, cancel
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 28) {
                header
                modePicker

                switch mode {
                case .passkey:
                    passkeyPane
                case .password:
                    passwordPane
                }

                if let localError {
                    Text(localError)
                        .font(.callout)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let status = app.pairingStatusMessage {
                    Text(status)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, 72)
            .padding(.vertical, 48)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [Color.black, Color.black.opacity(0.92), Color(red: 0.05, green: 0.08, blue: 0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        )
        .focusSection()
        .onAppear {
            focusedField = mode == .password ? .login : nil
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Text("Logowanie EstateOS")
                .font(.system(size: 52, weight: .bold, design: .rounded))
            Text("Passkey przez iPhone albo login i hasło z bazy EstateOS")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var modePicker: some View {
        HStack(spacing: 14) {
            ForEach(LoginMode.allCases, id: \.self) { item in
                Button(item.rawValue) {
                    mode = item
                    localError = nil
                    if item == .password {
                        focusedField = .login
                    }
                }
                .buttonStyle(EOSChipButtonStyle(selected: mode == item, accent: .white))
                .focusEffectDisabled()
            }
        }
        .padding(8)
        .eosGlass(cornerRadius: 20, opacity: 0.28)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var passkeyPane: some View {
        HStack(alignment: .top, spacing: 24) {
            qrCard(
                title: "Passkey / Face ID",
                subtitle: "Zeskanuj iPhonem — logowanie biometryczne sparuje TV automatycznie",
                pairingCode: app.passkeyPairingCode,
                payload: passkeyQrPayload
            ) {
                Task { await app.refreshTvPairCode(mode: "passkey") }
            }

            qrCard(
                title: "QR logowania hasłem",
                subtitle: "Otwiera logowanie na iPhonie z kodem parowania",
                pairingCode: app.loginPairingCode,
                payload: loginQrPayload
            ) {
                Task { await app.refreshTvPairCode(mode: "password") }
            }
        }
        .focusSection()
    }

    private var passwordPane: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Konto EstateOS")
                .font(.title2.bold())

            TextField("E-mail", text: $login)
                .textFieldStyle(.plain)
                .font(.title3)
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.12)))
                .focused($focusedField, equals: .login)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

            SecureField("Hasło", text: $password)
                .textFieldStyle(.plain)
                .font(.title3)
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 14).fill(Color.white.opacity(0.12)))
                .focused($focusedField, equals: .password)

            HStack(spacing: 16) {
                Button {
                    Task { await submitPasswordLogin() }
                } label: {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Zaloguj")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: .green))
                .focusEffectDisabled()
                .focused($focusedField, equals: .submit)

                Button("Anuluj") {
                    app.closeLoginSheet()
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused($focusedField, equals: .cancel)
            }
        }
        .padding(28)
        .eosGlass(cornerRadius: 28, opacity: 0.4)
        .frame(maxWidth: 760, alignment: .leading)
        .focusSection()
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
            localError = "Nie udało się zalogować."
        }
    }

    private func qrCard(
        title: String,
        subtitle: String,
        pairingCode: String,
        payload: String,
        onRefresh: @escaping () -> Void
    ) -> some View {
        VStack(spacing: 14) {
            if let image = qrImage(from: payload) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 180, height: 180)
                    .padding(12)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Text(title)
                .font(.headline)

            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Text(pairingCode.isEmpty ? "Ładowanie kodu…" : pairingCode)
                .font(.title2.weight(.bold))
                .monospaced()

            Button("Odśwież kod") { onRefresh() }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
        }
        .frame(width: 420)
        .padding(20)
        .eosGlass(cornerRadius: 24, opacity: 0.38)
    }

    private var loginQrPayload: String {
        "https://estateos.pl/login?source=tvos&pair=\(app.loginPairingCode)&authIntent=login"
    }

    private var passkeyQrPayload: String {
        "https://estateos.pl/passkey-login?source=tvos&pair=\(app.passkeyPairingCode)&mode=passkey"
    }

    private func qrImage(from payload: String) -> UIImage? {
        qrFilter.setValue(Data(payload.utf8), forKey: "inputMessage")
        guard let output = qrFilter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
        guard let cg = ciContext.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
