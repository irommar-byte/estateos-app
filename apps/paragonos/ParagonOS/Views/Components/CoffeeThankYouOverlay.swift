import SwiftUI
import UIKit

struct CoffeeThankYouOverlay: View {
    var onFinished: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var burst = false
    @State private var fadeOut = false
    @State private var hearts: [HeartBurst] = []

    var body: some View {
        ZStack {
            Color.black.opacity(0.72)
                .ignoresSafeArea()
            RadialGradient(
                colors: [
                    Color(red: 0.18, green: 0.08, blue: 0.10).opacity(0.9),
                    Color.black.opacity(0.4)
                ],
                center: .center,
                startRadius: 20,
                endRadius: 420
            )
            .ignoresSafeArea()

            ForEach(hearts) { heart in
                Image(systemName: "heart.fill")
                    .font(.system(size: heart.size))
                    .foregroundStyle(heart.color)
                    .rotationEffect(.degrees(burst ? heart.endRotation : 0))
                    .offset(burst && reduceMotion == false ? heart.end : .zero)
                    .scaleEffect(burst ? (reduceMotion ? 1.05 : heart.endScale) : 0.12)
                    .opacity(burst ? (fadeOut ? 0 : 0.95) : 0)
            }

            Text("Dziękuję że jesteś.")
                .font(.largeTitle.weight(.semibold))
                .multilineTextAlignment(.center)
                .foregroundStyle(.white)
                .padding(.horizontal, 28)
                .scaleEffect(burst ? 1 : 0.86)
                .opacity(burst ? (fadeOut ? 0 : 1) : 0)
        }
        .interactiveDismissDisabled()
        .onAppear {
            hearts = HeartBurst.make(count: reduceMotion ? 18 : 64)
            run()
        }
    }

    private func run() {
        withAnimation(.spring(response: 0.62, dampingFraction: 0.78)) {
            burst = true
        }
        HeartBurstHaptics.play(reduced: reduceMotion)
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            withAnimation(.easeOut(duration: 0.45)) {
                fadeOut = true
            }
            try? await Task.sleep(nanoseconds: 480_000_000)
            onFinished()
        }
    }
}

private struct HeartBurst: Identifiable {
    let id = UUID()
    let size: CGFloat
    let color: Color
    let end: CGSize
    let endScale: CGFloat
    let endRotation: Double

    static func make(count: Int) -> [HeartBurst] {
        let palette: [Color] = [
            Color(red: 0.96, green: 0.28, blue: 0.38),
            Color(red: 0.92, green: 0.42, blue: 0.52),
            Color(red: 1, green: 0.55, blue: 0.62),
            Color(red: 0.86, green: 0.16, blue: 0.32),
            ParagonTheme.osGreen.opacity(0.92),
            Color(red: 0.98, green: 0.72, blue: 0.78)
        ]
        return (0..<count).map { index in
            let angle = (Double(index) / Double(max(count, 1))) * .pi * 2 + Double.random(in: -0.18...0.18)
            let distance = CGFloat.random(in: 90...340)
            return HeartBurst(
                size: CGFloat.random(in: 16...42),
                color: palette[index % palette.count],
                end: CGSize(width: cos(angle) * distance, height: sin(angle) * distance * 1.12),
                endScale: CGFloat.random(in: 0.7...1.35),
                endRotation: Double.random(in: -48...48)
            )
        }
    }
}

enum HeartBurstHaptics {
    static func play(reduced: Bool) {
        let heavy = UIImpactFeedbackGenerator(style: .heavy)
        let medium = UIImpactFeedbackGenerator(style: .medium)
        heavy.prepare()
        medium.prepare()
        let pulses = reduced ? 4 : 12
        Task { @MainActor in
            for index in 0..<pulses {
                if index.isMultiple(of: 2) {
                    heavy.impactOccurred(intensity: index == 0 ? 1 : 0.92)
                } else {
                    medium.impactOccurred(intensity: 0.78)
                }
                try? await Task.sleep(nanoseconds: reduced ? 140_000_000 : 90_000_000)
            }
        }
    }
}
