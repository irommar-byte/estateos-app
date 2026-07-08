import SwiftUI
import CoreImage.CIFilterBuiltins

struct LoginView: View {
    @EnvironmentObject private var app: AppModel
    @State private var login = ""
    @State private var password = ""
    @State private var isLoading = false
    @FocusState private var focusedField: Field?
    private let ciContext = CIContext()
    private let qrFilter = CIFilter.qrCodeGenerator()

    enum Field: Hashable {
        case login, password, submit
    }

    var body: some View {
        VStack(spacing: 28) {
            VStack(spacing: 8) {
                Text("EstateOS")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                Text("Zaloguj się, aby przeglądać oferty na Apple TV")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            HStack(alignment: .top, spacing: 22) {
                passwordPane
                VStack(spacing: 14) {
                    qrCard(
                        title: "QR logowania",
                        subtitle: "Szybkie otwarcie logowania na iPhonie",
                        pairingCode: app.loginPairingCode,
                        payload: loginQrPayload
                    ) {
                        Task { await app.refreshTvPairCode(mode: "password") }
                    }
                    qrCard(
                        title: "QR Passkey",
                        subtitle: "Skanuj i zaloguj Face ID/Touch ID",
                        pairingCode: app.passkeyPairingCode,
                        payload: passkeyQrPayload
                    ) {
                        Task { await app.refreshTvPairCode(mode: "passkey") }
                    }
                }
            }
            .frame(width: 1100)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            focusedField = .login
        }
    }

    private var passwordPane: some View {
        VStack(spacing: 14) {
            TextField("Login", text: $login)
                .textFieldStyle(.plain)
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.12)))
                .focused($focusedField, equals: .login)

            SecureField("Password", text: $password)
                .textFieldStyle(.plain)
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.12)))
                .focused($focusedField, equals: .password)

            Button {
                Task {
                    isLoading = true
                    await app.login(login: login, password: password)
                    isLoading = false
                    if app.session != nil {
                        app.closeLoginSheet()
                    }
                }
            } label: {
                if isLoading {
                    ProgressView()
                } else {
                    Text("Kontynuuj")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(login.isEmpty || password.isEmpty || isLoading)
            .focused($focusedField, equals: .submit)

            Button("Anuluj") {
                app.closeLoginSheet()
            }
            .buttonStyle(.bordered)
        }
        .frame(width: 620)
        .padding(22)
        .background(glassPanel)
    }

    private var glassPanel: some View {
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(.ultraThinMaterial.opacity(0.35))
            .overlay(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )
    }

    private func qrCard(
        title: String,
        subtitle: String,
        pairingCode: String,
        payload: String,
        onRefresh: @escaping () -> Void
    ) -> some View {
        VStack(spacing: 16) {
            if let image = qrImage(from: payload) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 155, height: 155)
                    .padding(10)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Text(title)
                .font(.headline)

            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Text(pairingCode)
                .font(.title3.weight(.bold))

            Button("Odśwież kod") {
                onRefresh()
            }
            .buttonStyle(.bordered)
        }
        .frame(width: 420)
        .padding(16)
        .background(glassPanel)
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
