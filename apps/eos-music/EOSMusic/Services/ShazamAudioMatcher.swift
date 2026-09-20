import AVFoundation
import Foundation
import ShazamKit

enum ShazamMatcherEvent {
    case match(SHMediaItem)
    case noMatch(Error?)
    case level(Float)
    case failed(Error)
    case timeout
}

enum ShazamIdentifyError: Error {
    case notRecognized
    case noNetwork
    case noMicrophone
    case service(String)
    case alreadyListening
    case activityUnavailable

    var titleLine: String {
        switch self {
        case .notRecognized: return "Nie rozpoznano utworu"
        case .noNetwork: return "Brak sieci"
        case .noMicrophone: return "Brak dostępu do mikrofonu"
        case .service: return "Błąd usługi Shazam"
        case .alreadyListening: return "Już słucham"
        case .activityUnavailable: return "Włącz Live Activities"
        }
    }

    var reason: String {
        switch self {
        case .notRecognized: return "brak rozpoznania"
        case .noNetwork: return "brak sieci"
        case .noMicrophone: return "odmowa mikrofonu"
        case .service(let message): return message
        case .alreadyListening: return "już słucham"
        case .activityUnavailable: return "brak Live Activity"
        }
    }

    static func isNetwork(_ error: Error) -> Bool {
        if APIError.isTimeout(error) { return true }
        if let url = error as? URLError {
            switch url.code {
            case .notConnectedToInternet, .timedOut, .networkConnectionLost,
                 .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed:
                return true
            default:
                return false
            }
        }
        if let api = error as? APIError, case .network = api { return true }
        return false
    }
}

final class ShazamAudioMatcher: NSObject, SHSessionDelegate, @unchecked Sendable {
    private let audioEngine = AVAudioEngine()
    private var shazamSession = SHSession()
    private let onEvent: @Sendable (ShazamMatcherEvent) -> Void
    private let lock = NSLock()
    private var isRunning = false
    private var lastLevelPublish = Date.distantPast
    private var lastBufferAt = Date()
    private var watchdog: Timer?

    init(onEvent: @escaping @Sendable (ShazamMatcherEvent) -> Void) {
        self.onEvent = onEvent
        super.init()
        shazamSession.delegate = self
    }

    func start() throws {
        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw ShazamIdentifyError.noMicrophone
        }
        lock.lock()
        isRunning = true
        lock.unlock()
        input.installTap(onBus: 0, bufferSize: 4_096, format: format) { [weak self] buffer, time in
            guard let self, self.running else { return }
            self.lastBufferAt = Date()
            self.shazamSession.matchStreamingBuffer(buffer, at: time)
            self.publishLevelIfNeeded(buffer)
        }
        lastBufferAt = Date()
        audioEngine.prepare()
        try audioEngine.start()
        DispatchQueue.main.async { [weak self] in
            self?.watchdog = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in
                guard let self, self.running else { return }
                if Date().timeIntervalSince(self.lastBufferAt) > 8 {
                    self.onEvent(.failed(ShazamIdentifyError.service("brak próbek")))
                }
            }
        }
    }

    func stop() {
        lock.lock()
        let wasRunning = isRunning
        isRunning = false
        lock.unlock()
        watchdog?.invalidate()
        watchdog = nil
        guard wasRunning else { return }
        audioEngine.inputNode.removeTap(onBus: 0)
        audioEngine.stop()
    }

    private var running: Bool {
        lock.lock()
        defer { lock.unlock() }
        return isRunning
    }

    private func publishLevelIfNeeded(_ buffer: AVAudioPCMBuffer) {
        let now = Date()
        guard now.timeIntervalSince(lastLevelPublish) >= 0.45 else { return }
        lastLevelPublish = now
        guard let channels = buffer.floatChannelData, buffer.frameLength > 0 else { return }
        let samples = channels[0]
        let count = Int(buffer.frameLength)
        var sum: Float = 0
        for index in 0..<count {
            let sample = samples[index]
            sum += sample * sample
        }
        let rms = sqrt(sum / Float(count))
        DispatchQueue.main.async { [onEvent] in onEvent(.level(rms)) }
    }

    func session(_ session: SHSession, didFind match: SHMatch) {
        guard let item = preferredItem(from: match) else { return }
        DispatchQueue.main.async { [onEvent] in onEvent(.match(item)) }
    }

    private func preferredItem(from match: SHMatch) -> SHMediaItem? {
        let items = match.mediaItems
        if let both = items.first(where: {
            ($0.appleMusicID?.isEmpty == false) && ($0.isrc?.isEmpty == false)
        }) {
            return both
        }
        if let apple = items.first(where: { $0.appleMusicID?.isEmpty == false }) {
            return apple
        }
        if let named = items.first(where: {
            !($0.title ?? "").isEmpty && !($0.artist ?? "").isEmpty
        }) {
            return named
        }
        return items.first
    }

    func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
        DispatchQueue.main.async { [onEvent] in onEvent(.noMatch(error)) }
    }
}
