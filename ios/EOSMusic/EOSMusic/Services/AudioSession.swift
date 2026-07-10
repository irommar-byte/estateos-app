import AVFoundation

enum AudioSession {
    static func activateForPlayback() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(
            .playback,
            mode: .default,
            options: [.allowAirPlay, .allowBluetoothA2DP]
        )
        try? session.setActive(true, options: [])
    }
}
