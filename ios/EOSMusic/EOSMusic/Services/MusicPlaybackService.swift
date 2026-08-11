import SwiftUI
import Combine

@MainActor
final class MusicPlaybackService: ObservableObject {
    @Published private(set) var engine: MusicPlaybackEngine? {
        didSet {
            bindEngineSignals()
        }
    }

    private var engineCancellables = Set<AnyCancellable>()
    private var teardownHandler: (() -> Void)?

    /// Forward only identity / transport changes — never every currentTime tick.
    private func bindEngineSignals() {
        engineCancellables = []
        guard let engine else {
            objectWillChange.send()
            return
        }
        objectWillChange.send()

        Publishers.MergeMany(
            engine.$currentTrack.map { _ in () }.eraseToAnyPublisher(),
            engine.$displayArtwork.map { _ in () }.eraseToAnyPublisher(),
            engine.$isPlaying.map { _ in () }.eraseToAnyPublisher(),
            engine.$isLoading.map { _ in () }.eraseToAnyPublisher(),
            // Do NOT forward isBuffering — it flickers and rebuilds every @EnvironmentObject app list.
            engine.$errorMessage.map { _ in () }.eraseToAnyPublisher()
        )
        .receive(on: RunLoop.main)
        .sink { [weak self] _ in
            self?.objectWillChange.send()
        }
        .store(in: &engineCancellables)
    }

    func play(
        session: MusicPlaybackSession,
        api: MusicAPIClient,
        jobLookup: @escaping (String) -> String?,
        libraryTrackLookup: ((String) -> MusicTrack?)? = nil,
        externalFileResolver: ((MusicPlaybackTrack) async throws -> URL)? = nil,
        offlineOnly: Bool = false,
        onTeardown: (() -> Void)? = nil
    ) async {
        if let old = engine {
            old.stop()
            engine = nil
        }
        teardownHandler?()
        teardownHandler = onTeardown

        let newEngine = MusicPlaybackEngine(session: session)
        newEngine.configure(
            api: api,
            jobLookup: jobLookup,
            libraryTrackLookup: libraryTrackLookup,
            externalFileResolver: externalFileResolver,
            onTeardown: { [weak self] in
                self?.teardownHandler?()
                self?.teardownHandler = nil
            }
        )
        newEngine.offlineOnly = offlineOnly
        engine = newEngine
        await newEngine.start()
    }

    func stop() {
        engine?.stop()
        engine = nil
        teardownHandler?()
        teardownHandler = nil
    }
}
