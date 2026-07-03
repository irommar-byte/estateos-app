import SwiftUI

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

    static let posterCornerRadius: CGFloat = 14
    static let cardCornerRadius: CGFloat = 18
    static let posterAspectRatio: CGFloat = 16 / 9

    static let focusAnimation = Animation.easeOut(duration: 0.22)
}

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
            .background {
                NostalgieAmbientBackground()
            }
    }
}

extension View {
    func nostalgieScreen() -> some View {
        modifier(NostalgieBackground())
    }

    func glassCapsule(paddingH: CGFloat = 10, paddingV: CGFloat = 6) -> some View {
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
}

struct ScreenTitle: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.largeTitle.bold())
            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.title2.weight(.semibold))
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 620, alignment: .leading)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(FocusCardButtonStyle())
                    .frame(width: 280)
            }
        }
        .padding(.vertical, 12)
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
        .font(.title3)
        .padding(.horizontal, 22)
        .padding(.vertical, 18)
        .background(isFocused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                .stroke(isFocused ? Color.white.opacity(0.9) : Color.white.opacity(0.08), lineWidth: isFocused ? 3 : 1)
        }
        .animation(NostalgieTheme.focusAnimation, value: isFocused)
    }
}

struct FocusCardButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, 28)
            .padding(.vertical, 18)
            .background(focused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                    .stroke(focused ? Color.white.opacity(0.95) : Color.white.opacity(0.08), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.12) : .clear, radius: 16, y: 4)
            .offset(y: focused ? -2 : 0)
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .lineLimit(1)
            .font(.title3.weight(.semibold))
            .foregroundStyle(focused ? Color.black.opacity(0.88) : .white)
            .padding(.horizontal, 32)
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity)
            .background(focused ? Color.white : NostalgieTheme.accent.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                    .stroke(focused ? Color.white : Color.clear, lineWidth: 3)
            }
            .shadow(color: focused ? Color.white.opacity(0.18) : .clear, radius: 18, y: 6)
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}

/// Primary CTA on the movie detail screen — sized to content, never truncates.
struct DetailPlayButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(focused ? Color.black.opacity(0.9) : .white)
            .padding(.horizontal, 44)
            .padding(.vertical, 20)
            .background(focused ? Color.white : Color.white.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(focused ? Color.white : Color.white.opacity(0.2), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.22) : .clear, radius: 20, y: 8)
            .scaleEffect(focused ? 1.06 : 1.0)
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}

/// Secondary actions on the detail screen — equal height, Apple TV–style toolbar pills.
struct DetailToolbarButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(focused ? Color.black.opacity(0.9) : .white.opacity(0.92))
            .padding(.horizontal, 30)
            .padding(.vertical, 20)
            .background(focused ? Color.white : Color.white.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(focused ? Color.white : Color.white.opacity(0.14), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.16) : .clear, radius: 16, y: 6)
            .scaleEffect(focused ? 1.05 : 1.0)
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}

struct MediaCardButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(focused ? NostalgieTheme.cardFocused : NostalgieTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                    .stroke(focused ? Color.white.opacity(0.95) : Color.white.opacity(0.06), lineWidth: focused ? 3 : 1)
            }
            .shadow(color: focused ? Color.white.opacity(0.16) : .clear, radius: 22, y: focused ? 8 : 0)
            .offset(y: focused ? -3 : 0)
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}

struct TabBarButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused
    let isSelected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 26)
            .padding(.vertical, 12)
            .background(isSelected ? Color.white.opacity(0.14) : Color.white.opacity(0.06))
            .foregroundStyle(isSelected ? .white : .white.opacity(0.72))
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .stroke(focused ? Color.white : (isSelected ? Color.white.opacity(0.35) : Color.clear), lineWidth: focused ? 3 : 1)
            }
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}

struct ChipButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var focused
    let isSelected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(isSelected ? Color.white.opacity(0.16) : Color.white.opacity(0.05))
            .foregroundStyle(isSelected ? .white : .white.opacity(0.68))
            .clipShape(Capsule())
            .overlay {
                Capsule()
                    .stroke(focused ? Color.white : (isSelected ? Color.white.opacity(0.28) : Color.clear), lineWidth: focused ? 2 : 1)
            }
            .animation(NostalgieTheme.focusAnimation, value: focused)
    }
}
