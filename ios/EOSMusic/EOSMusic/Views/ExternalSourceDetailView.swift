import SwiftUI

struct ExternalSourceDetailView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss
    let source: ConnectedMusicSource

    @State private var tracks: [ExternalAudioTrack] = []
    @State private var isLoading = true
    @State private var scanCount = 0
    @State private var scanFolder = ""
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                EOSLoadingView(
                    title: scanCount > 0 ? "Znaleziono \(scanCount) utworów…" : "Skanuję pliki audio…",
                    subtitle: scanFolder
                )
                .transition(.opacity.combined(with: .scale(scale: 0.985)))
            } else if tracks.isEmpty {
                ContentUnavailableView(
                    "Brak utworów",
                    systemImage: "music.note",
                    description: Text("W tym folderze nie znaleziono plików MP3, M4A ani FLAC.")
                )
                .transition(.opacity)
            } else {
                List {
                    Section {
                        Button {
                            Task { await play(from: 0) }
                        } label: {
                            Label("Odtwórz wszystko", systemImage: "play.fill")
                                .font(.headline)
                                .foregroundStyle(EOSTheme.accent)
                        }
                    }
                    Section("\(tracks.count) utworów") {
                        ForEach(Array(tracks.enumerated()), id: \.element.id) { index, track in
                            Button {
                                Task { await play(from: index) }
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
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
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
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = tracks.isEmpty
        scanCount = 0
        scanFolder = ""
        defer { isLoading = false }
        do {
            tracks = try await app.sources.listTracks(for: source) { count, folder in
                scanCount = count
                scanFolder = folder
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func play(from index: Int) async {
        await app.playExternalTracks(tracks, source: source, startIndex: index)
    }
}
