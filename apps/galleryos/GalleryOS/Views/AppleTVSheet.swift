import SwiftUI

/// Receives the pairing code from a QR scan (galleryos://pair?code=ABC123).
@MainActor
final class AppleTVInbox: ObservableObject {
    static let shared = AppleTVInbox()
    @Published var code: String?
    @Published var presenting = false

    func receive(_ url: URL) {
        guard url.scheme?.lowercased() == Brand.urlScheme, url.host?.lowercased() == "pair" else { return }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        code = items.first { $0.name == "code" }?.value
        presenting = true
    }
}

enum AppleTVSharing {
    /// The server the iPhone uses right now, in a shape Apple TV can read.
    static func current() -> (server: AppleTVServer, password: String)? {
        let settings = DestinationSettings.load()
        guard settings.kind != DestinationKind.none, !settings.host.isEmpty else { return nil }
        let password = GalleryKeychain.string(account: "destination-password") ?? ""
        let remote = settings.remoteHost.isEmpty ? settings.host : settings.remoteHost
        let id = "\(settings.username.lowercased())@\(remote)".lowercased()
        let title: String = {
            if !settings.localName.isEmpty { return settings.localName }
            return remote
        }()
        return (AppleTVServer(settings: settings, id: id, title: title), password)
    }

    static func refreshIfEnabled() {
        guard CloudServerShare.isEnabled else { return }
        guard let current = current() else {
            return note(L("Najpierw połącz \(ThisDevice.genitive) z serwerem"))
        }
        guard current.server.isSupportedOnTV else {
            return note(L("Apple TV czyta z serwera GalleryOS albo QNAP-a"))
        }
        guard !current.password.isEmpty else {
            return note(L("Brak hasła serwera – połącz serwer jeszcze raz"))
        }
        CloudServerShare.publish(current.server, password: current.password)
    }

    private static func note(_ text: String) {
        UserDefaults.standard.set(text, forKey: CloudServerShare.noteKey)
    }
}

struct AppleTVShareToggle: View {
    @AppStorage(CloudServerShare.enabledKey) private var cloud = true
    @AppStorage(CloudServerShare.noteKey) private var note = ""

    var body: some View {
        Toggle(isOn: $cloud) {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(L("Apple TV"))
                    Text(cloud ? (note.isEmpty ? L("To samo Apple ID") : note) : L("Wyłączone"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: "appletv")
                    .foregroundStyle(GalleryTheme.accent)
            }
        }
        .tint(GalleryTheme.accent)
        .onChange(of: cloud) { _, enabled in
            if enabled {
                AppleTVSharing.refreshIfEnabled()
            } else {
                CloudServerShare.withdraw()
            }
        }
    }
}

struct AppleTVForm: View {
    private enum Phase: Equatable {
        case idle
        case working
        case done
        case failed(String)
    }

    @ObservedObject private var inbox = AppleTVInbox.shared
    @AppStorage(CloudServerShare.enabledKey) private var cloud = true
    @State private var code = ""
    @State private var phase: Phase = .idle

    private var current: (server: AppleTVServer, password: String)? { AppleTVSharing.current() }

    var body: some View {
        Form {
            Section {
                AppleTVShareToggle()
            } footer: {
                Text(L("Apple TV z tym samym Apple ID pokaże bibliotekę sam. Hasło serwera jest zaszyfrowane i trafia tylko do Twojego iCloud."))
            }

            Section {
                if let current, current.server.isSupportedOnTV {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(current.server.title).font(.headline)
                            Text(current.server.username).font(.footnote).foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "externaldrive.connected.to.line.below")
                            .foregroundStyle(GalleryTheme.accent)
                    }
                } else if current != nil {
                    Text(L("Apple TV czyta zdjęcia z serwera GalleryOS albo z QNAP-a (WebDAV). Wybierz jedno z tych miejsc w ustawieniach biblioteki."))
                        .foregroundStyle(.secondary)
                } else {
                    Text(L("Najpierw połącz \(ThisDevice.genitive) z serwerem, a potem sparuj Apple TV."))
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text(L("Serwer dla Apple TV"))
            }

            Section {
                TextField(L("Kod z ekranu telewizora"), text: $code)
                    .font(.system(.title3, design: .monospaced))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .onSubmit { Task { await pair() } }
                Button {
                    Task { await pair() }
                } label: {
                    HStack {
                        Text(L("Połącz Apple TV"))
                        Spacer()
                        if phase == .working { ProgressView() }
                    }
                }
                .disabled(!canPair)
                switch phase {
                case .done:
                    Label(L("Gotowe. Apple TV pokaże bibliotekę za chwilę."), systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                case .failed(let message):
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                default:
                    EmptyView()
                }
            } header: {
                Text(L("Parowanie kodem"))
            } footer: {
                Text(L("Otwórz GalleryOS na Apple TV. Ekran pokaże kod. Możesz też zeskanować kod QR aparatem \(ThisDevice.genitive)."))
            }

        }
        .navigationTitle(L("Apple TV"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { takeInbox() }
        .onChange(of: inbox.code) { _, _ in takeInbox() }
        .onChange(of: cloud) { _, enabled in
            if enabled {
                AppleTVSharing.refreshIfEnabled()
            } else {
                CloudServerShare.withdraw()
            }
        }
    }

    private var canPair: Bool {
        guard let current, current.server.isSupportedOnTV, !current.password.isEmpty else { return false }
        return PairingCrypto.normalize(code: code).count >= 4 && phase != .working
    }

    private func takeInbox() {
        guard let incoming = inbox.code, !incoming.isEmpty else { return }
        code = incoming
        inbox.code = nil
        phase = .idle
    }

    private func pair() async {
        guard canPair, let current else { return }
        phase = .working
        do {
            let key = try await ShareAccount.shared.pairLookup(code: code)
            let payload = PairingPayload(server: current.server, password: current.password)
            let sealed = try PairingCrypto.seal(payload, devicePublicKey: key, code: code)
            try await ShareAccount.shared.pairClaim(code: code, sealed: sealed)
            phase = .done
            code = ""
        } catch {
            phase = .failed(AccountFailure.message(for: error))
        }
    }
}

struct AppleTVPairingSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            AppleTVForm()
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(L("Zamknij")) { dismiss() }
                    }
                }
        }
    }
}
