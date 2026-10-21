import Photos
import SwiftUI
import UniformTypeIdentifiers

/// Step-by-step setup: where the library lives, finding the server at home, signing in,
/// remote access over DDNS, and a first connection. Shown once on first launch and
/// available again from the Library menu.
enum SetupGuide {
    static let doneKey = "galleryos.setup.done"

    static var needed: Bool {
        guard !UserDefaults.standard.bool(forKey: doneKey) else { return false }
        let settings = DestinationSettings.load()
        return !settings.connected && settings.kind == DestinationKind.none
    }
}

enum GuidePage: Hashable {
    case photos, place, find, account, remote, server, disk, connect, done
}

enum GuideCheck: Equatable {
    case idle
    case running
    case ok(Int)
    case auth
    case unreachable
}

// MARK: - Model

@MainActor
final class SetupGuideModel: ObservableObject {
    @Published var place = LibraryPlace.qnap
    @Published var otherKind = DestinationKind.webdav
    @Published var localHost = ""
    @Published var localPort = 0
    @Published var localName = ""
    @Published var remoteHost = ""
    @Published var remotePort = ""
    @Published var host = ""
    @Published var port = ""
    @Published var username = ""
    @Published var password = ""
    @Published var directory = ""
    @Published var folderName = ""
    @Published var homeCheck = GuideCheck.idle
    @Published var remoteCheck = GuideCheck.idle
    @Published var steps: [SetupStep] = []
    @Published var stage = SetupStage.editing
    @Published var failure = ""
    private(set) var finished = false
    private var restore: (settings: DestinationSettings, password: String?)?

    init() {
        let settings = DestinationSettings.load()
        if let known = LibraryPlace(rawValue: settings.place), known != .thisPhone, settings.kind != DestinationKind.none {
            place = known
        }
        if [DestinationKind.sftp, DestinationKind.immich, DestinationKind.webdav].contains(settings.kind) {
            otherKind = settings.kind
        }
        host = settings.host
        let shownPort = settings.kind == DestinationKind.webdav ? settings.remotePort : settings.port
        port = shownPort == 0 ? "" : String(shownPort)
        remotePort = port
        username = settings.username
        directory = settings.directory
        folderName = settings.folderName
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
        password = GalleryKeychain.string(account: "destination-password") ?? ""
    }

    /// A LAN address cannot answer over cellular, so home checks only run on Wi‑Fi or Ethernet.
    var atHome: Bool {
        let network = ServerLink.shared.network
        return network.isLocal || network == .unknown
    }

    var user: String { username.trimmingCharacters(in: .whitespacesAndNewlines) }

    func next(after page: GuidePage?, photosAsked: Bool) -> GuidePage {
        switch page {
        case nil: return photosAsked ? .place : .photos
        case .photos: return .place
        case .place:
            switch place {
            case .thisPhone: return .done
            case .qnap: return .find
            case .server, .otherServer: return .server
            case .disk: return .disk
            }
        case .find: return .account
        case .account: return .remote
        case .remote, .server, .disk: return .connect
        case .connect, .done: return .done
        }
    }

    func pick(_ item: NearbyPlace) {
        localHost = item.host
        localName = item.name
        localPort = item.kind.contains("webdav") ? item.port : 0
        homeCheck = .idle
    }

    func checkHome() async -> GuideCheck {
        let local = Self.clean(localHost)
        guard !local.isEmpty, atHome else {
            homeCheck = .idle
            return .idle
        }
        homeCheck = .running
        let result = await WebDAVTransport.reach(host: local, port: localPort, username: user, password: password, timeout: 4)
        homeCheck = result.ok ? .ok(result.millis) : result.auth ? .auth : .unreachable
        return homeCheck
    }

    func checkRemote() async {
        let remote = Self.clean(remoteHost)
        guard !remote.isEmpty else {
            remoteCheck = .idle
            return
        }
        remoteCheck = .running
        let result = await WebDAVTransport.reach(host: remote, port: Int(remotePort) ?? 0, username: user, password: password, timeout: 10)
        remoteCheck = result.ok ? .ok(result.millis) : result.auth ? .auth : .unreachable
    }

    func keepOnPhone(_ library: PhotoLibrary) {
        library.useThisPhone()
        finish()
    }

    func remember(folder url: URL) -> String? {
        guard url.startAccessingSecurityScopedResource() else { return "Dysk jest odłączony. Podłącz go i spróbuj jeszcze raz." }
        defer { url.stopAccessingSecurityScopedResource() }
        do {
            let data = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
            LibraryEngine.shared.saveBookmark(data, name: url.lastPathComponent)
            folderName = url.lastPathComponent
            return nil
        } catch {
            return "Nie udało się zapamiętać tego folderu."
        }
    }

