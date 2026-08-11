import AVFoundation
import Combine
import UIKit

/// Exclusive playback session — same priority class as Apple Music / Podcasts.
@MainActor
enum AudioSession {
    private static var didInstallObservers = false
    private static var shouldResumeAfterInterruption = false
    private static var cancellables = Set<AnyCancellable>()
    private static var configuredForPlayback = false

    static func activateForPlayback(force: Bool = false) {
        installObserversIfNeeded()
        let session = AVAudioSession.sharedInstance()

        // Avoid setCategory/setActive churn while already playing — that hitch is exactly
        // what users hear when switching apps / collapsing Control Center.
        if !force,
           configuredForPlayback,
           session.category == .playback {
            return
        }

        do {
            if session.category != .playback || force {
                try session.setCategory(
                    .playback,
                    mode: .default,
                    options: [.allowAirPlay, .allowBluetoothA2DP]
                )
            }
            try session.setActive(true, options: [])
            configuredForPlayback = true
        } catch {
            configuredForPlayback = false
            // Retry once after a short delay — common after route flips.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 200_000_000)
                do {
                    try AVAudioSession.sharedInstance().setCategory(
                        .playback,
                        mode: .default,
                        options: [.allowAirPlay, .allowBluetoothA2DP]
                    )
                    try AVAudioSession.sharedInstance().setActive(true, options: [])
                    configuredForPlayback = true
                } catch {
                    configuredForPlayback = false
                }
            }
        }
    }

    /// Re-assert category after returning from background / other apps.
    /// Only forces a full reconfigure if something else stole the session.
    static func reinforceIfNeeded() {
        let session = AVAudioSession.sharedInstance()
        if session.category != .playback {
            activateForPlayback(force: true)
            return
        }
        // Soft nudge — setActive only when category is already correct.
        do {
            try session.setActive(true, options: [])
            configuredForPlayback = true
        } catch {
            activateForPlayback(force: true)
        }
    }

    static func deactivateLeavingForOtherApp() {
        configuredForPlayback = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private static func installObserversIfNeeded() {
        guard !didInstallObservers else { return }
        didInstallObservers = true

        NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)
            .receive(on: DispatchQueue.main)
            .sink { note in
                handleInterruption(note)
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: AVAudioSession.routeChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { note in
                handleRouteChange(note)
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: AVAudioSession.mediaServicesWereResetNotification)
            .receive(on: DispatchQueue.main)
            .sink { _ in
                configuredForPlayback = false
                activateForPlayback(force: true)
                NotificationCenter.default.post(name: .eosAudioSessionNeedsResume, object: nil)
            }
            .store(in: &cancellables)

        // Do NOT reinforce on every didBecomeActive — that re-activates the session and
        // can glitch continuous background playback. Foreground uses willEnterForeground.
    }

    private static func handleInterruption(_ note: Notification) {
        guard
            let info = note.userInfo,
            let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: typeValue)
        else { return }

        switch type {
        case .began:
            shouldResumeAfterInterruption = true
            configuredForPlayback = false
            NotificationCenter.default.post(name: .eosAudioSessionInterrupted, object: nil)

        case .ended:
            let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
            activateForPlayback(force: true)
            if options.contains(.shouldResume) || shouldResumeAfterInterruption {
                shouldResumeAfterInterruption = false
                NotificationCenter.default.post(name: .eosAudioSessionNeedsResume, object: nil)
            }

        @unknown default:
            break
        }
    }

    private static func handleRouteChange(_ note: Notification) {
        guard
            let info = note.userInfo,
            let reasonValue = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
            let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue)
        else { return }

        switch reason {
        case .oldDeviceUnavailable:
            // Headphones unplugged — pause (Apple Music behavior).
            NotificationCenter.default.post(name: .eosAudioSessionRouteLost, object: nil)
        case .newDeviceAvailable:
            activateForPlayback(force: true)
        case .categoryChange, .override:
            // Soft — category may already be ours after a system flip.
            reinforceIfNeeded()
        default:
            break
        }
    }
}

extension Notification.Name {
    static let eosAudioSessionInterrupted = Notification.Name("eosmusic.audio.interrupted")
    static let eosAudioSessionNeedsResume = Notification.Name("eosmusic.audio.resume")
    static let eosAudioSessionRouteLost = Notification.Name("eosmusic.audio.routeLost")
}
