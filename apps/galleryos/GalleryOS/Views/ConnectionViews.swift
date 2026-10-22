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

    private var connected: Bool {
        if case .connected = phase { return true }
        return false
    }

    /// A small glass disc with a fine rim: green house at home, blue globe away. Calm like the
    /// system bar: nothing moves except the symbol itself (SF Symbols effects never shift layout).
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 11, weight: .semibold))
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(tint)
            .symbolEffect(.variableColor.iterative.reversing, options: .repeating, isActive: connecting)
            .contentTransition(.symbolEffect(.replace))
            .frame(width: 23, height: 23)
            .background(JewelDisc(tint: tint))
            .frame(height: 28)
    }
}

/// Glass disc: a soft gradient, a hairline metallic rim and a highlight at the top. Static.
struct JewelDisc: View {
    let tint: Color

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [tint.opacity(0.3), tint.opacity(0.08)], center: UnitPoint(x: 0.4, y: 0.25), startRadius: 0, endRadius: 16))
            Circle()
                .strokeBorder(
                    LinearGradient(colors: [.white.opacity(0.55), tint.opacity(0.45), tint.opacity(0.2)], startPoint: .top, endPoint: .bottom),
                    lineWidth: 0.8
                )
            Ellipse()
                .fill(LinearGradient(colors: [.white.opacity(0.28), .clear], startPoint: .top, endPoint: .bottom))
                .frame(width: 13, height: 6)
                .offset(y: -6.5)
        }
        .allowsHitTesting(false)
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
                    title: L("Sieć domowa"),
                    address: localTitle.isEmpty ? L("Nie zapisano") : localTitle,
                    symbol: "house.fill",
                    tint: LinkRoute.home.tint,
                    active: link.route == .home,
                    probe: link.home
                )
                Divider().padding(.leading, 44)
                RouteRow(
                    title: L("Zdalnie · DDNS"),
                    address: remoteHost.isEmpty ? L("Nie ustawiono") : remoteHost,
                    symbol: "globe",
                    tint: LinkRoute.remote.tint,
                    active: link.route == .remote,
                    probe: link.remote
                )
            }
            Picker(L("Trasa"), selection: Binding(
                get: { linkMode },
                set: { value in
                    UISelectionFeedbackGenerator().selectionChanged()
                    linkMode = value
                    ServerLink.shared.reset()
                    Task { _ = try? await LibraryEngine.shared.connect() }
                }
            )) {
                Text(L("Automatycznie")).tag(LinkMode.auto.rawValue)
                Text(L("Dom")).tag(LinkMode.home.rawValue)
                Text(L("Zdalnie")).tag(LinkMode.remote.rawValue)
            }
            .pickerStyle(.segmented)
            HStack(spacing: 10) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    Task { await link.probeAll() }
                } label: {
                    Label(L("Sprawdź"), systemImage: "bolt.horizontal")
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
                                Text(link.learning ? L("Szukam…") : L("Wykryj w domu"))
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .galleryGlassButton()
                        .disabled(link.learning || !link.network.isLocal)
                    } else {
                        Menu {
                            Button(L("Zapomnij sieć domową"), systemImage: "house.slash", role: .destructive) {
                                link.forgetHome()
                                settings = DestinationSettings.load()
                            }
                        } label: {
                            Label(L("Dom"), systemImage: "ellipsis")
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
        case .idle: L("Brak serwera")
        case .connecting(let route): route == .none ? L("Łączę z serwerem…") : L("Łączę · \(route.title)…")
        case .connected(.home): L("Połączono w sieci domowej")
        case .connected(.remote): L("Połączono zdalnie")
        case .connected: L("Połączono")
        case .offline: L("Brak sieci")
        case .unreachable(let message): message
        }
    }

    private var networkLine: String {
        var parts = [link.network.title]
        if link.network.isLocal {
            parts.append(link.onKnownHomeNetwork ? L("rozpoznana sieć domowa") : L("inna sieć"))
        }
        if linkMode != LinkMode.auto.rawValue {
            parts.append(linkMode == LinkMode.home.rawValue ? L("tylko dom") : L("tylko zdalnie"))
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
                        Text(L("AKTYWNE"))
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

/// The two roads to the server side by side. The one in use is lit; each shows its last ping.
struct RouteStrip: View {
    @ObservedObject private var link = ServerLink.shared
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
        HStack(spacing: 10) {
            RouteTile(
                title: L("Dom"),
                address: localTitle.isEmpty ? L("nie zapisano") : localTitle,
                route: .home,
                active: link.route == .home,
                probe: link.home
            )
            RouteTile(
                title: L("Zdalnie"),
                address: remoteHost.isEmpty ? L("nie ustawiono") : remoteHost,
                route: .remote,
                active: link.route == .remote,
                probe: link.remote
            )
        }
        .onReceive(link.$phase) { _ in settings = DestinationSettings.load() }
        .task { await link.probeAll() }
    }
}

private struct RouteTile: View {
    let title: String
    let address: String
    let route: LinkRoute
    let active: Bool
    let probe: LinkProbe

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: route.symbol)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(active ? .white : route.tint)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(active ? .white : .primary)
                Spacer(minLength: 4)
                state
            }
            Text(address)
                .font(.caption2)
                .foregroundStyle(active ? .white.opacity(0.85) : .secondary)
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(active ? AnyShapeStyle(route.tint.gradient) : AnyShapeStyle(Color.secondary.opacity(0.12)))
        )
        .animation(GalleryTheme.snappy, value: active)
        .animation(GalleryTheme.snappy, value: probe)
        .accessibilityElement(children: .combine)
        .accessibilityValue(active ? L("w użyciu") : "")
    }

    @ViewBuilder
    private var state: some View {
        if probe.checking {
            ProgressView().controlSize(.mini)
        } else if let reachable = probe.reachable {
            if reachable, let millis = probe.millis {
                Text("\(millis) ms")
                    .font(.caption2.monospacedDigit().weight(.semibold))
                    .foregroundStyle(active ? .white.opacity(0.9) : .secondary)
            } else if !reachable {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(active ? .white : Color(red: 1.0, green: 0.27, blue: 0.23))
            }
        }
    }
}
