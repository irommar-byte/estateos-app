import SwiftUI
import UIKit

enum EOSTheme {
    static let background = Color(uiColor: .systemBackground)
    static let card = Color(uiColor: .secondarySystemBackground)
    static let cardBorder = Color(uiColor: .separator)
    static let accent = Color(red: 1.0, green: 0.216, blue: 0.373)
    static let accentSecondary = Color(red: 0.749, green: 0.353, blue: 0.949)
    static let textPrimary = Color.primary
    static let textSecondary = Color.secondary
    static let textMuted = Color(uiColor: .tertiaryLabel)
    static let statusOnline = Color(uiColor: .systemGreen)
    static let statusOffline = Color(uiColor: .systemRed)

    static let gradient = LinearGradient(
        colors: [accent, accentSecondary],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

/// Spójna typografia w stylu Apple Music — zaokrąglone nagłówki, czytelne metadane.
enum EOSTypography {
    static func configureGlobalAppearance() {
        let navBar = UINavigationBar.appearance()
        navBar.largeTitleTextAttributes = [
            .font: UIFont.systemFont(ofSize: 34, weight: .bold),
            .kern: 0.2
        ]
        navBar.titleTextAttributes = [
            .font: UIFont.systemFont(ofSize: 17, weight: .semibold)
        ]

        let tabBar = UITabBarItem.appearance()
        tabBar.setTitleTextAttributes([
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold)
        ], for: .normal)
    }

    static var largeTitle: Font { .system(.largeTitle, design: .rounded, weight: .bold) }
    static var title: Font { .system(.title2, design: .rounded, weight: .bold) }
    static var title3: Font { .system(.title3, design: .rounded, weight: .semibold) }
    static var headline: Font { .system(.headline, design: .default, weight: .semibold) }
    static var body: Font { .system(.body, design: .default, weight: .regular) }
    static var bodySemibold: Font { .system(.body, design: .default, weight: .semibold) }
    static var callout: Font { .system(.callout, design: .default, weight: .regular) }
    static var subheadline: Font { .system(.subheadline, design: .default, weight: .medium) }
    static var footnote: Font { .system(.footnote, design: .default, weight: .regular) }
    static var caption: Font { .system(.caption, design: .default, weight: .medium) }
    static var captionBold: Font { .system(.caption, design: .default, weight: .bold) }
    static var caption2Medium: Font { .system(.caption2, design: .default, weight: .medium) }
    static var microLabel: Font { .system(size: 10, weight: .medium) }
    static var sectionLabel: Font { .system(.caption, design: .default, weight: .bold) }
    static var monoDigit: Font { .system(.caption, design: .monospaced, weight: .semibold) }
}

enum EOSMotion {
    static let standard = Animation.spring(response: 0.38, dampingFraction: 0.86)
    static let snappy = Animation.snappy(duration: 0.25)
    static let soft = Animation.easeInOut(duration: 0.28)
    /// Sheet mini ↔ full — slightly slower spring for glass depth.
    static let playerSheet = Animation.spring(response: 0.44, dampingFraction: 0.9, blendDuration: 0.1)
}

enum EOSLayout {
    /// Bottom scroll room so the last row clears the floating mini-player.
    /// Nested NavigationStack Lists often ignore parent `safeAreaInset`, so this must be
    /// roughly the bar height (≈62) + gap — not a token 28 pt.
    static let miniPlayerScrollClearance: CGFloat = 100
    static let miniPlayerCorner: CGFloat = 16
}

/// Visual presets for the full player (legacy values map on load).
enum PlayerVisualPreset: String, CaseIterable, Identifiable {
    case vinyl
    case cover
    case spectrum
    case off

    var id: String { rawValue }

    var title: String {
        switch self {
        case .vinyl: return "Winyl"
        case .cover: return "Okładka"
        case .spectrum: return "Spectrum"
        case .off: return "Wyłączone"
        }
    }

    var subtitle: String {
        switch self {
        case .vinyl: return "Obracająca się płyta"
        case .cover: return "Okładka drgająca w rytm muzyki"
        case .spectrum: return "Czytelny mikser częstotliwości EQ"
        case .off: return "Statyczna okładka bez efektów"
        }
    }

    var systemImage: String {
        switch self {
        case .vinyl: return "opticaldisc"
        case .cover: return "square.stack.3d.up.fill"
        case .spectrum: return "waveform.path.ecg"
        case .off: return "moon.zzz"
        }
    }

    var showsMixer: Bool { self == .spectrum }

    var isStrong: Bool { self == .spectrum }

    var allowsStrobe: Bool { false }

