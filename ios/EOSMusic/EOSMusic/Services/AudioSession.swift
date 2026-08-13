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

    static func activateForVideoPlayback(force: Bool = false) {
        installObserversIfNeeded()
        let session = AVAudioSession.sharedInstance()
        do {
            if session.category != .playback || session.mode != .moviePlayback || force {
                try session.setCategory(
                    .playback,
                    mode: .moviePlayback,
                    options: [.allowAirPlay, .allowBluetoothA2DP]
                )
            }
            try session.setActive(true, options: [])
            configuredForPlayback = true
        } catch {
            activateForPlayback(force: force)
        }
    }

    /// Re-assert category after returning from background / other apps.
    static func reinforceIfNeeded() {
        let session = AVAudioSession.sharedInstance()
        if session.category != .playback {
            activateForPlayback(force: true)
            return
        }
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
            let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
            let switchingToExternal = outputs.contains { port in
                port.portType == .airPlay || port.portType == .HDMI || port.portType == .AVB
            }
            if !switchingToExternal {
                NotificationCenter.default.post(name: .eosAudioSessionRouteLost, object: nil)
            }
        case .newDeviceAvailable:
            activateForPlayback(force: true)
        case .categoryChange, .override:
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
