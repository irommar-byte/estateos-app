import SwiftUI

struct AddToPlaylistSheet: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let track: MusicTrackPayload
    let trackTitle: String

    @State private var showCreateFolder = false
    @State private var newFolderName = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var addedFolderId: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(app.musicFolders) { folder in
                        Button {
                            Task { await add(to: folder.id) }
                        } label: {
                            HStack {
                                ArtworkImage(url: folder.artworkURL, size: 44, cornerRadius: 8)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(folder.name)
                                        .foregroundStyle(EOSTheme.textPrimary)
                                    Text(folder.countLabel)
                                        .font(.caption)
                                        .foregroundStyle(EOSTheme.textSecondary)
                                }
                                Spacer()
                                if addedFolderId == folder.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(EOSTheme.accent)
                                } else if isSaving {
                                    ProgressView()
                                }
                            }
                        }
                        .disabled(isSaving)
                    }
                } header: {
                    Text("Wybierz playlistę")
                }
            }
            .scrollContentBackground(.hidden)
            .background(EOSAmbientBackground())
            .navigationTitle("Dodaj do playlisty")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showCreateFolder = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .alert("Nowa playlista", isPresented: $showCreateFolder) {
                TextField("Nazwa", text: $newFolderName)
                Button("Anuluj", role: .cancel) { newFolderName = "" }
                Button("Utwórz") {
                    Task { await createFolderAndAdd() }
                }
            } message: {
                Text("Utwórz playlistę i dodaj „\(trackTitle)”.")
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func add(to folderId: String) async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await app.addTrackToFolder(folderId: folderId, track: track)
            addedFolderId = folderId
            try? await Task.sleep(nanoseconds: 400_000_000)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func createFolderAndAdd() async {
        let name = newFolderName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let folder = try await app.api.createMusicFolder(name: name)
            try await app.refreshMusicLibrary()
            newFolderName = ""
            try await app.addTrackToFolder(folderId: folder.id, track: track)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
