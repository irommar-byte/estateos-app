import AVFoundation
import Combine
import Foundation

// MARK: Music — soundtrack for memories on iPhone, iPad and Apple TV

@MainActor
final class MemoryMusic: ObservableObject {
    private var player: AVAudioPlayer?
    private var volume: Float = 0.8
    private var loader: Task<Void, Never>?

    func start(mood: MemoryMood, muted: Bool) {
        loader = Task {
            let data = await Task.detached(priority: .userInitiated) { MemoryScore.wav(mood) }.value
            guard !Task.isCancelled else { return }
            try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            guard let player = try? AVAudioPlayer(data: data) else { return }
            player.numberOfLoops = -1
            player.volume = 0
            player.prepareToPlay()
            player.play()
            player.setVolume(muted ? 0 : volume, fadeDuration: 2.5)
            self.player = player
        }
    }

    func setMuted(_ muted: Bool) { player?.setVolume(muted ? 0 : volume, fadeDuration: 0.6) }
    func pause() { player?.pause() }
    func resume() { player?.play() }

    func fadeTo(_ level: Float) {
        guard let player, player.volume > 0 else { return }
        player.setVolume(volume * level, fadeDuration: 1.5)
    }

    func stop() {
        loader?.cancel()
        guard let player else { return }
        player.setVolume(0, fadeDuration: 0.8)
        let held = player
        self.player = nil
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            held.stop()
        }
    }
}

/// A gentle loop for each mood, written on the device: warm pad, soft bass and a music-box line.
enum MemoryScore {
    private static let rate = Double(LaunchChime.sampleRate)
    private static let lock = NSLock()

    static func wav(_ mood: MemoryMood) -> Data {
        lock.lock()
        defer { lock.unlock() }
        let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first ?? FileManager.default.temporaryDirectory
        let url = folder.appendingPathComponent("memory-\(mood.rawValue)-v1.wav")
        if let data = try? Data(contentsOf: url), data.count > 1000 { return data }
        let data = LaunchChime.encodeWAV(render(mood))
        try? data.write(to: url, options: .atomic)
        return data
    }

    private static func progression(_ mood: MemoryMood) -> [[Int]] {
        switch mood {
        case .warm: return [[48, 52, 55, 60], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]
        case .dreamy: return [[50, 54, 57, 61], [52, 56, 59, 62], [47, 54, 57, 62], [43, 50, 55, 59]]
        case .tender: return [[41, 48, 53, 57], [38, 50, 53, 57], [46, 50, 53, 58], [48, 52, 55, 60]]
        case .nostalgic: return [[45, 52, 57, 60], [41, 48, 53, 57], [48, 52, 55, 60], [43, 50, 55, 59]]
        }
    }

    private static func frequency(_ midi: Int) -> Double { 440 * pow(2, Double(midi - 69) / 12) }

