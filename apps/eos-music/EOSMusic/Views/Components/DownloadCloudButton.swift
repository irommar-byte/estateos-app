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
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: size * 0.92, weight: .medium))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.statusOnline)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Na tym iPhonie — dotknij, aby usunąć lokalną kopię (serwer zostaje)")

            case .onServer:
                // Stonowana chmurka: miękka pastylka zamiast świecącej czerwieni.
                Button(action: onDownload) {
                    Image(systemName: "icloud.fill")
                        .font(.system(size: size * 0.82, weight: .medium))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent.opacity(0.88))
                        .padding(size * 0.24)
                        .background(EOSTheme.accent.opacity(0.1), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Na serwerze EOS — pobierz na ten iPhone")

            case .acquiringServer(let progress):
                Button(action: onCancel) {
                    ServerCloudProgressIcon(progress: progress, size: size)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Zapisuję na serwer (\(Int(progress)) procent) — anuluj")

            case .downloading(let progress):
                let pct = min(100, max(0, progress))
                Button(action: onCancel) {
                    ZStack {
                        ServerCloudProgressIcon(progress: pct, size: size)
                        Image(systemName: "arrow.down")
                            .font(.system(size: size * 0.28, weight: .bold))
                            .foregroundStyle(.white)
                            .offset(y: size * 0.06)
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

    private var state: TrackDownloadUIState {
        app.downloads.uiState(
            for: track.url,
            isOnServer: app.isOnServer(track.url)
        )
    }

    var body: some View {
        Group {
            switch state {
            case .idle:
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    app.queuePlus(track, preferredFolderId: folderId)
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: size, weight: .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent)
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

            case .onServer, .acquiringServer, .downloading, .done:
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

    private func downloadToDevice() async {
        do {
            try await app.downloadToDevice(track, preferredFolderId: folderId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Chmurka wypełnia się kolorem w miarę progressu i „oddycha” (mruga) podczas zapisu.
struct ServerCloudProgressIcon: View {
    let progress: Double
    var size: CGFloat = 22
    var animateBreath: Bool = true

    @State private var pulse = false

    private var pct: Double { min(100, max(0, progress)) / 100 }

    var body: some View {
        ZStack {
            Image(systemName: "icloud")
                .font(.system(size: size, weight: .regular))
                .foregroundStyle(EOSTheme.textMuted.opacity(0.35))

            Image(systemName: "icloud.fill")
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(EOSTheme.accent)
                .mask(alignment: .bottom) {
                    Rectangle()
                        .frame(height: max(1, size * pct))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
        }
        .frame(width: size + 4, height: size + 2)
        .opacity(animateBreath ? (pulse ? 0.55 : 1) : 1)
        .shadow(color: EOSTheme.accent.opacity(0.12 + 0.22 * pct), radius: pulse && animateBreath ? 5 : 3)
        .onAppear {
            guard animateBreath else { return }
            withAnimation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
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
        case .done, .onServer, .acquiringServer, .downloading: return true
        case .idle, .failed: return onServerHint
        }
    }

    private var statusTitle: String {
        switch state {
        case .done:
            return "Na tym iPhonie"
        case .onServer:
            return "Na serwerze EOS"
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
        case .onServer, .acquiringServer, .downloading: return "icloud.fill"
        case .failed: return "exclamationmark.icloud"
        case .idle: return onServerHint ? "icloud.fill" : "dot.radiowaves.left.and.right"
        }
    }

    private var statusColor: Color {
        switch state {
        case .done: return .green
        case .failed: return EOSTheme.accent
        case .idle: return onServerHint ? EOSTheme.accent : EOSTheme.textMuted
        default: return EOSTheme.accent
        }
    }

    private var downloadLabel: String? {
        switch state {
        case .idle, .onServer, .failed: return "Pobierz"
        case .acquiringServer, .downloading: return "Anuluj"
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
                case .acquiringServer, .downloading: onCancel()
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
