import SwiftUI

struct DownloadCloudButton: View {
    let state: TrackDownloadUIState
    /// When true, cloud icon for .idle state shows "waiting for server" instead of "download to device"
    var inLibrary: Bool = false
    var size: CGFloat = 22
    var onDownload: () -> Void = {}
    var onCancel: () -> Void = {}
    var onRemoveOffline: () -> Void = {}

    var body: some View {
        Group {
            switch state {
            case .done:
                Button(action: onRemoveOffline) {
                    EOSDoneBadge(size: size * 0.95)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Na tym iPhonie — dotknij, aby usunąć lokalną kopię (serwer zostaje)")

            case .onServer:
                // Stonowana chmurka: miękka pastylka zamiast świecącej czerwieni.
                Button(action: onDownload) {
                    Image(systemName: "icloud.fill")
                        .font(.system(size: size * 0.86, weight: .semibold))
                        .foregroundStyle(EOSTheme.gradient)
                        .shadow(color: EOSTheme.accent.opacity(0.35), radius: 4, y: 1)
                        .padding(size * 0.2)
                        .background(EOSTheme.accent.opacity(0.08), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Na serwerze EOS — pobierz na ten iPhone")

            case .acquiringServer(let progress):
                Button(action: onCancel) {
                    ServerCloudProgressIcon(progress: progress, size: size)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Zapisuję na serwer (\(Int(progress)) procent) — anuluj")

            case .queuedForServer:
                Button(action: onCancel) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: size * 0.82, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.textSecondary)
                        .padding(size * 0.24)
                        .background(EOSTheme.textMuted.opacity(0.12), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("W kolejce na serwer — anuluj")

            case .downloading(let progress):
                let pct = min(100, max(0, progress))
                Button(action: onCancel) {
                    ZStack {
                        ServerCloudProgressIcon(progress: pct, size: size, animateBreath: false, toDevice: true)
                        Image(systemName: "arrow.down")
                            .font(.system(size: size * 0.28, weight: .heavy))
                            .foregroundStyle(.white)
                            .offset(y: size * 0.04)
                            .shadow(color: .black.opacity(0.25), radius: 1)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pobieranie na iPhone (\(Int(pct)) procent) — anuluj")

            case .failed:
                Button(action: onDownload) {
                    Image(systemName: "exclamationmark.icloud")
                        .font(.system(size: size * 0.9))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Błąd pobierania — spróbuj ponownie")

            case .idle:
                if inLibrary {
                    // Track is in library but server hasn't acquired it yet — show waiting indicator
                    Image(systemName: "icloud.and.arrow.down")
                        .font(.system(size: size * 0.82, weight: .medium))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.textMuted.opacity(0.5))
                        .padding(size * 0.24)
                        .accessibilityLabel("Oczekuje na serwer")
                } else {
                    Button(action: onDownload) {
                        Image(systemName: "icloud.and.arrow.down")
                            .font(.system(size: size * 0.82, weight: .medium))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(EOSTheme.accentSecondary.opacity(0.9))
                            .padding(size * 0.24)
                            .background(EOSTheme.accentSecondary.opacity(0.09), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Pobierz na ten iPhone")
                }
            }
        }
        .animation(EOSMotion.snappy, value: state.isBusy)
    }
}

/// Canonical per-track storage action:
/// + = add/ensure durable server copy, cloud = download server copy to this device.
struct TrackStorageActionButton: View {
    @EnvironmentObject private var app: AppModel

    let track: MusicTrackPayload
    var folderId: String? = nil
    var size: CGFloat = 20
    var frameSize: CGFloat = 34

    @State private var errorMessage: String?
    @State private var burst = 0
    @State private var successTick = 0
    @State private var lastKey = ""

    /// Krótki klucz stanu — przejścia i efekty zależą tylko od zmiany etapu, nie od każdego %.
    private func stageKey(_ state: TrackDownloadUIState) -> String {
        switch state {
        case .idle: return "idle"
        case .failed: return "failed"
        case .queuedForServer: return "queued"
        case .acquiringServer: return "acquiring"
        case .onServer: return "server"
        case .downloading: return "downloading"
        case .done: return "done"
        }
    }

    private func stageTransition(_ key: String) -> AnyTransition {
        // Pobieranie na iPhone ↔ gotowe: obrót 3D jak karta (chmurka → zielony ptaszek).
        if key == "downloading" || key == "done" {
            return .asymmetric(
                insertion: .modifier(active: EOSFlip3D(angle: -90, opacity: 0), identity: EOSFlip3D(angle: 0, opacity: 1)),
                removal: .modifier(active: EOSFlip3D(angle: 90, opacity: 0), identity: EOSFlip3D(angle: 0, opacity: 1))
            )
        }
        return .asymmetric(
            insertion: .scale(scale: 0.35).combined(with: .opacity),
            removal: .scale(scale: 1.35).combined(with: .opacity)
        )
    }

    private var state: TrackDownloadUIState {
        app.downloads.uiState(
            for: track.url,
            isOnServer: app.isOnServer(track.url)
        )
    }

    var body: some View {
        let key = stageKey(state)
        ZStack {
            content
                .id(key)
                .transition(stageTransition(key))
            // Rozbłysk pierścienia, gdy utwór trafi na serwer albo na iPhone'a.
            BurstRing(trigger: burst, size: frameSize)
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.68), value: key)
        .sensoryFeedback(.success, trigger: successTick)
        .onChange(of: key) { old, new in
            if (new == "server" && (old == "acquiring" || old == "queued"))
                || (new == "done" && old == "downloading") {
                burst += 1
                successTick += 1
            }
        }
        .alert(
            "Błąd",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    @ViewBuilder
    private var content: some View {
        Group {
            switch state {
            case .idle:
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    app.queuePlus(track, preferredFolderId: folderId)
                } label: {
                    ZStack {
                        Circle()
                            .strokeBorder(EOSTheme.gradient, lineWidth: 1.6)
                            .frame(width: size * 1.05, height: size * 1.05)
                        Image(systemName: "plus")
                            .font(.system(size: size * 0.5, weight: .bold))
                            .foregroundStyle(EOSTheme.gradient)
                    }
                    .frame(width: frameSize, height: frameSize)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(app.isOfflinePlaybackActive)
                .accessibilityLabel("Dodaj na serwer EOS")

            case .failed:
                // Keep a distinct cloud error — do not flicker back to "+".
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    app.queuePlus(track, preferredFolderId: folderId)
                } label: {
                    Image(systemName: "exclamationmark.icloud.fill")
                        .font(.system(size: size, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent)
                        .frame(width: frameSize, height: frameSize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(app.isOfflinePlaybackActive)
                .accessibilityLabel("Zapis na serwer nie udał się — spróbuj ponownie")

            case .onServer, .acquiringServer, .queuedForServer, .downloading, .done:
                DownloadCloudButton(
                    state: state,
                    inLibrary: app.isInLibrary(track.url),
                    size: size,
                    onDownload: {
                        Task { await downloadToDevice() }
                    },
                    onCancel: {
                        app.cancelDownload(for: track.url)
                    },
                    onRemoveOffline: {
                        app.removeOfflineDownload(for: track.url)
                    }
                )
                .frame(width: frameSize, height: frameSize)
            }
        }
    }

    private func downloadToDevice() async {
        do {
            try await app.downloadToDevice(track, preferredFolderId: folderId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Chmurka napełnia się gradientem jak płyn (zapis na serwer: kolory EOS, na iPhone: zieleń),
/// a pierścień wokół pokazuje dokładny postęp.
struct ServerCloudProgressIcon: View {
    let progress: Double
    var size: CGFloat = 22
    var animateBreath: Bool = true
    var toDevice: Bool = false

    @State private var shimmer = false

    private var pct: Double { min(100, max(0, progress)) / 100 }
    private var fill: LinearGradient {
        toDevice
            ? LinearGradient(colors: [Color(red: 0.2, green: 0.86, blue: 0.5), Color(red: 0.05, green: 0.6, blue: 0.32)], startPoint: .top, endPoint: .bottom)
            : LinearGradient(colors: [EOSTheme.accent, EOSTheme.accentSecondary], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.primary.opacity(0.08), lineWidth: 1.6)
            Circle()
                .trim(from: 0, to: pct)
                .stroke(fill, style: StrokeStyle(lineWidth: 1.8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            ZStack {
                Image(systemName: "icloud")
                    .font(.system(size: size * 0.62, weight: .semibold))
                    .foregroundStyle(EOSTheme.textMuted.opacity(0.45))
                Image(systemName: "icloud.fill")
                    .font(.system(size: size * 0.62, weight: .semibold))
                    .foregroundStyle(fill)
                    .mask(alignment: .bottom) {
                        Rectangle()
                            .frame(height: max(1, size * 0.62 * pct))
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                    }
                    .shadow(color: (toDevice ? Color.green : EOSTheme.accent).opacity(shimmer ? 0.45 : 0.15), radius: shimmer ? 4 : 2)
            }
        }
        .frame(width: size + 6, height: size + 6)
        .animation(.spring(response: 0.6, dampingFraction: 0.85), value: pct)
        .onAppear {
            guard animateBreath else { return }
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { shimmer = true }
        }
    }
}

/// Znaczek „na tym iPhonie”: wypukły zielony krążek z odblaskiem i grubym ptaszkiem.
struct EOSDoneBadge: View {
    var size: CGFloat = 22

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color(red: 0.32, green: 0.9, blue: 0.55), Color(red: 0.05, green: 0.62, blue: 0.33)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            // Odblask na górze — efekt szkliwa.
            Ellipse()
                .fill(LinearGradient(colors: [Color.white.opacity(0.55), .clear], startPoint: .top, endPoint: .bottom))
                .frame(width: size * 0.7, height: size * 0.38)
                .offset(y: -size * 0.2)
            Image(systemName: "checkmark")
                .font(.system(size: size * 0.46, weight: .black))
                .foregroundStyle(.white)
                .shadow(color: Color(red: 0, green: 0.35, blue: 0.15).opacity(0.5), radius: 0.5, y: 0.8)
        }
        .frame(width: size, height: size)
        .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 0.6))
        .shadow(color: Color.green.opacity(0.35), radius: 4, y: 2)
        .accessibilityHidden(true)
    }
}

/// Przejście 3D: element obraca się wokół osi Y jak karta.
struct EOSFlip3D: ViewModifier {
    let angle: Double
    let opacity: Double
    func body(content: Content) -> some View {
        content
            .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .opacity(opacity)
    }
}

// MARK: - Apple Music–style mini toast

/// Player chips: where the track lives + one-tap download.
struct PlayerStorageStatusBar: View {
    let state: TrackDownloadUIState
    var onServerHint: Bool = false
    var layout: Layout = .horizontal
    var onDownload: () -> Void = {}
    var onCancel: () -> Void = {}
    var onRemoveOffline: () -> Void = {}

    enum Layout { case horizontal, compact }

    private var showsServerChip: Bool {
        switch state {
        case .done, .onServer, .acquiringServer, .queuedForServer, .downloading: return true
        case .idle, .failed: return onServerHint
        }
    }

    private var statusTitle: String {
        switch state {
        case .done:
            return "Na tym iPhonie"
        case .onServer:
            return "Na serwerze EOS"
        case .queuedForServer:
            return "W kolejce…"
        case .acquiringServer:
            return "Zapisuję na serwerze…"
        case .downloading(let progress):
            return "Pobieranie \(Int(progress))%"
        case .failed:
            return "Błąd pobierania"
        case .idle:
            return onServerHint ? "Na serwerze EOS" : "Tylko stream"
        }
    }

    private var statusIcon: String {
        switch state {
        case .done: return "iphone"
        case .queuedForServer: return "clock.fill"
        case .onServer, .acquiringServer, .downloading: return "icloud.fill"
        case .failed: return "exclamationmark.icloud"
        case .idle: return onServerHint ? "icloud.fill" : "dot.radiowaves.left.and.right"
        }
    }

    private var statusColor: Color {
        switch state {
        case .done: return .green
        case .failed: return EOSTheme.accent
        case .queuedForServer: return EOSTheme.textSecondary
        case .idle: return onServerHint ? EOSTheme.accent : EOSTheme.textMuted
        default: return EOSTheme.accent
        }
    }

    private var downloadLabel: String? {
        switch state {
        case .idle, .onServer, .failed: return "Pobierz"
        case .queuedForServer, .acquiringServer, .downloading: return "Anuluj"
        case .done: return nil
        }
    }

    var body: some View {
        Group {
            if layout == .compact {
                compactBody
            } else {
                horizontalBody
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var horizontalBody: some View {
        HStack(spacing: 8) {
            statusChip
            if case .done = state, showsServerChip {
                serverChip
            }
            Spacer(minLength: 4)
            actionControl
        }
    }

    private var compactBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                statusChip
                if case .done = state, showsServerChip {
                    serverChip
                }
            }
            actionControl
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var actionControl: some View {
        if let label = downloadLabel {
            Button {
                switch state {
                case .queuedForServer, .acquiringServer, .downloading: onCancel()
                default: onDownload()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: state.isBusy ? "xmark" : "arrow.down.to.line")
                        .font(.caption.weight(.bold))
                    Text(label)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, layout == .compact ? 14 : 12)
                .padding(.vertical, 8)
                .frame(maxWidth: layout == .compact ? .infinity : nil, alignment: .center)
                .background(EOSTheme.accent, in: Capsule())
            }
            .buttonStyle(.plain)
        } else {
            Button(action: onRemoveOffline) {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.body.weight(.semibold))
                    Text("Na iPhonie")
                        .font(.caption.weight(.semibold))
                }
                .foregroundStyle(.green)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: layout == .compact ? .infinity : nil)
                .background(.ultraThinMaterial, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Na iPhonie — usuń lokalną kopię")
        }
    }

    private var statusChip: some View {
        HStack(spacing: 6) {
            Image(systemName: statusIcon)
                .font(.caption.weight(.semibold))
            Text(statusTitle)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .foregroundStyle(statusColor)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(statusColor.opacity(0.12), in: Capsule())
    }

    private var serverChip: some View {
        HStack(spacing: 4) {
            Image(systemName: "icloud.fill")
                .font(.caption2.weight(.semibold))
            Text("Serwer")
                .font(.caption2.weight(.semibold))
        }
        .foregroundStyle(EOSTheme.accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(EOSTheme.accent.opacity(0.12), in: Capsule())
    }
}

struct MusicToast: Identifiable, Equatable {
    let id = UUID()
    let systemImage: String
    let title: String
    let subtitle: String?

    static func addedToLibrary(trackTitle: String) -> MusicToast {
        MusicToast(
            systemImage: "plus.circle.fill",
            title: "Dodano do biblioteki",
            subtitle: trackTitle
        )
    }

    static func addedToPlaylist(trackTitle: String, playlist: String) -> MusicToast {
        MusicToast(
            systemImage: "text.badge.plus",
            title: "Dodano do playlisty",
            subtitle: "„\(trackTitle)” → \(playlist)"
        )
    }

    static func savedOnServer(trackTitle: String) -> MusicToast {
        MusicToast(
            systemImage: "icloud.fill",
            title: "Zapisano na serwerze",
            subtitle: trackTitle
        )
    }

    static func offlineUnavailable(trackTitle: String) -> MusicToast {
        MusicToast(
            systemImage: "airplane",
            title: "Niedostępne offline",
            subtitle: "„\(trackTitle)” nie jest pobrany na to urządzenie"
        )
    }
}

struct MusicToastBanner: View {
    let toast: MusicToast

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: toast.systemImage)
                .font(.title3.weight(.semibold))
                .foregroundStyle(EOSTheme.accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                if let subtitle = toast.subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
        .padding(.horizontal, 16)
    }
}


/// Pierścień światła rozchodzący się po zakończeniu zapisu (serwer / iPhone).
private struct BurstRing: View {
    let trigger: Int
    let size: CGFloat
    @State private var progress: CGFloat = 1

    var body: some View {
        Circle()
            .stroke(
                AngularGradient(colors: [EOSTheme.accent, EOSTheme.accentSecondary, EOSTheme.accent], center: .center),
                lineWidth: 2.5 * (1 - progress) + 0.5
            )
            .frame(width: size * 0.8, height: size * 0.8)
            .scaleEffect(0.7 + progress * 0.9)
            .opacity(Double(1 - progress))
            .allowsHitTesting(false)
            .onChange(of: trigger) { _, _ in
                progress = 0
                withAnimation(.easeOut(duration: 0.6)) { progress = 1 }
            }
    }
}
