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

    let onImportFolder: (String, URL) async throws -> Void
    let onImportFile: (String, URL) throws -> Void

    @State private var folderName = ""
    @State private var showFilePicker = false
    @State private var isConnecting = false
    @State private var statusMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label {
                        Text("Wybierz folder z muzyką — utworzy się playlista o tej samej nazwie, a wszystkie utwory trafią do biblioteki i na serwer EOS.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } icon: {
                        Image(systemName: "folder.fill")
                            .foregroundStyle(.orange)
                    }
                }

                Section {
                    TextField("Nazwa playlisty", text: $folderName, prompt: Text("np. Moja muzyka"))

                    Button {
                        FolderPickerPresenter.present(
                            onPick: { url in
                                connect(url: url, expectsDirectory: true)
                            }
                        )
                    } label: {
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
                            Text(statusMessage ?? "Importuję…")
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Folder z muzyką")
                } footer: {
                    Text("Folder → nowa playlista + automatyczny zapis na serwerze. Pojedynczy plik zostaje podpięty lokalnie (MP3, M4A, FLAC, WAV).")
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
                isPresented: $showFilePicker,
                allowedContentTypes: audioImportTypes,
                allowsMultipleSelection: false
            ) { result in
                handleImport(result, expectsDirectory: false)
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func handleImport(_ result: Result<[URL], Error>, expectsDirectory: Bool) {
        switch result {
        case .failure(let error):
            let ns = error as NSError
            if ns.domain == NSCocoaErrorDomain, ns.code == NSUserCancelledError { return }
            if ns.code == NSUserCancelledError { return }
            errorMessage = error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            connect(url: url, expectsDirectory: expectsDirectory)
        }
    }

    private func connect(url: URL, expectsDirectory: Bool) {
        isConnecting = true
        errorMessage = nil

        let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = name.isEmpty ? url.deletingPathExtension().lastPathComponent : name

        Task {
            defer { isConnecting = false }
            do {
                var isDirectory: ObjCBool = false
                _ = FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
                let isDir = isDirectory.boolValue

                if expectsDirectory || isDir {
                    statusMessage = "Skanuję folder…"
                    try await onImportFolder(resolved, url)
                } else {
                    statusMessage = "Dodaję plik…"
                    try onImportFile(resolved, url)
                }
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - iCloud Drive

struct ICloudConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onImportFolder: (String, URL) async throws -> Void
    let onImportFile: (String, URL) throws -> Void

    @State private var accountState = ICloudAccountService.currentState()
    @State private var folderName = ""
    @State private var showFilePicker = false
    @State private var isConnecting = false
    @State private var statusMessage: String?
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
                        TextField("Nazwa playlisty", text: $folderName, prompt: Text("Moja muzyka"))

                        Button {
                            FolderPickerPresenter.present(
                                onPick: { url in
                                    connect(url: url, expectsDirectory: true)
                                }
                            )
                        } label: {
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
                                Text(statusMessage ?? "Importuję…")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    } header: {
                        Text("Folder z muzyką")
                    } footer: {
                        Text("Folder → nowa playlista + automatyczny zapis na serwerze EOS. Pojedynczy plik zostaje podpięty z iCloud.")
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
                isPresented: $showFilePicker,
                allowedContentTypes: audioImportTypes,
                allowsMultipleSelection: false
            ) { result in
                handleImport(result, expectsDirectory: false)
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func handleImport(_ result: Result<[URL], Error>, expectsDirectory: Bool) {
        switch result {
        case .failure(let error):
            let ns = error as NSError
            if ns.domain == NSCocoaErrorDomain, ns.code == NSUserCancelledError { return }
            if ns.code == NSUserCancelledError { return }
            errorMessage = error.localizedDescription
        case .success(let urls):
            guard let url = urls.first else { return }
            connect(url: url, expectsDirectory: expectsDirectory)
        }
    }

    private func connect(url: URL, expectsDirectory: Bool) {
        isConnecting = true
        errorMessage = nil

        let name = folderName.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolved = name.isEmpty ? url.deletingPathExtension().lastPathComponent : name

        Task {
            defer { isConnecting = false }
            do {
                var isDirectory: ObjCBool = false
                _ = FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory)
                let isDir = isDirectory.boolValue

                if expectsDirectory || isDir {
                    statusMessage = "Skanuję folder…"
                    try await onImportFolder(resolved, url)
                } else {
                    statusMessage = "Dodaję plik…"
                    try onImportFile(resolved, url)
                }
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
