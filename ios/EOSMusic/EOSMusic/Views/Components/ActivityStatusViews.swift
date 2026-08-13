import SwiftUI

/// Kolejka pobierania filmów / seriali EOS™LIBRARY (jak muzyka).
struct MovieDownloadQueuePanel: View {
    let batch: MovieDownloadBatch
    @ObservedObject var service: MovieDownloadService

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
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(batch.label)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        MovieStorageLocationBadge(kind: destinationBadge)
                        if batch.destination == .serverAndPhone {
                            Text("serwer → iPhone")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer(minLength: 0)
                Text("\(service.completedCount)/\(service.totalCount)")
                    .font(.caption.monospacedDigit().weight(.bold))
                    .foregroundStyle(EOSTheme.accent)
                if service.isRunning {
                    Button("Stop", role: .cancel) { service.cancelBatch() }
                        .font(.caption2.weight(.semibold))
                } else {
                    Button("OK") { service.clearFinishedBatch() }
                        .font(.caption2.weight(.semibold))
                }
            }

            ProgressView(value: service.overallProgress)
                .tint(EOSTheme.accent)

            if let title = service.activeItemTitle {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.mini)
                        if let badge = service.activeItemPhaseBadge {
                            MovieStorageLocationBadge(kind: badgeKind(from: badge, progress: service.activeItemProgress))
                        }
                        Text(title)
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                    }
                    let detail = service.activeDetailLine
                    if !detail.isEmpty {
                        Text(detail)
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let message = service.statusMessage, !service.isRunning {
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // Lista pozycji z możliwością anulowania pojedynczych.
            VStack(spacing: 6) {
                ForEach(batch.items.prefix(8)) { item in
                    itemRow(item)
                }
                if batch.items.count > 8 {
                    Text("… i \(batch.items.count - 8) kolejnych")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                        Text(String(format: "%.0f%%", pct))
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
                } else if case .pending = item.state {
                    Text("W kolejce")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
            if canCancel(item) {
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
        case .pending, .downloading, .pullingPhone:
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
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(.ultraThinMaterial)
    }
}

/// Kolejka zapisu albumu / playlisty na serwer EOS.
struct ServerDownloadQueuePanel: View {
    let queue: MusicDownloadService.BulkServerQueueProgress
    var onCancel: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Zapis na serwer EOS", systemImage: "icloud.and.arrow.down")
                    .font(.caption.weight(.semibold))
                Spacer()
                Text("\(queue.completed)/\(queue.total)")
                    .font(.caption.monospacedDigit().weight(.bold))
                    .foregroundStyle(EOSTheme.accent)
                if onCancel != nil {
                    Button("Anuluj", role: .cancel) { onCancel?() }
                        .font(.caption2.weight(.semibold))
                }
            }

            ProgressView(value: Double(queue.completed), total: Double(max(queue.total, 1)))
                .tint(EOSTheme.accent)

            if let active = queue.active {
                HStack(spacing: 6) {
                    ProgressView()
                        .controlSize(.mini)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Teraz: \(active.title)")
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                        if let pct = queue.activeProgress {
                            Text("Przygotowanie na serwerze · \(Int(pct))%")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Przygotowanie na serwerze…")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if !queue.pending.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("W kolejce (\(queue.pending.count))")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ForEach(Array(queue.pending.prefix(4).enumerated()), id: \.offset) { idx, item in
                        Text("\(queue.completed + idx + 2). \(item.title)")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                    if queue.pending.count > 4 {
                        Text("… i \(queue.pending.count - 4) kolejnych")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                    Text(activity.title)
                        .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
                        .foregroundStyle(EOSTheme.textSecondary)
                        .lineLimit(1)
                    if !activity.detail.isEmpty {
                        Text(activity.detail)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(compact ? 1 : 2)
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
