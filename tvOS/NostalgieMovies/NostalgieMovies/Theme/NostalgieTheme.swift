import SwiftUI

// MARK: - Design tokens

enum NostalgieTheme {
    static let background = LinearGradient(
        colors: [
            Color(red: 0.04, green: 0.04, blue: 0.07),
            Color(red: 0.08, green: 0.05, blue: 0.14),
            Color(red: 0.03, green: 0.03, blue: 0.06),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let accent = Color(red: 1.0, green: 0.24, blue: 0.38)
    static let accentSecondary = Color(red: 0.72, green: 0.42, blue: 0.98)
    static let card = Color.white.opacity(0.06)
    static let cardFocused = Color.white.opacity(0.14)

    static let posterCornerRadius: CGFloat = 12
    static let cardCornerRadius: CGFloat = 16
    static let posterAspectRatio: CGFloat = 16 / 9

    static let focusSpring = Animation.spring(response: 0.32, dampingFraction: 0.78)
    static let tabSpring = Animation.spring(response: 0.32, dampingFraction: 0.82)
    static let contentSpring = Animation.spring(response: 0.32, dampingFraction: 0.76)

    /// Legacy alias — prefer focusSpring in new code.
    static let focusAnimation = focusSpring
}

enum NostalgieSpacing {
    static let screenH: CGFloat = 72
    static let screenTop: CGFloat = 48
    static let section: CGFloat = 14
    static let row: CGFloat = 6
    static let listRow: CGFloat = 6
    static let scrollBottom: CGFloat = 56
    static let grid: CGFloat = 28
}

enum NostalgieRadius {
    static let chip: CGFloat = 10
    static let panel: CGFloat = 14
    static let card: CGFloat = 16
    static let sheet: CGFloat = 20
}

enum NostalgieGlassLevel {
    case chip, panel, card, sheet

    var radius: CGFloat {
        switch self {
        case .chip: return NostalgieRadius.chip
        case .panel: return NostalgieRadius.panel
        case .card: return NostalgieRadius.card
        case .sheet: return NostalgieRadius.sheet
        }
    }
}

enum NostalgieFont {
    static func rounded(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }

    static func rounded(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .rounded).weight(weight)
    }

    static let brand = rounded(22, weight: .bold)
    static let hero = rounded(40, weight: .bold)
    static let pageTitle = rounded(.title, weight: .bold)
    static let sectionTitle = rounded(.title3, weight: .semibold)
    static let detailTitle = rounded(30, weight: .bold)
    static let rowTitle = rounded(.subheadline, weight: .semibold)
    static let listTitle = rounded(.callout, weight: .semibold)
    static let body = rounded(.body)
    static let metadata = rounded(.caption)
    static let caption = rounded(.caption2, weight: .medium)
    static let badge = rounded(.caption2, weight: .bold)
    static let field = rounded(.headline)
}

// MARK: - Background

struct NostalgieAmbientBackground: View {
    var body: some View {
        ZStack {
            NostalgieTheme.background
            Circle()
                .fill(NostalgieTheme.accentSecondary.opacity(0.16))
                .frame(width: 560, height: 560)
                .blur(radius: 120)
                .offset(x: -420, y: -280)
            Circle()
                .fill(NostalgieTheme.accent.opacity(0.10))
                .frame(width: 480, height: 480)
                .blur(radius: 100)
                .offset(x: 520, y: 320)
        }
        .ignoresSafeArea()
    }
}

struct NostalgieBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { NostalgieAmbientBackground() }
    }
}

extension View {
    func nostalgieScreen() -> some View {
        modifier(NostalgieBackground())
    }

    /// Pozioma półka rozciągnięta do krawędzi ekranu — treść ma marginesy,
    /// a skalowane karty nie są przycinane na brzegach obszaru treści.
    func fullBleedShelf() -> some View {
        padding(.horizontal, -NostalgieSpacing.screenH)
            .contentMargins(.horizontal, NostalgieSpacing.screenH, for: .scrollContent)
    }

    func glassCapsule(paddingH: CGFloat = 8, paddingV: CGFloat = 5) -> some View {
        padding(.horizontal, paddingH)
            .padding(.vertical, paddingV)
            .background {
                Capsule()
                    .fill(.ultraThinMaterial)
                    .background(Capsule().fill(Color.black.opacity(0.38)))
            }
    }

    func glassPanel(cornerRadius: CGFloat = NostalgieTheme.cardCornerRadius) -> some View {
        background {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(.ultraThinMaterial)
                .background(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color.black.opacity(0.32))
                )
                .overlay {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                }
        }
    }

    func glassPanel(_ level: NostalgieGlassLevel) -> some View {
        glassPanel(cornerRadius: level.radius)
    }
}

// MARK: - Typography headers

struct ScreenTitle: View {
    enum Level { case page, section, detail }

    let title: String
    var subtitle: String?
    var level: Level = .page

    private var titleFont: Font {
        switch level {
        case .page: return NostalgieFont.pageTitle
        case .section: return NostalgieFont.sectionTitle
        case .detail: return NostalgieFont.detailTitle
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(titleFont)
                .lineLimit(level == .detail ? 1 : 2)
                .minimumScaleFactor(level == .detail ? 0.85 : 1)
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(NostalgieFont.metadata)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }
}

/// Alias — use ScreenTitle(level: .section) in new code.
struct MusicSectionHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        ScreenTitle(title: title, subtitle: subtitle, level: .section)
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(.secondary)
            Text(title)
                .font(NostalgieFont.sectionTitle)
            Text(message)
                .font(NostalgieFont.body)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 620, alignment: .leading)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(FocusCardButtonStyle())
            }
        }
        .padding(.vertical, 8)
    }
}

