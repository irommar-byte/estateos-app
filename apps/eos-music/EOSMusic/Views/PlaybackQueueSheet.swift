import SwiftUI

/// Pełna lista kolejki odtwarzania — wybór utworu w aplikacji (i ta sama kolejka co BMW iDrive przez BT).
struct PlaybackQueueSheet: View {
    @ObservedObject var engine: MusicPlaybackEngine
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            Group {
                if engine.playbackQueueRows.isEmpty {
                    ContentUnavailableView(
                        "Brak kolejki",
                        systemImage: "music.note.list",
                        description: Text("Odtwórz playlistę, aby zobaczyć utwory.")
                    )
                } else {
                    queueList
                }
            }
            .scrollContentBackground(.hidden)
            .background(EOSAmbientBackground())
            .navigationTitle("Kolejka")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Gotowe") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var queueList: some View {
        ScrollViewReader { proxy in
            List {
                if let source = engine.queueSourceTitle, !source.isEmpty {
                    Section {
                        EmptyView()
                    } header: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(source)
                                .font(EOSTypography.headline)
                                .foregroundStyle(EOSTheme.textPrimary)
                            Text("\(engine.playbackQueueRows.count) utworów · \(engine.queuePositionLabel)")
                                .font(EOSTypography.caption)
                                .foregroundStyle(EOSTheme.textSecondary)
                        }
                        .textCase(nil)
                        .padding(.bottom, 4)
                    }
                }

                Section {
                    ForEach(engine.playbackQueueRows) { row in
                        HStack(spacing: 6) {
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                Task {
                                    await engine.jumpToOrderIndex(row.orderIndex)
                                    dismiss()
                                }
                            } label: {
                                PlaybackQueueRowView(row: row)
                            }
                            .buttonStyle(.plain)

                            if !row.track.isExternal {
                                TrackStorageActionButton(
                                    track: row.track.payload,
                                    folderId: row.track.folderId
                                )
                            }
                        }
                        .listRowBackground(rowBackground(for: row))
                        .id(row.id)
                    }
                } header: {
                    if engine.queueSourceTitle == nil {
                        Text("\(engine.playbackQueueRows.count) utworów")
                            .font(EOSTypography.sectionLabel)
                            .foregroundStyle(EOSTheme.textMuted)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .onAppear {
                scrollToCurrent(using: proxy, animated: false)
            }
            .onChange(of: engine.currentQueueIndex) { _, _ in
                scrollToCurrent(using: proxy, animated: true)
            }
        }
    }

    private func rowBackground(for row: PlaybackQueueRow) -> some View {
        Group {
            if row.isCurrent {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(EOSTheme.accent.opacity(colorScheme == .dark ? 0.18 : 0.12))
            } else {
                Color.clear
            }
        }
    }

    private func scrollToCurrent(using proxy: ScrollViewProxy, animated: Bool) {
        guard let current = engine.playbackQueueRows.first(where: \.isCurrent) else { return }
        if animated {
            withAnimation(EOSMotion.soft) {
                proxy.scrollTo(current.id, anchor: .center)
            }
        } else {
            proxy.scrollTo(current.id, anchor: .center)
        }
    }
}

private struct PlaybackQueueRowView: View {
    let row: PlaybackQueueRow

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                if row.isCurrent {
                    Image(systemName: "waveform")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(EOSTheme.accent)
                        .symbolEffect(.variableColor.iterative, options: .speed(0.6), isActive: true)
                } else {
                    Text("\(row.displayNumber)")
                        .font(EOSTypography.monoDigit)
                        .foregroundStyle(row.isPast ? EOSTheme.textMuted : EOSTheme.textSecondary)
                        .frame(minWidth: 22)
                }
            }
            .frame(width: 28, alignment: .center)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.track.title)
                    .font(EOSTypography.bodySemibold)
                    .foregroundStyle(row.isCurrent ? EOSTheme.textPrimary : EOSTheme.textPrimary.opacity(row.isPast ? 0.55 : 1))
                    .lineLimit(2)
                if let artist = row.track.artist, !artist.isEmpty {
                    Text(artist)
                        .font(EOSTypography.caption)
                        .foregroundStyle(EOSTheme.textSecondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)

            if row.isCurrent {
                Text("Teraz")
                    .font(EOSTypography.captionBold)
                    .foregroundStyle(EOSTheme.accent)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityLabel("\(row.displayNumber). \(row.track.title)\(row.isCurrent ? ", odtwarzany teraz" : "")")
    }
}
