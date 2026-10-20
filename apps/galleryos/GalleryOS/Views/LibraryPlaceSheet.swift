import SwiftUI
import UniformTypeIdentifiers

struct LibraryPlaceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: PhotoLibrary
    @StateObject private var nearby = NearbyPlaces()
    @ObservedObject private var savedServers = SavedServerStore.shared
    @ObservedObject private var link = ServerLink.shared
    @AppStorage("galleryos.place") private var place = LibraryPlace.thisPhone.rawValue
    @State private var localHost = ""
    @State private var localPort = 0
    @State private var localName = ""
    @State private var remoteHost = ""
    @State private var host = ""
    @State private var port = ""
    @State private var username = ""
    @State private var password = ""
    @State private var directory = ""
    @State private var otherKind = DestinationKind.webdav
    @State private var folderName = ""
    @State private var picking = false
    @State private var advanced = false
    @State private var message = ""
    @State private var steps: [SetupStep] = []
    @State private var stage = SetupStage.editing
    @State private var scanning = true
    @State private var attempt: Task<Void, Never>?
    @State private var restore: (settings: DestinationSettings, password: String?)?

    var body: some View {
        NavigationStack {
            Form {
                if !savedServers.servers.isEmpty {
                    savedSection
                }
                Section {
                    Picker("Miejsce biblioteki", selection: safePlace) {
                        ForEach(LibraryPlace.allCases) { item in
                            Label(item.title, systemImage: item.symbol).tag(item.rawValue)
                        }
                    }
                    .pickerStyle(.menu)
                } header: {
                    Text("Gdzie trzymać bibliotekę")
                } footer: {
                    Text(footer)
                }
                if webDAVForm {
                    homeSection
                    remoteSection
                    accountSection
                } else if place != LibraryPlace.thisPhone.rawValue && place != LibraryPlace.disk.rawValue {
                    connection
                }
                if place == LibraryPlace.disk.rawValue {
                    disk
                }
                if !message.isEmpty, stage == .editing {
                    Section {
                        Label(message, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                            .font(.subheadline)
                    }
                }
            }
            .disabled(stage != .editing)
            .animation(GalleryTheme.snappy, value: place)
            .animation(GalleryTheme.snappy, value: localHost)
            .navigationTitle("Serwer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { cancel() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(place == LibraryPlace.thisPhone.rawValue ? "Gotowe" : "Połącz") {
                        attempt?.cancel()
                        attempt = Task { await enable() }
                    }
                    .fontWeight(.semibold)
                    .disabled(stage == .connecting)
                }
            }
            .overlay {
                if stage != .editing {
                    ConnectingOverlay(steps: steps, stage: stage) {
                        withAnimation(GalleryTheme.snappy) { stage = .editing }
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.94)))
                }
            }
            .fileImporter(isPresented: $picking, allowedContentTypes: [.folder]) { result in
                switch result {
                case .success(let url):
                    guard url.startAccessingSecurityScopedResource() else {
                        message = "Dysk odpięty"
                        return
                    }
                    defer { url.stopAccessingSecurityScopedResource() }
                    do {
                        let data = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
                        if let problem = SpareDisks.shared.add(data: data, name: url.lastPathComponent) {
                            message = problem
                        } else {
                            folderName = url.lastPathComponent
                            message = ""
                        }
                    } catch {
                        message = "Nie udało się zapamiętać folderu."
                    }
                case .failure:
                    message = "Nie wybrano folderu."
                }
            }
        }
        .presentationDetents([.large])
        .interactiveDismissDisabled(stage == .connecting)
        .onDisappear {
            if stage != .done {
                attempt?.cancel()
                putBack()
            }
        }
        .onAppear(perform: load)
        .task {
            try? await Task.sleep(for: .milliseconds(300))
            nearby.start()
            try? await Task.sleep(for: .seconds(6))
            withAnimation(GalleryTheme.snappy) { scanning = false }
        }
        .onDisappear { nearby.stop() }
    }

    // MARK: Sections

    private var savedSection: some View {
        Section("Zapisane serwery") {
            ForEach(savedServers.servers) { server in
                Button {
                    UISelectionFeedbackGenerator().selectionChanged()
                    withAnimation(GalleryTheme.snappy) { apply(server) }
                } label: {
                    SavedServerRow(server: server, live: server.online ? link.route : nil)
                }
                .buttonStyle(.plain)
                .swipeActions {
                    Button("Usuń", systemImage: "trash", role: .destructive) {
                        withAnimation(GalleryTheme.snappy) { savedServers.remove(server) }
                    }
                }
            }
        }
    }

    private var homeSection: some View {
        Section {
            ForEach(candidates) { item in
                Button {
                    UISelectionFeedbackGenerator().selectionChanged()
                    withAnimation(GalleryTheme.snappy) { pick(item) }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: item.kind.contains("webdav") ? "externaldrive.connected.to.line.below" : "server.rack")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(LinkRoute.home.tint.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(item.name).foregroundStyle(.primary)
                            Text(item.host).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if localHost.caseInsensitiveCompare(item.host) == .orderedSame {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(LinkRoute.home.tint)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            TextField("Adres w sieci, np. 192.168.1.20", text: Binding(
                get: { localHost },
                set: {
                    localHost = $0
                    localName = ""
                    localPort = 0
                }
            ))
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(.URL)
        } header: {
            HStack(spacing: 8) {
                Text("Sieć domowa")
                if scanning {
                    ScanningDots()
                }
            }
        } footer: {
            Text("W domu GalleryOS łączy się bezpośrednio z serwerem: szybciej i bez internetu. Gdy wyjdziesz, sam przejdzie na DDNS.")
        }
    }

    private var remoteSection: some View {
        Section {
            TextField("np. nazwa.myqnapcloud.com", text: $remoteHost)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
        } header: {
            Text("Dostęp zdalny · DDNS")
        } footer: {
            Text("Adres wpisany raz służy poza domem. Po powrocie do domu połączenie samo wraca na sieć lokalną.")
        }
    }

    private var accountSection: some View {
        Section {
            TextField("Login", text: $username)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField("Hasło", text: $password)
                .textContentType(.password)
            DisclosureGroup("Zaawansowane", isExpanded: $advanced) {
                TextField("Port zdalny (DDNS), jeśli znasz", text: $port)
                    .keyboardType(.numberPad)
                TextField("Udział, na przykład Public", text: $directory)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        } header: {
            Text("Konto na serwerze")
        } footer: {
            Text("Hasło trafia do pęku kluczy iCloud. Na innych urządzeniach z tym samym kontem GalleryOS połączy się samo.")
        }
    }

    @ViewBuilder
    private var connection: some View {
        Section {
            if place == LibraryPlace.otherServer.rawValue {
                Picker("Rodzaj", selection: $otherKind) {
                    Text("WebDAV").tag(DestinationKind.webdav)
                    Text("SFTP").tag(DestinationKind.sftp)
                    Text("Immich").tag(DestinationKind.immich)
                }
            }
            TextField("Adres", text: $host, prompt: Text("Adres serwera"))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
            TextField("Port", text: $port)
                .keyboardType(.numberPad)
            TextField(otherKind == DestinationKind.immich && place == LibraryPlace.otherServer.rawValue ? "E-mail albo klucz API" : "Login", text: $username)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            SecureField("Hasło", text: $password)
                .textContentType(.password)
            if place != LibraryPlace.server.rawValue && otherKind != DestinationKind.immich {
                TextField("Folder", text: $directory)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        } header: {
            Text("Połączenie")
        }
    }

    private var disk: some View {
        Section {
            Button("Wybierz dysk, folder albo udział SMB") { picking = true }
            if !folderName.isEmpty {
                Label(folderName, systemImage: "folder.fill")
                    .foregroundStyle(.secondary)
            }
        } footer: {
            Text("Udział SMB wybiera się w Plikach. GalleryOS zapisuje w nim katalog biblioteki i nie rusza pozostałych plików.")
        }
    }

    // MARK: State

    private var webDAVForm: Bool {
        place == LibraryPlace.qnap.rawValue || (place == LibraryPlace.otherServer.rawValue && otherKind == DestinationKind.webdav)
    }

    private var candidates: [NearbyPlace] {
        var seen = Set<String>()
        return nearby.places.filter { item in
            let name = item.name.lowercased()
            guard !item.kind.contains("smb"), !name.contains("print"), !name.contains("laser"), !name.contains("hp ") else { return false }
            return seen.insert(item.host.lowercased()).inserted
        }
    }

    private var footer: String {
        switch LibraryPlace(rawValue: place) {
        case .thisPhone: "Zdjęcia zostają w Rolce tego \(ThisDevice.genitive)."
        case .server: "Ten sam katalog biblioteki, wysyłany w kawałkach, także poza domem."
        case .qnap: "Wybierz serwer w sieci domowej, dopisz DDNS do pracy poza domem i zaloguj się raz."
        case .otherServer: "WebDAV, SFTP albo Immich, jeśli taki serwer już działa."
        case .disk: "Dysk, folder z Plików albo udział SMB podpięty w Plikach."
        case nil: ""
        }
    }

    private var safePlace: Binding<String> {
        Binding(
            get: { LibraryPlace(rawValue: place)?.rawValue ?? LibraryPlace.thisPhone.rawValue },
            set: { value in
                UISelectionFeedbackGenerator().selectionChanged()
                place = value
                message = ""
            }
        )
    }

    private func pick(_ item: NearbyPlace) {
        localHost = item.host
        localName = item.name
        localPort = item.kind.contains("webdav") ? item.port : 0
        message = ""
    }

    private func apply(_ server: SavedServer) {
        let settings = SavedServerStore.shared.settings(for: server)
        place = LibraryPlace(rawValue: settings.place)?.rawValue ?? LibraryPlace.otherServer.rawValue
        if [DestinationKind.sftp, DestinationKind.immich, DestinationKind.webdav].contains(settings.kind) {
            otherKind = settings.kind
        }
        fill(settings)
        password = savedServers.password(for: server) ?? password
        message = ""
    }

    private func load() {
        let settings = DestinationSettings.load()
        if let known = LibraryPlace(rawValue: settings.place) {
            place = known.rawValue
        } else if LibraryPlace(rawValue: place) == nil {
            place = LibraryPlace.otherServer.rawValue
        }
        if [DestinationKind.sftp, DestinationKind.immich, DestinationKind.webdav].contains(settings.kind) {
            otherKind = settings.kind
        }
        fill(settings)
        folderName = settings.folderName
        password = GalleryKeychain.string(account: "destination-password") ?? ""
    }

    private func fill(_ settings: DestinationSettings) {
        host = settings.host
        let shownPort = settings.kind == DestinationKind.webdav ? settings.remotePort : settings.port
        port = shownPort == 0 ? "" : String(shownPort)
        username = settings.username
        directory = settings.directory
        advanced = shownPort > 0 || !settings.directory.isEmpty
        localHost = settings.localHost
        localPort = settings.localPort
        localName = settings.localName
        remoteHost = settings.remoteHost
        if localHost.isEmpty, GalleryNetwork.isLocalHost(settings.host) {
            localHost = settings.host
        }
        if remoteHost.isEmpty, !settings.host.isEmpty, !GalleryNetwork.isLocalHost(settings.host) {
            remoteHost = settings.host
        }
    }

    // MARK: Connect

    private func enable() async {
        if place == LibraryPlace.disk.rawValue {
            if folderName.isEmpty {
                message = "Wybierz dysk, folder albo udział SMB."
                return
            }
            dismiss()
            return
        }
        message = ""
        if LibraryPlace(rawValue: place) == .server, ConnectionURL.isCloudNAS(clean(host)) {
            let name = ConnectionURL.bare(host)
            if remoteHost.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                remoteHost = name
            }
            place = LibraryPlace.qnap.rawValue
        }
        if place == LibraryPlace.thisPhone.rawValue {
            library.useThisPhone()
            dismiss()
            return
        }
        var local = clean(localHost)
        var remote = clean(remoteHost)
        if webDAVForm, local.isEmpty, GalleryNetwork.isLocalHost(remote) {
            local = remote
            remote = ""
        }
        if webDAVForm, local.isEmpty, remote.isEmpty {
            message = "Wybierz serwer w sieci domowej albo wpisz adres DDNS."
            return
        }
        if !webDAVForm, place != LibraryPlace.disk.rawValue, clean(host).isEmpty {
            message = "Wpisz adres serwera."
            return
        }
        if place == LibraryPlace.disk.rawValue, folderName.isEmpty {
            message = "Wybierz dysk, folder albo udział SMB."
            return
        }
        if webDAVForm, password.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            message = "Wpisz hasło do konta na serwerze."
            return
        }

        var settings = DestinationSettings.load()
        settings.place = place
        settings.username = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let typedDirectory = directory.trimmingCharacters(in: .whitespacesAndNewlines)
        if webDAVForm {
            settings.host = remote.isEmpty ? local : remote
            settings.port = advanced ? (Int(port) ?? 0) : 0
            settings.directory = !advanced || typedDirectory.allSatisfy(\.isNumber) ? "" : typedDirectory
            settings.localHost = local
            settings.localPort = local.isEmpty ? 0 : localPort
            settings.localName = local.isEmpty ? "" : localName
            settings.remoteHost = remote
            settings.namedRemotePort = Int(port) ?? 0
        } else {
            settings.host = clean(host)
            settings.port = Int(port) ?? 0
            settings.directory = typedDirectory
            settings.localHost = ""
            settings.localPort = 0
            settings.localName = ""
            settings.remoteHost = ""
        }
        settings.folderName = folderName
        settings.connected = false
        switch LibraryPlace(rawValue: place) {
        case .server: settings.kind = DestinationKind.server
        case .qnap: settings.kind = DestinationKind.webdav
        case .otherServer: settings.kind = otherKind
        case .disk: settings.kind = DestinationKind.folder
        default: settings.kind = DestinationKind.none
        }
        if restore == nil {
            restore = (DestinationSettings.load(), GalleryKeychain.string(account: "destination-password"))
        }
        settings.save()
        if password.isEmpty {
            GalleryKeychain.remove(account: "destination-password")
        } else {
            try? GalleryKeychain.set(password, account: "destination-password")
        }

        var plan: [SetupStep] = []
        if webDAVForm, !local.isEmpty {
            plan.append(SetupStep(id: "home", title: "Sieć domowa", detail: localName.isEmpty ? local : localName, symbol: "house.fill"))
        }
        if webDAVForm, !remote.isEmpty {
            plan.append(SetupStep(id: "remote", title: "Zdalnie · DDNS", detail: remote, symbol: "globe"))
        }
        plan.append(SetupStep(id: "library", title: "Biblioteka GalleryOS", detail: "Logowanie i katalog", symbol: "photo.stack"))
        steps = plan
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) { stage = .connecting }

        if webDAVForm {
            let user = settings.username
            let secret = password
            let probePort = settings.port
            let homeHost = local
            let awayHost = remote
            let homePort = localPort
            // A LAN address cannot answer over cellular; waiting for its timeout only stalls the sheet.
            let atHome = link.network.isLocal || link.network == .unknown
            async let homeCheck: (ok: Bool, auth: Bool, millis: Int)? = homeHost.isEmpty || !atHome ? nil
                : WebDAVTransport.reach(host: homeHost, port: homePort, username: user, password: secret, timeout: 2.5)
            async let remoteCheck: (ok: Bool, auth: Bool, millis: Int)? = awayHost.isEmpty ? nil
                : WebDAVTransport.reach(host: awayHost, port: probePort, username: user, password: secret, timeout: 10)
            mark("home", atHome ? .running : .skipped("Poza domem"))
            mark("remote", .running)
            let homeResult = await homeCheck
            if Task.isCancelled { return }
            if let homeResult {
                mark("home", homeResult.ok ? .done("\(homeResult.millis) ms")
                    : homeResult.auth ? .failed("Błędny login lub hasło")
                    : link.network.isLocal ? .failed("Nie odpowiada") : .skipped("Poza domem"))
            }
            let remoteResult = await remoteCheck
            if Task.isCancelled { return }
            if let remoteResult {
                mark("remote", remoteResult.ok ? .done("\(remoteResult.millis) ms")
                    : remoteResult.auth ? .failed("Błędny login lub hasło") : .failed("Nie odpowiada"))
            }
            let auth = (homeResult?.auth ?? false) || (remoteResult?.auth ?? false)
            let anyOK = (homeResult?.ok ?? false) || (remoteResult?.ok ?? false)
            if auth && !anyOK {
                mark("library", .skipped("Popraw hasło"))
                fail("Błędny login lub hasło.")
                return
            }
        }
        mark("library", .running)
        do {
            _ = try await library.connectDestination()
            if Task.isCancelled { return }
            restore = nil
            mark("library", .done("Gotowe"))
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.spring(response: 0.42, dampingFraction: 0.7)) { stage = .done }
            try? await Task.sleep(for: .seconds(1.3))
            dismiss()
        } catch {
            if Task.isCancelled { return }
            let text = SyncPause.message(for: error)
            mark("library", .failed(text))
            fail(text)
        }
    }

    /// While connecting, stops the attempt and puts the last working server back; otherwise closes.
    private func cancel() {
        guard stage == .connecting else {
            if stage == .failed { putBack() }
            dismiss()
            return
        }
        attempt?.cancel()
        attempt = nil
        putBack()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        withAnimation(GalleryTheme.snappy) { stage = .editing }
    }

    private func putBack() {
        guard let restore else { return }
        self.restore = nil
        restore.settings.save()
        if let password = restore.password {
            try? GalleryKeychain.set(password, account: "destination-password")
        }
        if restore.settings.connected {
            ServerLink.shared.reset()
            LibraryEngine.shared.reroute()
        }
    }

    private func fail(_ text: String) {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        message = text
        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) { stage = .failed }
    }

    private func mark(_ id: String, _ state: SetupStep.State) {
        guard let index = steps.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(.spring(response: 0.38, dampingFraction: 0.72)) {
            steps[index].state = state
        }
    }

    private func clean(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}

