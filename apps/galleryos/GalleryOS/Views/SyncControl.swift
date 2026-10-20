import SwiftUI

enum SyncLight: Equatable {
    case off
    case working
    case waiting
    case ok
    case error

    static func resolve(status: SyncStatus, uploads: Bool, connected: Bool, online: Bool) -> SyncLight {
        guard connected else { return .off }
        if status.busy { return .working }
        if status.visible, status.title == "Wstrzymano" {
            return status.detail.hasPrefix("Czeka") ? .waiting : .error
        }
        if !uploads { return .off }
        if !online { return .error }
        return .ok
    }

    var color: Color {
        switch self {
        case .off: Color.secondary
        case .working, .waiting: Color(red: 1.0, green: 0.78, blue: 0.16)
        case .ok: Color(red: 0.2, green: 0.84, blue: 0.42)
        case .error: Color(red: 1.0, green: 0.27, blue: 0.23)
        }
    }

    var headline: String {
        switch self {
        case .off: "Synchronizacja wyłączona"
        case .working: "Synchronizuję"
        case .waiting: "Czekam"
        case .ok: "Wszystko aktualne"
        case .error: "Wymaga uwagi"
        }
    }

    var symbol: String {
        switch self {
        case .ok: "checkmark"
        case .error: "exclamationmark"
        case .waiting: "pause.fill"
        case .off: "moon.zzz.fill"
        case .working: "arrow.triangle.2.circlepath"
        }
    }
}

/// Small arrows glyph that lives in the navigation bar: spins and breathes amber while syncing,
/// settles green when everything is on the server, turns red when something needs attention.
struct SyncGlyph: View {
    let light: SyncLight
    var progress: Double?

    var body: some View {
        ZStack {
            if light == .working {
                Circle()
                    .stroke(light.color.opacity(0.18), lineWidth: 2)
                Circle()
                    .trim(from: 0, to: max(0.04, progress ?? 0.04))
                    .stroke(light.color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.smooth(duration: 0.45), value: progress)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
            Image(systemName: light == .working ? "arrow.up" : "arrow.triangle.2.circlepath")
                .font(.system(size: light == .working ? 11 : 15, weight: .bold))
                .foregroundStyle(light.color)
                .symbolEffect(.bounce, value: light == .ok)
                .symbolEffect(.wiggle, value: light == .error)
                .symbolEffect(.pulse, options: .repeating, isActive: light == .working)
                .contentTransition(.symbolEffect(.replace.magic(fallback: .downUp)))
        }
        .frame(width: 22, height: 22)
        .shadow(color: light == .off ? .clear : light.color.opacity(0.45), radius: 4)
        .animation(GalleryTheme.snappy, value: light)
        .frame(width: 28, height: 28)
        .contentShape(Rectangle())
    }
}

/// Toolbar label. The only part of a screen that redraws on progress ticks.
private struct SyncToolbarLabel: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var feed = SyncFeed.shared
    @ObservedObject private var servers = SavedServerStore.shared
    @ObservedObject private var link = ServerLink.shared
    @AppStorage("galleryos.sync.enabled") private var uploads = true

    var body: some View {
        let light = SyncLight.resolve(
            status: feed.status,
            uploads: uploads,
            connected: library.destinationConnected,
            online: servers.online != nil
        )
        HStack(spacing: 2) {
            if library.destinationConnected {
                RouteGlyph(phase: link.phase)
                    .transition(.scale.combined(with: .opacity))
            }
            SyncGlyph(light: light, progress: feed.status.busy ? feed.status.progress : nil)
        }
        .animation(GalleryTheme.snappy, value: library.destinationConnected)
        .sensoryFeedback(trigger: light) { old, new in
            if old == .working, new == .ok { return .success }
            if old != .error, new == .error { return .warning }
            return nil
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Synchronizacja: \(light.headline), \(link.route.title)")
    }
}

/// Toolbar button + droplet-to-panel zoom. Attach to any screen inside a NavigationStack.
struct SyncControl: ViewModifier {
    var hidden = false
    @EnvironmentObject private var library: PhotoLibrary
    @Namespace private var droplet
    @State private var open = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                if !hidden {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                            open = true
                        } label: {
                            SyncToolbarLabel()
                        }
                    }
                    .matchedTransitionSource(id: "sync.droplet", in: droplet)
                }
            }
            .sheet(isPresented: $open) {
                SyncPanel()
                    .environmentObject(library)
                    .navigationTransition(.zoom(sourceID: "sync.droplet", in: droplet))
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                    .presentationCornerRadius(34)
            }
    }
}

