import SwiftUI
import UniformTypeIdentifiers
import UIKit

private var audioImportTypes: [UTType] {
    var types: [UTType] = [.mp3, .mpeg4Audio, .audio, .aiff, .wav]
    if let flac = UTType(filenameExtension: "flac") { types.append(flac) }
    if let aac = UTType(filenameExtension: "aac") { types.append(aac) }
    if let alac = UTType(filenameExtension: "alac") { types.append(alac) }
    return types
}

// MARK: - Local folder (On My iPhone / Files)

struct LocalFolderConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onConnect: (String, URL) throws -> Void

    @State private var folderName = ""
    @State private var showFolderPicker = false
    @State private var showFilePicker = false
    @State private var isConnecting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label {
                        Text("Dodaj folder z muzyką zapisany na iPhonie lub w aplikacji Pliki — bez konta iCloud.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } icon: {
                        Image(systemName: "folder.fill")
                            .foregroundStyle(.orange)
                    }
                }

                Section {
                    TextField("Nazwa w Przeglądaj", text: $folderName, prompt: Text("np. Moja muzyka"))

                    Button { showFolderPicker = true } label: {
                        FilesActionRow(icon: "folder.badge.plus", title: "Wybierz folder", iconColor: .orange)
                    }
                    .disabled(isConnecting)

                    Button { showFilePicker = true } label: {
                        FilesActionRow(icon: "music.note", title: "Lub wybierz plik audio", iconColor: .orange)
                    }
                    .disabled(isConnecting)

                    if isConnecting {
                        HStack {
                            ProgressView()
                            Text("Dodaję…")
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Folder z muzyką")
                } footer: {
                    Text("Pojedynczy plik jest kopiowany do aplikacji i działa od razu. Folder zostaje podpięty z Plików (bookmark). MP3, M4A, FLAC, WAV.")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Lokalny folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                        .disabled(isConnecting)
                }
            }
            .fileImporter(
                isPresented: $showFolderPicker,
                allowedContentTypes: [.folder],
                allowsMultipleSelection: false
            ) { result in
                handleImport(result)
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: audioImportTypes,
                allowsMultipleSelection: false
            ) { result in
                handleImport(result)
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            let ns = error as NSError
            if ns.domain == NSCocoaErrorDomain, ns.code == NSUserCancelledError { return }
            if ns.code == NSUserCancelledError { return }
            errorMessage = error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            connect(url: url)
        }
    }

    private func connect(url: URL) {
        isConnecting = true
        defer { isConnecting = false }

        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = name.isEmpty ? url.deletingPathExtension().lastPathComponent : name
        do {
            try onConnect(resolved, url)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - iCloud Drive

struct ICloudConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onConnect: (String, URL) throws -> Void

    @State private var accountState = ICloudAccountService.currentState()
    @State private var folderName = ""
    @State private var showFolderPicker = false
    @State private var showFilePicker = false
    @State private var isConnecting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: accountState.isSignedIn ? "checkmark.icloud.fill" : "icloud.slash")
                            .foregroundStyle(accountState.isSignedIn ? .blue : .secondary)
                        Text(accountState.label)
                    }

                    if !accountState.isSignedIn {
                        FilesListButton {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            FilesActionRow(icon: "gear", title: "Otwórz Ustawienia iCloud", iconColor: .blue)
                        }
                    }
                } header: {
                    Text("Konto iCloud")
                }

                if accountState.isSignedIn {
                    Section {
                        TextField("Nazwa folderu", text: $folderName, prompt: Text("Moja muzyka"))

                        Button { showFolderPicker = true } label: {
                            FilesActionRow(icon: "folder.badge.plus", title: "Wybierz folder", iconColor: .blue)
                        }
                        .disabled(isConnecting)

                        Button { showFilePicker = true } label: {
                            FilesActionRow(icon: "music.note", title: "Lub wybierz plik audio", iconColor: .blue)
                        }
                        .disabled(isConnecting)

                        if isConnecting {
                            HStack {
                                ProgressView()
                                Text("Dodaję…")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } header: {
                        Text("Folder z muzyką")
                    } footer: {
                        Text("Pojedynczy plik jest kopiowany do aplikacji. Folder pozostaje w iCloud z dostępem przez bookmark.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("iCloud Drive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                        .disabled(isConnecting)
                }
            }
            .onAppear { accountState = ICloudAccountService.currentState() }
            .fileImporter(
                isPresented: $showFolderPicker,
                allowedContentTypes: [.folder],
                allowsMultipleSelection: false
            ) { result in
                handleImport(result)
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: audioImportTypes,
                allowsMultipleSelection: false
            ) { result in
                handleImport(result)
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            let ns = error as NSError
            if ns.domain == NSCocoaErrorDomain, ns.code == NSUserCancelledError { return }
            if ns.code == NSUserCancelledError { return }
            errorMessage = error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            connect(url: url)
        }
    }

    private func connect(url: URL) {
        isConnecting = true
        defer { isConnecting = false }

        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = name.isEmpty ? url.deletingPathExtension().lastPathComponent : name
        do {
            try onConnect(resolved, url)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
