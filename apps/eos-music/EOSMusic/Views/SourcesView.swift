import SwiftUI

private enum BrowseLocation: String, Identifiable {
    case localFolder
    case iCloud

    var id: String { rawValue }

    var kind: MusicSourceKind {
        switch self {
        case .localFolder: return .localFolder
        case .iCloud: return .iCloudDrive
        }
    }

    var title: String { kind.title }
    var subtitle: String { kind.subtitle }
    var systemImage: String { kind.systemImage }

    var tint: Color {
        switch self {
        case .localFolder: return .orange
        case .iCloud: return .blue
        }
    }
}

struct SourcesView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        // Observe MusicSourcesStore directly (AppModel no longer fans out sources.objectWillChange).
        SourcesViewBody(sources: app.sources)
    }
}

/// Inner body so `@ObservedObject` tracks `MusicSourcesStore` without AppModel republish.
private struct SourcesViewBody: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject var sources: MusicSourcesStore
    @State private var activeLocation: BrowseLocation?
    @State private var editMode: EditMode = .inactive
    @State private var sourceToDelete: ConnectedMusicSource?
    @State private var errorMessage: String?
    @State private var deviceStorage: StorageSnapshot?

    private var isEditing: Bool { editMode == .active }

    private var sortedSources: [ConnectedMusicSource] {
        sources.sources.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private var localDeviceSubtitle: String {
        let music = OfflineMusicStore.shared.downloadedFileCount
        let movies = app.onlineMovies.phoneMovieCount
        if music == 0 && movies == 0 { return "Utwory i filmy pobrane w EOS Music" }
        var parts: [String] = []
        if music > 0 { parts.append("\(music) utw.") }
        if movies > 0 { parts.append("\(movies) filmów") }
        return "Pobrane · " + parts.joined(separator: " · ")
    }

    private var serverLibrarySubtitle: String {
        let music = app.serverAssetCount
        let movies = app.onlineMovies.serverMovieCount
        if music == 0 && movies == 0 { return "Muzyka i filmy zapisane trwale na serwerze" }
        var parts: [String] = []
        if music > 0 { parts.append("\(music) utw.") }
        if movies > 0 { parts.append("\(movies) filmów") }
        let size = ByteCountFormatter.string(
            fromByteCount: Int64(app.serverLibraryBytes + app.onlineMovies.serverMovieBytes),
            countStyle: .file
        )
        return parts.joined(separator: " · ") + " · \(size)"
    }

    private var deviceBreakdown: StorageBreakdown? {
        let musicBytes = OfflineMusicStore.shared.totalDownloadedBytes
        let movieBytes = app.onlineMovies.phoneMovieBytes
        let musicCount = OfflineMusicStore.shared.downloadedFileCount
        let movieCount = app.onlineMovies.phoneMovieCount
        guard let disk = deviceStorage else {
            if musicBytes + movieBytes <= 0 { return nil }
            return .libraryOnly(
                musicBytes: musicBytes,
                movieBytes: movieBytes,
                musicCount: musicCount,
                movieCount: movieCount
            )
        }
        return .disk(
            musicBytes: musicBytes,
            movieBytes: movieBytes,
            musicCount: musicCount,
            movieCount: movieCount,
            diskTotal: disk.totalBytes,
            diskFree: disk.freeBytes
        )
    }

    private var serverBreakdown: StorageBreakdown? {
        let musicBytes = Int64(app.serverLibraryBytes)
        let movieBytes = Int64(app.onlineMovies.serverMovieBytes)
        let musicCount = app.serverAssetCount
        let movieCount = app.onlineMovies.serverMovieCount
        if let total = app.serverDiskTotalBytes, total > 0 {
            let free = Int64(app.serverDiskFreeBytes ?? max(0, total - Int(musicBytes + movieBytes)))
            return .disk(
                musicBytes: musicBytes,
                movieBytes: movieBytes,
                musicCount: musicCount,
                movieCount: movieCount,
                diskTotal: Int64(total),
                diskFree: free
            )
        }
        if musicBytes + movieBytes <= 0 { return nil }
        return .libraryOnly(
            musicBytes: musicBytes,
            movieBytes: movieBytes,
            musicCount: musicCount,
            movieCount: movieCount
        )
    }

    private var serverStorageIsLibraryOnly: Bool {
        app.serverDiskTotalBytes == nil || (app.serverDiskTotalBytes ?? 0) <= 0
    }

    private func refreshStorageStats() {
        deviceStorage = StorageCapacityReader.deviceVolume()
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        LocalDownloadsBrowseView()
                    } label: {
                        FilesLocationRow(
                            title: AppConfig.appDisplayName,
                            subtitle: localDeviceSubtitle,
                            systemImage: "iphone",
                            tint: Color(white: 0.45),
                            breakdown: deviceBreakdown
                        )
                    }
                    .disabled(isEditing)

                    NavigationLink {
                        ServerMusicAssetsView()
                    } label: {
                        FilesLocationRow(
                            title: "Serwer EOS",
                            subtitle: serverLibrarySubtitle,
                            systemImage: "externaldrive.fill.badge.checkmark",
                            tint: EOSTheme.accent,
                            breakdown: serverBreakdown,
                            storageLibraryOnly: serverStorageIsLibraryOnly
                        )
                    }
                    .disabled(isEditing)
                } header: {
                    Text("Biblioteka")
                } footer: {
                    Text("Paski: różowy = muzyka, niebieski = filmy. Pobrane = offline na telefonie. Serwer EOS = trwała kopia w chmurze.")
                }

                Section {
                    FilesListButton {
                        activeLocation = .localFolder
                    } label: {
                        FilesLocationRow(
                            title: BrowseLocation.localFolder.title,
                            subtitle: BrowseLocation.localFolder.subtitle,
                            systemImage: BrowseLocation.localFolder.systemImage,
                            tint: BrowseLocation.localFolder.tint
                        )
                    }
                    .disabled(isEditing)

                    FilesListButton {
                        activeLocation = .iCloud
                    } label: {
                        FilesLocationRow(
                            title: BrowseLocation.iCloud.title,
                            subtitle: BrowseLocation.iCloud.subtitle,
                            systemImage: BrowseLocation.iCloud.systemImage,
                            tint: BrowseLocation.iCloud.tint
                        )
                    }
                    .disabled(isEditing)
                } header: {
                    Text("Dodaj muzykę")
                } footer: {
                    Text("Wybierz lokalny folder (np. On My iPhone → Muzyka) albo folder w iCloud Drive. Pliki MP3, M4A i FLAC pojawią się posortowane według wykonawców i albumów.")
                }

                if !sortedSources.isEmpty {
                    Section {
                        ForEach(sortedSources) { source in
                            if isEditing {
                                FilesFolderRow(
                                    name: source.name,
                                    detail: sourceDetail(source)
                                )
                            } else {
                                NavigationLink {
                                    ExternalSourceDetailView(source: source)
                                } label: {
                                    FilesFolderRow(
                                        name: source.name,
                                        detail: sourceDetail(source)
                                    )
                                }
                            }
                        }
                        .onDelete(perform: deleteSources)
                    } header: {
                        Text("Połączone foldery")
                    } footer: {
                        Text("Przesuń w lewo albo użyj Edytuj, aby odłączyć folder. Pliki na dysku pozostaną nietknięte.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Przeglądaj")
            .navigationBarTitleDisplayMode(.large)
            .eosScrollClearance()
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    EditButton()
                        .disabled(sortedSources.isEmpty)
                }
            }
            .environment(\.editMode, $editMode)
            .task {
                refreshStorageStats()
                await app.refreshServerAssets()
                await app.onlineMovies.refreshDownloads()
                refreshStorageStats()
            }
            .onAppear {
                refreshStorageStats()
            }
            .sheet(item: $activeLocation) { location in
                switch location {
                case .localFolder:
                    LocalFolderConnectionSheet { name, url in
                        try sources.connectFolder(kind: .localFolder, name: name, folderURL: url)
                    }
                case .iCloud:
                    ICloudConnectionSheet { name, url in
                        try sources.connectFolder(kind: .iCloudDrive, name: name, folderURL: url)
                    }
                }
            }
            .alert("Odłączyć folder?", isPresented: Binding(
                get: { sourceToDelete != nil },
                set: { if !$0 { sourceToDelete = nil } }
            )) {
                Button("Odłącz", role: .destructive) {
                    if let source = sourceToDelete {
                        sources.disconnect(source)
                    }
                    sourceToDelete = nil
                }
                Button("Anuluj", role: .cancel) { sourceToDelete = nil }
            } message: {
                if let source = sourceToDelete {
                    Text("„\(source.name)” zniknie z listy. Pliki na dysku pozostaną bez zmian.")
                }
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func sourceDetail(_ source: ConnectedMusicSource) -> String {
        let kindLabel: String
        if source.isSandboxFile {
            kindLabel = "Plik lokalny"
        } else {
            kindLabel = source.kind.title
        }
        if let email = source.accountEmail, !email.isEmpty {
            return "\(kindLabel) · \(email)"
        }
        return kindLabel
    }

    private func deleteSources(at offsets: IndexSet) {
        guard let index = offsets.first else { return }
        sourceToDelete = sortedSources[index]
    }
}
