import SwiftUI

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

/// Kolejka pobierania filmów / seriali CDA-HD (jak muzyka).
struct MovieDownloadQueuePanel: View {
    let batch: MovieDownloadBatch
    @ObservedObject var service: MovieDownloadService

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("CDA-HD → serwer", systemImage: "film.fill")
                    .font(.caption.weight(.semibold))
                Spacer()
                Text("\(service.completedCount)/\(service.totalCount)")
                    .font(.caption.monospacedDigit().weight(.bold))
                    .foregroundStyle(EOSTheme.accent)
                if service.isRunning {
                    Button("Anuluj", role: .cancel) { service.cancelBatch() }
                        .font(.caption2.weight(.semibold))
                }
            }

            ProgressView(value: service.overallProgress)
                .tint(EOSTheme.accent)

            if let title = service.activeItemTitle {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini)
                    Text("Teraz: \(title)")
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                }
            }

            Text(batch.label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
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
