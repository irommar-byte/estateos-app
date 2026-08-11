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

        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        let name = url.lastPathComponent
        let audio = isAudioFileName(name)
        let videoCapable = isVideoFileName(name)

        if isAmbiguousMediaFile(url) {
            app.presentExternalOpen(
                ExternalOpenPrompt(
                    sourceURL: url,
                    fileName: name,
                    suggestedAudio: audio || videoCapable,
                    suggestedVideo: videoCapable
                )
            )
            return true
        }

        if audio {
            Task { await app.playExternalAudioFile(at: url) }
            return true
        }

        if videoCapable {
            Task { await video.openExternalVideo(at: url) }
            return true
        }

        app.libraryError = "Nieobsługiwany format pliku."
        return true
    }

    static func isMediaFileURL(_ url: URL) -> Bool {
        if url.scheme == "pl.nostalgie.eosmusic" { return false }
        guard url.isFileURL else { return false }
        let name = url.lastPathComponent
        guard !name.isEmpty, name != "/" else { return false }
        return isAudioFileName(name) || isVideoFileName(name)
    }

    /// mp4 / mov / m4v can be opened as music or video.
    static func isAmbiguousMediaFile(_ url: URL) -> Bool {
        let ext = (url.lastPathComponent as NSString).pathExtension.lowercased()
        return ["mp4", "mov", "m4v"].contains(ext)
    }
}