    func connect(_ library: PhotoLibrary) async {
        failure = ""
        recognizeCloudNAS()
        let nas = place == .qnap
        var local = Self.clean(localHost)
        var remote = Self.clean(remoteHost)
        if nas, local.isEmpty, GalleryNetwork.isLocalHost(remote) {
            local = remote
            remote = ""
        }

        var settings = DestinationSettings.load()
        settings.place = place.rawValue
        settings.username = user
        let typedDirectory = directory.trimmingCharacters(in: .whitespacesAndNewlines)
        if nas {
            settings.host = remote.isEmpty ? local : remote
            settings.port = remote.isEmpty ? 0 : (Int(remotePort) ?? 0)
            settings.directory = typedDirectory.allSatisfy(\.isNumber) ? "" : typedDirectory
            settings.localHost = local
            settings.localPort = local.isEmpty ? 0 : localPort
            settings.localName = local.isEmpty ? "" : localName
            settings.remoteHost = remote
            settings.namedRemotePort = Int(remotePort) ?? 0
        } else {
            settings.host = place == .disk ? "" : Self.clean(host)
            settings.port = Int(port) ?? 0
            settings.directory = typedDirectory
            settings.localHost = ""
            settings.localPort = 0
            settings.localName = ""
            settings.remoteHost = ""
        }
        settings.folderName = place == .disk ? folderName : settings.folderName
        settings.connected = false
        switch place {
        case .server: settings.kind = DestinationKind.server
        case .qnap: settings.kind = DestinationKind.webdav
        case .otherServer: settings.kind = otherKind
        case .disk: settings.kind = DestinationKind.folder
        case .thisPhone: settings.kind = DestinationKind.none
        }
        if restore == nil {
            restore = (DestinationSettings.load(), GalleryKeychain.string(account: "destination-password"))
        }
        settings.save()
        if password.isEmpty {
            GalleryKeychain.remove(account: "destination-password")
        } else {
            GalleryKeychain.keep(password, account: "destination-password")
        }

        var plan: [SetupStep] = []
        if nas, !local.isEmpty {
            plan.append(SetupStep(id: "home", title: "Sieć domowa", detail: localName.isEmpty ? local : localName, symbol: "house.fill"))
        }
        if nas, !remote.isEmpty {
            plan.append(SetupStep(id: "remote", title: "Zdalnie · DDNS", detail: remote, symbol: "globe"))
        }
        if place == .disk {
            plan.append(SetupStep(id: "disk", title: "Dysk", detail: folderName, symbol: "externaldrive.fill"))
        } else if !nas {
            plan.append(SetupStep(id: "server", title: "Serwer", detail: settings.host, symbol: "server.rack"))
        }
        plan.append(SetupStep(id: "library", title: "Biblioteka GalleryOS", detail: "Logowanie i katalog", symbol: "photo.stack"))
        steps = plan
        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) { stage = .connecting }

        if nas {
            let secret = password
            let probePort = settings.port
            let homePort = localPort
            let home = atHome
            let account = user
            let homeHost = local
            let awayHost = remote
            async let homeProbe: (ok: Bool, auth: Bool, millis: Int)? = homeHost.isEmpty || !home ? nil
                : WebDAVTransport.reach(host: homeHost, port: homePort, username: account, password: secret, timeout: 3)
            async let remoteProbe: (ok: Bool, auth: Bool, millis: Int)? = awayHost.isEmpty ? nil
                : WebDAVTransport.reach(host: awayHost, port: probePort, username: account, password: secret, timeout: 10)
            mark("home", home ? .running : .skipped("Poza domem"))
            mark("remote", .running)
            let homeResult = await homeProbe
            if Task.isCancelled { return }
            if let homeResult {
                mark("home", homeResult.ok ? .done("\(homeResult.millis) ms")
                    : homeResult.auth ? .failed("Błędny login lub hasło")
                    : ServerLink.shared.network.isLocal ? .failed("Nie odpowiada") : .skipped("Poza domem"))
            }
            let remoteResult = await remoteProbe
            if Task.isCancelled { return }
            if let remoteResult {
                mark("remote", remoteResult.ok ? .done("\(remoteResult.millis) ms")
                    : remoteResult.auth ? .failed("Błędny login lub hasło") : .failed("Nie odpowiada"))
            }
            let auth = (homeResult?.auth ?? false) || (remoteResult?.auth ?? false)
            let anyOK = (homeResult?.ok ?? false) || (remoteResult?.ok ?? false)
            if auth && !anyOK {
                mark("library", .skipped("Popraw hasło"))
                fail("Serwer odrzucił login lub hasło. Wróć i wpisz je jeszcze raz.")
                return
            }
        } else {
            mark("server", .running)
            mark("disk", .running)
        }
        mark("library", .running)
        do {
            _ = try await library.connectDestination()
            if Task.isCancelled { return }
            mark("server", .done(""))
            mark("disk", .done(""))
            mark("library", .done("Gotowe"))
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            finish()
            withAnimation(.spring(response: 0.42, dampingFraction: 0.7)) { stage = .done }
        } catch {
            if Task.isCancelled { return }
            let text = SyncPause.message(for: error)
            mark("server", .failed(text))
            mark("disk", .failed(text))
            mark("library", .failed(text))
            fail(text)
        }
    }

    func edit() {
        withAnimation(GalleryTheme.snappy) { stage = .editing }
    }

    /// Leaving the guide before it succeeds puts the last working library back.
    func abandon() {
        guard !finished, let restore else { return }
        self.restore = nil
        restore.settings.save()
        if let password = restore.password {
            GalleryKeychain.keep(password, account: "destination-password")
        }
        if restore.settings.connected {
            ServerLink.shared.reset()
            LibraryEngine.shared.reroute()
        }
    }

    func skip() {
        UserDefaults.standard.set(true, forKey: SetupGuide.doneKey)
    }

    private func finish() {
        restore = nil
        finished = true
        UserDefaults.standard.set(true, forKey: SetupGuide.doneKey)
    }

    private func fail(_ text: String) {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        failure = text
        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) { stage = .failed }
    }

    private func mark(_ id: String, _ state: SetupStep.State) {
        guard let index = steps.firstIndex(where: { $0.id == id }) else { return }
        withAnimation(.spring(response: 0.38, dampingFraction: 0.72)) {
            steps[index].state = state
        }
    }

    /// `nazwa.myqnapcloud.com` on the GalleryOS-server page is the NAS in the cloud.
    /// Port „Domyślny” there is 8787, which QNAP does not use.
    private func recognizeCloudNAS() {
        guard place == .server || (place == .otherServer && otherKind == DestinationKind.webdav) else { return }
        let name = ConnectionURL.bare(host)
        guard ConnectionURL.isCloudNAS(name) else { return }
        if remoteHost.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            remoteHost = name
        }
        if remotePort.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let typed = port.trimmingCharacters(in: .whitespacesAndNewlines)
            if !typed.isEmpty, typed != "8787" { remotePort = typed }
        }
        place = .qnap
    }

    static func clean(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}

