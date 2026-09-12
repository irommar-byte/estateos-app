import AVFoundation
import Foundation

enum LaunchSounds {
    private static var players: [AVAudioPlayer] = []
    private static var cashRegisterPlayer: AVAudioPlayer?

    static func prepare() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        if cashRegisterPlayer == nil {
            cashRegisterPlayer = makePlayer(resource: "cash-register-open", ext: "mp3")
            cashRegisterPlayer?.prepareToPlay()
        }
    }

    static func cashRegister() {
        prepare()
        guard let player = cashRegisterPlayer else { return }
        player.currentTime = 0
        player.play()
        players.append(player)
    }

    private static func makePlayer(resource: String, ext: String) -> AVAudioPlayer? {
        let url = Bundle.main.url(forResource: resource, withExtension: ext, subdirectory: "Sounds")
            ?? Bundle.main.url(forResource: resource, withExtension: ext)
        guard let url else { return nil }
        return try? AVAudioPlayer(contentsOf: url)
    }
}
