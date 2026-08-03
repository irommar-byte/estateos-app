import SwiftUI

private enum ExternalBrowseMode: String, CaseIterable, Identifiable {
    case artists
    case albums
    case songs

    var id: String { rawValue }

    var title: String {
        switch self {
        case .artists: return "Wykonawcy"
        case .albums: return "Albumy"
        case .songs: return "Utwory"
        }
    }
}

struct ExternalSourceDetailView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    let source: ConnectedMusicSource

    @State private var tracks: [ExternalAudioTrack] = []
    @State private var isLoading = true
    @State private var scanCount = 0
    @State private var scanFolder = ""
    @State private var errorMessage: String?
    @State private var needsReconnect = false
    @State private var showReconnectPicker = false
    @State private var mode: ExternalBrowseMode = .artists
    @State private var selectedArtist: String?
    @State private var selectedAlbum: String?

    private var artists: [(name: String, count: Int)] {
        var map: [String: Int] = [:]
        for track in tracks {
            let name = track.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
            let key = (name?.isEmpty == false) ? name! : "Nieznany wykonawca"
            map[key, default: 0] += 1
        }
        return map
            .map { (name: $0.key, count: $0.value) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private var albums: [(id: String, title: String, artist: String?, count: Int)] {
        var map: [String: (title: String, artist: String?, count: Int)] = [:]
        for track in tracks {
            let title = track.album?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let title, !title.isEmpty else { continue }
            let key = "\(title.lowercased())|\((track.artist ?? "").lowercased())"
            if var existing = map[key] {
                existing.count += 1
                map[key] = existing
            } else {
                map[key] = (title, track.artist, 1)
            }
        }
        return map
            .map { (id: $0.key, title: $0.value.title, artist: $0.value.artist, count: $0.value.count) }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private var filteredTracks: [ExternalAudioTrack] {
        if let selectedArtist {
            return tracks.filter {
                let name = $0.artist?.trimmingCharacters(in: .whitespacesAndNewlines)
                let key = (name?.isEmpty == false) ? name! : "Nieznany wykonawca"
                return key == selectedArtist
            }
        }
        if let selectedAlbum {
            return tracks.filter { $0.album == selectedAlbum }
        }
        return tracks
    }

    var body: some View {
        Group {
            if isLoading {
                EOSLoadingView(
                    title: scanCount > 0 ? "Znaleziono \(scanCount) utworów…" : "Skanuję pliki audio…",
                    subtitle: scanFolder
                )
                .transition(.opacity.combined(with: .scale(scale: 0.985)))
            } else if needsReconnect {
                ContentUnavailableView {
                    Label("Brak dostępu do folderu", systemImage: "folder.badge.questionmark")
                } description: {
                    Text("iOS odwołał dostęp. Wybierz ten sam folder ponownie — muzyka wróci do listy.")
                } actions: {
                    Button("Wybierz folder ponownie") {
                        showReconnectPicker = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(EOSTheme.accent)
                }
            } else if tracks.isEmpty {
                ContentUnavailableView(
                    "Brak utworów",
                    systemImage: "music.note",
                    description: Text("W tym folderze nie znaleziono plików MP3, M4A ani FLAC. Sprawdź strukturę folderu albo dodaj inny lokalny katalog.")
                )
                .transition(.opacity)
            } else {
                browseContent
            }
        }
        .animation(.snappy(duration: 0.25), value: isLoading)
        .animation(.snappy(duration: 0.25), value: tracks.count)
        .background(EOSAmbientBackground())
        .navigationTitle(source.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if source.folderBookmark != nil {
                        Button {
                            showReconnectPicker = true
                        } label: {
                            Label("Połącz folder ponownie", systemImage: "arrow.triangle.2.circlepath")
                        }
                    }
                    Button("Odłącz folder", role: .destructive) {
                        app.sources.disconnect(source)
                        dismiss()
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showReconnectPicker) {
            LocalFolderConnectionSheet { _, url in
                try app.sources.reconnectFolder(sourceId: source.id, folderURL: url)
                Task { await load() }
            }
        }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
            if needsReconnect || (errorMessage?.contains("dostępu") == true) {
                Button("Wybierz folder") {
                    showReconnectPicker = true
                }
            }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    @ViewBuilder
    private var browseContent: some View {
        ScrollViewReader { proxy in
            List {
                Section {
                    Picker("Widok", selection: $mode) {
                        ForEach(ExternalBrowseMode.allCases) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .onChange(of: mode) { _, _ in
                        selectedArtist = nil
                        selectedAlbum = nil
                    }

                    Button {
                        Task { await play(tracks: filteredTracks, from: 0) }
                    } label: {
                        Label(
                            selectedArtist != nil || selectedAlbum != nil
                                ? "Odtwórz wybór (\(filteredTracks.count))"
                                : "Odtwórz wszystko (\(tracks.count))",
                            systemImage: "play.fill"
                        )
                        .font(.headline)
                        .foregroundStyle(EOSTheme.accent)
                    }
                }

                switch mode {
                case .artists:
                    if let selectedArtist {
                        Section {
                            Button {
                                self.selectedArtist = nil
                            } label: {
                                Label(selectedArtist, systemImage: "chevron.backward")
                            }
                        }
                        songListSections(filteredTracks)
                    } else {
                        Section("\(artists.count) wykonawców") {
                            ForEach(artists, id: \.name) { artist in
                                Button {
                                    selectedArtist = artist.name
                                } label: {
                                    HStack {
                                        Text(artist.name)
                                            .foregroundStyle(.primary)
                                        Spacer()
                                        Text("\(artist.count)")
                                            .foregroundStyle(.secondary)
                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                            }
                        }
                    }
                case .albums:
                    if let selectedAlbum {
                        Section {
                            Button {
                                self.selectedAlbum = nil
                            } label: {
                                Label(selectedAlbum, systemImage: "chevron.backward")
                            }
                        }
                        songListSections(filteredTracks)
                    } else {
                        Section("\(albums.count) albumów") {
                            ForEach(albums, id: \.id) { album in
                                Button {
                                    selectedAlbum = album.title
                                } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(album.title)
                                            .foregroundStyle(.primary)
                                        Text([album.artist, "\(album.count) utw."].compactMap { $0 }.joined(separator: " · "))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                case .songs:
                    songListSections(filteredTracks, withAlphabet: true)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .overlay(alignment: .trailing) {
                if mode == .songs {
                    AlphabetIndexBar(
                        available: Set(LibraryAlphabet.group(filteredTracks) { $0.title }.map(\.key))
                    ) { letter in
                        withAnimation(.easeOut(duration: 0.12)) {
                            proxy.scrollTo(letter, anchor: .top)
                        }
                    }
                    .padding(.trailing, 2)
                }
            }
        }
    }

    @ViewBuilder
    private func songListSections(_ items: [ExternalAudioTrack], withAlphabet: Bool = false) -> some View {
        if withAlphabet {
            ForEach(LibraryAlphabet.group(items) { $0.title }, id: \.key) { section in
                Section {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { _, track in
                        songRow(track, in: items)
                    }
                } header: {
                    Text(section.key)
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(.secondary)
                        .id(section.key)
                }
            }
        } else {
            Section("\(items.count) utworów") {
                ForEach(Array(items.enumerated()), id: \.element.id) { _, track in
                    songRow(track, in: items)
                }
            }
        }
    }

    private func songRow(_ track: ExternalAudioTrack, in queue: [ExternalAudioTrack]) -> some View {
        let index = queue.firstIndex(where: { $0.id == track.id }) ?? 0
        return Button {
            Task { await play(tracks: queue, from: index) }
        } label: {
            TrackRowView(
                index: index + 1,
                title: track.title,
                subtitle: [track.artist, track.album].compactMap { $0 }.joined(separator: " · "),
                duration: nil,
                artworkURL: nil,
                isPlaying: app.playback.engine?.currentTrack?.url == track.id
            )
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        isLoading = tracks.isEmpty
        scanCount = 0
        scanFolder = ""
        needsReconnect = false
        defer { isLoading = false }
        do {
            tracks = try await app.sources.listTracks(for: source) { count, folder in
                scanCount = count
                scanFolder = folder
            }
            errorMessage = nil
        } catch {
            let message = error.localizedDescription
            errorMessage = message
            needsReconnect = message.localizedCaseInsensitiveContains("dostępu")
                || message.localizedCaseInsensitiveContains("połącz ponownie")
            if needsReconnect {
                tracks = []
            }
        }
    }

    private func play(tracks queue: [ExternalAudioTrack], from index: Int) async {
        guard !queue.isEmpty else { return }
        await app.playExternalTracks(queue, source: source, startIndex: index)
    }
}
