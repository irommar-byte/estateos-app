import AVFoundation
import Foundation

enum CoffeeSounds {
    private static var pourPlayer: AVAudioPlayer?

    static func prepare() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        if pourPlayer == nil {
            pourPlayer = makePlayer(resource: "coffee_sound", ext: "mp3")
            pourPlayer?.prepareToPlay()
        }
    }

    static func pour() {
        prepare()
        guard let player = pourPlayer else { return }
        player.currentTime = 0
        player.play()
    }

    private static func makePlayer(resource: String, ext: String) -> AVAudioPlayer? {
        let url = Bundle.main.url(forResource: resource, withExtension: ext, subdirectory: "Sounds")
            ?? Bundle.main.url(forResource: resource, withExtension: ext)
        guard let url else { return nil }
        return try? AVAudioPlayer(contentsOf: url)
    }
}
