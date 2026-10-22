import SwiftUI
import UIKit

// MARK: Power

/// Whether the device is on the charger right now, live.
@MainActor
final class PowerWatch: ObservableObject {
    static let shared = PowerWatch()
    @Published private(set) var charging = SyncPolicy.charging
    private var observer: NSObjectProtocol?

    private init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        charging = SyncPolicy.charging
        observer = NotificationCenter.default.addObserver(
            forName: UIDevice.batteryStateDidChangeNotification, object: nil, queue: .main
        ) { _ in
            Task { @MainActor in
                let now = SyncPolicy.charging
                if PowerWatch.shared.charging != now { PowerWatch.shared.charging = now }
            }
        }
    }
}

// MARK: Pilot light

/// A pilot light like the ones on studio equipment: a lens of coloured glass in a dark bezel.
/// Off, the glass is dark but you can still tell its colour; on, it glows from inside and lights
/// the bezel around it; blinking, it breathes softly instead of flashing.
struct PilotLight: View {
    let color: Color
    let lit: Bool
    var breathing = false
    var size: CGFloat = 10
    @Environment(\.coreMotion) private var motion
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !(lit && breathing && motion))) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let glow = lit ? (breathing && motion ? 0.55 + 0.45 * (sin(t * 3.4) * 0.5 + 0.5) : 1) : 0
            ZStack {
                // Light thrown on the panel.
                Circle()
                    .fill(RadialGradient(colors: [color.opacity(0.55 * glow), color.opacity(0)], center: .center, startRadius: 0, endRadius: size * 1.6))
                    .frame(width: size * 3.2, height: size * 3.2)
                // Bezel.
                Circle()
                    .fill(LinearGradient(colors: scheme == .dark ? [Color(white: 0.05), Color(white: 0.22)] : [Color(white: 0.55), Color(white: 0.95)],
                                         startPoint: .top, endPoint: .bottom))
                    .frame(width: size + 4, height: size + 4)
                // Glass.
                Circle()
                    .fill(RadialGradient(
                        colors: lit
                            ? [.white.opacity(0.95 * glow + 0.05), color.opacity(0.9 + 0.1 * glow), color.opacity(0.55)]
                            : [color.opacity(0.28), color.opacity(0.14), Color.black.opacity(0.55)],
                        center: UnitPoint(x: 0.38, y: 0.32), startRadius: 0, endRadius: size * 0.7))
                    .frame(width: size, height: size)
                // The tiny highlight on the glass.
                Circle()
                    .fill(.white.opacity(lit ? 0.7 : 0.25))
                    .frame(width: size * 0.28, height: size * 0.28)
                    .offset(x: -size * 0.18, y: -size * 0.2)
            }
            .frame(width: size * 3.2, height: size * 3.2)
        }
        .animation(.easeInOut(duration: 0.35), value: lit)
        .accessibilityHidden(true)
    }
}

// MARK: Auto sync switch

/// AUTO SYNC as a machined toggle: a groove milled into the panel, engraved OFF and ON, and a
/// knob of brushed aluminium that snaps across with a click. A green pilot light in the groove
/// shows it is running.
struct MetalSyncSwitch: View {
    @Binding var on: Bool
    var onFlip: (Bool) -> Void = { _ in }
    @Environment(\.colorScheme) private var scheme
    @GestureState private var dragging: CGFloat?

    private let width: CGFloat = 92
    private let height: CGFloat = 38
    private var knob: CGFloat { height - 8 }
    private var travel: CGFloat { width - knob - 8 }

