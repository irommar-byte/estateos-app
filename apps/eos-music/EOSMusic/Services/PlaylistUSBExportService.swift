import Foundation
import UniformTypeIdentifiers

@MainActor
final class PlaylistUSBExportService: ObservableObject {
    @Published var isExporting = false
    @Published var progress: Double = 0
    @Published var statusTitle = ""
    @Published var lastError: String?

    func export(
        playlistName: String,
        folderId: String,
        tracks: [MusicTrack],
        destinationRoot: URL,
        app: AppModel
    ) async {
        guard !tracks.isEmpty else { return }
        isExporting = true
        progress = 0
        lastError = nil
        statusTitle = "Zapisuję playlistę…"
        let accessed = destinationRoot.startAccessingSecurityScopedResource()
        defer {
            if accessed { destinationRoot.stopAccessingSecurityScopedResource() }
            isExporting = false
        }

        do {
            var isDir: ObjCBool = false
            guard FileManager.default.fileExists(atPath: destinationRoot.path, isDirectory: &isDir),
                  isDir.boolValue else {
                throw APIError.server("Wybrany folder jest niedostępny — podłącz pendrive ponownie.")
            }

            let folderName = sanitized(playlistName)
            let dest = destinationRoot.appendingPathComponent(folderName, isDirectory: true)
            try FileManager.default.createDirectory(at: dest, withIntermediateDirectories: true)

            for (index, track) in tracks.enumerated() {
                statusTitle = track.title
                progress = Double(index) / Double(tracks.count)
                let local = try await ensureLocalFile(for: track, app: app)
                let name = fileName(index: index + 1, track: track, source: local)
                let target = uniqueURL(in: dest, name: name)
                if FileManager.default.fileExists(atPath: target.path) == false {
                    try FileManager.default.copyItem(at: local, to: target)
                }
            }

            PlaylistUSBBookmarkStore.save(url: destinationRoot, folderId: folderId)
            progress = 1
            statusTitle = "Zapisano \(tracks.count) utworów"
            app.presentToast(MusicToast(
                systemImage: "externaldrive.badge.checkmark",
                title: "Playlista na USB",
                subtitle: "\(tracks.count) utworów · \(folderName)"
            ))
        } catch {
            lastError = error.localizedDescription
            PlaylistUSBBookmarkStore.clear(folderId: folderId)
            app.presentToast(MusicToast(
                systemImage: "externaldrive.badge.xmark",
                title: "Zapis na USB nie powiódł się",
                subtitle: error.localizedDescription
            ))
        }
    }

    private func ensureLocalFile(for track: MusicTrack, app: AppModel) async throws -> URL {
        if let local = OfflineMusicStore.shared.localURL(for: track.url) {
            return local
        }
        if let opened = OpenedAudioRegistry.localURL(for: track.url) {
            return opened
        }
        app.downloadTrack(track, folderId: track.folderId)
        let deadline = Date().addingTimeInterval(600)
        while Date() < deadline {
            if let local = OfflineMusicStore.shared.localURL(for: track.url) {
                return local
            }
            if case .failed(let message) = app.downloads.uiState(for: track.url, isOnServer: app.isOnServer(track.url)) {
                throw APIError.server(message)
            }
            try await Task.sleep(nanoseconds: 400_000_000)
        }
        throw APIError.server("Nie udało się pobrać „\(track.title)” na telefon.")
    }

    private func fileName(index: Int, track: MusicTrack, source: URL) -> String {
        let ext = source.pathExtension.isEmpty ? "mp3" : source.pathExtension
        let artist = sanitized(track.artist ?? "")
        let title = sanitized(track.title)
        if artist.isEmpty {
            return String(format: "%02d %@.%@", index, title, ext)
        }
        return String(format: "%02d %@ - %@.%@", index, artist, title, ext)
    }

    private func uniqueURL(in folder: URL, name: String) -> URL {
        let base = folder.appendingPathComponent(name)
        if !FileManager.default.fileExists(atPath: base.path) { return base }
        let stem = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var i = 2
        while true {
            let candidate = folder.appendingPathComponent("\(stem) \(i).\(ext)")
            if !FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            i += 1
        }
    }

    private func sanitized(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleaned = trimmed.replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        return cleaned.isEmpty ? "Utwór" : cleaned
    }
}
