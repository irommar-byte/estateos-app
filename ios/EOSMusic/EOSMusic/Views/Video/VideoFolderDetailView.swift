import SwiftUI

struct VideoFolderDetailView: View {
    @EnvironmentObject private var video: VideoAppModel
    let folder: ConnectedVideoFolder
    @State private var showReconnect = false

    private var items: [VideoItem] {
        video.videosByFolder[folder.id] ?? []
    }

    var body: some View {
        ZStack {
            EOSAmbientBackground()
                .allowsHitTesting(false)

            List {
                Section {
                    if video.isScanning && items.isEmpty {
                        ProgressView("Skanuję folder…")
                    } else if items.isEmpty {
                        ContentUnavailableView(
                            "Brak filmów",
                            systemImage: "film",
                            description: Text("W folderze nie znaleziono MKV/AVI/MP4… albo dostęp wygasł — połącz ponownie.")
                        )
                        .listRowBackground(Color.clear)
                    } else {
                        Button {
                            video.play(folder: folder, startIndex: 0)
                        } label: {
                            Label("Odtwórz wszystko", systemImage: "play.fill")
                                .font(.body.weight(.semibold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(EOSTheme.accent)
                        .listRowBackground(Color.clear)
                    }
                }

                if !items.isEmpty {
                    Section("Playlista · \(items.count)") {
                        ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                            Button {
                                video.play(folder: folder, startIndex: index)
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "film")
                                        .foregroundStyle(EOSTheme.accent)
                                        .frame(width: 28)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.title)
                                            .font(.body.weight(.semibold))
                                            .foregroundStyle(.primary)
                                            .multilineTextAlignment(.leading)
                                        Text(item.displaySubtitle)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "play.circle.fill")
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .refreshable { await video.refreshFolder(folder) }
        }
        .navigationTitle(folder.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showReconnect = true
                    } label: {
                        Label("Połącz ponownie", systemImage: "arrow.triangle.2.circlepath")
                    }
                    Button {
                        Task { await video.refreshFolder(folder) }
                    } label: {
                        Label("Odśwież listę", systemImage: "arrow.clockwise")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .task { await video.refreshFolder(folder) }
        .sheet(isPresented: $showReconnect) {
            VideoFolderConnectionSheet { _, url in
                try video.sources.reconnectFolder(folderId: folder.id, folderURL: url)
                Task { await video.refreshFolder(folder) }
            }
        }
    }
}
