import SwiftUI

private enum CloudLocation: String, Identifiable {
    case iCloud

    var id: String { rawValue }

    var title: String { "iCloud Drive" }

    var subtitle: String { "Konto iCloud i foldery w chmurze" }

    var systemImage: String { "icloud.fill" }

    var tint: Color { .blue }
}

struct SourcesView: View {
    @EnvironmentObject private var app: AppModel
    @State private var activeLocation: CloudLocation?
    @State private var editMode: EditMode = .inactive
    @State private var sourceToDelete: ConnectedMusicSource?
    @State private var errorMessage: String?

    private var isEditing: Bool { editMode == .active }

    private var localDeviceSubtitle: String {
        let count = OfflineMusicStore.shared.downloadedFileCount
        if count == 0 { return "Folder Pobrane — widoczny w aplikacji Pliki" }
        return "Pobrane · \(count) utworów"
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
                } header: {
                    Text("Na moim iPhonie")
                }

                Section {
                    FilesListButton {
                        activeLocation = .iCloud
                    } label: {
                        FilesLocationRow(
                            title: CloudLocation.iCloud.title,
                            subtitle: CloudLocation.iCloud.subtitle,
                            systemImage: CloudLocation.iCloud.systemImage,
                            tint: CloudLocation.iCloud.tint
                        )
                    }
                    .disabled(isEditing)
                } header: {
                    Text("Lokalizacje")
                } footer: {
                    Text("Dotknij lokalizacji, aby dodać folder z muzyką — tak jak w aplikacji Pliki.")
                }

                if !app.sources.sources.isEmpty {
                    Section {
                        ForEach(app.sources.sources) { source in
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
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Przeglądaj")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    EditButton()
                        .disabled(app.sources.sources.isEmpty)
                }
            }
            .environment(\.editMode, $editMode)
            .sheet(item: $activeLocation) { location in
                ICloudConnectionSheet { name, url in
                    try app.sources.connectFolder(kind: .iCloudDrive, name: name, folderURL: url)
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
        sourceToDelete = app.sources.sources[index]
    }
}
