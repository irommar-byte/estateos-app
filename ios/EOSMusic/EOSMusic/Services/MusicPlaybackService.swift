import SwiftUI
import Combine

@MainActor
final class MusicPlaybackService: ObservableObject {
    @Published private(set) var engine: MusicPlaybackEngine? {
        didSet {
            engineCancellable?.cancel()
            guard let engine else { return }
            engineCancellable = engine.objectWillChange.sink { [weak self] _ in
                self?.objectWillChange.send()
            }
        }
    }

    private var engineCancellable: AnyCancellable?
    private var teardownHandler: (() -> Void)?

    func play(
        session: MusicPlaybackSession,
        api: MusicAPIClient,
        jobLookup: @escaping (String) -> String?,
        libraryTrackLookup: ((String) -> MusicTrack?)? = nil,
        externalFileResolver: ((MusicPlaybackTrack) async throws -> URL)? = nil,
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
