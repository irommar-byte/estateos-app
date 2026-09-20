import SwiftUI

/// Unoszący się HUD postępu — nie wchodzi w layout zakładek, więc nie szarpie całego ekranu.
struct FloatingDownloadActivityOverlay: View {
    @EnvironmentObject private var app: AppModel
    @State private var isMovieQueueMinimized = true

    private var showsSync: Bool {
        app.librarySyncMessage != nil && !app.isOfflinePlaybackActive
    }

    private var showsMusic: Bool { app.downloads.bulkServerQueue != nil }
    private var showsMovie: Bool { app.movieDownloads.activeBatch != nil }

    var body: some View {
        Group {
            if showsSync || showsMusic || showsMovie {
                VStack(spacing: 8) {
                    if showsSync, let sync = app.librarySyncMessage {
                        LibrarySyncStatusBar(
                            message: sync,
                            showsSpinner: app.isLibraryLoading
                        )
                        .transition(Self.cardTransition)
                    }

                    if let queue = app.downloads.bulkServerQueue {
                        ServerDownloadQueuePanel(
                            queue: queue,
                            isMinimized: Binding(
                                get: { app.downloads.isBulkQueueMinimized },
                                set: { app.downloads.isBulkQueueMinimized = $0 }
                            )
                        ) {
                            app.cancelBulkMusicQueue()
                        }
                        .transition(Self.cardTransition)
                    }

                    if let batch = app.movieDownloads.activeBatch {
                        MovieDownloadQueuePanel(
                            batch: batch,
                            service: app.movieDownloads,
                            isMinimized: $isMovieQueueMinimized
                        )
                        .transition(Self.cardTransition)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .top)
            }
        }
        .animation(EOSMotion.soft, value: showsSync)
        .animation(EOSMotion.soft, value: showsMusic)
        .animation(EOSMotion.soft, value: showsMovie)
        .onChange(of: app.movieDownloads.activeBatch?.id) { _, newId in
            if newId != nil {
                isMovieQueueMinimized = true
            }
        }
    }

    private static var cardTransition: AnyTransition {
        .asymmetric(
            insertion: .opacity
                .combined(with: .offset(y: -8))
                .combined(with: .scale(scale: 0.98, anchor: .top)),
            removal: .opacity
                .combined(with: .offset(y: -6))
                .combined(with: .scale(scale: 0.98, anchor: .top))
        )
    }
}

private struct FloatingActivityChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.07), lineWidth: 0.5)
            }
            .shadow(color: Color.black.opacity(0.16), radius: 18, y: 8)
    }
}

private struct FloatingProgressBar: View {
    let progress: Double
    var height: CGFloat = 3.5

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.primary.opacity(0.08))
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [EOSTheme.accent, EOSTheme.accentSecondary],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(height, geo.size.width * CGFloat(min(1, max(0.02, progress)))))
            }
        }
        .frame(height: height)
        .animation(.easeOut(duration: 0.22), value: progress)
    }
}

/// Kolejka pobierania filmów / seriali EOS™LIBRARY (jak muzyka).
struct MovieDownloadQueuePanel: View {
    let batch: MovieDownloadBatch
    @ObservedObject var service: MovieDownloadService
    @Binding var isMinimized: Bool

