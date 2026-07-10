import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct ICloudConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onConnect: (String, URL) throws -> Void

    @State private var accountState = ICloudAccountService.currentState()
    @State private var folderName = ""
    @State private var showFolderPicker = false
    @State private var showFilePicker = false
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

                        FilesListButton { showFolderPicker = true } label: {
                            FilesActionRow(icon: "folder.badge.plus", title: "Wybierz folder", iconColor: .blue)
                        }
                        FilesListButton { showFilePicker = true } label: {
                            FilesActionRow(icon: "music.note", title: "Lub wybierz plik audio", iconColor: .blue)
                        }
                    } header: {
                        Text("Folder z muzyką")
                    } footer: {
                        Text("Wybierz folder z plikami MP3, M4A lub FLAC. Jeśli dostawca nie pozwala wybrać folderu (Open jest nieaktywne), wybierz dowolny plik audio — użyjemy jego folderu.")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("iCloud Drive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
            }
            .onAppear { accountState = ICloudAccountService.currentState() }
            .sheet(isPresented: $showFolderPicker) {
                FolderDocumentPicker { result in
                    handleFolderImport(result.map { [$0] })
                    showFolderPicker = false
                }
            }
            .sheet(isPresented: $showFilePicker) {
                AudioDocumentPicker { result in
                    let mapped: Result<[URL], Error> = result.map { [$0] }
                    handleFolderImport(mapped)
                    showFilePicker = false
                }
            }
            .alert("Błąd", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func handleFolderImport(_ result: Result<[URL], Error>) {
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
                try onConnect(resolved, url)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

private struct FolderDocumentPicker: UIViewControllerRepresentable {
    let onPick: (Result<URL, Error>) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.folder],
            asCopy: false
        )
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        picker.directoryURL = nil
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (Result<URL, Error>) -> Void

        init(onPick: @escaping (Result<URL, Error>) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard var url = urls.first else {
                onPick(.failure(NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)))
                return
            }
            if !url.hasDirectoryPath {
                url = url.deletingLastPathComponent()
            }
            onPick(.success(url))
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onPick(.failure(NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)))
        }
    }
}

private struct AudioDocumentPicker: UIViewControllerRepresentable {
    let onPick: (Result<URL, Error>) -> Void

    func makeCoordinator() -> FolderDocumentPicker.Coordinator {
        FolderDocumentPicker.Coordinator(onPick: onPick)
    }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.audio],
            asCopy: false
        )
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        picker.directoryURL = nil
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
}