// MARK: - Connecting UI

enum SetupStage: Equatable {
    case editing, connecting, done, failed
}

struct SetupStep: Identifiable, Equatable {
    enum State: Equatable {
        case waiting
        case running
        case done(String)
        case skipped(String)
        case failed(String)
    }

    let id: String
    let title: String
    let detail: String
    let symbol: String
    var state: State = .waiting
}

private struct ConnectingOverlay: View {
    let steps: [SetupStep]
    let stage: SetupStage
    let onBack: () -> Void

    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()
            VStack(spacing: 22) {
                Beacon(stage: stage)
                    .padding(.top, 8)
                Text(title)
                    .font(.title3.weight(.bold))
                    .contentTransition(.opacity)
                VStack(spacing: 0) {
                    ForEach(steps) { step in
                        StepRow(step: step)
                        if step.id != steps.last?.id {
                            Divider().padding(.leading, 48)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                if stage == .failed {
                    Button("Popraw dane", action: onBack)
                        .buttonStyle(.glassProminent)
                        .controlSize(.large)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(24)
            .frame(maxWidth: 440)
        }
        .animation(GalleryTheme.snappy, value: stage)
    }

    private var title: String {
        switch stage {
        case .connecting: "Łączę z serwerem"
        case .done: "Połączono"
        case .failed: "Nie udało się połączyć"
        case .editing: ""
        }
    }
}

struct Beacon: View {
    let stage: SetupStage

    private var tint: Color {
        switch stage {
        case .done: LinkRoute.home.tint
        case .failed: Color(red: 1.0, green: 0.27, blue: 0.23)
        default: GalleryTheme.accent
        }
    }

    var body: some View {
        ZStack {
            if stage == .connecting {
                ForEach(0..<3) { ring in
                    Circle()
                        .stroke(tint.opacity(0.5), lineWidth: 2)
                        .frame(width: 88, height: 88)
                        .phaseAnimator([0.0, 1.0]) { view, phase in
                            view
                                .scaleEffect(1 + phase * 0.9)
                                .opacity(1 - phase)
                        } animation: { _ in
                            .easeOut(duration: 1.6).delay(Double(ring) * 0.5)
                        }
                }
            }
            Circle()
                .fill(tint.gradient)
                .frame(width: 88, height: 88)
                .shadow(color: tint.opacity(0.45), radius: 18, y: 6)
            Image(systemName: stage == .done ? "checkmark" : stage == .failed ? "xmark" : "server.rack")
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(.white)
                .contentTransition(.symbolEffect(.replace.magic(fallback: .downUp)))
                .symbolEffect(.pulse, options: .repeating, isActive: stage == .connecting)
        }
        .frame(width: 170, height: 170)
        .scaleEffect(stage == .done ? 1.06 : 1)
        .animation(.spring(response: 0.4, dampingFraction: 0.6), value: stage)
    }
}

struct StepRow: View {
    let step: SetupStep

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: step.symbol)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(GalleryTheme.accent.gradient, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(step.title).font(.subheadline.weight(.semibold))
                Text(caption)
                    .font(.caption)
                    .foregroundStyle(captionColor)
                    .lineLimit(2)
                    .contentTransition(.opacity)
            }
            Spacer(minLength: 8)
            indicator
                .frame(width: 26, height: 26)
        }
        .padding(.vertical, 10)
    }

