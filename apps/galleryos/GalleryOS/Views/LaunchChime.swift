import AVFoundation
import Foundation

/// The opening sound, synthesised on device so it ships without an audio asset:
/// a lydian celesta run, a glass bell crown over a warm pad, fairy-dust sparkles and a hall tail.
/// Times are in seconds from the first frame of `LaunchCinema`, so sound and light line up.
enum LaunchChime {
    static let sampleRate = 44_100
    static let duration = 3.6
    /// The light burst and the bell crown happen together at this moment.
    static let bloom = 0.62

    private static let cacheName = "launch-chime-v1.wav"
    private static let lock = NSLock()
    nonisolated(unsafe) private static var memory: Data?
    private static let flagLock = NSLock()
    nonisolated(unsafe) private static var ready = false

    /// Never waits on a render in progress, so the main thread can poll it.
    static var isReady: Bool {
        flagLock.lock()
        defer { flagLock.unlock() }
        return ready
    }

    private static func markReady() {
        flagLock.lock()
        ready = true
        flagLock.unlock()
    }

    /// Rendered once, then read from Caches on later launches. Concurrent callers wait for one render.
    static func wav() -> Data {
        lock.lock()
        defer { lock.unlock() }
        if let memory { return memory }
        let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let url = folder.appendingPathComponent(cacheName)
        if let data = try? Data(contentsOf: url), data.count > 44 {
            memory = data
            markReady()
            return data
        }
        let data = encodeWAV(render())
        try? data.write(to: url, options: .atomic)
        memory = data
        markReady()
        return data
    }

    // MARK: Score

    private struct Partial {
        var ratio: Double
        var gain: Double
        var decay: Double
    }

    private struct Voice {
        var start: Double
        var frequency: Double
        var amplitude: Double
        var pan: Double
        var attack: Double
        var decay: Double
        var partials: [Partial]
        var detuneCents: Double = 0
        /// Pads swell and fade instead of ringing out from the attack.
        var swell: Double = 0
    }

    private static let celesta = [
        Partial(ratio: 1, gain: 1, decay: 1),
        Partial(ratio: 2, gain: 0.34, decay: 0.55),
        Partial(ratio: 3, gain: 0.11, decay: 0.38),
        Partial(ratio: 4.07, gain: 0.05, decay: 0.26),
    ]

    private static let glassBell = [
        Partial(ratio: 1, gain: 1, decay: 1),
        Partial(ratio: 2.76, gain: 0.32, decay: 0.5),
        Partial(ratio: 5.40, gain: 0.12, decay: 0.3),
        Partial(ratio: 8.93, gain: 0.05, decay: 0.18),
    ]

    private static let warmPad = [
        Partial(ratio: 1, gain: 1, decay: 1),
        Partial(ratio: 2, gain: 0.16, decay: 1),
        Partial(ratio: 3, gain: 0.05, decay: 1),
    ]

    private static func score() -> [Voice] {
        var voices: [Voice] = []

        // Rising run in D lydian; the raised fourth (G♯) is what makes it sound "magic".
        let run = [587.33, 739.99, 880.0, 1108.73, 1318.51, 1661.22, 1760.0]
        for (index, frequency) in run.enumerated() {
            let position = Double(index) / Double(run.count - 1)
            voices.append(Voice(
                start: 0.12 + Double(index) * 0.072,
                frequency: frequency,
                amplitude: 0.30 - position * 0.08,
                pan: -0.55 + position * 1.1,
                attack: 0.004,
                decay: 0.9 - position * 0.25,
                partials: celesta
            ))
        }

        // Bell crown on the bloom.
        for (frequency, pan, amplitude) in [(1174.66, -0.25, 0.34), (1760.0, 0.3, 0.22), (2349.32, 0.05, 0.10)] {
            voices.append(Voice(
                start: bloom,
                frequency: frequency,
                amplitude: amplitude,
                pan: pan,
                attack: 0.003,
                decay: 1.5,
                partials: glassBell
            ))
        }

        // Warm Dmaj9 pad underneath, two slightly detuned layers for width.
        let pad = [146.83, 220.0, 293.66, 369.99, 440.0, 659.25]
        for (index, frequency) in pad.enumerated() {
            for (cents, pan) in [(-4.0, -0.45), (4.0, 0.45)] {
                voices.append(Voice(
                    start: bloom - 0.08,
                    frequency: frequency,
                    amplitude: index == 0 ? 0.07 : 0.055,
                    pan: pan,
                    attack: 0.38,
                    decay: 1.25,
                    partials: warmPad,
                    detuneCents: cents,
                    swell: 0.9
                ))
            }
        }

        // Soft body under the burst, felt more than heard on a phone speaker.
        voices.append(Voice(start: bloom, frequency: 73.42, amplitude: 0.20, pan: 0, attack: 0.025, decay: 0.42, partials: [Partial(ratio: 1, gain: 1, decay: 1)]))

        // Fairy dust: high pentatonic tinkles scattered around the burst.
        var seed: UInt64 = 0x6A11_E205
        func random() -> Double {
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return Double(seed >> 11) / Double(UInt64(1) << 53)
        }
        let dust = [2349.32, 2637.02, 2959.96, 3520.0, 3951.07, 4698.63]
        for _ in 0..<26 {
            let start = bloom - 0.25 + random() * 1.45
            voices.append(Voice(
                start: start,
                frequency: dust[Int(random() * Double(dust.count)) % dust.count],
                amplitude: 0.035 + random() * 0.06,
                pan: random() * 1.8 - 0.9,
                attack: 0.002,
                decay: 0.12 + random() * 0.26,
                partials: [Partial(ratio: 1, gain: 1, decay: 1), Partial(ratio: 2.0, gain: 0.18, decay: 0.5)]
            ))
        }
        return voices
    }

