import Foundation

enum ExternalMediaKind: String {
    case audio
    case video
}

struct ExternalOpenPrompt: Identifiable, Equatable {
    let id = UUID()
    let sourceURL: URL
    let fileName: String
    let suggestedAudio: Bool
    let suggestedVideo: Bool
}

enum IncomingMediaRouter {
    /// Returns `true` when the URL was handled as media (not OAuth / deep link).
    @MainActor
    static func handle(_ url: URL, app: AppModel, video: VideoAppModel) -> Bool {
        guard isMediaFileURL(url) else { return false }

        let name = url.lastPathComponent
        let audio = isAudioFileName(name)
        let videoCapable = isVideoFileName(name)

        // Skopiuj do sandboxu ZANIM zwolnimy security-scope — inaczej async Task
        // nie ma już prawa czytać pliku z Files / Telegram / Share Sheet.
        let staged: URL
        do {
            staged = try stageIntoSandbox(url)
        } catch {
            app.libraryError = "Nie udało się otworzyć pliku: \(error.localizedDescription)"
            return true
        }

        if isAmbiguousMediaFile(url) {
            app.presentExternalOpen(
                ExternalOpenPrompt(
                    sourceURL: staged,
                    fileName: name,
                    suggestedAudio: audio || videoCapable,
                    suggestedVideo: videoCapable
                )
            )
            return true
        }

        if audio {
            Task { await app.playExternalAudioFile(at: staged) }
            return true
        }

        if videoCapable {
            Task {
                do {
                    try await video.openExternalVideo(at: staged)
                } catch {
                    app.presentToast(MusicToast(
                        systemImage: "exclamationmark.triangle",
                        title: "Nie udało się otworzyć wideo",
                        subtitle: error.localizedDescription
                    ))
                }
            }
            return true
        }

        app.libraryError = "Nieobsługiwany format pliku."
        return true
    }

    /// Natychmiastowa kopia do Documents — działa nawet gdy źródło jest tymczasowe.
    private static func stageIntoSandbox(_ source: URL) throws -> URL {
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }

        AppDocuments.ensureStructure()
        let safeName = source.lastPathComponent
            .replacingOccurrences(of: "/", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let fileName = safeName.isEmpty ? "import.mp3" : safeName
        let folder = isVideoFileName(fileName) ? AppDocuments.videoImports : AppDocuments.audioImports
        let dest = folder
            .appendingPathComponent("inbox-\(UUID().uuidString.prefix(8))-\(fileName)", isDirectory: false)

        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.copyItem(at: source, to: dest)
        return dest
    }

    static func isMediaFileURL(_ url: URL) -> Bool {
        if url.scheme == "pl.nostalgie.eosmusic" { return false }
        // file:// oraz rzadkie warianty Open In
        if url.isFileURL {
            let name = url.lastPathComponent
            guard !name.isEmpty, name != "/" else { return false }
            return isAudioFileName(name) || isVideoFileName(name)
        }
        return false
    }

    /// mp4 / mov / m4v can be opened as music or video.
    static func isAmbiguousMediaFile(_ url: URL) -> Bool {
        let ext = (url.lastPathComponent as NSString).pathExtension.lowercased()
        return ["mp4", "mov", "m4v"].contains(ext)
    }
}
