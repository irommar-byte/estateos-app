import SwiftUI
import UniformTypeIdentifiers

struct GoogleDriveConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var auth = GoogleDriveAuthService.shared

    let onConnectAPI: (String, String, String) -> Void
    let onConnectFolder: (String, URL) throws -> Void

    @State private var folderName = ""
    @State private var selectedFolder: GoogleDriveItem?
    @State private var isSigningIn = false
    @State private var errorMessage: String?
    @State private var showSetupAlert = false
    @State private var showFilesPicker = false

    var body: some View {
        NavigationStack {
            Group {
                if auth.isSignedIn {
                    signedInContent
                } else {
                    signedOutContent
                }
            }
            .navigationTitle("Google Drive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
                if auth.isSignedIn, selectedFolder != nil {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Gotowe") { connectSelectedFolder() }
                    }
                }
            }
            .overlay {
                if isSigningIn {
                    ProgressView("Logowanie…")
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .alert("Wymagana konfiguracja", isPresented: $showSetupAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Uzupełnij CLIENT_ID w pliku GoogleOAuth.plist (Google Cloud Console → OAuth iOS).\n\nNa razie użyj „Wybierz folder” — działa przez aplikację Pliki.")
            }
            .fileImporter(
                isPresented: $showFilesPicker,
                allowedContentTypes: [.folder],
                allowsMultipleSelection: false
            ) { result in
                handleFilesImport(result)
            }
        }
    }

    @ViewBuilder
    private var signedOutContent: some View {
        List {
            Section {
                TextField("Nazwa folderu", text: $folderName, prompt: Text("Moja muzyka"))

                FilesListButton { showFilesPicker = true } label: {
                    FilesActionRow(icon: "folder.badge.plus", title: "Wybierz folder", iconColor: .blue)
                }
            } header: {
                Text("Przez aplikację Pliki")
            } footer: {
                Text("Włącz Google Drive w Ustawienia → iCloud → Pliki, potem wybierz folder z muzyką.")
            }

            Section {
                FilesListButton { handleSignInTap() } label: {
                    FilesActionRow(
                        icon: "person.crop.circle.badge.plus",
                        title: "Zaloguj się przez Google",
                        iconColor: auth.isConfigured ? .primary : .secondary
                    )
                }
                .disabled(isSigningIn)
            } header: {
                Text("Logowanie Google")
            } footer: {
                if auth.isConfigured {
                    Text("Przeglądaj foldery bezpośrednio z Dysku Google.")
                } else {
                    Text("OAuth nie jest skonfigurowany — użyj opcji przez Pliki powyżej.")
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    @ViewBuilder
    private var signedInContent: some View {
        List {
            Section {
                if let email = auth.email {
                    HStack(spacing: 12) {
                        Image(systemName: "person.crop.circle.fill")
                            .foregroundStyle(.secondary)
                        Text(email)
                    }
                }
                FilesListButton {
                    auth.signOut()
                    selectedFolder = nil
                } label: {
                    FilesActionRow(icon: "rectangle.portrait.and.arrow.right", title: "Wyloguj", iconColor: .red, titleColor: .red)
                }
            } header: {
                Text("Konto Google")
            }

            Section {
                TextField("Nazwa folderu", text: $folderName, prompt: Text("Moja muzyka"))

                NavigationLink {
                    GoogleDriveFolderPickerView { folder in
                        selectedFolder = folder
                        if folderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            folderName = folder.name
                        }
                    }
                } label: {
                    HStack {
                        Text("Folder")
                        Spacer()
                        Text(selectedFolder?.name ?? "Wybierz…")
                            .foregroundStyle(selectedFolder == nil ? .secondary : .primary)
                    }
                }
            } header: {
                Text("Folder z muzyką")
            }

            if let folder = selectedFolder {
                Section {
                    FilesListButton { connectSelectedFolder() } label: {
                        FilesActionRow(icon: "link", title: "Połącz „\(folder.name)”", iconColor: .blue)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func handleSignInTap() {
        guard auth.isConfigured else {
            showSetupAlert = true
            return
        }
        Task { await signIn() }
    }

    private func signIn() async {
        isSigningIn = true
        defer { isSigningIn = false }
        do {
            try await auth.signIn()
        } catch {
            if case GoogleDriveAuthError.cancelled = error { return }
            errorMessage = error.localizedDescription
        }
    }

    private func connectSelectedFolder() {
        guard let folder = selectedFolder, let email = auth.email else { return }
        let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = name.isEmpty ? folder.name : name
        onConnectAPI(resolved, folder.id, email)
        dismiss()
    }

    private func handleFilesImport(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            if (error as NSError).code != NSUserCancelledError {
                errorMessage = error.localizedDescription
            }
        case .success(let urls):
            guard let url = urls.first else { return }
            let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
            let resolved = name.isEmpty ? url.lastPathComponent : name
            do {
                try onConnectFolder(resolved, url)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