extension View {
    func syncControl(hidden: Bool = false) -> some View {
        modifier(SyncControl(hidden: hidden))
    }
}

/// Full server and pipeline status, opened from the toolbar droplet.
struct SyncPanel: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var feed = SyncFeed.shared
    @ObservedObject private var servers = SavedServerStore.shared
    @AppStorage("galleryos.sync.enabled") private var uploads = true
    @AppStorage("galleryos.sync.wifiOnly") private var wifiOnly = false
    @AppStorage("galleryos.sync.chargingOnly") private var chargingOnly = false
    @AppStorage("galleryos.sync.keepUnlocked") private var keepUnlocked = true
    @State private var freeSpace: String?

    private var status: SyncStatus { feed.status }

    private var light: SyncLight {
        SyncLight.resolve(
            status: status,
            uploads: uploads,
            connected: library.destinationConnected,
            online: servers.online != nil
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    hero
                    controls
                    serverCard
                    numbers
                    sources
                    conditions
                }
                .padding(.horizontal, 18)
                .padding(.bottom, 28)
            }
            .scrollBounceBehavior(.basedOnSize)
            .navigationTitle("Synchronizacja")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(role: .close) { dismiss() }
                }
            }
            .task { LibraryEngine.shared.publishCounts() }
            .task { freeSpace = await library.freeSpaceText() }
            .animation(GalleryTheme.snappy, value: light)
            .animation(GalleryTheme.snappy, value: status)
        }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .stroke(light.color.opacity(0.16), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: ringFraction)
                    .stroke(
                        AngularGradient(colors: [light.color.opacity(0.55), light.color], center: .center),
                        style: StrokeStyle(lineWidth: 10, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(GalleryTheme.spring, value: ringFraction)
                Image(systemName: light.symbol)
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(light.color)
                    .symbolEffect(.rotate.clockwise, options: .repeating, isActive: light == .working)
                    .contentTransition(.symbolEffect(.replace))
            }
            .frame(width: 112, height: 112)
            .shadow(color: light.color.opacity(0.35), radius: 18)
            .padding(.top, 8)

            VStack(spacing: 4) {
                Text(light.headline)
                    .font(.title2.weight(.bold))
                if let progress = status.progress, status.busy {
                    Text("\(Int((progress * 100).rounded())) %")
                        .font(.system(.title3, design: .rounded).weight(.semibold))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: progress))
                        .foregroundStyle(light.color)
                }
                Text(detailLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .contentTransition(.numericText())
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var ringFraction: CGFloat {
        switch light {
        case .working: CGFloat(status.progress ?? 0.12)
        case .ok: 1
        case .error, .waiting: 0.62
        case .off: 0
        }
    }

    private var detailLine: String {
        if !status.detail.isEmpty, status.visible {
            let line = status.title.isEmpty ? status.detail : "\(status.title) · \(status.detail)"
            if keepUnlocked, status.busy { return line + "\nEkran zostaje włączony do 100%." }
            return line
        }
        switch light {
        case .off: return library.destinationConnected ? "Kopiowanie na serwer jest wstrzymane." : "Nie wybrano jeszcze serwera."
        case .ok: return "Każde zdjęcie z tego iPhone’a ma kopię na serwerze."
        default: return ""
        }
    }

    // MARK: Cards

    private var controls: some View {
        PanelCard {
            Toggle(isOn: Binding(
                get: { uploads },
                set: { value in
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                    withAnimation(GalleryTheme.snappy) {
                        uploads = value
                        LibraryEngine.shared.setUploadsEnabled(value)
                    }
                }
            )) {
                PanelLabel("Kopiuj na serwer", symbol: "icloud.and.arrow.up", tint: GalleryTheme.accent)
            }
            .tint(GalleryTheme.accent)
        }
    }

    private var serverCard: some View {
        PanelCard {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.secondary.opacity(0.14))
                    Image(systemName: "server.rack")
                        .font(.system(size: 17, weight: .semibold))
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(servers.online?.title ?? servers.servers.first?.title ?? "Brak serwera")
                        .font(.headline)
                        .lineLimit(1)
                    Text(connectionLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            if library.destinationConnected {
                Divider().padding(.vertical, 2)
                ConnectionCard()
            }
            if tvReady {
                Divider().padding(.vertical, 2)
                AppleTVShareToggle()
            }
        }
    }

    private var connectionLine: String {
        guard servers.online != nil else {
            if let last = servers.servers.first?.lastSeen {
                return "Offline · widziany " + last.formatted(.relative(presentation: .named))
            }
            return "Offline"
        }
        return ServerLink.shared.host.isEmpty ? "Połączony" : "Połączony · \(ServerLink.shared.host)"
    }

    private var tvReady: Bool {
        guard let server = servers.online ?? servers.servers.first else { return false }
        return server.kind == DestinationKind.server || server.kind == DestinationKind.webdav
    }

    private var sources: some View {
        let item = feed.sources
        return PanelCard {
            Text("Skąd jest kolejka")
                .font(.headline)
            SourceLine(symbol: "iphone", tint: GalleryTheme.accent, title: "Z tego iPhone’a",
                       detail: "\(PhotoFormat.count(item.toSend)) · \(ByteText.amount(item.toSendBytes))")
            if item.cloudOriginals > 0 {
                SourceLine(symbol: "icloud", tint: .blue, title: "Oryginał tylko w iCloud",
                           detail: "\(PhotoFormat.count(item.cloudOriginals)) · \(ByteText.amount(item.cloudBytes))")
            }
            SourceLine(symbol: "externaldrive", tint: SyncLight.ok.color, title: "Już na serwerze",
                       detail: "\(PhotoFormat.count(item.alreadyOnServer)) · nie pobieram drugi raz")
            SourceLine(symbol: "square.on.square", tint: .orange, title: "Druga kopia na telefonie",
                       detail: "\(PhotoFormat.count(item.copiesOnPhone)) · pominięte")
            if item.sharedAlbums + item.fromComputer + item.albumOnly > 0 {
                Divider().padding(.vertical, 2)
                Text("Poza kolejką")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                if item.sharedAlbums > 0 {
                    SourceLine(symbol: "person.2", tint: .purple, title: "Album udostępniony",
                               detail: PhotoFormat.count(item.sharedAlbums))
                }
                if item.fromComputer > 0 {
                    SourceLine(symbol: "desktopcomputer", tint: .secondary, title: "Z komputera",
                               detail: PhotoFormat.count(item.fromComputer))
                }
                if item.albumOnly > 0 {
                    SourceLine(symbol: "rectangle.stack", tint: .secondary, title: "Tylko w albumie",
                               detail: PhotoFormat.count(item.albumOnly))
                }
            }
        }
    }

    private var numbers: some View {
        let counts = feed.counts
        let sentBytes = (UserDefaults.standard.object(forKey: "galleryos.bytes-sent") as? NSNumber)?.int64Value ?? 0
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            StatTile(value: "\(counts.sent)", label: "Na serwerze", symbol: "externaldrive.fill", tint: GalleryTheme.accent)
            StatTile(value: "\(counts.waiting)", label: "Czeka", symbol: "clock.fill", tint: SyncLight.waiting.color)
            StatTile(value: ByteText.amount(sentBytes), label: "Wysłano", symbol: "arrow.up.circle.fill", tint: SyncLight.ok.color)
            StatTile(value: freeSpace ?? "…", label: "Wolne miejsce", symbol: "internaldrive.fill", tint: .purple)
        }
    }

    private var conditions: some View {
        PanelCard {
            Toggle(isOn: $wifiOnly) {
                PanelLabel("Tylko Wi-Fi", symbol: "wifi", tint: .blue)
            }
            Divider().padding(.vertical, 2)
            Toggle(isOn: $chargingOnly) {
                PanelLabel("Tylko podczas ładowania", symbol: "bolt.fill", tint: SyncLight.ok.color)
            }
            Divider().padding(.vertical, 2)
            Toggle(isOn: Binding(
                get: { keepUnlocked },
                set: { value in
                    keepUnlocked = value
                    LibraryEngine.shared.refreshHold()
                }
            )) {
                PanelLabel("Nie blokuj do 100%", symbol: "lock.open.fill", tint: .orange)
            }
        }
        .disabled(!uploads)
        .opacity(uploads ? 1 : 0.5)
        .tint(GalleryTheme.accent)
        .onChange(of: wifiOnly) { _, _ in LibraryEngine.shared.kick() }
        .onChange(of: chargingOnly) { _, _ in LibraryEngine.shared.kick() }
    }
}

private struct PanelCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct PanelLabel: View {
    let title: String
    let symbol: String
    let tint: Color

    init(_ title: String, symbol: String, tint: Color) {
        self.title = title
        self.symbol = symbol
        self.tint = tint
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(title)
        }
    }
}

private struct SourceLine: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 22)
            Text(title)
                .font(.subheadline)
            Spacer(minLength: 8)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct StatTile: View {
    let value: String
    let label: String
    let symbol: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(tint)
            Text(value)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
