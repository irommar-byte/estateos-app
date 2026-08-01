import SwiftUI
import UIKit

struct LocalAudioFileItem: Identifiable, Hashable {
    let id: String
    let url: URL
    let title: String
    let artist: String?
    let modifiedAt: Date
    let fileSize: Int64
}

struct LocalDownloadsBrowseView: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject private var offline = OfflineMusicStore.shared

    @State private var files: [LocalAudioFileItem] = []
    @State private var searchText = ""
    @State private var fileToDelete: LocalAudioFileItem?
    @State private var editMode: EditMode = .inactive

    private var filtered: [LocalAudioFileItem] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return files }
        return files.filter {
            $0.title.localizedCaseInsensitiveContains(q)
                || ($0.artist?.localizedCaseInsensitiveContains(q) ?? false)
        }
    }

    var body: some View {
        List {
            Section {
                if filtered.isEmpty {
                    ContentUnavailableView(
                        searchText.isEmpty ? "Brak pobranych utworów" : "Brak wyników",
                        systemImage: "music.note",
                        description: Text(searchText.isEmpty
                            ? "Pobierz utwory w Bibliotece — pojawią się tutaj i w aplikacji Pliki."
                            : "Spróbuj innej frazy.")
                    )
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(filtered) { item in
                        if editMode == .active {
                            localRow(item)
                        } else {
                            Button {
                                Task { await play(item) }
                            } label: {
                                localRow(item)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button {
                                    share(item)
                                } label: {
                                    Label("Udostępnij", systemImage: "square.and.arrow.up")
                                }
                                Button("Usuń", role: .destructive) {
                                    fileToDelete = item
                                }
                            }
                        }
                    }
                    .onDelete(perform: deleteFiles)
                }
            } header: {
                Text("Pobrane")
            } footer: {
                Text("Lokalne kopie offline. Folder: Pliki → Na moim iPhonie → \(AppConfig.appDisplayName) → Pobrane. Usunięcie stąd nie kasuje biblioteki EOS na serwerze.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Na moim iPhonie")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $searchText, prompt: "Szukaj")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                EditButton()
                    .disabled(files.isEmpty)
            }
        }
        .environment(\.editMode, $editMode)
        .onAppear { reload() }
        .onChange(of: offline.entries) { _, _ in reload() }
        .refreshable { reload() }
        .alert("Usunąć plik?", isPresented: Binding(
            get: { fileToDelete != nil },
            set: { if !$0 { fileToDelete = nil } }
        )) {
            Button("Usuń", role: .destructive) {
                if let item = fileToDelete {
                    offline.removeFile(at: item.url)
                    reload()
                }
                fileToDelete = nil
            }
            Button("Anuluj", role: .cancel) { fileToDelete = nil }
        } message: {
            if let item = fileToDelete {
                Text("„\(item.title)” zostanie usunięty z telefonu.")
            }
        }
    }

    @ViewBuilder
    private func localRow(_ item: LocalAudioFileItem) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "music.note")
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(rowSubtitle(item))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }

    private func rowSubtitle(_ item: LocalAudioFileItem) -> String {
        let date = item.modifiedAt.formatted(date: .numeric, time: .omitted)
        let size = ByteCountFormatter.string(fromByteCount: item.fileSize, countStyle: .file)
        if let artist = item.artist, !artist.isEmpty {
            return "\(artist) · \(date) · \(size)"
        }
        return "\(date) · \(size)"
    }

    private func reload() {
        AppDocuments.ensureStructure()
        let urls = offline.allLocalAudioFiles()
        files = urls.map { url in
            let entry = offline.entries.values.first { $0.fileName == url.lastPathComponent }
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
            let parsed = parseAudioTitle(from: url.deletingPathExtension().lastPathComponent)
            return LocalAudioFileItem(
                id: url.absoluteString,
                url: url,
                title: entry?.title ?? parsed.title,
                artist: entry?.artist ?? parsed.artist,
                modifiedAt: values?.contentModificationDate ?? Date(),
                fileSize: Int64(values?.fileSize ?? 0)
            )
        }
    }

    private func play(_ item: LocalAudioFileItem) async {
        let track = MusicPlaybackTrack(
            externalFile: item.url,
            externalRelativePath: nil,
            webDAVPath: nil,
            sourceId: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
            title: item.title,
            artist: item.artist,
            album: nil
        )
        let session = MusicPlaybackSession(
            queue: [track],
            startIndex: 0,
            folderId: nil,
            folderName: "Pobrane",
            externalSourceId: nil
        )
        await app.playback.play(session: session, api: app.api, jobLookup: { _ in nil })
        app.isFullPlayerPresented = false
    }

    private func share(_ item: LocalAudioFileItem) {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = scene.windows.first?.rootViewController else { return }
        let vc = UIActivityViewController(activityItems: [item.url], applicationActivities: nil)
        root.present(vc, animated: true)
    }

    private func deleteFiles(at offsets: IndexSet) {
        guard let index = offsets.first else { return }
        fileToDelete = filtered[index]
    }
}