    /// Map old Account / effects settings. Default to Spectrum (UIKit EQ) — vinyl TimelineViews froze devices.
    static func migrated(fromStored raw: String?) -> PlayerVisualPreset {
        switch raw {
        case "subtle", "vinyl": return .vinyl
        case "cover", "aurora", "pulse": return .cover
        case "strong", "spectrum": return .spectrum
        case "off": return .off
        case let value?:
            return PlayerVisualPreset(rawValue: value) ?? .spectrum
        case nil:
            return .spectrum
        }
    }
}

/// Effective visual budget after user prefs + system limits.
struct PlayerVisualPolicy: Equatable {
    var enabled: Bool
    var allowStrobe: Bool
    var analyzerFPS: Double
    var timelineFPS: Double
    var intensityScale: Double
    var restrictionReason: String?

    static func resolve(
        preset: PlayerVisualPreset,
        intensity: Double = 0.88,
        strobeEnabled: Bool = false,
        autoPerformance: Bool,
        reduceMotion: Bool,
        lowPower: Bool,
        thermal: ProcessInfo.ThermalState
    ) -> PlayerVisualPolicy {
        let clampedIntensity = min(1, max(0, intensity))
        if preset == .off {
            return PlayerVisualPolicy(
                enabled: false,
                allowStrobe: false,
                analyzerFPS: 0,
                timelineFPS: 0,
                intensityScale: 0,
                restrictionReason: nil
            )
        }

        if reduceMotion {
            // Keep cheap live analyzer so EQ/island still follow the song; no spinning chrome.
            return PlayerVisualPolicy(
                enabled: true,
                allowStrobe: false,
                analyzerFPS: preset == .spectrum ? 14 : 12,
                timelineFPS: 0,
                intensityScale: clampedIntensity * 0.75,
                restrictionReason: "Reduce Motion — bez obrotu"
            )
        }

        // Analyzer FPS feeds PCM → visualizer lock. UI timelines stay at 0 (UIKit hosts poll).
        var fps: Double = preset == .spectrum ? 20 : 16
        let timeline: Double = 0
        var reason: String?
        var scale = clampedIntensity

        if autoPerformance {
            if thermal == .critical || thermal == .serious {
                return PlayerVisualPolicy(
                    enabled: false,
                    allowStrobe: false,
                    analyzerFPS: 0,
                    timelineFPS: 0,
                    intensityScale: 0,
                    restrictionReason: "Urządzenie jest gorące — efekty wstrzymane"
                )
            }
            if thermal == .fair || lowPower {
                fps = preset == .spectrum ? 14 : 12
                scale *= 0.7
                reason = lowPower
                    ? "Tryb Low Power ogranicza efekty"
                    : "Ciepłe urządzenie — tryb oszczędny"
            }
        } else if lowPower || thermal == .fair {
            fps = preset == .spectrum ? 16 : 12
            scale *= 0.8
        }

        return PlayerVisualPolicy(
            enabled: true,
            allowStrobe: false,
            analyzerFPS: fps,
            timelineFPS: timeline,
            intensityScale: scale,
            restrictionReason: reason
        )
    }
}

/// Where the music player UI is shown — drives analyzer FPS without touching AVPlayerItem.
enum PlayerVisualSurface: Equatable {
    case none
    case mini
    case full
}

/// Single lifecycle for audio-reactive visuals (mini island, full EQ, background).
struct PlayerVisualAnalysisSync: ViewModifier {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var ui: UIPreferences
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var thermal = ProcessInfo.processInfo.thermalState
    @State private var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled

    func body(content: Content) -> some View {
        content
            .onAppear { sync() }
            .onChange(of: syncTrigger) { _, _ in sync() }
            .onReceive(NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)) { _ in
                thermal = ProcessInfo.processInfo.thermalState
            }
            .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
                lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
            }
    }

    private var syncTrigger: String {
        let engine = app.playback.engine
        return [
            app.isFullPlayerPresented.description,
            engine?.isPlaying.description ?? "nil",
            engine?.isLoading.description ?? "nil",
            engine?.currentTrack?.id ?? "nil",
            ui.playerVisualPreset.rawValue,
            ui.playerAutoPerformance.description,
            reduceMotion.description,
            lowPower.description,
            String(thermal.rawValue),
            scenePhase == .active ? "active" : "inactive"
        ].joined(separator: "|")
    }

    private func sync() {
        guard let engine = app.playback.engine else { return }

        let policy = PlayerVisualPolicy.resolve(
            preset: ui.playerVisualPreset,
            autoPerformance: ui.playerAutoPerformance,
            reduceMotion: reduceMotion,
            lowPower: lowPower,
            thermal: thermal
        )

        let surface: PlayerVisualSurface
        // Keep analysis soft-off in background — engine leaves the audio tap attached
        // while playing so switching apps does not stutter.
        if scenePhase != .active {
            surface = .none
        } else if app.isFullPlayerPresented {
            surface = .full
        } else if engine.currentTrack != nil {
            surface = .mini
        } else {
            surface = .none
        }

        engine.syncVisualAnalysis(
            surface: surface,
            policy: policy,
            needsSpectrum: surface == .full && ui.playerVisualPreset.showsMixer,
            isPlaying: engine.isPlaying,
            isLoading: engine.isLoading
        )
    }
}

