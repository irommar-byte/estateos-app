import SwiftUI
import UniformTypeIdentifiers

struct VideoFolderConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onConnect: (String, URL) throws -> Void

    @State private var folderName = ""
    @State private var showFolderPicker = false
    @State private var showFilePicker = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label {
                        Text("Wybierz folder z filmami na iPhonie, w iCloud albo na dysku USB podłączonym w aplikacji Pliki.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } icon: {
                        Image(systemName: "film.stack.fill")
                            .foregroundStyle(EOSTheme.accent)
                    }
                }

                Section {
                    TextField("Nazwa w bibliotece", text: $folderName, prompt: Text("np. Filmy USB"))

                    FilesListButton { showFolderPicker = true } label: {
                        FilesActionRow(icon: "folder.badge.plus", title: "Wybierz folder", iconColor: EOSTheme.accent)
                    }
                    FilesListButton { showFilePicker = true } label: {
                        FilesActionRow(icon: "film", title: "Lub wybierz plik wideo", iconColor: EOSTheme.accent)
                    }
                } header: {
                    Text("Folder z filmami")
                } footer: {
                    Text("Obsługiwane: MKV, AVI, MP4, MOV, M4V, WMV, WebM, TS, M2TS, MPG i inne. Player używa VLC (także HDR).")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Dodaj folder wideo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
            }
            .sheet(isPresented: $showFolderPicker) {
                FolderDocumentPicker { result in
                    handleImport(result.map { [$0] })
                    showFolderPicker = false
                }
            }
            .sheet(isPresented: $showFilePicker) {
                VideoDocumentPicker { result in
                    handleImport(result.map { [$0] })
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

    private func handleImport(_ result: Result<[URL], Error>) {
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

struct VideoDocumentPicker: UIViewControllerRepresentable {
    let onPick: (Result<URL, Error>) -> Void

    func makeCoordinator() -> FolderDocumentPicker.Coordinator {
        FolderDocumentPicker.Coordinator(onPick: onPick)
    }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        var types: [UTType] = [.movie, .mpeg4Movie, .quickTimeMovie, .avi]
        if let mkv = UTType(filenameExtension: "mkv") { types.append(mkv) }
        if let mpeg = UTType(filenameExtension: "mpeg") { types.append(mpeg) }
        if let ts = UTType(filenameExtension: "ts") { types.append(ts) }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: false)
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
}
