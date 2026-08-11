import SwiftUI

/// Branded launch animation — plays once while the app boots, then the root
/// view crossfades into the login screen / library. Staged reveal: glow burst,
/// mark scale-in, wordmark letter reveal, mini equalizer pulse.
struct EOSLaunchIntroView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var ringBurst = false
    @State private var markVisible = false
    @State private var markGlow = false
    @State private var wordmarkVisible = false
    @State private var subtitleVisible = false
    @State private var equalizerVisible = false
    @State private var shimmer = false

    private let wordmark = "EOS"

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.06, green: 0.06, blue: 0.08),
                    Color(red: 0.03, green: 0.03, blue: 0.045),
                    Color(red: 0.08, green: 0.05, blue: 0.09)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [EOSTheme.accent.opacity(markGlow ? 0.22 : 0.1), .clear],
                center: .center,
                startRadius: 20,
                endRadius: 340
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 22) {
                Spacer(minLength: 0)

                ZStack {
                    ForEach(0..<2, id: \.self) { index in
                        Circle()
                            .stroke(
                                (index == 0 ? EOSTheme.accent : EOSTheme.accentSecondary).opacity(0.28),
                                lineWidth: 1.4
                            )
                            .frame(width: 96, height: 96)
                            .scaleEffect(ringBurst ? 1.9 + CGFloat(index) * 0.35 : 0.7)
                            .opacity(ringBurst ? 0 : 0.9)
                    }

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    EOSTheme.accent.opacity(markGlow ? 0.5 : 0.28),
                                    EOSTheme.accentSecondary.opacity(markGlow ? 0.22 : 0.1),
                                    .clear
                                ],
                                center: .center,
                                startRadius: 4,
                                endRadius: 78
                            )
                        )
                        .frame(width: 140, height: 140)
                        .blur(radius: 18)

                    Image(systemName: "waveform.circle.fill")
                        .font(.system(size: 62, weight: .semibold))
                        .foregroundStyle(EOSTheme.gradient)
                        .shadow(color: EOSTheme.accent.opacity(markGlow ? 0.55 : 0.2), radius: markGlow ? 18 : 6)
                        .scaleEffect(markVisible ? 1 : 0.4)
                        .opacity(markVisible ? 1 : 0)
                }
                .frame(width: 140, height: 140)

                VStack(spacing: 6) {
                    HStack(spacing: 3) {
                        ForEach(Array(wordmark.enumerated()), id: \.offset) { index, letter in
                            Text(String(letter))
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .opacity(wordmarkVisible ? 1 : 0)
                                .offset(y: wordmarkVisible ? 0 : 14)
                                .animation(
                                    reduceMotion
                                        ? .easeOut(duration: 0.3)
                                        : .spring(response: 0.5, dampingFraction: 0.72).delay(Double(index) * 0.07),
                                    value: wordmarkVisible
                                )
                        }
                        Text("™")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(EOSTheme.accent)
                            .baselineOffset(14)
                            .opacity(wordmarkVisible ? 1 : 0)
                    }
                    .overlay {
                        if !reduceMotion {
                            ShimmerSweep(active: shimmer)
                                .mask(
                                    HStack(spacing: 3) {
                                        ForEach(Array(wordmark.enumerated()), id: \.offset) { _, letter in
                                            Text(String(letter))
                                                .font(.system(size: 34, weight: .bold, design: .rounded))
                                        }
                                    }
                                )
                        }
                    }

                    Text("MUSIC")
                        .font(.caption.weight(.bold))
                        .tracking(6)
                        .foregroundStyle(.white.opacity(0.5))
                        .opacity(subtitleVisible ? 1 : 0)
                        .offset(y: subtitleVisible ? 0 : 6)
                }

                MiniEqualizerBars(active: equalizerVisible && !reduceMotion)
                    .frame(width: 88, height: 22)
                    .opacity(equalizerVisible ? 1 : 0)
                    .padding(.top, 6)

                Spacer(minLength: 0)
                Spacer(minLength: 0)
            }
        }
        .onAppear { runSequence() }
    }

    private func runSequence() {
        if reduceMotion {
            withAnimation(.easeOut(duration: 0.35)) {
                markVisible = true
                wordmarkVisible = true
                subtitleVisible = true
                equalizerVisible = true
            }
            return
        }

        withAnimation(.spring(response: 0.55, dampingFraction: 0.68)) {
            markVisible = true
        }
        withAnimation(.easeOut(duration: 1.1).delay(0.05)) {
            ringBurst = true
        }
        withAnimation(.easeInOut(duration: 1.4).delay(0.45).repeatForever(autoreverses: true)) {
            markGlow = true
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.32)) {
            wordmarkVisible = true
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.62)) {
            subtitleVisible = true
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.75)) {
            equalizerVisible = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.85) {
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: false)) {
                shimmer = true
            }
        }
    }
}

private struct ShimmerSweep: View {
    let active: Bool

    var body: some View {
        LinearGradient(
            colors: [.clear, .white.opacity(0.85), .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: 60)
        .offset(x: active ? 160 : -160)
        .blendMode(.plusLighter)
    }
}

private struct MiniEqualizerBars: View {
    let active: Bool
    @State private var phase = false

    private let heights: [CGFloat] = [0.45, 0.9, 0.6, 1.0, 0.5]

    var body: some View {
        HStack(alignment: .center, spacing: 5) {
            ForEach(Array(heights.enumerated()), id: \.offset) { index, base in
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(EOSTheme.gradient)
                    .frame(width: 5, height: active ? max(4, base * (phase ? 22 : 22 * 0.4)) : 4)
                    .animation(
                        .easeInOut(duration: 0.42 + Double(index) * 0.05).repeatForever(autoreverses: true),
                        value: phase
                    )
            }
        }
        .onAppear { if active { phase = true } }
        .onChange(of: active) { _, newValue in phase = newValue }
    }
}