// MARK: - Flow

struct SetupGuideView: View {
    var firstRun = false
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: PhotoLibrary
    @StateObject private var model = SetupGuideModel()
    @State private var path: [GuidePage] = []

    private var photosAsked: Bool { library.authorization != .notDetermined }

    var body: some View {
        NavigationStack(path: $path) {
            GuideWelcome(firstRun: firstRun, onStart: { advance(from: nil) }, onLater: close)
                .toolbar { closeItem }
                .navigationDestination(for: GuidePage.self) { page in
                    if page == .done {
                        screen(page)
                    } else {
                        screen(page).toolbar { closeItem }
                    }
                }
        }
        .environmentObject(model)
        .interactiveDismissDisabled()
        .onDisappear { model.abandon() }
    }

    @ToolbarContentBuilder
    private var closeItem: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button(firstRun ? "Później" : "Zamknij", action: close)
                .disabled(model.stage == .connecting)
        }
    }

    @ViewBuilder
    private func screen(_ page: GuidePage) -> some View {
        switch page {
        case .photos: GuidePhotos { advance(from: .photos) }
        case .place: GuidePlace { advance(from: .place) }
        case .find: GuideFind { advance(from: .find) }
        case .account: GuideAccount { advance(from: .account) }
        case .remote: GuideRemote { advance(from: .remote) }
        case .server: GuideServer { advance(from: .server) }
        case .disk: GuideDisk { advance(from: .disk) }
        case .connect:
            GuideConnect(onDone: { advance(from: .connect) }, onEdit: {
                model.edit()
                if !path.isEmpty { path.removeLast() }
            })
        case .done: GuideDone(onFinish: { dismiss() })
        }
    }

    private func advance(from page: GuidePage?) {
        if page == .place, model.place == .thisPhone {
            model.keepOnPhone(library)
        }
        path.append(model.next(after: page, photosAsked: photosAsked))
    }

    private func close() {
        model.abandon()
        model.skip()
        dismiss()
    }
}

// MARK: - Pages

private struct GuideWelcome: View {
    let firstRun: Bool
    let onStart: () -> Void
    let onLater: () -> Void

    var body: some View {
        GuideLayout(
            symbol: "photo.stack.fill",
            tint: GalleryTheme.accent,
            title: firstRun ? "Witaj w GalleryOS" : "Kreator połączenia",
            subtitle: "Przeprowadzę Cię krok po kroku przez połączenie z dyskiem lub serwerem. Zajmie to kilka minut."
        ) {
            VStack(alignment: .leading, spacing: 22) {
                GuideFeature(symbol: "lock.shield.fill", tint: .green, title: "Prywatnie",
                             detail: "Zdjęcia trafiają tylko na Twój dysk albo serwer, bez cudzej chmury.")
                GuideFeature(symbol: "house.and.flag.fill", tint: .orange, title: "W domu i w drodze",
                             detail: "W domu GalleryOS łączy się bezpośrednio, a poza domem przez DDNS.")
                GuideFeature(symbol: "appletv.fill", tint: .purple, title: "Na dużym ekranie",
                             detail: "Ta sama biblioteka na Apple TV, w pełnej jakości, także HDR i Dolby Vision.")
            }
            .padding(.top, 6)
        } footer: {
            GuidePrimary(title: "Zaczynamy", action: onStart)
            if firstRun {
                Button("Skonfiguruję później", action: onLater)
                    .font(.body.weight(.medium))
            }
        }
    }
}

private struct GuidePhotos: View {
    let onNext: () -> Void
    @EnvironmentObject private var library: PhotoLibrary

