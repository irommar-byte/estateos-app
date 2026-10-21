import SwiftUI

/// Toolbar glyph for the live route: house at home, globe over DDNS, radio waves while searching.
struct RouteGlyph: View {
    let phase: LinkPhase

    private var symbol: String {
        switch phase {
        case .idle: "server.rack"
        case .connecting(let route): route == .none ? "dot.radiowaves.left.and.right" : route.symbol
        case .connected(let route): route.symbol
        case .offline: "wifi.slash"
        case .unreachable: "exclamationmark.icloud"
        }
    }

    private var tint: Color {
        switch phase {
        case .idle, .offline: .secondary
        case .connecting: LinkRoute.none.tint
        case .connected(let route): route.tint
        case .unreachable: Color(red: 1.0, green: 0.27, blue: 0.23)
        }
    }

    private var connecting: Bool {
        if case .connecting = phase { return true }
        return false
    }

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(tint)
            .symbolEffect(.variableColor.iterative.reversing, options: .repeating, isActive: connecting)
            .contentTransition(.symbolEffect(.replace.magic(fallback: .downUp.byLayer)))
            .frame(width: 22, height: 28)
            .animation(GalleryTheme.snappy, value: phase)
    }
}

/// Dynamic-Island style pill that drops in when the phone moves between home LAN and DDNS.
struct LinkAnnouncementBanner: View {
    @ObservedObject private var link = ServerLink.shared

    var body: some View {
        ZStack {
            if let note = link.announcement {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill((note.tint ?? note.route.tint).gradient)
                        Image(systemName: note.symbol ?? note.route.symbol)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .symbolEffect(.bounce, value: note.id)
                    }
                    .frame(width: 34, height: 34)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(note.title)
                            .font(.subheadline.weight(.semibold))
                        Text(note.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.leading, 8)
                .padding(.trailing, 18)
                .padding(.vertical, 8)
                .frame(maxWidth: 340)
                .galleryGlass(in: Capsule())
                .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
                .padding(.horizontal, 24)
                .transition(
                    .asymmetric(
                        insertion: .move(edge: .top).combined(with: .scale(scale: 0.6, anchor: .top)).combined(with: .opacity),
                        removal: .move(edge: .top).combined(with: .opacity)
                    )
                )
                .id(note.id)
                .onTapGesture { dismiss() }
                .task(id: note.id) {
                    try? await Task.sleep(for: .seconds(2.8))
                    dismiss()
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }

    private func dismiss() {
        withAnimation(.spring(response: 0.36, dampingFraction: 0.9)) {
            link.announcement = nil
        }
    }
}

/// The route diagram and both paths to the server, shown in the sync panel.
struct ConnectionCard: View {
    @ObservedObject private var link = ServerLink.shared
    @AppStorage("galleryos.link.mode") private var linkMode = LinkMode.auto.rawValue
    @State private var settings = DestinationSettings.load()

    private var remoteHost: String {
        settings.remoteHost.isEmpty ? (GalleryNetwork.isLocalHost(settings.host) ? "" : settings.host) : settings.remoteHost
    }

    private var localTitle: String {
        if !settings.localName.isEmpty { return settings.localName }
        if !settings.localHost.isEmpty { return settings.localHost }
        if GalleryNetwork.isLocalHost(settings.host) { return settings.host }
        return ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            RouteDiagram(phase: link.phase)
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 3) {
                Text(headline)
                    .font(.headline)
                    .contentTransition(.opacity)
                HStack(spacing: 6) {
                    Image(systemName: link.network.symbol)
                    Text(networkLine)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            VStack(spacing: 0) {
                RouteRow(
                    title: "Sieć domowa",
                    address: localTitle.isEmpty ? "Nie zapisano" : localTitle,
                    symbol: "house.fill",
                    tint: LinkRoute.home.tint,
                    active: link.route == .home,
                    probe: link.home
                )
                Divider().padding(.leading, 44)
                RouteRow(
                    title: "Zdalnie · DDNS",
                    address: remoteHost.isEmpty ? "Nie ustawiono" : remoteHost,
                    symbol: "globe",
                    tint: LinkRoute.remote.tint,
                    active: link.route == .remote,
                    probe: link.remote
                )
            }
            Picker("Trasa", selection: Binding(
                get: { linkMode },
                set: { value in
                    UISelectionFeedbackGenerator().selectionChanged()
                    linkMode = value
                    ServerLink.shared.reset()
                    Task { _ = try? await LibraryEngine.shared.connect() }
                }
            )) {
                Text("Automatycznie").tag(LinkMode.auto.rawValue)
                Text("Dom").tag(LinkMode.home.rawValue)
                Text("Zdalnie").tag(LinkMode.remote.rawValue)
            }
            .pickerStyle(.segmented)
            HStack(spacing: 10) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    Task { await link.probeAll() }
                } label: {
                    Label("Sprawdź", systemImage: "bolt.horizontal")
                        .frame(maxWidth: .infinity)
                }
                .galleryGlassButton()
                if settings.kind == DestinationKind.webdav {
                    if localTitle.isEmpty {
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            link.learnHomeIfNeeded(force: true)
                        } label: {
                            HStack(spacing: 6) {
                                if link.learning {
                                    ProgressView().controlSize(.small)
                                } else {
                                    Image(systemName: "dot.radiowaves.left.and.right")
                                }
                                Text(link.learning ? "Szukam…" : "Wykryj w domu")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .galleryGlassButton()
                        .disabled(link.learning || !link.network.isLocal)
                    } else {
                        Menu {
                            Button("Zapomnij sieć domową", systemImage: "house.slash", role: .destructive) {
                                link.forgetHome()
                                settings = DestinationSettings.load()
                            }
                        } label: {
                            Label("Dom", systemImage: "ellipsis")
                                .frame(maxWidth: .infinity)
                        }
                        .galleryGlassButton()
                    }
                }
            }
            .font(.subheadline.weight(.semibold))
        }
        .onReceive(link.$phase) { _ in settings = DestinationSettings.load() }
        .onReceive(link.$learning) { _ in settings = DestinationSettings.load() }
        .task { await link.probeAll() }
    }

    private var headline: String {
        switch link.phase {
        case .idle: "Brak serwera"
        case .connecting(let route): route == .none ? "Łączę z serwerem…" : "Łączę · \(route.title)…"
        case .connected(.home): "Połączono w sieci domowej"
        case .connected(.remote): "Połączono zdalnie"
        case .connected: "Połączono"
        case .offline: "Brak sieci"
        case .unreachable(let message): message
        }
    }

    private var networkLine: String {
        var parts = [link.network.title]
        if link.network.isLocal {
            parts.append(link.onKnownHomeNetwork ? "rozpoznana sieć domowa" : "inna sieć")
        }
        if linkMode != LinkMode.auto.rawValue {
            parts.append(linkMode == LinkMode.home.rawValue ? "tylko dom" : "tylko zdalnie")
        }
        return parts.joined(separator: " · ")
    }
}

private struct RouteRow: View {
    let title: String
    let address: String
    let symbol: String
    let tint: Color
    let active: Bool
    let probe: LinkProbe

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .opacity(active ? 1 : 0.55)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(title).font(.subheadline.weight(.semibold))
                    if active {
                        Text("AKTYWNE")
                            .font(.system(size: 9, weight: .heavy))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(tint.opacity(0.18), in: Capsule())
                            .foregroundStyle(tint)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                Text(address)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            status
        }
        .padding(.vertical, 8)
        .animation(GalleryTheme.snappy, value: active)
        .animation(GalleryTheme.snappy, value: probe)
    }

