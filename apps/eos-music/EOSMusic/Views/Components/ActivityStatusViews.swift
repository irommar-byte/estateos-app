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
    private var musicIsOrb: Bool { app.downloads.isBulkQueueMinimized }
    private var movieIsOrb: Bool { isMovieQueueMinimized }

    private var queueTop: CGFloat { showsSync ? 64 : 8 }

    @ViewBuilder
    private var movieQueue: some View {
        if let batch = app.movieDownloads.activeBatch {
            MovieDownloadQueuePanel(
                batch: batch,
                service: app.movieDownloads,
                isMinimized: $isMovieQueueMinimized
            )
            .transition(Self.cardTransition)
        }
    }

    @ViewBuilder
    private var musicQueue: some View {
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
    }

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .allowsHitTesting(false)
            .overlay(alignment: .top) {
                if showsSync, let sync = app.librarySyncMessage {
                    LibrarySyncStatusBar(
                        message: sync,
                        showsSpinner: app.isLibraryLoading
                    )
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
                    .transition(Self.cardTransition)
                }
            }
            .overlay(alignment: .top) {
                if showsMovie && showsMusic && !movieIsOrb && !musicIsOrb {
                    VStack(spacing: 8) {
                        movieQueue
                        musicQueue
                    }
                    .padding(.horizontal, 12)
                    .padding(.top, queueTop)
                }
            }
            .overlay(alignment: .top) {
                if showsMovie && !movieIsOrb && !(showsMusic && !musicIsOrb) {
                    movieQueue
                        .padding(.leading, 12)
                        .padding(.trailing, showsMusic && musicIsOrb ? 64 : 12)
                        .padding(.top, queueTop)
                }
            }
            .overlay(alignment: .top) {
                if showsMusic && !musicIsOrb && !(showsMovie && !movieIsOrb) {
                    musicQueue
                        .padding(.leading, showsMovie && movieIsOrb ? 64 : 12)
                        .padding(.trailing, 12)
                        .padding(.top, queueTop)
                }
            }
            .overlay(alignment: .topLeading) {
                if showsMovie && movieIsOrb {
                    movieQueue
                        .padding(.leading, 12)
                        .padding(.top, queueTop)
                }
            }
            .overlay(alignment: .topTrailing) {
                if showsMusic && musicIsOrb {
                    musicQueue
                        .padding(.trailing, 12)
                        .padding(.top, queueTop)
                }
            }
        .animation(EOSMotion.soft, value: showsSync)
        .animation(EOSMotion.soft, value: showsMusic)
        .animation(EOSMotion.soft, value: showsMovie)
        .animation(EOSMotion.snappy, value: musicIsOrb)
        .animation(EOSMotion.snappy, value: movieIsOrb)
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

    @State private var collapseTask: Task<Void, Never>?

    /// Niebieski, żeby kółko filmu nie myliło się z różowym kółkiem muzyki.
    private static let ring = Color(red: 0.20, green: 0.55, blue: 0.98)

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
        Group {
            if isMinimized {
                orb
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 0.6, anchor: .topLeading).combined(with: .opacity),
                            removal: .scale(scale: 0.82, anchor: .topLeading).combined(with: .opacity)
                        )
                    )
            } else {
                expandedCard
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 0.92, anchor: .topLeading)
                                .combined(with: .opacity)
                                .combined(with: .offset(y: -10)),
                            removal: .scale(scale: 0.7, anchor: .topLeading)
                                .combined(with: .opacity)
                                .combined(with: .offset(y: -18))
                        )
                    )
                    .gesture(
                        DragGesture(minimumDistance: 12).onEnded { value in
                            if value.translation.height < -20 {
                                collapse()
                            }
                        }
                    )
            }
        }
        .animation(EOSMotion.snappy, value: isMinimized)
        .onAppear {
            if !isMinimized { scheduleCollapse() }
        }
        .onChange(of: isMinimized) { _, minimized in
            if minimized {
                collapseTask?.cancel()
            } else {
                scheduleCollapse()
            }
        }
    }

    private var orb: some View {
        Button {
            withAnimation(EOSMotion.snappy) { isMinimized = false }
        } label: {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                Circle()
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
                Circle()
                    .stroke(Color.primary.opacity(0.12), lineWidth: 3.5)
                Circle()
                    .trim(from: 0, to: CGFloat(min(1, max(0, service.overallProgress))))
                    .stroke(
                        AngularGradient(
                            colors: [Self.ring, Self.ring.opacity(0.55)],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.22), value: service.overallProgress)
                VStack(spacing: 1) {
                    if !service.isRunning {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Self.ring)
                            .symbolRenderingMode(.hierarchical)
                    } else {
                        Text("\(Int((service.overallProgress * 100).rounded()))")
                            .font(.system(size: 12, weight: .bold, design: .rounded).monospacedDigit())
                            .foregroundStyle(Self.ring)
                            .contentTransition(.numericText())
                        Image(systemName: service.activeItemPhaseBadge == "iPHONE" ? "iphone" : "film.fill")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(width: 44, height: 44)
            .shadow(color: Color.black.opacity(0.16), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Postęp pobierania filmu, \(Int((service.overallProgress * 100).rounded())) procent")
    }

    private var expandedCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                Button {
                    collapse()
                } label: {
                    Image(systemName: "chevron.up.circle.fill")
                        .font(.body)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(Self.ring)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Zwiń kolejkę")

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
                Text(String(format: "%.1f%%", service.overallProgress * 100))
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

            if let bytes = service.activeBytesLabel, service.isRunning {
                Text(bytes)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(EOSTheme.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

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
                            .foregroundStyle(.secondary)
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

    private func collapse() {
        collapseTask?.cancel()
        withAnimation(EOSMotion.snappy) { isMinimized = true }
    }

    private func scheduleCollapse() {
        collapseTask?.cancel()
        collapseTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(EOSMotion.snappy) { isMinimized = true }
        }
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
                        Text(pct >= 99 ? "Finalizowanie…" : String(format: "%.1f%%", pct))
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(EOSTheme.accent)
                        if item.id == service.activeBatch?.items.first(where: {
                            if case .downloading = $0.state { return true }
                            if case .pullingPhone = $0.state { return true }
                            return false
                        })?.id {
                            if let bytes = service.activeBytesLabel {
                                Text(bytes)
                                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(.primary)
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
                    Text("W kolejce na serwerze")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
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

    @State private var collapseTask: Task<Void, Never>?

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

    private var isFinished: Bool {
        queue.pending.isEmpty
            && queue.active == nil
            && (queue.completed + queue.failedCount) >= max(queue.total, 1)
    }

    private var finishedWithErrors: Bool {
        isFinished && queue.failedCount > 0
    }

    var body: some View {
        Group {
            if isMinimized {
                orb
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 0.6, anchor: .topTrailing).combined(with: .opacity),
                            removal: .scale(scale: 0.82, anchor: .topTrailing).combined(with: .opacity)
                        )
                    )
            } else {
                expandedCard
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 0.92, anchor: .topTrailing)
                                .combined(with: .opacity)
                                .combined(with: .offset(y: -10)),
                            removal: .scale(scale: 0.7, anchor: .topTrailing)
                                .combined(with: .opacity)
                                .combined(with: .offset(y: -18))
                        )
                    )
                    .gesture(
                        DragGesture(minimumDistance: 12).onEnded { value in
                            if value.translation.height < -20 {
                                collapse()
                            }
                        }
                    )
            }
        }
        .animation(EOSMotion.snappy, value: isMinimized)
        .onAppear {
            if !isMinimized { scheduleCollapse() }
        }
        .onChange(of: isMinimized) { _, minimized in
            if minimized {
                collapseTask?.cancel()
            } else {
                scheduleCollapse()
            }
        }
    }

    private var orb: some View {
        Button {
            withAnimation(EOSMotion.snappy) { isMinimized = false }
        } label: {
            ZStack {
                Circle()
                    .fill(.ultraThinMaterial)
                Circle()
                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
                Circle()
                    .stroke(Color.primary.opacity(0.12), lineWidth: 3.5)
                Circle()
                    .trim(from: 0, to: CGFloat(min(1, max(0, queue.overallProgress))))
                    .stroke(
                        AngularGradient(
                            colors: [EOSTheme.accent, EOSTheme.accentSecondary],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.22), value: queue.overallProgress)
                VStack(spacing: 1) {
                    if finishedWithErrors {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(EOSTheme.accent)
                            .symbolRenderingMode(.hierarchical)
                    } else if isFinished {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(EOSTheme.statusOnline)
                            .symbolRenderingMode(.hierarchical)
                    } else {
                        Text("\(Int((queue.overallProgress * 100).rounded()))")
                            .font(.system(size: 12, weight: .bold, design: .rounded).monospacedDigit())
                            .foregroundStyle(EOSTheme.accent)
                            .contentTransition(.numericText())
                        Image(systemName: queue.phase == .device ? "iphone" : "externaldrive.fill")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(width: 44, height: 44)
            .shadow(color: Color.black.opacity(0.16), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Postęp zapisu na serwer, \(Int((queue.overallProgress * 100).rounded())) procent")
    }

    private var expandedCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Button {
                    collapse()
                } label: {
                    Image(systemName: "chevron.up.circle.fill")
                        .font(.body)
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(EOSTheme.accent)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Zwiń kolejkę")

                phasePill
                Spacer(minLength: 6)
                if finishedWithErrors {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(EOSTheme.accent)
                        .symbolRenderingMode(.hierarchical)
                } else if isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(EOSTheme.statusOnline)
                        .symbolRenderingMode(.hierarchical)
                } else {
                    Text("\(Int((queue.overallProgress * 100).rounded()))%")
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .foregroundStyle(EOSTheme.accent)
                        .contentTransition(.numericText())
                    Text(DownloadETAFormatter.expanded(LiveActivityLockScreenPolicy.displayETA(
                        seconds: queue.etaSeconds,
                        remainingCount: queue.remainingCount
                    )))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
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

            ForEach(Array(queue.liveCurrentItems.prefix(BulkServerQueuePolicy.maxConcurrentServerJobs).enumerated()), id: \.offset) { _, item in
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
                    if let bytes = queue.byteLabel, !bytes.isEmpty {
                        Text(bytes)
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    } else if item.progress < 0.01 {
                        Text("Szukam pliku…")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    FloatingProgressBar(progress: min(1, max(0, item.progress)), height: 3.5)
                }
            }

            if queue.destination == .serverAndPhone, queue.phase == .server, queue.deviceTotal > 0 {
                Text("Potem na iPhone: \(queue.deviceTotal) utworów")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .modifier(FloatingActivityChrome())
    }

    private func collapse() {
        collapseTask?.cancel()
        withAnimation(EOSMotion.snappy) { isMinimized = true }
    }

    private func scheduleCollapse() {
        collapseTask?.cancel()
        collapseTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(EOSMotion.snappy) { isMinimized = true }
        }
    }

    private var phasePill: some View {
        let phone = queue.phase == .device
        let done = isFinished
        return HStack(spacing: 5) {
            Image(systemName: done ? "checkmark.circle.fill" : (phone ? "iphone" : "externaldrive.fill"))
                .font(.caption2.weight(.semibold))
            Text(done ? "Zakończono" : (phone ? "iPhone" : "Serwer"))
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(done ? EOSTheme.statusOnline : EOSTheme.accent)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background((done ? EOSTheme.statusOnline : EOSTheme.accent).opacity(0.14), in: Capsule())
        .accessibilityLabel(done ? "Zakończono" : phaseTitle)
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
