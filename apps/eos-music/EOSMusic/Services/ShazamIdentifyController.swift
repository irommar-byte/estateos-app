import Foundation
import SwiftUI
import UIKit

@MainActor
final class ShazamIdentifyController: ObservableObject {
    static let shared = ShazamIdentifyController()

    private static let continuousKey = "eos.music.shazam.continuousListening"

    @Published var isPresented = false
    @Published var isListening = false
    @Published var titleLine = "Słucham…"
    @Published var artistLine = ""
    @Published var artworkURL: URL?
    @Published var addStatus = ""
    @Published var addSucceeded: Bool?
    /// Normalized mic level 0…1 while listening (drives ripples).
    @Published var inputLevel: CGFloat = 0
    /// Szybszy szczyt — pierścień tuż przy znaczku reaguje na to, co słyszy Shazam.
    @Published var peakLevel: CGFloat = 0
    /// Bumps on successful library add — triggers flip celebration.
    @Published var celebrationGeneration = 0
    @Published var isCelebrating = false
    @Published var isFlipped = false
    @Published var isDismissing = false
    @Published var continuousListening: Bool {
        didSet { UserDefaults.standard.set(continuousListening, forKey: Self.continuousKey) }
    }

    private var dismissTask: Task<Void, Never>?
    private var peakHold: CGFloat = 0
    /// Skips cancel when the sheet closes after a successful single match animation.
    private var suppressDismissCancel = false

    init() {
        continuousListening = UserDefaults.standard.bool(forKey: Self.continuousKey)
    }

    func bind(_ app: AppModel) {
        ShazamRecognitionCoordinator.shared.bind(app)
    }

    func userTapped() {
        resetPresentationState(keepContinuous: true)
        isPresented = true
        guard let app = SiriPlaybackBridge.shared.app else { return }
        ShazamRecognitionCoordinator.shared.startFromUI(app: app)
    }

    func startListening() {
        resetPresentationState(keepContinuous: true)
        guard let app = SiriPlaybackBridge.shared.app else { return }
        ShazamRecognitionCoordinator.shared.startFromUI(app: app)
    }

    /// User swiped the sheet down or tapped close — cancel listening immediately.
    func userDismissedSheet() {
        dismissTask?.cancel()
        dismissTask = nil
        isPresented = false
        isDismissing = false
        isCelebrating = false
        isFlipped = false
        isListening = false
        inputLevel = 0
        peakLevel = 0
        peakHold = 0
        if suppressDismissCancel {
            suppressDismissCancel = false
            return
        }
        Task { await ShazamRecognitionCoordinator.shared.cancel() }
    }

    func dismiss() {
        userDismissedSheet()
    }

    func applyExternal(
        title: String,
        artist: String,
        status: String,
        success: Bool?,
        listening: Bool,
        artwork: URL? = nil
    ) {
        titleLine = title
        artistLine = artist
        addStatus = status
        addSucceeded = success
        isListening = listening
        if let artwork {
            artworkURL = artwork
        }
        if listening {
            isCelebrating = false
            isDismissing = false
            isFlipped = false
        } else if success != true {
            inputLevel = 0
            peakLevel = 0
            peakHold = 0
        }
        if success == true {
            celebrateMatch()
        }
    }

    func setInputLevel(_ level: Float) {
        guard isListening, !isCelebrating else { return }
        let mapped = CGFloat(min(1, max(0, (level - 0.003) / 0.055)))
        // Soft attack; slower release so ripples linger like real Shazam.
        let attack: CGFloat = mapped > inputLevel ? 0.55 : 0.18
        let next = inputLevel * (1 - attack) + mapped * attack
        peakHold = max(peakHold * 0.9, next)
        let display = max(next, peakHold * 0.65)
        if abs(display - inputLevel) > 0.008 {
            inputLevel = display
        }
        let peakAttack: CGFloat = mapped > peakLevel ? 0.82 : 0.34
        let peak = peakLevel * (1 - peakAttack) + mapped * peakAttack
        if abs(peak - peakLevel) > 0.006 {
            peakLevel = peak
        }
    }

    private func celebrateMatch() {
        dismissTask?.cancel()
        isCelebrating = true
        celebrationGeneration &+= 1
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.7)

        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
            isFlipped = true
        }

        dismissTask = Task { @MainActor in
            // Hold the flipped checkmark beat.
            try? await Task.sleep(nanoseconds: 1_150_000_000)
            guard !Task.isCancelled else { return }

            if continuousListening, isPresented {
                // Soft return to listening without closing the sheet.
                withAnimation(.spring(response: 0.52, dampingFraction: 0.86)) {
                    isDismissing = false
                    isCelebrating = false
                    isFlipped = false
                    addSucceeded = nil
                    titleLine = "Słucham…"
                    artistLine = ""
                    addStatus = continuousListening ? "Ciągłe nasłuchiwanie" : ""
                    artworkURL = nil
                    isListening = true
                }
                inputLevel = 0
                peakLevel = 0
                peakHold = 0
                if let app = SiriPlaybackBridge.shared.app {
                    ShazamRecognitionCoordinator.shared.resumeAfterContinuousCelebration(app: app)
                }
                return
            }

            withAnimation(.spring(response: 0.62, dampingFraction: 0.86)) {
                isDismissing = true
            }
            try? await Task.sleep(nanoseconds: 640_000_000)
            guard !Task.isCancelled else { return }
            suppressDismissCancel = true
            withAnimation(.spring(response: 0.5, dampingFraction: 0.9)) {
                isPresented = false
                isDismissing = false
                isCelebrating = false
                isFlipped = false
                isListening = false
            }
            inputLevel = 0
            peakLevel = 0
            peakHold = 0
        }
    }

    private func resetPresentationState(keepContinuous: Bool) {
        dismissTask?.cancel()
        dismissTask = nil
        titleLine = "Słucham…"
        artistLine = ""
        artworkURL = nil
        addStatus = ""
        addSucceeded = nil
        inputLevel = 0
        peakLevel = 0
        peakHold = 0
        isCelebrating = false
        isDismissing = false
        isFlipped = false
        isListening = false
        if !keepContinuous {
            // keep preference; only clear transient UI
        }
    }
}
