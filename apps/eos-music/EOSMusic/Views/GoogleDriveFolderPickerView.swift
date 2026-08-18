import SwiftUI

struct GoogleDriveFolderPickerView: View {
    let onSelect: (GoogleDriveItem) -> Void

    @State private var path: [(id: String, name: String)] = [("root", "Mój dysk")]
    @State private var items: [GoogleDriveItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    private var currentFolderId: String { path.last?.id ?? "root" }
    private var currentFolderName: String { path.last?.name ?? "Mój dysk" }

    var body: some View {
        Group {
            if isLoading && items.isEmpty {
                ProgressView("Ładuję foldery…")
            } else {
                List {
                    if path.count > 1 {
                        Section {
                            FilesListButton {
                                path.removeLast()
                                Task { await load() }
                            } label: {
                                FilesActionRow(icon: "chevron.left", title: "Wstecz", iconColor: .blue)
                            }
                        }
                    }

                    Section {
                        FilesListButton {
                            onSelect(GoogleDriveItem(
                                id: currentFolderId,
                                name: currentFolderName,
                                isFolder: true,
                                mimeType: nil,
                                size: nil
                            ))
                        } label: {
                            FilesActionRow(icon: "checkmark.circle.fill", title: "Użyj tego folderu", iconColor: .blue)
                        }
                    }

                    Section {
                        if items.filter(\.isFolder).isEmpty {
                            Text("Brak podfolderów")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(items.filter(\.isFolder)) { folder in
                                FilesListButton {
                                    path.append((folder.id, folder.name))
                                    Task { await load() }
                                } label: {
                                    FilesFolderRow(name: folder.name, detail: "Folder")
                                }
                            }
                        }
                    } header: {
                        Text("Podfoldery")
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle(currentFolderName)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: currentFolderId) { await load() }
        .refreshable { await load() }
        .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await GoogleDriveAuthService.shared.accessToken()
            let client = GoogleDriveClient(accessToken: token)
            items = try await client.listChildren(folderId: currentFolderId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