extension View {
    func syncPlayerVisualAnalysis() -> some View {
        modifier(PlayerVisualAnalysisSync())
    }
}

/// Compatibility alias used by older call sites / docs.
typealias PlayerEffectsMode = PlayerVisualPreset

enum AppAppearance: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: return "Systemowy"
        case .light: return "Jasny"
        case .dark: return "Ciemny"
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

@MainActor
final class UIPreferences: ObservableObject {
    @Published var appearance: AppAppearance {
        didSet { UserDefaults.standard.set(appearance.rawValue, forKey: Self.appearanceKey) }
    }
    /// Preferred visual preset (Vinyl / Spectrum / Aurora / Pulse / Off).
    @Published var playerVisualPreset: PlayerVisualPreset {
        didSet { UserDefaults.standard.set(playerVisualPreset.rawValue, forKey: Self.playerEffectsKey) }
    }
    /// 0…1 global visual intensity multiplier.
    @Published var playerEffectsIntensity: Double {
        didSet { UserDefaults.standard.set(playerEffectsIntensity, forKey: Self.intensityKey) }
    }
    /// Mikser: czułość reakcji diod / VU (0…1).
    @Published var playerSensitivity: Double {
        didSet { UserDefaults.standard.set(playerSensitivity, forKey: Self.sensitivityKey) }
    }
    /// Mikser: drive / przester wizualny (0…1) — wcześniejszy CLIP i saturacja.
    @Published var playerDrive: Double {
        didSet { UserDefaults.standard.set(playerDrive, forKey: Self.driveKey) }
    }
    /// Mikser: master power — wyłącza reaktywne diody (EQ zostaje).
    @Published var playerMixerPowered: Bool {
        didSet { UserDefaults.standard.set(playerMixerPowered, forKey: Self.mixerPowerKey) }
    }
    /// Safe beat strobe — default off; gated by policy.
    @Published var playerStrobeEnabled: Bool {
        didSet { UserDefaults.standard.set(playerStrobeEnabled, forKey: Self.strobeKey) }
    }
    /// Auto-throttle on Low Power / thermal stress.
    @Published var playerAutoPerformance: Bool {
        didSet { UserDefaults.standard.set(playerAutoPerformance, forKey: Self.autoPerfKey) }
    }
    @Published var ultraCompact: Bool {
        didSet { UserDefaults.standard.set(ultraCompact, forKey: Self.ultraCompactKey) }
    }
    /// Forced Offline mode — play only local downloads, skip network streams.
    @Published var offlineModeEnabled: Bool {
        didSet { UserDefaults.standard.set(offlineModeEnabled, forKey: Self.offlineModeKey) }
    }

    /// Back-compat for call sites still reading `playerEffectsMode`.
    var playerEffectsMode: PlayerVisualPreset {
        get { playerVisualPreset }
        set { playerVisualPreset = newValue }
    }

    private static let appearanceKey = "ui.appearance"
    private static let playerEffectsKey = "ui.playerEffectsMode"
    private static let ultraCompactKey = "ui.ultraCompact"
    private static let intensityKey = "ui.playerEffectsIntensity"
    private static let sensitivityKey = "ui.playerSensitivity"
    private static let driveKey = "ui.playerDrive"
    private static let mixerPowerKey = "ui.playerMixerPowered"
    private static let strobeKey = "ui.playerStrobeEnabled"
    private static let autoPerfKey = "ui.playerAutoPerformance"
    private static let offlineModeKey = "ui.offlineModeEnabled"

