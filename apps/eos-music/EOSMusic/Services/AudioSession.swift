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
    private static var leaseMode: AudioSessionLeaseMode = .inactive
    private static var modeBeforeCapture: AudioSessionLeaseMode = .inactive

    static func activateForPlayback(force: Bool = false) {
        installObserversIfNeeded()
        leaseMode = .musicPlayback
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
        leaseMode = .videoPlayback
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

    static func activateForShazamCapture() {
        installObserversIfNeeded()
        if leaseMode != .shazamCapture {
            modeBeforeCapture = leaseMode == .inactive ? .musicPlayback : leaseMode
        }
        leaseMode = .shazamCapture
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .measurement,
                options: [.mixWithOthers, .defaultToSpeaker]
            )
            try session.setActive(true, options: [])
            EOSLog.audioSession.info("lease=shazamCapture")
        } catch {
            EOSLog.audioSession.error("shazam capture failed \(error.localizedDescription, privacy: .public)")
        }
    }

    static func endShazamCapture() {
        guard leaseMode == .shazamCapture else { return }
        let restore = modeBeforeCapture
        leaseMode = restore
        switch restore {
        case .videoPlayback:
            activateForVideoPlayback(force: true)
        case .musicPlayback, .inactive, .shazamCapture:
            activateForPlayback(force: true)
        }
    }

    /// Re-assert category after returning from background / other apps.
    static func reinforceIfNeeded() {
        if AudioSessionLeasePolicy.shouldIgnoreOwnCategoryChange(current: leaseMode) {
            return
        }
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
                if leaseMode == .shazamCapture {
                    activateForShazamCapture()
                    return
                }
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
            shouldResumeAfterInterruption = leaseMode != .shazamCapture
            configuredForPlayback = false
            if leaseMode != .shazamCapture {
                NotificationCenter.default.post(name: .eosAudioSessionInterrupted, object: nil)
            }

        case .ended:
            let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
            if leaseMode == .shazamCapture {
                activateForShazamCapture()
                return
            }
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
            if leaseMode == .shazamCapture {
                activateForShazamCapture()
                return
            }
            activateForPlayback(force: true)
        case .categoryChange, .override:
            if AudioSessionLeasePolicy.shouldIgnoreOwnCategoryChange(current: leaseMode) {
                return
            }
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
