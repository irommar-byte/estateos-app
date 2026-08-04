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
    @State private var activeLocation: BrowseLocation?
    @State private var editMode: EditMode = .inactive
    @State private var sourceToDelete: ConnectedMusicSource?
    @State private var errorMessage: String?

    private var isEditing: Bool { editMode == .active }

    private var sortedSources: [ConnectedMusicSource] {
        app.sources.sources.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    private var localDeviceSubtitle: String {
        let count = OfflineMusicStore.shared.downloadedFileCount
        if count == 0 { return "Utwory pobrane w EOS Music" }
        return "Pobrane · \(count) utworów"
    }

    private var serverLibrarySubtitle: String {
        let count = app.serverAssetCount
        if count == 0 { return "Muzyka zapisana trwale na serwerze" }
        let size = ByteCountFormatter.string(fromByteCount: Int64(app.serverLibraryBytes), countStyle: .file)
        return "\(count) utworów · \(size)"
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
                            tint: Color(white: 0.45)
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
                            tint: EOSTheme.accent
                        )
                    }
                    .disabled(isEditing)
                } header: {
                    Text("Biblioteka")
                } footer: {
                    Text("Pobrane = offline na telefonie. Serwer EOS = trwała kopia w chmurze — stream i pobranie na każde urządzenie.")
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
                await app.refreshServerAssets()
            }
            .sheet(item: $activeLocation) { location in
                switch location {
                case .localFolder:
                    LocalFolderConnectionSheet { name, url in
                        try app.sources.connectFolder(kind: .localFolder, name: name, folderURL: url)
                    }
                case .iCloud:
                    ICloudConnectionSheet { name, url in
                        try app.sources.connectFolder(kind: .iCloudDrive, name: name, folderURL: url)
                    }
                }
            }
            .alert("Odłączyć folder?", isPresented: Binding(
                get: { sourceToDelete != nil },
                set: { if !$0 { sourceToDelete = nil } }
            )) {
                Button("Odłącz", role: .destructive) {
                    if let source = sourceToDelete {
                        app.sources.disconnect(source)
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
        if let email = source.accountEmail, !email.isEmpty {
            return "\(source.kind.title) · \(email)"
        }
        return source.kind.title
    }

    private func deleteSources(at offsets: IndexSet) {
        guard let index = offsets.first else { return }
        sourceToDelete = sortedSources[index]
    }
}
