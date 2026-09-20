import Foundation

@MainActor
final class ShazamIdentifyController: ObservableObject {
    static let shared = ShazamIdentifyController()

    @Published var isPresented = false
    @Published var isListening = false
    @Published var titleLine = "Słucham…"
    @Published var artistLine = ""
    @Published var artworkURL: URL?
    @Published var addStatus = ""
    @Published var addSucceeded: Bool?

    func bind(_ app: AppModel) {
        ShazamRecognitionCoordinator.shared.bind(app)
    }

    func userTapped() {
        isPresented = true
        guard let app = SiriPlaybackBridge.shared.app else { return }
        ShazamRecognitionCoordinator.shared.startFromUI(app: app)
    }

    func startListening() {
        guard let app = SiriPlaybackBridge.shared.app else { return }
        ShazamRecognitionCoordinator.shared.startFromUI(app: app)
    }

    func dismiss() {
        Task { await ShazamRecognitionCoordinator.shared.cancel() }
        isPresented = false
    }

    func applyExternal(
        title: String,
        artist: String,
        status: String,
        success: Bool?,
        listening: Bool
    ) {
        titleLine = title
        artistLine = artist
        addStatus = status
        addSucceeded = success
        isListening = listening
    }
}
