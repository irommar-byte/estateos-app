import SwiftUI

/// Airplane (Offline, red) ↔ Wi‑Fi (Online + connected, green) with iPhone-like fly-away / cascade.
struct OnlineOfflineModeGlyph: View {
    let isOffline: Bool
    let networkOnline: Bool
    var size: CGFloat = 18

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var showsAirplane: Bool { isOffline }
    private var wifiSymbol: String { networkOnline ? "wifi" : "wifi.slash" }
    private var wifiColor: Color {
        if !networkOnline { return EOSTheme.accent }
        return Color.green
    }

    var body: some View {
        ZStack {
            Image(systemName: "airplane")
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(Color.red)
                .opacity(showsAirplane ? 1 : 0)
                .offset(
                    x: showsAirplane || reduceMotion ? 0 : 26,
                    y: showsAirplane || reduceMotion ? 0 : -16
                )
                .scaleEffect(showsAirplane ? 1 : (reduceMotion ? 0.85 : 0.35))
                .rotationEffect(.degrees(showsAirplane || reduceMotion ? 0 : 28))

            Image(systemName: wifiSymbol)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(wifiColor)
                .opacity(showsAirplane ? 0 : 1)
                .scaleEffect(showsAirplane ? (reduceMotion ? 0.85 : 0.35) : 1)
                .symbolEffect(
                    .variableColor.iterative.reversing,
                    options: .speed(0.85),
                    isActive: !showsAirplane && networkOnline && !reduceMotion
                )
        }
        .frame(width: size + 6, height: size + 4)
        .accessibilityHidden(true)
        .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring(response: 0.48, dampingFraction: 0.78), value: showsAirplane)
        .animation(.easeInOut(duration: 0.25), value: networkOnline)
    }
}