    private var destinationBadge: MovieStorageLocationBadge.Kind {
        switch batch.destination {
        case .server:
            return .server
        case .serverAndPhone:
            if service.activeItemPhaseBadge == "iPHONE" {
                return .phone
            }
            return .server
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: isMinimized ? 6 : 10) {
            HStack(alignment: .center, spacing: 8) {
                Button {
                    withAnimation(EOSMotion.snappy) { isMinimized.toggle() }
                } label: {
                    Image(systemName: isMinimized ? "chevron.down.circle.fill" : "chevron.up.circle.fill")
                        .font(.body)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isMinimized ? "Rozwiń kolejkę" : "Zwiń kolejkę")

                VStack(alignment: .leading, spacing: 2) {
                    Text(batch.label)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        MovieStorageLocationBadge(kind: destinationBadge)
                        Text("\(service.completedCount)/\(service.totalCount)")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.secondary)
                        if batch.destination == .serverAndPhone {
                            Text("serwer → iPhone")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer(minLength: 0)
                Text("\(Int((service.overallProgress * 100).rounded()))%")
                    .font(.subheadline.monospacedDigit().weight(.bold))
                    .foregroundStyle(EOSTheme.accent)
                if service.isRunning {
                    Button("Stop", role: .cancel) { service.cancelBatch() }
                        .font(.caption.weight(.semibold))
                } else {
                    Button("OK") { service.clearFinishedBatch() }
                        .font(.caption.weight(.semibold))
                }
            }

            FloatingProgressBar(progress: service.overallProgress)

            if let title = service.activeItemTitle {
                HStack(spacing: 6) {
                    if !isMinimized {
                        ProgressView().controlSize(.mini)
                    }
                    if let badge = service.activeItemPhaseBadge {
                        MovieStorageLocationBadge(kind: badgeKind(from: badge, progress: service.activeItemProgress))
                    }
                    Text(title)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    let detail = service.activeDetailLine
                    if !detail.isEmpty {
                        Text(detail)
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                }
            }

            if let message = service.statusMessage, !service.isRunning {
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if !isMinimized {
                VStack(spacing: 6) {
                    ForEach(batch.items.prefix(6)) { item in
                        itemRow(item)
                    }
                    if batch.items.count > 6 {
                        Text("… i \(batch.items.count - 6) kolejnych")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .modifier(FloatingActivityChrome())
    }

    private func itemRow(_ item: MovieDownloadQueueItem) -> some View {
        HStack(spacing: 8) {
            if let kind = badgeKind(for: item) {
                MovieStorageLocationBadge(kind: kind)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.caption2.weight(.semibold))
                    .lineLimit(1)
                if let pct = item.progressPercent {
                    HStack(spacing: 6) {
                        Text(pct >= 99 ? "Finalizowanie…" : String(format: "%.0f%%", pct))
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(EOSTheme.accent)
                        if item.id == service.activeBatch?.items.first(where: {
                            if case .downloading = $0.state { return true }
                            if case .pullingPhone = $0.state { return true }
                            return false
                        })?.id {
                            if let bytes = service.activeBytesLabel {
                                Text(bytes)
                                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                                    .foregroundStyle(.secondary)
                            }
                            if let eta = service.activeETALabel {
                                Text("· \(eta)")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                } else if case .pullingPhone(let progress) = item.state, progress < 0 {
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.mini)
                        Text(service.activeBytesLabel.map { "Kopiuję · \($0)" } ?? "Kopiuję na urządzenie…")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(EOSTheme.accent)
                    }
                } else if case .done = item.state {
                    Text("Pobrany")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(EOSTheme.accent)
                } else if case .pending = item.state {
                    Text("W kolejce")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                } else if case .queuedOnServer = item.state {
                    Text("Na serwerze EOS")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(EOSTheme.accent.opacity(0.85))
                } else if case .failed(let message) = item.state {
                    Text(message)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.red.opacity(0.88))
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            if case .failed = item.state {
                Button {
                    service.retryItem(id: item.id)
                } label: {
                    Image(systemName: "arrow.clockwise.circle.fill")
                        .font(.body)
                        .foregroundStyle(EOSTheme.accent)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ponów pobieranie")
            } else if canCancel(item) {
                Button {
                    service.cancelItem(id: item.id)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Anuluj pobieranie")
            }
        }
        .padding(.vertical, 2)
    }

    private func canCancel(_ item: MovieDownloadQueueItem) -> Bool {
        guard service.isRunning else { return false }
        switch item.state {
        case .pending, .queuedOnServer, .downloading, .pullingPhone:
            return true
        default:
            return false
        }
    }

    private func badgeKind(for item: MovieDownloadQueueItem) -> MovieStorageLocationBadge.Kind? {
        switch item.state {
        case .downloading(let p):
            let pct = p <= 1 ? p * 100 : p
            return .serverProgress(pct)
        case .pullingPhone(let p):
            let pct = p <= 1 ? p * 100 : p
            return .phoneProgress(pct)
        case .pending:
            return .queue
        case .queuedOnServer:
            return .serverProgress(0)
        case .done:
            return batch.destination == .serverAndPhone ? .phone : .server
        case .skipped:
            return .server
        case .cancelled:
            return .cancelled
        case .failed:
            return .error
        case .idle:
            return nil
        }
    }

    private func badgeKind(from phase: String, progress: Double?) -> MovieStorageLocationBadge.Kind {
        let pct = progress ?? 0
        if phase == "iPHONE" { return .phoneProgress(pct) }
        if phase == "SERWER" { return .serverProgress(pct) }
        return .queue
    }
}

/// Pasek statusu synchronizacji biblioteki (online, w tle).
struct LibrarySyncStatusBar: View {
    let message: String
    var showsSpinner: Bool = true

    var body: some View {
        HStack(spacing: 10) {
            if showsSpinner {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(EOSTheme.accent)
            }
            Text(message)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .modifier(FloatingActivityChrome())
    }
}

/// Kolejka zapisu albumu / playlisty na serwer EOS.
struct ServerDownloadQueuePanel: View {
    let queue: MusicDownloadService.BulkServerQueueProgress
    @Binding var isMinimized: Bool
    var onCancel: (() -> Void)?

    private var phaseTitle: String {
        if queue.destination == .serverAndPhone, queue.phase == .device {
            return "Pobieranie na iPhone"
        }
        return "Zapis na serwer EOS"
    }

    private var countLabel: String {
        if queue.destination == .serverAndPhone, queue.phase == .device {
            return "\(queue.deviceCompleted) z \(max(queue.deviceTotal, 1))"
        }
        return "\(queue.completed) z \(max(queue.total, 1))"
    }

    private var pendingItems: [MusicDownloadService.ServerQueueItem] {
        queue.phase == .device ? queue.devicePending : queue.pending
    }

    var body: some View {
        VStack(alignment: .leading, spacing: isMinimized ? 8 : 10) {
            HStack(spacing: 8) {
                Button {
                    withAnimation(EOSMotion.snappy) { isMinimized.toggle() }
                } label: {
                    Image(systemName: isMinimized ? "chevron.down.circle.fill" : "chevron.up.circle.fill")
                        .font(.body)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isMinimized ? "Rozwiń kolejkę" : "Zwiń kolejkę")

                phasePill
                Spacer(minLength: 6)
                Text("\(Int((queue.overallProgress * 100).rounded()))%")
                    .font(.title3.weight(.semibold).monospacedDigit())
                    .foregroundStyle(EOSTheme.accent)
                    .contentTransition(.numericText())
                Text(DownloadETAFormatter.expanded(queue.etaSeconds ?? Double(max(1, queue.remainingCount)) * 25))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if onCancel != nil {
                    Button("Anuluj", role: .cancel) { onCancel?() }
                        .font(.caption.weight(.semibold))
                }
            }

            FloatingProgressBar(progress: queue.overallProgress, height: 7)
            Text(countLabel)
                .font(.caption2.monospacedDigit().weight(.semibold))
                .foregroundStyle(.secondary)
            if !pendingItems.isEmpty {
                Text("W kolejce \(pendingItems.count)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            ForEach(Array(queue.liveCurrentItems.prefix(2).enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(item.title)
                            .font(.subheadline.weight(.medium))
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Text("\(Int((min(1, max(0, item.progress)) * 100).rounded()))%")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(EOSTheme.accent)
                            .contentTransition(.numericText())
                    }
                    FloatingProgressBar(progress: min(1, max(0, item.progress)), height: 3.5)
                }
            }

            if !isMinimized {
                if queue.destination == .serverAndPhone, queue.phase == .server, queue.deviceTotal > 0 {
                    Text("Potem na iPhone: \(queue.deviceTotal) utworów")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .modifier(FloatingActivityChrome())
    }

    private var phasePill: some View {
        let phone = queue.phase == .device
        return HStack(spacing: 5) {
            Image(systemName: phone ? "iphone" : "externaldrive.fill")
                .font(.caption2.weight(.semibold))
            Text(phone ? "iPhone" : "Serwer")
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(EOSTheme.accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(EOSTheme.accent.opacity(0.14), in: Capsule())
        .accessibilityLabel(phaseTitle)
    }
}

struct PlaybackActivityLine: View {
    let activity: PlaybackActivitySnapshot
    var compact: Bool = false

    var body: some View {
        if activity.phase != .idle && activity.phase != .playing {
            HStack(spacing: 8) {
                if activity.phase.showsSpinner {
                    ProgressView()
                        .controlSize(compact ? .mini : .small)
                } else if let icon = activity.phase.systemImage {
                    Image(systemName: icon)
                        .font(compact ? .caption2 : .caption)
                        .foregroundStyle(EOSTheme.accent)
                }
                VStack(alignment: .leading, spacing: 1) {
                    MarqueeText(
                        text: activity.title,
                        font: compact ? .caption2.weight(.semibold) : .caption.weight(.semibold),
                        foreground: EOSTheme.textSecondary,
                        speedPointsPerSecond: 26
                    )
                    if !activity.detail.isEmpty {
                        MarqueeText(
                            text: activity.detail,
                            font: .caption2,
                            foreground: Color.secondary.opacity(0.85),
                            speedPointsPerSecond: 24
                        )
                    }
                }
                Spacer(minLength: 0)
                if let progress = activity.progress {
                    Text("\(Int(progress))%")
                        .font(.caption2.monospacedDigit().weight(.bold))
                        .foregroundStyle(EOSTheme.accent)
                }
            }
        }
    }
}