struct NostalgieTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure = false
    var isFocused: Bool

    var body: some View {
        Group {
            if isSecure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .textFieldStyle(.plain)
        .font(NostalgieFont.field)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .font(NostalgieFont.field)
        .background(isFocused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                .stroke(isFocused ? Color.white.opacity(0.9) : Color.white.opacity(0.08), lineWidth: isFocused ? 3 : 1)
        }
        .animation(NostalgieTheme.focusSpring, value: isFocused)
    }
}

// MARK: - Button styles

struct FocusCardButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.rowTitle)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 18)
            .padding(.vertical, 11)
            .background(focused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                    .stroke(focused ? Color.white.opacity(0.95) : Color.white.opacity(0.08), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.12) : .clear, radius: 12, y: 2)
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct BackLinkButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.caption)
            .lineLimit(1)
            .foregroundStyle(focused ? .white : .white.opacity(0.62))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(focused ? Color.white.opacity(0.14) : Color.white.opacity(0.04))
            .clipShape(Capsule())
            .overlay {
                Capsule().stroke(focused ? Color.white.opacity(0.9) : Color.clear, lineWidth: 2)
            }
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct ListRowButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .fill(focused ? NostalgieTheme.cardFocused : Color.white.opacity(0.025))
                    .overlay(alignment: .leading) {
                        if focused {
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(NostalgieTheme.accent)
                                .frame(width: 4)
                                .padding(.vertical, 8)
                                .padding(.leading, 2)
                        }
                    }
            }
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .stroke(focused ? Color.white.opacity(0.85) : Color.white.opacity(0.05), lineWidth: focused ? 1.5 : 1)
            }
            .shadow(color: focused ? Color.black.opacity(0.35) : .clear, radius: 10, y: 4)
            .brightness(focused ? 0.02 : 0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.rounded(.title3, weight: .semibold))
            .lineLimit(1)
            .foregroundStyle(focused ? Color.black.opacity(0.88) : .white)
            .padding(.horizontal, 28)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity)
            .background(focused ? Color.white : NostalgieTheme.accent.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                    .stroke(focused ? Color.white : Color.clear, lineWidth: 3)
            }
            .shadow(color: focused ? Color.white.opacity(0.18) : .clear, radius: 16, y: 5)
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct DetailPlayButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(focused ? Color.black.opacity(0.9) : .white)
            .padding(.horizontal, 40)
            .padding(.vertical, 18)
            .background(focused ? Color.white : Color.white.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .stroke(focused ? Color.white : Color.white.opacity(0.2), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.22) : .clear, radius: 18, y: 6)
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct DetailToolbarButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.rowTitle)
            .foregroundStyle(focused ? Color.black.opacity(0.9) : .white.opacity(0.92))
            .padding(.horizontal, 26)
            .padding(.vertical, 16)
            .background(focused ? Color.white : Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.panel, style: .continuous)
                    .stroke(focused ? Color.white : Color.white.opacity(0.14), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.16) : .clear, radius: 14, y: 5)
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct MediaCardButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(focused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieRadius.card, style: .continuous)
                    .stroke(focused ? Color.white.opacity(0.95) : Color.white.opacity(0.06), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.16) : .clear, radius: 18, y: focused ? 6 : 0)
            .scaleEffect(focused ? 1.04 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}

struct PrimaryTabButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused
    let isSelected: Bool
    var namespace: Namespace.ID? = nil

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.rounded(17, weight: .bold))
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .foregroundStyle(isSelected ? .white : .white.opacity(0.68))
            .padding(.horizontal, 20)
            .padding(.vertical, 13)
            .background {
                Group {
                    if isSelected, let namespace {
                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [NostalgieTheme.accent, NostalgieTheme.accentSecondary],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .matchedGeometryEffect(id: "primaryTabPill", in: namespace)
                    } else {
                        Capsule().fill(Color.white.opacity(focused ? 0.16 : 0.055))
                    }
                }
            }
            .overlay {
                Capsule().stroke(focused ? Color.white : Color.clear, lineWidth: 3)
            }
            .shadow(color: isSelected ? NostalgieTheme.accent.opacity(0.45) : .clear, radius: focused ? 20 : 12, y: 5)
            .scaleEffect(focused ? 1.07 : (isSelected ? 1.02 : 1.0))
            .animation(NostalgieTheme.tabSpring, value: focused)
            .animation(NostalgieTheme.tabSpring, value: isSelected)
    }
}

struct SecondaryTabButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused
    let isSelected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.rounded(13, weight: .semibold))
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .foregroundStyle(isSelected ? .white : .white.opacity(0.5))
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(isSelected ? Color.white.opacity(0.12) : Color.white.opacity(0.035))
            .clipShape(Capsule())
            .overlay {
                Capsule().stroke(focused ? Color.white.opacity(0.9) : Color.clear, lineWidth: 2)
            }
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.tabSpring, value: focused)
            .animation(NostalgieTheme.tabSpring, value: isSelected)
    }
}

struct ChipButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused
    let isSelected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(NostalgieFont.caption)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isSelected ? Color.white.opacity(0.16) : Color.white.opacity(0.05))
            .foregroundStyle(isSelected ? .white : .white.opacity(0.68))
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .stroke(focused ? Color.white : (isSelected ? Color.white.opacity(0.28) : Color.clear), lineWidth: focused ? 2 : 1)
            }
            .scaleEffect(focused ? 1.03 : 1.0)
            .animation(NostalgieTheme.focusSpring, value: focused)
    }
}