    // MARK: Rendering

    static func render() -> (left: [Float], right: [Float]) {
        let rate = Double(sampleRate)
        let count = Int(duration * rate)
        var left = [Float](repeating: 0, count: count)
        var right = [Float](repeating: 0, count: count)

        left.withUnsafeMutableBufferPointer { l in
            right.withUnsafeMutableBufferPointer { r in
                for voice in score() {
                    addVoice(voice, left: l, right: r, rate: rate)
                }
                addAir(left: l, right: r, rate: rate)
            }
        }

        var wetLeft = left
        var wetRight = right
        Hall().process(left: &wetLeft, right: &wetRight)
        for index in 0..<count {
            left[index] = left[index] * 0.86 + wetLeft[index] * 0.62
            right[index] = right[index] * 0.86 + wetRight[index] * 0.62
        }

        let fadeStart = Int((duration - 0.7) * rate)
        for index in fadeStart..<count {
            let x = Double(index - fadeStart) / Double(count - fadeStart)
            let gain = Float(0.5 + 0.5 * cos(x * .pi))
            left[index] *= gain
            right[index] *= gain
        }

        var peak: Float = 0
        for index in 0..<count {
            peak = max(peak, abs(left[index]), abs(right[index]))
        }
        if peak > 0 {
            let scale = 0.7 / peak
            for index in 0..<count {
                left[index] *= scale
                right[index] *= scale
            }
        }
        return (left, right)
    }

    private static func addVoice(_ voice: Voice, left: UnsafeMutableBufferPointer<Float>, right: UnsafeMutableBufferPointer<Float>, rate: Double) {
        let first = Int(voice.start * rate)
        guard first < left.count else { return }
        let ring = voice.attack + voice.decay * 7 + voice.swell
        let last = min(left.count, first + Int(ring * rate))
        let tune = pow(2, voice.detuneCents / 1200)
        let angle = (voice.pan + 1) * .pi / 4
        let gainLeft = cos(angle)
        let gainRight = sin(angle)
        for partial in voice.partials {
            let frequency = voice.frequency * tune * partial.ratio
            guard frequency < rate * 0.45 else { continue }
            let step = 2 * Double.pi * frequency / rate
            let tau = max(0.01, voice.decay * partial.decay)
            var phase = 0.0
            for index in first..<last {
                let t = Double(index - first) / rate
                let envelope: Double
                if t < voice.attack {
                    let x = t / voice.attack
                    envelope = x * x * (3 - 2 * x)
                } else if t < voice.attack + voice.swell {
                    envelope = 1
                } else {
                    envelope = exp(-(t - voice.attack - voice.swell) / tau)
                }
                let value = sin(phase) * envelope * voice.amplitude * partial.gain
                left[index] += Float(value * gainLeft)
                right[index] += Float(value * gainRight)
                phase += step
                if phase > 2 * .pi { phase -= 2 * .pi }
            }
        }
    }

    /// A breath of filtered noise that rises into the bloom.
    private static func addAir(left: UnsafeMutableBufferPointer<Float>, right: UnsafeMutableBufferPointer<Float>, rate: Double) {
        let last = min(left.count, Int((bloom + 0.5) * rate))
        var seed: UInt32 = 0x2F6B_1C33
        func noise() -> Double {
            seed ^= seed << 13
            seed ^= seed >> 17
            seed ^= seed << 5
            return Double(seed) / Double(UInt32.max) * 2 - 1
        }
        var lowL = 0.0, lowR = 0.0, floorL = 0.0, floorR = 0.0
        for index in 0..<last {
            let t = Double(index) / rate
            let rise = min(1, t / bloom)
            let envelope = t < bloom ? rise * rise : exp(-(t - bloom) / 0.12)
            let cutoff = 500 + 5_500 * rise
            let alpha = 1 - exp(-2 * .pi * cutoff / rate)
            let hp = 1 - exp(-2 * .pi * 320 / rate)
            lowL += (noise() - lowL) * alpha
            lowR += (noise() - lowR) * alpha
            floorL += (lowL - floorL) * hp
            floorR += (lowR - floorR) * hp
            left[index] += Float((lowL - floorL) * envelope * 0.05)
            right[index] += Float((lowR - floorR) * envelope * 0.05)
        }
    }