    var body: some View {
        GuideLayout(
            symbol: "photo.on.rectangle.angled",
            tint: .orange,
            title: "Dostęp do zdjęć",
            subtitle: "GalleryOS kopiuje zdjęcia i filmy z Rolki na Twój dysk lub serwer. Niczego nie usuwa bez Twojej zgody."
        ) {
            GuideGroup(footer: "Wybierz „Zezwól na pełny dostęp”, żeby kopia obejmowała całą bibliotekę, także nowe zdjęcia.") {
                GuideNote(symbol: "checkmark.shield.fill", tint: .green,
                          text: "Zdjęcia nie opuszczają Twojej sieci, dopóki sam nie dodasz dostępu zdalnego.")
            }
        } footer: {
            GuidePrimary(title: "Zezwól na dostęp") { library.requestAccess() }
            Button("Nie teraz", action: onNext)
                .font(.body.weight(.medium))
        }
        .onChange(of: library.authorization) { _, status in
            if status != .notDetermined { onNext() }
        }
    }
}

private struct GuidePlace: View {
    let onNext: () -> Void
    @EnvironmentObject private var model: SetupGuideModel

    private let order: [LibraryPlace] = [.qnap, .server, .otherServer, .thisPhone]

    var body: some View {
        GuideLayout(
            symbol: "arrow.triangle.branch",
            tint: GalleryTheme.accent,
            title: "Gdzie mają trafiać zdjęcia?",
            subtitle: "Wybierz serwer na kopię biblioteki. Pendrive dodasz później, jednym przyciskiem w synchronizacji."
        ) {
            VStack(spacing: 10) {
                ForEach(order) { item in
                    GuideChoice(
                        symbol: Self.symbol(item),
                        tint: Self.tint(item),
                        title: Self.title(item),
                        detail: Self.detail(item),
                        selected: model.place == item
                    ) {
                        withAnimation(GalleryTheme.snappy) { model.place = item }
                    }
                }
            }
        } footer: {
            GuidePrimary(title: model.place == .thisPhone ? "Zostaw na iPhonie" : "Dalej", action: onNext)
        }
    }

    static func symbol(_ place: LibraryPlace) -> String {
        switch place {
        case .qnap: "externaldrive.connected.to.line.below.fill"
        case .disk: "externaldrive.fill"
        case .server: "server.rack"
        case .otherServer: "network"
        case .thisPhone: "iphone"
        }
    }

    static func tint(_ place: LibraryPlace) -> Color {
        switch place {
        case .qnap: GalleryTheme.accent
        case .disk: .orange
        case .server: .indigo
        case .otherServer: .teal
        case .thisPhone: .gray
        }
    }

    static func title(_ place: LibraryPlace) -> String {
        switch place {
        case .qnap: "Serwer NAS w domu"
        case .disk: "Dysk przenośny lub udział SMB"
        case .server: "Serwer GalleryOS"
        case .otherServer: "Inny serwer"
        case .thisPhone: "Tylko na tym iPhonie"
        }
    }

    static func detail(_ place: LibraryPlace) -> String {
        switch place {
        case .qnap: "QNAP, Synology lub inny NAS z WebDAV. W domu i zdalnie."
        case .disk: "Dysk USB‑C podłączony do \(ThisDevice.genitive) albo folder sieciowy w Plikach."
        case .server: "Własny serwer GalleryOS. Wysyła w kawałkach, także poza domem."
        case .otherServer: "WebDAV, SFTP albo Immich, który już działa."
        case .thisPhone: "Bez kopii. Przeglądanie i porządkowanie Rolki."
        }
    }
}

private struct GuideFind: View {
    let onNext: () -> Void
    @EnvironmentObject private var model: SetupGuideModel
    @StateObject private var nearby = NearbyPlaces()
    @State private var scanning = true

    private var candidates: [NearbyPlace] {
        var seen = Set<String>()
        return nearby.places.filter { item in
            let name = item.name.lowercased()
            guard !item.kind.contains("smb"), !name.contains("print"), !name.contains("laser"), !name.contains("hp ") else { return false }
            return seen.insert(item.host.lowercased()).inserted
        }
    }

