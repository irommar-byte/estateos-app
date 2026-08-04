import SwiftUI

struct VideoLibraryView: View {
    @EnvironmentObject private var video: VideoAppModel
    @State private var showAddFolder = false
    @State private var reconnectFolder: ConnectedVideoFolder?
    @State private var folderPendingDelete: ConnectedVideoFolder?

    var body: some View {
        NavigationStack {
            ZStack {
                EOSAmbientBackground()
                    .allowsHitTesting(false)

                List {
                    Section {
                        FilesListButton { showAddFolder = true } label: {
                            FilesActionRow(
                                icon: "plus.circle.fill",
                                title: "Dodaj folder / USB",
                                iconColor: EOSTheme.accent
                            )
                        }
                    } footer: {
                        Text("Dodaj folder z filmami z iPhone’a, iCloud albo zewnętrznego dysku USB w aplikacji Pliki.")
                    }

                    if video.folders.isEmpty {
                        Section {
                            ContentUnavailableView(
                                "Brak folderów wideo",
                                systemImage: "film.stack",
                                description: Text("Dodaj folder z plikami MKV, AVI, MP4…")
                            )
                            .frame(maxWidth: .infinity)
                            .listRowBackground(Color.clear)
                        }
                    } else {
                        Section("Foldery") {
                            ForEach(video.folders) { folder in
                                NavigationLink {
                                    VideoFolderDetailView(folder: folder)
                                        .environmentObject(video)
                                } label: {
                                    HStack(spacing: 12) {
                                        Image(systemName: "folder.fill")
                                            .font(.title3)
                                            .foregroundStyle(EOSTheme.accent)
                                            .frame(width: 36, height: 36)
                                            .background(EOSTheme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(folder.name)
                                                .font(.body.weight(.semibold))
                                            Text(subtitle(for: folder))
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                .contextMenu {
                                    Button {
                                        reconnectFolder = folder
                                    } label: {
                                        Label("Połącz ponownie", systemImage: "arrow.triangle.2.circlepath")
                                    }
                                    Button(role: .destructive) {
                                        folderPendingDelete = folder
                                    } label: {
                                        Label("Usuń folder", systemImage: "trash")
                                    }
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .eosScrollClearance()
                .id(video.foldersVersion)
            }
            .navigationTitle("Wideo")
            .sheet(isPresented: $showAddFolder) {
                VideoFolderConnectionSheet { name, url in
                    try video.connectFolder(name: name, url: url)
                }
            }
            .sheet(item: $reconnectFolder) { folder in
                VideoFolderConnectionSheet { _, url in
                    try video.sources.reconnectFolder(folderId: folder.id, folderURL: url)
                }
                .onDisappear {
                    Task { await video.refreshFolder(folder) }
                }
            }
            .alert("Usunąć folder?", isPresented: Binding(
                get: { folderPendingDelete != nil },
                set: { if !$0 { folderPendingDelete = nil } }
            )) {
                Button("Usuń", role: .destructive) {
                    if let folder = folderPendingDelete {
                        video.disconnect(folder)
                    }
                    folderPendingDelete = nil
                }
                Button("Anuluj", role: .cancel) { folderPendingDelete = nil }
            } message: {
                Text("Usunie tylko skrót w aplikacji — pliki na dysku zostają.")
            }
            .alert("Wideo", isPresented: Binding(
                get: { video.libraryError != nil },
                set: { if !$0 { video.libraryError = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(video.libraryError ?? "")
            }
        }
    }

    private func subtitle(for folder: ConnectedVideoFolder) -> String {
        if let count = video.videosByFolder[folder.id]?.count {
            return "\(count) filmów"
        }
        return "Dotknij, aby otworzyć playlistę"
    }
}