    init() {
        let storedAppearance = UserDefaults.standard.string(forKey: Self.appearanceKey) ?? AppAppearance.system.rawValue
        appearance = AppAppearance(rawValue: storedAppearance) ?? .system
        playerVisualPreset = PlayerVisualPreset.migrated(
            fromStored: UserDefaults.standard.string(forKey: Self.playerEffectsKey)
        )
        if UserDefaults.standard.object(forKey: Self.intensityKey) != nil {
            playerEffectsIntensity = min(1, max(0, UserDefaults.standard.double(forKey: Self.intensityKey)))
        } else {
            playerEffectsIntensity = 0.72
        }
        if UserDefaults.standard.object(forKey: Self.sensitivityKey) != nil {
            playerSensitivity = min(1, max(0.15, UserDefaults.standard.double(forKey: Self.sensitivityKey)))
        } else {
            playerSensitivity = 0.78
        }
        if UserDefaults.standard.object(forKey: Self.driveKey) != nil {
            playerDrive = min(1, max(0, UserDefaults.standard.double(forKey: Self.driveKey)))
        } else {
            playerDrive = 0.42
        }
        if UserDefaults.standard.object(forKey: Self.mixerPowerKey) != nil {
            playerMixerPowered = UserDefaults.standard.bool(forKey: Self.mixerPowerKey)
        } else {
            playerMixerPowered = true
        }
        playerStrobeEnabled = UserDefaults.standard.bool(forKey: Self.strobeKey)
        if UserDefaults.standard.object(forKey: Self.autoPerfKey) != nil {
            playerAutoPerformance = UserDefaults.standard.bool(forKey: Self.autoPerfKey)
        } else {
            playerAutoPerformance = true
        }
        if UserDefaults.standard.object(forKey: Self.ultraCompactKey) != nil {
            ultraCompact = UserDefaults.standard.bool(forKey: Self.ultraCompactKey)
        } else {
            ultraCompact = false
        }
        offlineModeEnabled = UserDefaults.standard.bool(forKey: Self.offlineModeKey)
    }
}

struct EOSAmbientBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            EOSTheme.background.ignoresSafeArea()
            RadialGradient(
                colors: [EOSTheme.accentSecondary.opacity(colorScheme == .dark ? 0.18 : 0.1), .clear],
                center: .topLeading,
                startRadius: 0,
                endRadius: 420
            )
            .ignoresSafeArea()
            RadialGradient(
                colors: [EOSTheme.accent.opacity(colorScheme == .dark ? 0.12 : 0.08), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 380
            )
            .ignoresSafeArea()
        }
    }
}

struct EOSLoadingView: View {
    let title: String
    var subtitle: String? = nil
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .stroke(EOSTheme.accent.opacity(0.18), lineWidth: 1.5)
                    .frame(width: 54, height: 54)
                    .scaleEffect(isAnimating ? 1.35 : 0.9)
                    .opacity(isAnimating ? 0 : 0.7)
                Circle()
                    .stroke(EOSTheme.accentSecondary.opacity(0.22), lineWidth: 1.5)
                    .frame(width: 54, height: 54)
                    .scaleEffect(isAnimating ? 1.15 : 0.95)
                    .opacity(isAnimating ? 0.15 : 0.55)
                Image(systemName: "waveform.circle.fill")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(EOSTheme.gradient)
                    .scaleEffect(isAnimating ? 1.04 : 0.94)
                    .shadow(color: EOSTheme.accent.opacity(0.35), radius: isAnimating ? 10 : 4)
            }
            .frame(width: 72, height: 72)

            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(EOSTheme.textSecondary)

            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(EOSTheme.textMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.05).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}

struct EOSGlassCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(EOSTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(EOSTheme.cardBorder, lineWidth: 1)
            )
    }
}

extension View {
    func eosCard() -> some View { modifier(EOSGlassCard()) }

    func settingsInsetSurfaces() -> some View {
        modifier(SettingsInsetSurfaces())
    }
}

private struct SettingsInsetSurfaces: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .listRowBackground(
                SettingsSectionBackground(colorScheme: colorScheme)
            )
    }
}

private struct SettingsSectionBackground: View {
    let colorScheme: ColorScheme

    var body: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(Color(uiColor: .secondarySystemGroupedBackground))
            .shadow(
                color: Color.black.opacity(colorScheme == .light ? 0.1 : 0.35),
                radius: colorScheme == .light ? 14 : 8,
                x: 0,
                y: colorScheme == .light ? 6 : 3
            )
            .padding(.vertical, 3)
    }
}

struct SettingsChoiceRow: View {
    let title: String
    var subtitle: String? = nil
    var systemImage: String? = nil
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button {
            UISelectionFeedbackGenerator().selectionChanged()
            withAnimation(EOSMotion.snappy) { action() }
        } label: {
            HStack(spacing: 12) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.body.weight(.medium))
                        .foregroundStyle(EOSTheme.accent)
                        .frame(width: 26)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(EOSTheme.textPrimary)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(EOSTheme.accent)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

func formatDuration(_ seconds: Double?) -> String {
    guard let seconds, seconds.isFinite, seconds > 0 else { return "—" }
    let total = Int(seconds.rounded())
    let m = total / 60
    let s = total % 60
    return String(format: "%d:%02d", m, s)
}