    var body: some View {
        VStack(alignment: .center, spacing: 5) {
            EngravedText("AUTO SYNC", size: 9.5) // l10n:skip
            ZStack(alignment: .leading) {
                groove
                HStack {
                    EngravedText("OFF", size: 8.5, lit: !on, litColor: Color(white: scheme == .dark ? 0.85 : 0.25)) // l10n:skip
                    Spacer()
                    EngravedText("ON", size: 8.5, lit: on, litColor: Color(red: 0.32, green: 0.95, blue: 0.5)) // l10n:skip
                }
                .padding(.horizontal, 11)
                knobView
                    .offset(x: 4 + knobOffset)
            }
            .frame(width: width, height: height)
            .contentShape(Capsule())
            .onTapGesture { flip(!on) }
            .gesture(
                DragGesture(minimumDistance: 4)
                    .updating($dragging) { value, state, _ in
                        let base: CGFloat = on ? travel : 0
                        state = min(max(base + value.translation.width, 0), travel)
                    }
                    .onEnded { value in
                        let base: CGFloat = on ? travel : 0
                        let end = base + value.predictedEndTranslation.width
                        flip(end > travel / 2)
                    }
            )
        }
        .sensoryFeedback(.impact(weight: .heavy, intensity: 0.9), trigger: on)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L("Automatyczna kopia"))
        .accessibilityValue(on ? L("włączona") : L("wyłączona"))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { flip(!on) }
    }

    private var knobOffset: CGFloat {
        dragging ?? (on ? travel : 0)
    }

    private func flip(_ value: Bool) {
        guard value != on else {
            // Let go where it was: settle back with a spring.
            withAnimation(.spring(response: 0.35, dampingFraction: 0.62)) { on = value }
            return
        }
        withAnimation(.spring(response: 0.38, dampingFraction: 0.62)) { on = value }
        onFlip(value)
    }

    /// The milled groove: darker at the top where the light does not reach, a bright lip at the
    /// bottom, and a faint green glow along the floor when running.
    private var groove: some View {
        ZStack {
            Capsule()
                .fill(LinearGradient(
                    colors: scheme == .dark
                        ? [Color(white: 0.02), Color(white: 0.1), Color(white: 0.16)]
                        : [Color(white: 0.62), Color(white: 0.8), Color(white: 0.9)],
                    startPoint: .top, endPoint: .bottom))
            Capsule()
                .fill(RadialGradient(colors: [Color(red: 0.2, green: 0.95, blue: 0.45).opacity(on ? 0.28 : 0), .clear],
                                     center: UnitPoint(x: 0.78, y: 0.6), startRadius: 0, endRadius: 46))
            // Inner shadow along the top edge.
            Capsule()
                .strokeBorder(LinearGradient(colors: [.black.opacity(scheme == .dark ? 0.9 : 0.45), .clear],
                                             startPoint: .top, endPoint: .center), lineWidth: 3)
                .blur(radius: 1.2)
                .clipShape(Capsule())
            // The bright lip where the groove meets the panel.
            Capsule()
                .strokeBorder(LinearGradient(colors: [.black.opacity(0.35), .white.opacity(scheme == .dark ? 0.22 : 0.9)],
                                             startPoint: .top, endPoint: .bottom), lineWidth: 1)
        }
    }

    /// Brushed aluminium: a conic sheen like a turned metal cap, a soft dome highlight and a
    /// shadow that keeps it sitting in the groove.
    private var knobView: some View {
        ZStack {
            Circle()
                .fill(AngularGradient(
                    colors: [Color(white: 0.96), Color(white: 0.68), Color(white: 0.92), Color(white: 0.6),
                             Color(white: 0.97), Color(white: 0.66), Color(white: 0.9), Color(white: 0.96)],
                    center: .center))
            Circle()
                .fill(RadialGradient(colors: [.white.opacity(0.85), .white.opacity(0)], center: UnitPoint(x: 0.35, y: 0.28),
                                     startRadius: 0, endRadius: knob * 0.55))
            Circle()
                .strokeBorder(LinearGradient(colors: [.white, Color(white: 0.45)], startPoint: .top, endPoint: .bottom), lineWidth: 0.8)
            // A machined centre mark.
            Circle()
                .fill(on ? Color(red: 0.25, green: 0.9, blue: 0.45) : Color(white: 0.5))
                .frame(width: 4, height: 4)
                .shadow(color: on ? Color(red: 0.25, green: 0.95, blue: 0.45) : .clear, radius: 3)
        }
        .frame(width: knob, height: knob)
        .shadow(color: .black.opacity(0.45), radius: 2.5, y: 2)
        .shadow(color: .black.opacity(0.2), radius: 6, y: 4)
        .scaleEffect(dragging != nil ? 1.06 : 1)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: dragging != nil)
    }
}

/// Lettering engraved into metal: a dark cut with a light lower edge. Lit, it glows like the
/// legend on a backlit key.
struct EngravedText: View {
    let text: String
    var size: CGFloat = 10
    var lit = false
    var litColor: Color = .primary
    @Environment(\.colorScheme) private var scheme