    private var caption: String {
        switch step.state {
        case .waiting, .running: step.detail
        case .done(let note): note.isEmpty ? step.detail : "\(step.detail) · \(note)"
        case .skipped(let note), .failed(let note): note
        }
    }

    private var captionColor: Color {
        if case .failed = step.state { return Color(red: 1.0, green: 0.27, blue: 0.23) }
        return .secondary
    }

    @ViewBuilder
    private var indicator: some View {
        switch step.state {
        case .waiting:
            Circle().stroke(Color.secondary.opacity(0.3), lineWidth: 2)
        case .running:
            ProgressView().controlSize(.small)
        case .done:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(LinkRoute.home.tint)
                .transition(.scale(scale: 0.3).combined(with: .opacity))
        case .skipped:
            Image(systemName: "minus.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(.secondary)
                .transition(.scale(scale: 0.3).combined(with: .opacity))
        case .failed:
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(Color(red: 1.0, green: 0.27, blue: 0.23))
                .transition(.scale(scale: 0.3).combined(with: .opacity))
        }
    }
}

private struct SavedServerRow: View {
    let server: SavedServer
    let live: LinkRoute?

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                Image(systemName: "server.rack")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 38, height: 38)
                    .background(Color.secondary.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                Circle()
                    .fill(server.online ? LinkRoute.home.tint : Color.secondary.opacity(0.4))
                    .frame(width: 10, height: 10)
                    .overlay(Circle().stroke(Color(uiColor: .secondarySystemGroupedBackground), lineWidth: 2))
                    .offset(x: 3, y: 3)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(server.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                HStack(spacing: 6) {
                    if !server.localHost.isEmpty {
                        RouteChip(route: .home, active: live == .home)
                    }
                    if !server.remoteHost.isEmpty {
                        RouteChip(route: .remote, active: live == .remote)
                    }
                    if server.localHost.isEmpty, server.remoteHost.isEmpty {
                        Text(server.host).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Spacer()
            if server.online {
                Text("AKTYWNY")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(LinkRoute.home.tint)
            }
        }
        .contentShape(Rectangle())
    }
}

private struct RouteChip: View {
    let route: LinkRoute
    let active: Bool

    var body: some View {
        Label(route == .home ? "Dom" : "DDNS", systemImage: route.symbol)
            .font(.system(size: 11, weight: .semibold))
            .labelStyle(.titleAndIcon)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background((active ? route.tint : Color.secondary).opacity(active ? 0.2 : 0.12), in: Capsule())
            .foregroundStyle(active ? route.tint : .secondary)
    }
}

struct ScanningDots: View {
    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3) { index in
                Circle()
                    .frame(width: 4, height: 4)
                    .phaseAnimator([0.25, 1.0]) { view, phase in
                        view.opacity(phase)
                    } animation: { _ in
                        .easeInOut(duration: 0.5).delay(Double(index) * 0.15)
                    }
            }
        }
        .foregroundStyle(.secondary)
        .accessibilityLabel("Szukam w sieci")
    }
}

enum LibraryPlace: String, CaseIterable, Identifiable {
    case thisPhone
    case server
    case qnap
    case otherServer
    case disk

    var id: String { rawValue }

    var title: String {
        switch self {
        case .thisPhone: return "Na tym iPhonie"
        case .server: return "Serwer GalleryOS"
        case .qnap: return "QNAP"
        case .otherServer: return "Inny serwer"
        case .disk: return "Dysk lub udział SMB"
        }
    }

    var symbol: String {
        switch self {
        case .thisPhone: return "iphone"
        case .server: return "server.rack"
        case .qnap: return "externaldrive.connected"
        case .otherServer: return "network"
        case .disk: return "internaldrive"
        }
    }
}
