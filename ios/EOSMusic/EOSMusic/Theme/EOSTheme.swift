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

enum PlayerEffectsMode: String, CaseIterable, Identifiable {
    case subtle
    case strong
    case off

    var id: String { rawValue }

    var title: String {
        switch self {
        case .subtle: return "Delikatne"
        case .strong: return "Mocniejsze"
        case .off: return "Wyłączone"
        }
    }
}

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
    @Published var playerEffectsMode: PlayerEffectsMode {
        didSet { UserDefaults.standard.set(playerEffectsMode.rawValue, forKey: Self.playerEffectsKey) }
    }
    @Published var ultraCompact: Bool {
        didSet { UserDefaults.standard.set(ultraCompact, forKey: Self.ultraCompactKey) }
    }

    private static let appearanceKey = "ui.appearance"
    private static let playerEffectsKey = "ui.playerEffectsMode"
    private static let ultraCompactKey = "ui.ultraCompact"

    init() {
        let storedAppearance = UserDefaults.standard.string(forKey: Self.appearanceKey) ?? AppAppearance.system.rawValue
        appearance = AppAppearance(rawValue: storedAppearance) ?? .system
        let storedEffects = UserDefaults.standard.string(forKey: Self.playerEffectsKey) ?? PlayerEffectsMode.subtle.rawValue
        playerEffectsMode = PlayerEffectsMode(rawValue: storedEffects) ?? .subtle
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
        VStack(spacing: 12) {
            Image(systemName: "waveform.circle.fill")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(EOSTheme.gradient)
                .scaleEffect(isAnimating ? 1.05 : 0.92)
                .opacity(isAnimating ? 1 : 0.72)

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
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
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
                color: Color.black.opacity(colorScheme == .light ? 0.08 : 0),
                radius: 12,
                x: 0,
                y: 5
            )
            .padding(.vertical, 2)
    }
}

struct SettingsChoiceRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(title)
                    .foregroundStyle(EOSTheme.textPrimary)
                Spacer(minLength: 8)
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(EOSTheme.accent)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
    }
}

func formatDuration(_ seconds: Double?) -> String {
    guard let seconds, seconds.isFinite, seconds > 0 else { return "—" }
    let total = Int(seconds.rounded())
    let m = total / 60
    let s = total % 60
    return String(format: "%d:%02d", m, s)
}
