import SwiftUI

struct SmartPlaylistCard: View {
    let kind: SmartPlaylistKind
    let trackCount: Int

    var body: some View {
        let accent = kind.accent
        let color = Color(red: accent.r, green: accent.g, blue: accent.b)

        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .bottomLeading) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                color,
                                color.opacity(0.72),
                                Color.black.opacity(0.35)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .aspectRatio(1.15, contentMode: .fit)
                    .overlay(alignment: .topTrailing) {
                        Image(systemName: kind.systemImage)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.92))
                            .padding(14)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.18), lineWidth: 0.8)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text("AUTO")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(.white.opacity(0.72))
                    Text(kind.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                }
                .padding(12)
            }

            Text(kind.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(trackCount > 0 ? ListeningStatsPolicy.playCountLabel(trackCount) : "Zbiera statystyki")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(color)
        }
        .contentShape(Rectangle())
    }
}

struct SmartPlaylistDetailView: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject private var stats = ListeningStatsStore.shared
    let kind: SmartPlaylistKind

    private var library: [MusicTrack] {
        app.libraryTracksForBrowsing
    }

    private var entries: [SmartPlaylistEntry] {
        let raw = stats.entries(for: kind, library: library)
        if app.isOfflinePlaybackActive {
            return raw.filter { app.isOfflineAvailable($0.track.url) || $0.track.isLocalOfflineOnly }
        }
        return raw
    }

    private var accent: Color {
        let c = kind.accent
        return Color(red: c.r, green: c.g, blue: c.b)
    }

    var body: some View {
        Group {
            if entries.isEmpty {
                ContentUnavailableView(
                    kind.title,
                    systemImage: kind.systemImage,
                    description: Text(kind.emptyHint)
                )
            } else {
                List {
                    Section {
                        header
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 4, trailing: 20))

                    Section {
                        Button {
                            Task { await play(at: 0) }
                        } label: {
                            Label("Odtwórz wszystko", systemImage: "play.fill")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                        Button {
                            Task { await playShuffled() }
                        } label: {
                            Label("Losowo", systemImage: "shuffle")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(EOSTheme.accent)
                        }
                    }

                    Section {
                        ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                            HStack(spacing: 6) {
                                Button {
                                    Task { await play(at: index) }
                                } label: {
                                    TrackRowView(
                                        index: index + 1,
                                        title: entry.track.title,
                                        subtitle: rowSubtitle(entry),
                                        duration: entry.track.duration,
                                        artworkURL: entry.track.artworkURL,
                                        isPlaying: app.playback.engine?.currentTrack?.url == entry.track.url,
                                        downloadState: app.downloads.uiState(
                                            for: entry.track.url,
                                            isOnServer: app.isOnServer(entry.track.url)
                                        ),
                                        detailLabel: entry.playCount > 0
                                            ? ListeningStatsPolicy.compactPlayCount(entry.playCount)
                                            : "—"
                                    )
                                }
                                .buttonStyle(.plain)

                                TrackStorageActionButton(
                                    track: entry.track.payload,
                                    folderId: entry.track.folderId
                                )
                            }
                            .listRowInsets(EdgeInsets(top: 3, leading: 16, bottom: 3, trailing: 16))
                        }
                    } header: {
                        Text("Liczba odtworzeń przy każdym utworze")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .textCase(nil)
                    }
                }
                .listStyle(.plain)
                .environment(\.defaultMinListRowHeight, 52)
            }
        }
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.large)
        .eosScrollClearance()
    }

    private var header: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [accent, accent.opacity(0.65)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 72, height: 72)
                .overlay {
                    Image(systemName: kind.systemImage)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text("Playlista automatyczna")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent)
                Text(kind.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(entries.count) utworów")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    private func rowSubtitle(_ entry: SmartPlaylistEntry) -> String? {
        var parts: [String] = []
        if let artist = entry.track.artist, !artist.isEmpty {
            parts.append(artist)
        }
        if entry.playCount > 0 {
            parts.append(ListeningStatsPolicy.playCountLabel(entry.playCount))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func play(at index: Int) async {
        let tracks = entries.map(\.track)
        guard tracks.indices.contains(index) else { return }
        let folder = app.musicFolders.first(where: { $0.id == tracks[index].folderId })
        await app.playTracks(tracks, startIndex: index, folder: folder)
    }

    private func playShuffled() async {
        var tracks = entries.map(\.track)
        guard !tracks.isEmpty else { return }
        tracks.shuffle()
        let folder = app.musicFolders.first(where: { $0.id == tracks[0].folderId })
        await app.playTracks(tracks, startIndex: 0, folder: folder)
    }
}
