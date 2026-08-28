import SwiftUI
import UniformTypeIdentifiers

struct VideoFolderConnectionSheet: View {
    @Environment(\.dismiss) private var dismiss

    let onConnect: (String, URL) throws -> Void

    @State private var folderName = ""
    @State private var showFilePicker = false
    @State private var errorMessage: String?
    @State private var isConnecting = false

    private var videoContentTypes: [UTType] {
        var types: [UTType] = [.movie, .mpeg4Movie, .quickTimeMovie, .avi, .mpeg]
        if let mkv = UTType(filenameExtension: "mkv") { types.append(mkv) }
        if let wmv = UTType(filenameExtension: "wmv") { types.append(wmv) }
        if let webm = UTType(filenameExtension: "webm") { types.append(webm) }
        if let ts = UTType(filenameExtension: "ts") { types.append(ts) }
        if let m2ts = UTType(filenameExtension: "m2ts") { types.append(m2ts) }
        return types
    }

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

                    Button {
                        FolderPickerPresenter.present(
                            onPick: { url in
                                connect(url: url)
                            }
                        )
                    } label: {
                        FilesActionRow(icon: "folder.badge.plus", title: "Wybierz folder", iconColor: EOSTheme.accent)
                    }
                    .disabled(isConnecting)

                    Button {
                        showFilePicker = true
                    } label: {
                        FilesActionRow(icon: "film", title: "Lub wybierz plik wideo", iconColor: EOSTheme.accent)
                    }
                    .disabled(isConnecting)

                    if isConnecting {
                        HStack {
                            ProgressView()
                            Text("Dodaję folder…")
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Folder z filmami")
                } footer: {
                    Text("Pojedynczy plik (np. MOV/MKV) jest kopiowany do aplikacji i działa od razu. Folder / USB zostaje podpięty z Plików (bookmark). Obsługa: MKV, AVI, MP4, MOV i inne — VLC, także HDR.")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Dodaj folder wideo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                        .disabled(isConnecting)
                }
            }
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: videoContentTypes,
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
        defer {
            if accessed { url.stopAccessingSecurityScopedResource() }
        }

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