    var body: some View {
        GuideLayout(
            symbol: "wifi",
            tint: .green,
            title: "Znajdź serwer w sieci",
            subtitle: "\(ThisDevice.name) musi być w tym samym Wi‑Fi co serwer. Gdy iOS zapyta o dostęp do sieci lokalnej, wybierz „Zezwól”."
        ) {
            if !model.atHome {
                GuideGroup {
                    GuideNote(symbol: "antenna.radiowaves.left.and.right", tint: .orange,
                              text: "Nie jesteś teraz w Wi‑Fi. Możesz pominąć ten krok i w kolejnym wpisać adres DDNS.")
                }
            }
            GuideGroup(title: "W tej sieci", busy: scanning) {
                if candidates.isEmpty {
                    HStack(spacing: 12) {
                        if scanning {
                            ProgressView()
                            Text("Szukam serwerów…").foregroundStyle(.secondary)
                        } else {
                            Image(systemName: "questionmark.circle").foregroundStyle(.secondary)
                            Text("Nic nie znaleziono. Wpisz adres ręcznie poniżej.").foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .font(.subheadline)
                    .padding(16)
                } else {
                    ForEach(Array(candidates.enumerated()), id: \.element.id) { offset, item in
                        if offset > 0 { Divider().padding(.leading, 64) }
                        Button {
                            UISelectionFeedbackGenerator().selectionChanged()
                            withAnimation(GalleryTheme.snappy) { model.pick(item) }
                        } label: {
                            GuideRow(
                                symbol: item.kind.contains("webdav") ? "externaldrive.connected.to.line.below.fill" : "server.rack",
                                tint: .green,
                                title: item.name,
                                detail: item.host,
                                selected: model.localHost.caseInsensitiveCompare(item.host) == .orderedSame
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            GuideGroup(title: "Albo wpisz adres", footer: "Adres IP serwera znajdziesz w aplikacji Qfinder lub w panelu routera.") {
                GuideField(label: "Adres", prompt: "192.168.1.20", text: Binding(
                    get: { model.localHost },
                    set: {
                        model.localHost = $0
                        model.localName = ""
                        model.localPort = 0
                        model.homeCheck = .idle
                    }
                ), keyboard: .URL)
            }
            GuideTip(title: "Pierwszy raz z QNAP?", lines: [
                "W QTS otwórz Panel sterowania → Usługi sieciowe → WebDAV i włącz WebDAV.",
                "Nadaj swojemu kontu uprawnienia WebDAV do udziału Public.",
            ])
        } footer: {
            GuidePrimary(title: "Dalej", action: onNext)
                .disabled(model.localHost.trimmingCharacters(in: .whitespaces).isEmpty)
            if model.localHost.trimmingCharacters(in: .whitespaces).isEmpty {
                Button("Pomiń, nie jestem w domu", action: onNext)
                    .font(.body.weight(.medium))
            }
        }
        .task {
            try? await Task.sleep(for: .milliseconds(250))
            nearby.start()
            try? await Task.sleep(for: .seconds(7))
            withAnimation(GalleryTheme.snappy) { scanning = false }
        }
        .onDisappear { nearby.stop() }
    }
}

private struct GuideAccount: View {
    let onNext: () -> Void
    @EnvironmentObject private var model: SetupGuideModel
    @State private var advanced = false
    @State private var checking = false
    @FocusState private var focus: Field?

    private enum Field { case user, password }

    private var ready: Bool {
        !model.user.isEmpty && !model.password.isEmpty
    }

    var body: some View {
        GuideLayout(
            symbol: "person.badge.key.fill",
            tint: .indigo,
            title: "Zaloguj się do serwera",
            subtitle: "Użyj konta, którym logujesz się do QNAP lub NAS. Hasło trafi do pęku kluczy iCloud."
        ) {
            GuideGroup {
                GuideField(label: "Login", prompt: "admin", text: $model.username, content: .username)
                    .focused($focus, equals: .user)
                    .submitLabel(.next)
                    .onSubmit { focus = .password }
                Divider().padding(.leading, 16)
                GuideField(label: "Hasło", prompt: "Wymagane", text: $model.password, secure: true, content: .password)
                    .focused($focus, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { Task { await check() } }
            }
            .onChange(of: model.username) { model.homeCheck = .idle }
            .onChange(of: model.password) { model.homeCheck = .idle }
            GuideCheckRow(check: model.homeCheck, idle: nil)
            GuideGroup(footer: "Biblioteka zapisuje się w udziale Public.") {
                DisclosureGroup("Zaawansowane", isExpanded: $advanced) {
                    GuideField(label: "Udział", prompt: "Public", text: $model.directory)
                        .padding(.horizontal, -16)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        } footer: {
            GuidePrimary(
                title: model.homeCheck == .unreachable ? "Dalej mimo to" : "Dalej",
                busy: checking
            ) {
                if model.homeCheck == .unreachable {
                    onNext()
                } else {
                    Task { await check() }
                }
            }
            .disabled(!ready || checking)
        }
        .onAppear { if model.username.isEmpty { focus = .user } }
    }

    private func check() async {
        guard ready, !checking else { return }
        focus = nil
        checking = true
        let result = await model.checkHome()
        checking = false
        switch result {
        case .ok, .idle:
            if case .ok = result { UINotificationFeedbackGenerator().notificationOccurred(.success) }
            onNext()
        case .auth, .unreachable:
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case .running:
            break
        }
    }
}

private struct GuideRemote: View {
    let onNext: () -> Void
    @EnvironmentObject private var model: SetupGuideModel

    private var hasHome: Bool { !SetupGuideModel.clean(model.localHost).isEmpty }
    private var hasRemote: Bool { !SetupGuideModel.clean(model.remoteHost).isEmpty }

    var body: some View {
        GuideLayout(
            symbol: "globe",
            tint: .teal,
            title: "Dostęp spoza domu",
            subtitle: "Żeby zdjęcia wysyłały się też w drodze, serwer potrzebuje stałego adresu w internecie, czyli DDNS."
        ) {
            GuideGroup(footer: hasHome
                       ? "Możesz to pominąć i dopisać później. W domu wszystko działa także bez DDNS."
                       : "Bez adresu w sieci domowej potrzebny jest adres DDNS.") {
                GuideField(label: "DDNS", prompt: "nazwa.myqnapcloud.com", text: $model.remoteHost, keyboard: .URL)
                Divider().padding(.leading, 16)
                GuideField(label: "Port", prompt: "Automatycznie", text: $model.remotePort, keyboard: .numberPad)
            }
            .onChange(of: model.remoteHost) { model.remoteCheck = .idle }
            .onChange(of: model.remotePort) { model.remoteCheck = .idle }
            if hasRemote {
                GuideCheckRow(check: model.remoteCheck, idle: "Sprawdź, czy serwer odpowiada z internetu.")
                Button {
                    Task { await model.checkRemote() }
                } label: {
                    Label("Sprawdź połączenie", systemImage: "bolt.horizontal.circle")
                        .frame(maxWidth: .infinity)
                }
                .galleryGlassButton()
                .controlSize(.large)
                .disabled(model.remoteCheck == .running)
            }
            GuideTip(title: "Jak ustawić DDNS na QNAP", lines: [
                "W QTS otwórz myQNAPcloud i zarejestruj nazwę urządzenia. Dostaniesz adres nazwa.myqnapcloud.com.",
                "Włącz automatyczną konfigurację routera (UPnP) albo na routerze przekieruj port 5001 na adres serwera.",
                "Synology: Panel sterowania → Dostęp zewnętrzny → DDNS, a WebDAV przez HTTPS działa na porcie 5006.",
            ])
        } footer: {
            GuidePrimary(title: hasRemote ? "Połącz" : "Połącz tylko w domu", action: onNext)
                .disabled(!hasHome && !hasRemote)
        }
    }
}

private struct GuideServer: View {
    let onNext: () -> Void
    @EnvironmentObject private var model: SetupGuideModel

    private var other: Bool { model.place == .otherServer }
    private var immich: Bool { other && model.otherKind == DestinationKind.immich }

    var body: some View {
        GuideLayout(
            symbol: other ? "network" : "server.rack",
            tint: other ? .teal : .indigo,
            title: other ? "Twój serwer" : "Serwer GalleryOS",
            subtitle: other
                ? "Podaj adres serwera i konto. Adres w internecie działa i w domu, i w drodze."
                : "Podaj adres serwera GalleryOS i swoje konto. Zdjęcia wysyłają się w kawałkach, więc przerwy w sieci nie szkodzą."
        ) {
            if other {
                Picker("Rodzaj", selection: $model.otherKind) {
                    Text("WebDAV").tag(DestinationKind.webdav)
                    Text("SFTP").tag(DestinationKind.sftp)
                    Text("Immich").tag(DestinationKind.immich)
                }
                .pickerStyle(.segmented)
            }
            GuideGroup {
                GuideField(label: "Adres", prompt: "serwer.example.com", text: $model.host, keyboard: .URL)
                Divider().padding(.leading, 16)
                GuideField(label: "Port", prompt: "Domyślny", text: $model.port, keyboard: .numberPad)
            }
            if ConnectionURL.isCloudNAS(model.host) {
                GuideNote(
                    symbol: "externaldrive.connected.to.line.below.fill",
                    tint: GalleryTheme.accent,
                    text: "To adres QNAP albo Synology. Połączenie pójdzie przez WebDAV (HTTPS, port 5001). Login to konto z panelu serwera."
                )
            }
            GuideGroup(footer: "Hasło trafi do pęku kluczy iCloud. Na Twoich innych urządzeniach GalleryOS połączy się samo.") {
                GuideField(label: immich ? "Konto" : "Login", prompt: immich ? "E-mail albo klucz API" : "Login", text: $model.username, content: .username)
                Divider().padding(.leading, 16)
                GuideField(label: "Hasło", prompt: "Wymagane", text: $model.password, secure: true, content: .password)
                if other && !immich {
                    Divider().padding(.leading, 16)
                    GuideField(label: "Folder", prompt: "Opcjonalnie", text: $model.directory)
                }
            }
        } footer: {
            GuidePrimary(title: "Połącz", action: onNext)
                .disabled(SetupGuideModel.clean(model.host).isEmpty)
        }
    }
}

private struct GuideDisk: View {
    let onNext: () -> Void
    @EnvironmentObject private var model: SetupGuideModel
    @State private var picking = false
    @State private var problem = ""

    var body: some View {
        GuideLayout(
            symbol: "externaldrive.fill",
            tint: .orange,
            title: "Wybierz dysk",
            subtitle: "GalleryOS założy na nim katalog biblioteki i nie ruszy pozostałych plików."
        ) {
            GuideGroup(title: "Zanim wybierzesz") {
                GuideStepLine(number: 1, text: "Podłącz dysk do \(ThisDevice.genitive) przez USB‑C albo dodaj udział SMB w Plikach: Przeglądaj → ⋯ → Połącz z serwerem.")
                Divider().padding(.leading, 56)
                GuideStepLine(number: 2, text: "Stuknij „Wybierz dysk lub folder” i wskaż dysk albo folder na zdjęcia.")
            }
            if !model.folderName.isEmpty {
                GuideGroup {
                    GuideRow(symbol: "folder.fill", tint: .orange, title: model.folderName, detail: "Wybrany folder", selected: true)
                }
                .transition(.scale(scale: 0.96).combined(with: .opacity))
            }
            if !problem.isEmpty {
                GuideGroup {
                    GuideNote(symbol: "exclamationmark.triangle.fill", tint: .orange, text: problem)
                }
            }
            Button {
                picking = true
            } label: {
                Label(model.folderName.isEmpty ? "Wybierz dysk lub folder" : "Wybierz inny", systemImage: "folder.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .galleryGlassButton()
            .controlSize(.large)
        } footer: {
            GuidePrimary(title: "Połącz", action: onNext)
                .disabled(model.folderName.isEmpty)
        }
        .animation(GalleryTheme.snappy, value: model.folderName)
        .fileImporter(isPresented: $picking, allowedContentTypes: [.folder]) { result in
            switch result {
            case .success(let url):
                problem = model.remember(folder: url) ?? ""
            case .failure:
                problem = "Nie wybrano folderu."
            }
        }
    }
}

private struct GuideConnect: View {
    let onDone: () -> Void
    let onEdit: () -> Void
    @EnvironmentObject private var model: SetupGuideModel
    @EnvironmentObject private var library: PhotoLibrary
    @State private var attempt = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Beacon(stage: model.stage == .editing ? .connecting : model.stage)
                    .padding(.top, 24)
                VStack(spacing: 8) {
                    Text(title)
                        .font(.title.bold())
                        .contentTransition(.opacity)
                    if model.stage == .failed, !model.failure.isEmpty {
                        Text(model.failure)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(4)
                            .transition(.opacity)
                    }
                }
                VStack(spacing: 0) {
                    ForEach(model.steps) { step in
                        StepRow(step: step)
                        if step.id != model.steps.last?.id {
                            Divider().padding(.leading, 44)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 6)
                .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
        .galleryBottomBar(edge: .bottom) {
            if model.stage == .failed {
                VStack(spacing: 10) {
                    GuidePrimary(title: "Popraw dane", action: onEdit)
                    Button("Spróbuj ponownie") { attempt += 1 }
                        .font(.body.weight(.medium))
                }
                .guideFooter()
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationBarBackButtonHidden(model.stage != .failed)
        .navigationBarTitleDisplayMode(.inline)
        .animation(GalleryTheme.snappy, value: model.stage)
        .task(id: attempt) {
            await model.connect(library)
            guard model.stage == .done else { return }
            try? await Task.sleep(for: .seconds(1.1))
            if !Task.isCancelled { onDone() }
        }
    }

    private var title: String {
        switch model.stage {
        case .editing, .connecting: "Łączę…"
        case .done: "Połączono"
        case .failed: "Nie udało się połączyć"
        }
    }
}

private struct GuideDone: View {
    let onFinish: () -> Void
    @EnvironmentObject private var model: SetupGuideModel
    @State private var showAppleTV = false

    private var phoneOnly: Bool { model.place == .thisPhone }

    var body: some View {
        GuideLayout(
            symbol: phoneOnly ? "iphone" : "checkmark",
            tint: .green,
            title: phoneOnly ? "Gotowe" : "Wszystko gotowe",
            subtitle: phoneOnly
                ? "Zdjęcia zostają w Rolce tego \(ThisDevice.genitive). Dysk albo serwer dodasz w każdej chwili w menu Biblioteki → Kreator połączenia."
                : "GalleryOS jest połączony. Oto co dalej."
        ) {
            if !phoneOnly {
                GuideGroup(title: "Połączenie") {
                    ForEach(Array(summary.enumerated()), id: \.offset) { offset, line in
                        if offset > 0 { Divider().padding(.leading, 64) }
                        GuideRow(symbol: line.symbol, tint: line.tint, title: line.title, detail: line.detail, selected: false)
                    }
                }
                VStack(alignment: .leading, spacing: 22) {
                    GuideFeature(symbol: "arrow.triangle.2.circlepath", tint: GalleryTheme.accent, title: "Kopia rusza sama",
                                 detail: "Postęp widać na pasku w Bibliotece. Pierwsza kopia idzie najszybciej w domowym Wi‑Fi i na ładowarce.")
                    GuideFeature(symbol: "rectangle.on.rectangle", tint: .orange, title: "Zakładka Serwer",
                                 detail: "Zdjęcia już skopiowane możesz bezpiecznie usunąć z \(ThisDevice.genitive), a zostaną na serwerze.")
                    GuideFeature(symbol: "appletv.fill", tint: .purple, title: "Apple TV",
                                 detail: "Otwórz GalleryOS na Apple TV i sparuj go z tym \(ThisDevice.instrumental).")
                }
                .padding(.top, 4)
            }
        } footer: {
            GuidePrimary(title: "Zacznij korzystać", action: onFinish)
            if !phoneOnly {
                Button("Sparuj Apple TV") { showAppleTV = true }
                    .font(.body.weight(.medium))
            }
        }
        .navigationBarBackButtonHidden()
        .sheet(isPresented: $showAppleTV) {
            AppleTVPairingSheet()
        }
    }

    private var summary: [(symbol: String, tint: Color, title: String, detail: String)] {
        var lines: [(symbol: String, tint: Color, title: String, detail: String)] = []
        let local = SetupGuideModel.clean(model.localHost)
        let remote = SetupGuideModel.clean(model.remoteHost)
        switch model.place {
        case .qnap:
            if !local.isEmpty {
                lines.append(("house.fill", Color.green, "W domu", model.localName.isEmpty ? local : "\(model.localName) · \(local)"))
            }
            if remote.isEmpty {
                lines.append(("globe", Color.gray, "Poza domem", "Bez DDNS. Dopiszesz go w kreatorze."))
            } else {
                lines.append(("globe", Color.teal, "Poza domem", remote))
            }
        case .disk:
            lines.append(("externaldrive.fill", Color.orange, "Dysk", model.folderName))
        default:
            lines.append(("server.rack", Color.indigo, "Serwer", SetupGuideModel.clean(model.host)))
        }
        if !model.user.isEmpty, model.place != .disk {
            lines.append(("person.crop.circle.fill", Color.indigo, "Konto", model.user))
        }
        return lines
    }
}

// MARK: - Building blocks

private struct GuideLayout<Content: View, Footer: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    let subtitle: String
    @ViewBuilder var content: Content
    @ViewBuilder var footer: Footer

    var body: some View {
        ScrollView {
            VStack(spacing: 26) {
                VStack(spacing: 14) {
                    Image(systemName: symbol)
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 78, height: 78)
                        .background(tint.gradient, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .shadow(color: tint.opacity(0.32), radius: 16, y: 6)
                    Text(title)
                        .font(.title.bold())
                        .multilineTextAlignment(.center)
                    Text(subtitle)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 12)
                content
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
        .galleryBottomBar(edge: .bottom) {
            VStack(spacing: 10) { footer }
                .guideFooter()
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

private extension View {
    func guideFooter() -> some View {
        padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 6)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
    }
}

private struct GuidePrimary: View {
    let title: String
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if busy {
                    ProgressView().tint(.white)
                }
                Text(title)
            }
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity)
        }
        .galleryGlassButton(prominent: true)
        .controlSize(.large)
    }
}

private struct GuideGroup<Content: View>: View {
    var title: String?
    var busy = false
    var footer: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title {
                HStack(spacing: 8) {
                    Text(title)
                    if busy { ScanningDots() }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)
            }
            VStack(spacing: 0) { content }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            if let footer {
                Text(footer)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

private struct GuideField: View {
    let label: String
    let prompt: String
    @Binding var text: String
    var secure = false
    var keyboard = UIKeyboardType.default
    var content: UITextContentType?

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .frame(width: 70, alignment: .leading)
            Group {
                if secure {
                    SecureField(prompt, text: $text)
                } else {
                    TextField(prompt, text: $text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .textContentType(content)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 50)
    }
}

private struct GuideChoice: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            GuideRow(symbol: symbol, tint: tint, title: title, detail: detail, selected: selected)
                .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .strokeBorder(selected ? GalleryTheme.accent : .clear, lineWidth: 2)
                }
                .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: selected)
    }
}

private struct GuideRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String
    let selected: Bool

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            if selected {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(GalleryTheme.accent)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

private struct GuideFeature: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.system(size: 26, weight: .medium))
                .foregroundStyle(tint)
                .frame(width: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }
}

private struct GuideNote: View {
    let symbol: String
    let tint: Color
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(tint)
                .font(.body.weight(.semibold))
            Text(text)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

private struct GuideStepLine: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Text("\(number)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(GalleryTheme.accent.gradient, in: Circle())
            Text(text)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

private struct GuideTip: View {
    let title: String
    let lines: [String]
    @State private var open = false

    var body: some View {
        GuideGroup {
            DisclosureGroup(isExpanded: $open) {
                VStack(spacing: 0) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { offset, line in
                        GuideStepLine(number: offset + 1, text: line)
                            .padding(.horizontal, -16)
                    }
                }
                .padding(.top, 4)
            } label: {
                Label(title, systemImage: "lightbulb.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }
}

private struct GuideCheckRow: View {
    let check: GuideCheck
    let idle: String?

    var body: some View {
        Group {
            switch check {
            case .idle:
                if let idle {
                    line("bolt.horizontal.circle", .secondary, idle)
                }
            case .running:
                HStack(spacing: 10) {
                    ProgressView().controlSize(.small)
                    Text("Sprawdzam połączenie…").foregroundStyle(.secondary)
                    Spacer()
                }
            case .ok(let millis):
                line("checkmark.circle.fill", .green, "Serwer odpowiada · \(millis) ms")
            case .auth:
                line("xmark.circle.fill", .red, "Serwer odrzucił login lub hasło.")
            case .unreachable:
                line("exclamationmark.triangle.fill", .orange, "Serwer nie odpowiada. Sprawdź adres i czy WebDAV jest włączony.")
            }
        }
        .font(.subheadline)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(GalleryTheme.snappy, value: check)
    }

    private func line(_ symbol: String, _ tint: Color, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(tint)
            Text(text).foregroundStyle(tint == .secondary ? .secondary : .primary)
            Spacer(minLength: 0)
        }
    }
}