    @ViewBuilder
    private var status: some View {
        if probe.checking {
            ProgressView().controlSize(.small)
        } else if let reachable = probe.reachable {
            HStack(spacing: 4) {
                if reachable, let millis = probe.millis {
                    Text("\(millis) ms")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                Image(systemName: reachable ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(reachable ? LinkRoute.home.tint : Color(red: 1.0, green: 0.27, blue: 0.23))
                    .symbolEffect(.bounce, value: reachable)
            }
            .transition(.scale.combined(with: .opacity))
        }
    }
}

/// iPhone ─ route ─ server with a travelling pulse while the link is being negotiated.
private struct RouteDiagram: View {
    let phase: LinkPhase

    private var route: LinkRoute {
        switch phase {
        case .connected(let route), .connecting(let route): route
        default: .none
        }
    }

    private var live: Bool {
        if case .connected = phase { return true }
        return false
    }

    private var connecting: Bool {
        if case .connecting = phase { return true }
        return false
    }

    private var tint: Color {
        switch phase {
        case .connected(let route): route.tint
        case .connecting: LinkRoute.none.tint
        case .unreachable: Color(red: 1.0, green: 0.27, blue: 0.23)
        default: .secondary
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            node("iphone", tint: .primary)
            Connector(tint: tint, live: live, flowing: connecting || live)
            ZStack {
                Circle()
                    .fill(tint.opacity(0.16))
                    .frame(width: 58, height: 58)
                    .scaleEffect(connecting ? 1.18 : 1)
                    .opacity(connecting ? 0.4 : 1)
                    .animation(connecting ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true) : GalleryTheme.snappy, value: connecting)
                Image(systemName: route == .none ? (live ? "checkmark" : "dot.radiowaves.left.and.right") : route.symbol)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(tint)
                    .symbolEffect(.variableColor.iterative, options: .repeating, isActive: connecting && route == .none)
                    .contentTransition(.symbolEffect(.replace.magic(fallback: .downUp.byLayer)))
            }
            Connector(tint: tint, live: live, flowing: live)
            node("server.rack", tint: live ? tint : .secondary)
        }
        .animation(GalleryTheme.snappy, value: phase)
    }

    private func node(_ symbol: String, tint: Color) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 46, height: 46)
            .galleryGlass(in: Circle())
    }
}

private struct Connector: View {
    let tint: Color
    let live: Bool
    let flowing: Bool

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(live ? tint.opacity(0.55) : Color.secondary.opacity(0.22))
                    .frame(height: 3)
                if flowing {
                    TimelineView(.animation) { context in
                        let t = context.date.timeIntervalSinceReferenceDate
                        let fraction = CGFloat(t.truncatingRemainder(dividingBy: 1.1) / 1.1)
                        Circle()
                            .fill(tint)
                            .frame(width: 7, height: 7)
                            .shadow(color: tint.opacity(0.8), radius: 4)
                            .offset(x: fraction * max(proxy.size.width - 7, 0))
                    }
                    .transition(.opacity)
                }
            }
            .frame(maxHeight: .infinity)
        }
        .frame(height: 46)
        .padding(.horizontal, 6)
    }
}