    init(_ text: String, size: CGFloat = 10, lit: Bool = false, litColor: Color = .primary) {
        self.text = text
        self.size = size
        self.lit = lit
        self.litColor = litColor
    }

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: .heavy, design: .rounded))
            .tracking(size * 0.14)
            .foregroundStyle(lit ? litColor : Color(white: scheme == .dark ? 0.42 : 0.42))
            .shadow(color: lit ? litColor.opacity(0.8) : .clear, radius: 3)
            .shadow(color: .white.opacity(scheme == .dark ? 0.08 : 0.7), radius: 0, y: 0.6)
            .shadow(color: .black.opacity(scheme == .dark ? 0.8 : 0.25), radius: 0, y: -0.5)
            .animation(.easeInOut(duration: 0.3), value: lit)
    }
}

// MARK: Conditions

/// The three rules for the automatic copy as hardware keys with pilot lights:
/// WI-FI ONLY and CELLULAR are one pair (pressing one lets the other spring out), WHEN CHARGING
/// latches on its own. A key that is pressed but whose condition is not met right now keeps its
/// light dark; the moment the condition comes (the phone joins Wi-Fi, the cable goes in) the light
/// comes on and the machine starts.
struct ConditionDeck: View {
    let autoSync: Bool
    @Binding var wifiOnly: Bool
    @Binding var chargingOnly: Bool
    let network: NetworkKind
    let charging: Bool
    let ignition: Int
    var onChange: () -> Void = {}
    @Environment(\.colorScheme) private var scheme

    private var onWiFi: Bool { network == .wifi || network == .wired }
    private var onCellular: Bool { network == .cellular }

    /// All chosen rules are met: the copy may run.
    var open: Bool {
        guard autoSync, network != .none else { return false }
        if wifiOnly && !onWiFi { return false }
        if chargingOnly && !charging { return false }
        return true
    }

    private static let green = Color(red: 0.3, green: 0.92, blue: 0.48)
    private static let amber = Color(red: 1.0, green: 0.68, blue: 0.22)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                EngravedText(L("WARUNKI PRACY"), size: 10.5)
                Spacer()
                Readout(text: readout, lit: open, color: open ? Self.green : Self.amber)
            }
            HStack(spacing: 10) {
                ConditionKey(
                    symbol: "wifi", legend: "WI-FI ONLY", // l10n:skip
                    pressed: wifiOnly, lit: autoSync && wifiOnly && onWiFi, color: Self.green,
                    caption: wifiOnly ? (onWiFi ? L("połączone") : L("czeka na Wi-Fi")) : L("wyłączone")
                ) { set(wifiOnly: true) }
                ConditionKey(
                    symbol: "antenna.radiowaves.left.and.right", legend: "CELLULAR", // l10n:skip
                    pressed: !wifiOnly, lit: autoSync && !wifiOnly && network != .none, color: Self.green,
                    caption: !wifiOnly ? (onCellular ? L("w użyciu") : (network == .none ? L("brak sieci") : L("dozwolona"))) : L("wyłączone")
                ) { set(wifiOnly: false) }
                ConditionKey(
                    symbol: "bolt.fill", legend: "CHARGING", // l10n:skip
                    pressed: chargingOnly, lit: autoSync && chargingOnly && charging, color: Self.amber,
                    caption: chargingOnly ? (charging ? L("ładuje się") : L("czeka na kabel")) : (charging ? L("ładuje się") : L("dowolnie"))
                ) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { chargingOnly.toggle() }
                    onChange()
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .coreCard()
        .overlay { IgnitionSweep(trigger: ignition, radius: 22) }
        .opacity(autoSync ? 1 : 0.62)
        .animation(.easeInOut(duration: 0.35), value: autoSync)
    }

    private var readout: String {
        if !autoSync { return L("WSTRZYMANE") }
        if network == .none { return L("BRAK SIECI") }
        if wifiOnly && !onWiFi { return L("CZEKA NA WI-FI") }
        if chargingOnly && !charging { return L("CZEKA NA ŁADOWANIE") }
        return L("PRACUJE")
    }

    private func set(wifiOnly value: Bool) {
        guard wifiOnly != value else { return }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) { wifiOnly = value }
        onChange()
    }
}