    /// Freeverb-style hall: parallel damped combs into series allpasses, per channel.
    private struct Hall {
        func process(left: inout [Float], right: inout [Float]) {
            left = channel(left, spread: 0)
            right = channel(right, spread: 23)
        }

        private func channel(_ input: [Float], spread: Int) -> [Float] {
            let combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map { $0 + spread }
            let passes = [556, 441, 341, 225].map { $0 + spread }
            let feedback: Float = 0.9
            let damp: Float = 0.22
            var output = [Float](repeating: 0, count: input.count)
            for length in combs {
                var buffer = [Float](repeating: 0, count: length)
                var cursor = 0
                var store: Float = 0
                for index in 0..<input.count {
                    let delayed = buffer[cursor]
                    store = delayed * (1 - damp) + store * damp
                    buffer[cursor] = input[index] * 0.03 + store * feedback
                    output[index] += delayed
                    cursor += 1
                    if cursor == length { cursor = 0 }
                }
            }
            for length in passes {
                var buffer = [Float](repeating: 0, count: length)
                var cursor = 0
                for index in 0..<output.count {
                    let delayed = buffer[cursor]
                    let value = output[index]
                    buffer[cursor] = value + delayed * 0.5
                    output[index] = delayed - value
                    cursor += 1
                    if cursor == length { cursor = 0 }
                }
            }
            return output
        }
    }

    // MARK: WAV

    static func encodeWAV(_ audio: (left: [Float], right: [Float])) -> Data {
        let frames = audio.left.count
        let channels = 2
        let bytesPerSample = 2
        let dataSize = frames * channels * bytesPerSample
        var data = Data(capacity: 44 + dataSize)
        func append<T: FixedWidthInteger>(_ value: T) {
            withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
        }
        data.append(contentsOf: Array("RIFF".utf8))
        append(UInt32(36 + dataSize))
        data.append(contentsOf: Array("WAVEfmt ".utf8))
        append(UInt32(16))
        append(UInt16(1))
        append(UInt16(channels))
        append(UInt32(sampleRate))
        append(UInt32(sampleRate * channels * bytesPerSample))
        append(UInt16(channels * bytesPerSample))
        append(UInt16(16))
        data.append(contentsOf: Array("data".utf8))
        append(UInt32(dataSize))
        var samples = [Int16](repeating: 0, count: frames * channels)
        for index in 0..<frames {
            samples[index * 2] = Int16(max(-1, min(1, audio.left[index])) * 32_767)
            samples[index * 2 + 1] = Int16(max(-1, min(1, audio.right[index])) * 32_767)
        }
        samples.withUnsafeBufferPointer { data.append(UnsafeBufferPointer(start: UnsafeRawPointer($0.baseAddress!).assumingMemoryBound(to: UInt8.self), count: dataSize)) }
        return data
    }
}

/// Plays the chime. On iPhone it stays on the ambient session so the ring switch and the user's music win.
/// On Apple TV the same recording plays with no silent switch.
@MainActor
final class LaunchChimePlayer {
    private var player: AVAudioPlayer?
    private var cancelled = false

    func start(elapsed: @escaping @MainActor () -> TimeInterval) {
        Task.detached(priority: .userInitiated) {
            let data = LaunchChime.wav()
            await MainActor.run { self.play(data, offset: elapsed()) }
        }
    }

    func fadeOut() {
        cancelled = true
        player?.setVolume(0, fadeDuration: 0.3)
    }

    private func play(_ data: Data, offset: TimeInterval) {
        // Too late to line up with the light; a clipped chime sounds worse than none.
        guard !cancelled, offset < 0.5 else { return }
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, options: [.mixWithOthers])
        try? session.setActive(true)
        #endif
        guard let player = try? AVAudioPlayer(data: data) else { return }
        player.volume = 0.85
        player.prepareToPlay()
        player.currentTime = max(0, offset)
        player.play()
        self.player = player
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(LaunchChime.duration - offset + 0.2))
            self?.release()
        }
    }

    private func release() {
        player?.stop()
        player = nil
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        try? session.setCategory(.soloAmbient)
        #endif
    }
}
