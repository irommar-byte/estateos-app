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

    static let gradient = LinearGradient(
        colors: [accent, accentSecondary],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum EOSMotion {
    static let standard = Animation.spring(response: 0.38, dampingFraction: 0.86)
    static let snappy = Animation.snappy(duration: 0.25)
    static let soft = Animation.easeInOut(duration: 0.28)
}

enum EOSLayout {
    /// Extra scroll padding under the floating mini-player (beyond safeAreaInset).
    static let miniPlayerScrollClearance: CGFloat = 28
    static let miniPlayerCorner: CGFloat = 16
}

/// Visual presets for the full player (legacy `subtle`/`strong` map on load).
enum PlayerVisualPreset: String, CaseIterable, Identifiable {
    case vinyl
    case spectrum
    case aurora
    case pulse
    case off

    var id: String { rawValue }

    var title: String {
        switch self {
        case .vinyl: return "Vinyl"
        case .spectrum: return "Spectrum"
        case .aurora: return "Aurora"
        case .pulse: return "Pulse"
        case .off: return "Wyłączone"
        }
    }

    var subtitle: String {
        switch self {
        case .vinyl: return "Obracająca się płyta i delikatny halo"
        case .spectrum: return "Mikser częstotliwości + pierścień widma"
        case .aurora: return "Miękkie fale kolorów wokół okładki"
        case .pulse: return "Mocny beat-glow i bezpieczne strobo"
        case .off: return "Statyczna okładka bez efektów"
        }
    }

    var systemImage: String {
        switch self {
        case .vinyl: return "opticaldisc"
        case .spectrum: return "waveform.path.ecg"
        case .aurora: return "sparkles"
        case .pulse: return "bolt.heart.fill"
        case .off: return "moon.zzz"
        }
    }

    var showsMixer: Bool {
        switch self {
        case .spectrum, .aurora, .pulse: return true
        case .vinyl, .off: return false
        }
    }

    var isStrong: Bool {
        switch self {
        case .spectrum, .pulse: return true
        case .vinyl, .aurora, .off: return false
        }
    }

    var allowsStrobe: Bool { self == .pulse || self == .spectrum }

    /// Map old Account settings (`subtle` / `strong` / `off`).
    static func migrated(fromStored raw: String?) -> PlayerVisualPreset {
        switch raw {
        case "subtle": return .vinyl
        case "strong": return .spectrum
        case "off": return .off
        case let value?:
            return PlayerVisualPreset(rawValue: value) ?? .vinyl
        case nil:
            return .vinyl
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
        intensity: Double,
        strobeEnabled: Bool,
        autoPerformance: Bool,
        reduceMotion: Bool,
        lowPower: Bool,
        thermal: ProcessInfo.ThermalState
    ) -> PlayerVisualPolicy {
        let clampedIntensity = min(1, max(0, intensity))
        if preset == .off || reduceMotion {
            return PlayerVisualPolicy(
                enabled: false,
                allowStrobe: false,
                analyzerFPS: 0,
                timelineFPS: 0,
                intensityScale: 0,
                restrictionReason: reduceMotion && preset != .off
                    ? "Reduce Motion wyłącza animacje"
                    : nil
            )
        }

        var fps: Double = 24
        var timeline: Double = 30
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
                fps = 12
                timeline = 15
                scale *= 0.72
                reason = lowPower
                    ? "Tryb Low Power ogranicza efekty"
                    : "Ciepłe urządzenie — tryb oszczędny"
            }
        }

        let strobeOK = strobeEnabled
            && preset.allowsStrobe
            && !reduceMotion
            && !(autoPerformance && (lowPower || thermal != .nominal))

        return PlayerVisualPolicy(
            enabled: true,
            allowStrobe: strobeOK,
            analyzerFPS: fps,
            timelineFPS: timeline,
            intensityScale: scale,
            restrictionReason: reason
        )
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

    /// Back-compat for call sites still reading `playerEffectsMode`.
    var playerEffectsMode: PlayerVisualPreset {
        get { playerVisualPreset }
        set { playerVisualPreset = newValue }
    }

    private static let appearanceKey = "ui.appearance"
    private static let playerEffectsKey = "ui.playerEffectsMode"
    private static let ultraCompactKey = "ui.ultraCompact"
    private static let intensityKey = "ui.playerEffectsIntensity"
    private static let strobeKey = "ui.playerStrobeEnabled"
    private static let autoPerfKey = "ui.playerAutoPerformance"

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
