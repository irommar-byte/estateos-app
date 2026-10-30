import AVFoundation
import Foundation

enum CoffeeSounds {
    private static var pourPlayer: AVAudioPlayer?
    private static var thankYouPlayer: AVAudioPlayer?
    private static var fadeTask: Task<Void, Never>?

    static func prepare() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        if pourPlayer == nil {
            pourPlayer = makePlayer(resource: "coffee_sound", ext: "mp3")
            pourPlayer?.prepareToPlay()
        }
        if thankYouPlayer == nil {
            thankYouPlayer = makePlayer(resource: "coffee_thank_you", ext: "mp3")
            thankYouPlayer?.prepareToPlay()
        }
    }

    static func pour() {
        prepare()
        guard let player = pourPlayer else { return }
        player.currentTime = 0
        player.volume = 1
        player.play()
    }

    static func thankYou() {
        prepare()
        fadeTask?.cancel()
        pourPlayer?.stop()
        guard let player = thankYouPlayer else { return }
        player.currentTime = 0
        player.volume = 1
        player.play()
        scheduleSoftOutro(for: player)
    }

    static func stopThankYou() {
        fadeTask?.cancel()
        fadeTask = nil
        thankYouPlayer?.stop()
        thankYouPlayer?.currentTime = 0
        thankYouPlayer?.volume = 1
    }

    static var thankYouDuration: TimeInterval {
        prepare()
        let duration = thankYouPlayer?.duration ?? CoffeeThankYouCue.end
        return duration > 1 ? duration : CoffeeThankYouCue.end
    }

    private static func scheduleSoftOutro(for player: AVAudioPlayer) {
        let start = CoffeeThankYouCue.decay
        let length = max(0.4, CoffeeThankYouCue.end - CoffeeThankYouCue.decay)
        fadeTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(start * 1_000_000_000))
            guard Task.isCancelled == false, player.isPlaying else { return }
            let steps = 28
            for step in 0...steps {
                guard Task.isCancelled == false else { return }
                let p = Double(step) / Double(steps)
                player.volume = Float(max(0, 1 - CoffeeThankYouCue.smooth(p, from: 0, to: 1)))
                try? await Task.sleep(nanoseconds: UInt64((length / Double(steps)) * 1_000_000_000))
            }
        }
    }

    private static func makePlayer(resource: String, ext: String) -> AVAudioPlayer? {
        let url = Bundle.main.url(forResource: resource, withExtension: ext, subdirectory: "Sounds")
            ?? Bundle.main.url(forResource: resource, withExtension: ext)
        guard let url else { return nil }
        return try? AVAudioPlayer(contentsOf: url)
    }
}