    static func render(_ mood: MemoryMood) -> (left: [Float], right: [Float]) {
        let beat = 60.0 / 68.0
        let bar = beat * 4
        let chords = progression(mood)
        let loop = bar * 2 * Double(chords.count)
        let tail = 4.0
        let count = Int((loop + tail) * rate)
        var left = [Float](repeating: 0, count: count)
        var right = [Float](repeating: 0, count: count)

        let padTable = table([1, 0.32, 0.14, 0.05])
        let bassTable = table([1, 0.22])
        let bellTable = table([1, 0.28, 0.0, 0.09])
        var seed: UInt64 = 0x9E3779B97F4A7C15 &+ UInt64(mood.rawValue.count)
        func random() -> Double {
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return Double(seed >> 11) / Double(1 << 53)
        }

        left.withUnsafeMutableBufferPointer { l in
            right.withUnsafeMutableBufferPointer { r in
                for (position, chord) in chords.enumerated() {
                    let start = Double(position) * bar * 2
                    let length = bar * 2
                    // Pad: chord tones, two slightly detuned voices each.
                    for (voice, note) in chord.dropFirst().enumerated() {
                        for detune in [-5.0, 5.0] {
                            let pan = 0.5 + (Double(voice) - 1) * 0.25 + detune * 0.02
                            add(padTable, frequency(note + 12) * pow(2, detune / 1200), start: start, length: length + 1.6,
                                attack: 1.4, release: 1.8, gain: 0.055, pan: pan, decay: 0, left: l, right: r)
                        }
                    }
                    // Bass: the root, held.
                    add(bassTable, frequency(chord[0] - 12), start: start, length: length + 0.6,
                        attack: 0.08, release: 1.2, gain: 0.13, pan: 0.5, decay: 0.12, left: l, right: r)
                    // Music box: eighth notes over the chord, a few left out.
                    let tones = chord.dropFirst().map { $0 + 24 } + [chord[1] + 36]
                    let steps = Int(length / (beat / 2))
                    for step in 0..<steps where random() > 0.3 {
                        let note = tones[(step * 3 + position) % tones.count]
                        add(bellTable, frequency(note), start: start + Double(step) * beat / 2, length: 1.8,
                            attack: 0.004, release: 0.6, gain: 0.05 + random() * 0.025, pan: 0.25 + random() * 0.5,
                            decay: 1.1, left: l, right: r)
                    }
                }
            }
        }

        // Room: a soft stereo echo.
        let delays = [Int(0.31 * rate), Int(0.47 * rate)]
        for index in delays[1]..<count {
            left[index] += right[index - delays[0]] * 0.28
            right[index] += left[index - delays[1]] * 0.26
        }
        // Seamless loop: the tail rings into the beginning.
        let length = Int(loop * rate)
        for index in length..<count {
            left[index - length] += left[index]
            right[index - length] += right[index]
        }
        left.removeLast(count - length)
        right.removeLast(count - length)
        var peak: Float = 0
        for index in 0..<length { peak = max(peak, abs(left[index]), abs(right[index])) }
        if peak > 0 {
            let scale = 0.62 / peak
            for index in 0..<length {
                left[index] *= scale
                right[index] *= scale
            }
        }
        return (left, right)
    }

    /// One cycle of a waveform made of harmonics, for fast table look-up.
    private static func table(_ harmonics: [Double]) -> [Float] {
        let size = 2048
        var result = [Float](repeating: 0, count: size)
        for index in 0..<size {
            let phase = Double(index) / Double(size) * 2 * .pi
            var value = 0.0
            for (order, gain) in harmonics.enumerated() where gain > 0 {
                value += sin(phase * Double(order + 1)) * gain
            }
            result[index] = Float(value / harmonics.reduce(0, +))
        }
        return result
    }

    private static func add(
        _ wave: [Float], _ frequency: Double, start: Double, length: Double, attack: Double, release: Double,
        gain: Double, pan: Double, decay: Double,
        left: UnsafeMutableBufferPointer<Float>, right: UnsafeMutableBufferPointer<Float>
    ) {
        let first = Int(start * rate)
        let total = Int(length * rate)
        let attackSamples = max(1, Int(attack * rate))
        let releaseSamples = max(1, Int(release * rate))
        let step = frequency / rate * Double(wave.count)
        let leftGain = Float(gain * cos(pan * .pi / 2))
        let rightGain = Float(gain * sin(pan * .pi / 2))
        var phase = 0.0
        let size = Double(wave.count)
        for offset in 0..<total {
            let index = first + offset
            guard index < left.count else { break }
            var envelope = 1.0
            if offset < attackSamples { envelope = Double(offset) / Double(attackSamples) }
            if decay > 0 { envelope *= exp(-Double(offset) / rate / decay) }
            let remaining = total - offset
            if remaining < releaseSamples { envelope *= Double(remaining) / Double(releaseSamples) }
            let sample = wave[Int(phase)] * Float(envelope)
            left[index] += sample * leftGain
            right[index] += sample * rightGain
            phase += step
            if phase >= size { phase -= size }
        }
    }
}
