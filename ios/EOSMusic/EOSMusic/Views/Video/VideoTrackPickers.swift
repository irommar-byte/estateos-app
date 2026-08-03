import SwiftUI

struct VideoAudioTrackSheet: View {
    @ObservedObject var engine: VideoPlaybackEngine
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if engine.audioTracks.isEmpty {
                        Text("Brak dodatkowych ścieżek audio w tym pliku.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(engine.audioTracks) { track in
                            Button {
                                engine.selectAudioTrack(track.index)
                                dismiss()
                            } label: {
                                HStack {
                                    Text(track.title)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if track.isSelected {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(EOSTheme.accent)
                                    }
                                }
                            }
                        }
                    }
                } header: {
                    Text("Lektor / język audio")
                } footer: {
                    Text("Wybierz ścieżkę dźwiękową (lektor, oryginał, komentarz…).")
                }
            }
            .navigationTitle("Język / lektor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zamknij") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct VideoSubtitleSheet: View {
    @ObservedObject var engine: VideoPlaybackEngine
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        engine.setSubtitlesEnabled(false)
                        dismiss()
                    } label: {
                        HStack {
                            Text("Wyłącz napisy")
                            Spacer()
                            if !engine.subtitlesEnabled {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(EOSTheme.accent)
                            }
                        }
                    }

                    if engine.subtitleTracks.isEmpty {
                        Text("Brak osadzonych napisów w pliku.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(engine.subtitleTracks) { track in
                            Button {
                                engine.selectSubtitleTrack(track.index)
                                dismiss()
                            } label: {
                                HStack {
                                    Text(track.title)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if track.isSelected {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(EOSTheme.accent)
                                    }
                                }
                            }
                        }
                    }
                } header: {
                    Text("Napisy")
                }
            }
            .navigationTitle("Napisy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zamknij") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct VideoPlaylistSheet: View {
    @ObservedObject var engine: VideoPlaybackEngine
    let sources: VideoSourcesStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section(engine.folderName.isEmpty ? "Playlista" : engine.folderName) {
                    ForEach(Array(engine.queue.enumerated()), id: \.element.id) { index, item in
                        Button {
                            engine.playIndex(index, sources: sources)
                            dismiss()
                        } label: {
                            HStack(spacing: 10) {
                                Text("\(index + 1)")
                                    .font(.caption.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .frame(width: 28, alignment: .trailing)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title)
                                        .foregroundStyle(index == engine.currentIndex ? EOSTheme.accent : .primary)
                                        .font(.body.weight(index == engine.currentIndex ? .semibold : .regular))
                                    Text(item.displaySubtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if index == engine.currentIndex {
                                    Image(systemName: "waveform")
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Playlista folderu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zamknij") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