/// A square push key milled from the panel, with a pilot light above its legend.
private struct ConditionKey: View {
    let symbol: String
    let legend: String
    let pressed: Bool
    let lit: Bool
    let color: Color
    let caption: String
    let action: () -> Void
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                PilotLight(color: color, lit: lit, breathing: false, size: 8)
                    .frame(height: 16)
                Image(systemName: symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(lit ? color : (pressed ? Color.primary : Color.secondary))
                    .shadow(color: lit ? color.opacity(0.7) : .clear, radius: 5)
                    .contentTransition(.symbolEffect(.replace))
                EngravedText(legend, size: 8.5, lit: pressed, litColor: scheme == .dark ? .white : .black)
                Text(caption)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(lit ? color : .secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .contentTransition(.opacity)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(cap)
            .scaleEffect(pressed ? 0.975 : 1)
        }
        .buttonStyle(KeyPressStyle())
        .sensoryFeedback(.impact(weight: .medium, intensity: 0.8), trigger: pressed)
        .animation(.spring(response: 0.3, dampingFraction: 0.62), value: pressed)
        .animation(.easeInOut(duration: 0.4), value: lit)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(pressed ? [.isButton, .isSelected] : .isButton)
    }

    /// Raised: light on top, shadow below. Pressed: sunk into the panel, shadow inside.
    private var cap: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(LinearGradient(
                colors: pressed
                    ? (scheme == .dark ? [Color(white: 0.06), Color(white: 0.13)] : [Color(white: 0.84), Color(white: 0.93)])
                    : (scheme == .dark ? [Color(white: 0.2), Color(white: 0.12)] : [Color.white, Color(white: 0.9)]),
                startPoint: .top, endPoint: .bottom))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(LinearGradient(
                        colors: pressed
                            ? [.black.opacity(scheme == .dark ? 0.8 : 0.3), .white.opacity(scheme == .dark ? 0.08 : 0.8)]
                            : [.white.opacity(scheme == .dark ? 0.18 : 1), .black.opacity(scheme == .dark ? 0.6 : 0.15)],
                        startPoint: .top, endPoint: .bottom), lineWidth: 1)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(color.opacity(lit ? 0.08 : 0))
            )
            .shadow(color: .black.opacity(pressed ? 0 : (scheme == .dark ? 0.5 : 0.12)), radius: pressed ? 0 : 4, y: pressed ? 0 : 3)
    }
}

private struct KeyPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .brightness(configuration.isPressed ? -0.03 : 0)
            .animation(.spring(response: 0.22, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// A small display window, like the status readout on studio gear: monospaced capitals on dark
/// glass, glowing in its colour when the machine runs.
private struct Readout: View {
    let text: String
    let lit: Bool
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .tracking(1.2)
            .foregroundStyle(color.opacity(lit ? 1 : 0.85))
            .shadow(color: color.opacity(lit ? 0.9 : 0.4), radius: lit ? 4 : 2)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(LinearGradient(colors: [Color(white: 0.02), Color(white: 0.09)], startPoint: .top, endPoint: .bottom))
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .strokeBorder(LinearGradient(colors: [.black, .white.opacity(0.18)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
            )
            .contentTransition(.opacity)
            .animation(.easeInOut(duration: 0.3), value: text)
    }
}

/// The moment the machine starts: a band of light runs across the panel once.
struct IgnitionSweep: View {
    let trigger: Int
    var radius: CGFloat = 26

    var body: some View {
        GeometryReader { proxy in
            Color.clear
                .keyframeAnimator(initialValue: -1.0, trigger: trigger) { content, value in
                    content.overlay {
                        if value > -1, value < 1.5 {
                            LinearGradient(
                                colors: [.clear, .white.opacity(0.22), Color(red: 0.4, green: 1, blue: 0.6).opacity(0.25), .clear],
                                startPoint: .leading, endPoint: .trailing)
                                .frame(width: proxy.size.width * 0.45)
                                .rotationEffect(.degrees(12))
                                .offset(x: CGFloat(value) * proxy.size.width)
                                .blendMode(.plusLighter)
                        }
                    }
                } keyframes: { _ in
                    KeyframeTrack {
                        LinearKeyframe(-0.5, duration: 0.01)
                        CubicKeyframe(1.4, duration: 0.95)
                        LinearKeyframe(-1.0, duration: 0.01)
                    }
                }
        }
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .allowsHitTesting(false)
    }
}
