import SwiftUI

/// Kolejka odtwarzania w stylu Apple Music: karta „Teraz gra”, przełączniki Losowo / Powtarzaj
/// i lista z uchwytami ≡ — każdy utwór można złapać i przeciągnąć w inne miejsce.
/// (Ta sama kolejka trafia do BMW iDrive przez Bluetooth.)
struct PlaybackQueueSheet: View {
    @ObservedObject var engine: MusicPlaybackEngine
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var moveTick = 0

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
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gotowe") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: moveTick)
    }

    private var queueList: some View {
        let rows = engine.playbackQueueRows
        return ScrollViewReader { proxy in
            List {
                Section {
                    nowPlayingCard
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
                        .moveDisabled(true)
                        .deleteDisabled(true)
                }

                Section {
                    ForEach(rows, id: \.track.id) { row in
                        queueRow(row)
                            .id(row.track.id)
                            .listRowBackground(rowBackground(for: row))
                            .deleteDisabled(true)
                    }
                    .onMove { source, destination in
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                            engine.moveQueueItems(fromOffsets: source, toOffset: destination)
                        }
                        moveTick += 1
                    }
                } header: {
                    HStack {
                        Text("Następne")
                            .font(.headline)
                            .foregroundStyle(EOSTheme.textPrimary)
                        Spacer()
                        Text(engine.queuePositionLabel)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(EOSTheme.textSecondary)
                    }
                    .textCase(nil)
                }
            }
            .listStyle(.insetGrouped)
            // Uchwyty ≡ widoczne zawsze — bez osobnego trybu edycji.
            .environment(\.editMode, .constant(.active))
            .onAppear { scrollToCurrent(using: proxy, animated: false) }
            .onChange(of: engine.currentQueueIndex) { _, _ in scrollToCurrent(using: proxy, animated: true) }
        }
    }

    // MARK: - Karta „Teraz gra”

    @ViewBuilder
    private var nowPlayingCard: some View {
        if let track = engine.currentTrack {
            VStack(spacing: 14) {
                HStack(spacing: 14) {
                    ArtworkImage(
                        url: track.artworkURL,
                        size: 64,
                        cornerRadius: 10,
                        fallbackImage: engine.displayArtwork(for: track),
                        identity: track.id,
                        placeholderTitle: track.title
                    )
                    .shadow(color: .black.opacity(0.25), radius: 10, y: 5)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("TERAZ GRA")
                            .font(.caption2.weight(.bold))
                            .tracking(1.2)
                            .foregroundStyle(EOSTheme.accent)
                        Text(track.title)
                            .font(.headline)
                            .foregroundStyle(EOSTheme.textPrimary)
                            .lineLimit(1)
                        Text([track.artist, engine.queueSourceTitle].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(EOSTheme.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    NowPlayingBars(barWidth: 3)
                        .frame(width: 24, height: 20)
                }
                HStack(spacing: 10) {
                    modeChip(
                        title: "Losowo",
                        systemImage: "shuffle",
                        active: engine.shuffleEnabled
                    ) { engine.toggleShuffle() }
                    modeChip(
                        title: engine.repeatMode == .off ? "Powtarzaj" : engine.repeatMode.label,
                        systemImage: engine.repeatMode.icon,
                        active: engine.repeatMode != .off
                    ) { engine.cycleRepeatMode() }
                }
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.primary.opacity(colorScheme == .dark ? 0.08 : 0.05))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .strokeBorder(EOSTheme.accent.opacity(0.18), lineWidth: 0.8)
            )
        }
    }

    private func modeChip(title: String, systemImage: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(active ? Color.white : EOSTheme.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    Capsule().fill(active ? AnyShapeStyle(EOSTheme.gradient) : AnyShapeStyle(Color.primary.opacity(0.07)))
                )
                .contentTransition(.symbolEffect(.replace))
                .animation(.spring(response: 0.3, dampingFraction: 0.75), value: active)
        }
        .buttonStyle(EOSPressableStyle(pressedScale: 0.95))
        .sensoryFeedback(.selection, trigger: active)
    }

    // MARK: - Wiersz

    private func queueRow(_ row: PlaybackQueueRow) -> some View {
        HStack(spacing: 10) {
            Button {
                Task {
                    await engine.jumpToOrderIndex(row.orderIndex)
                    dismiss()
                }
            } label: {
                HStack(spacing: 12) {
                    ArtworkImage(
                        url: row.track.artworkURL,
                        size: 44,
                        cornerRadius: 7,
                        identity: row.track.id,
                        placeholderTitle: row.track.title
                    )
                    .overlay {
                        if row.isCurrent {
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .fill(Color.black.opacity(0.45))
                            NowPlayingBars(color: .white, barWidth: 2.6)
                                .frame(width: 20, height: 16)
                        }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.track.title)
                            .font(.body.weight(row.isCurrent ? .semibold : .regular))
                            .foregroundStyle(row.isCurrent ? EOSTheme.accent : EOSTheme.textPrimary)
                            .lineLimit(1)
                        if let artist = row.track.artist, !artist.isEmpty {
                            Text(artist)
                                .font(.caption)
                                .foregroundStyle(EOSTheme.textSecondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                }
                .opacity(row.isPast ? 0.5 : 1)
                .contentShape(Rectangle())
            }
            .buttonStyle(EOSRowPressStyle())

            if !row.track.isExternal {
                TrackStorageActionButton(track: row.track.payload, folderId: row.track.folderId)
            }
        }
        .trackQuickActions(
            TrackQuickActionItem(track: row.track),
            play: {
                Task {
                    await engine.jumpToOrderIndex(row.orderIndex)
                    dismiss()
                }
            },
            removeFromQueue: { engine.removeFromQueue(orderIndex: row.orderIndex) }
        )
        .accessibilityLabel("\(row.displayNumber). \(row.track.title)\(row.isCurrent ? ", odtwarzany teraz" : "")")
    }

    private func rowBackground(for row: PlaybackQueueRow) -> some View {
        Group {
            if row.isCurrent {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(EOSTheme.accent.opacity(colorScheme == .dark ? 0.16 : 0.1))
            } else {
                Color.white.opacity(colorScheme == .dark ? 0.05 : 0.7)
            }
        }
    }

    private func scrollToCurrent(using proxy: ScrollViewProxy, animated: Bool) {
        guard let current = engine.playbackQueueRows.first(where: \.isCurrent) else { return }
        if animated {
            withAnimation(EOSMotion.soft) { proxy.scrollTo(current.track.id, anchor: .center) }
        } else {
            proxy.scrollTo(current.track.id, anchor: .center)
        }
    }
}
