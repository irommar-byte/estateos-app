import SwiftUI
import UIKit

/// Choreography keyed to `coffee_thank_you.mp3` (TU.mp3): first hit ~0.95s, crest ~6.95s, lift ~11.85s, hush after ~13.2s.
enum CoffeeThankYouCue {
    static let swell: TimeInterval = 0.55
    static let firstHit: TimeInterval = 0.95
    static let beat: TimeInterval = 0.40
    static let crest: TimeInterval = 6.95
    static let lift: TimeInterval = 11.85
    static let decay: TimeInterval = 13.20
    static let end: TimeInterval = 15.60

    static func clamp01(_ value: Double) -> Double {
        min(1, max(0, value))
    }

    static func smooth(_ t: TimeInterval, from: TimeInterval, to: TimeInterval) -> Double {
        let x = clamp01((t - from) / max(0.001, to - from))
        return x * x * (3 - 2 * x)
    }

    /// Quintic ease-out — Apple-soft deceleration.
    static func easeOut(_ t: Double) -> Double {
        let x = clamp01(t)
        let inv = 1 - x
        return 1 - inv * inv * inv * inv * inv
    }

    static func veilOpacity(_ t: TimeInterval) -> Double {
        if t < 0.22 { return smooth(t, from: 0, to: 0.22) }
        if t < decay { return 1 }
        return 1 - smooth(t, from: decay, to: end)
    }

    static func bloomStrength(_ t: TimeInterval) -> Double {
        let appear = smooth(t, from: 0.12, to: firstHit + 0.18)
        let crestBoost = 0.52 * sinPulse(t, at: crest, width: 1.25)
        let liftBoost = 0.28 * sinPulse(t, at: lift, width: 0.95)
        let fade = 1 - smooth(t, from: decay, to: end)
        return min(1, appear * 0.58 + crestBoost + liftBoost) * fade
    }

    static func titleOpacity(_ t: TimeInterval) -> Double {
        if t < firstHit + 0.05 { return 0 }
        if t < firstHit + 0.55 { return smooth(t, from: firstHit + 0.05, to: firstHit + 0.55) }
        if t < decay + 0.15 { return 1 }
        return 1 - smooth(t, from: decay + 0.15, to: end - 0.35)
    }

    static func titleScale(_ t: TimeInterval) -> CGFloat {
        let appear = easeOut(smooth(t, from: firstHit + 0.05, to: firstHit + 0.62))
        return CGFloat(0.94 + 0.06 * appear)
    }

    static func titleOffsetY(_ t: TimeInterval) -> CGFloat {
        let appear = easeOut(smooth(t, from: firstHit + 0.05, to: firstHit + 0.70))
        return CGFloat(18 * (1 - appear))
    }

    static func heroScale(_ t: TimeInterval) -> CGFloat {
        if t < swell { return 0.06 }
        let bloom = easeOut(smooth(t, from: swell, to: firstHit + 0.55))
        let pulse = 1 + 0.038 * heartBeat(t)
        let crestPulse = 1 + 0.22 * sinPulse(t, at: crest, width: 0.82)
        let liftPulse = 1 + 0.10 * sinPulse(t, at: lift, width: 0.62)
        let fade = 1 - 0.12 * smooth(t, from: decay, to: end)
        return CGFloat((0.12 + 0.88 * bloom) * pulse * crestPulse * liftPulse * fade)
    }

    static func heroOpacity(_ t: TimeInterval) -> Double {
        if t < swell - 0.06 { return 0 }
        let seed = 0.18 * smooth(t, from: swell - 0.06, to: swell + 0.16)
        let appear = smooth(t, from: firstHit - 0.12, to: firstHit + 0.28)
        let fade = 1 - smooth(t, from: decay + 0.20, to: end)
        return min(1, max(seed, appear)) * fade
    }

    static func glowStrength(_ t: TimeInterval) -> Double {
        let body = smooth(t, from: firstHit - 0.08, to: firstHit + 0.40)
        let crestBoost = 0.92 * sinPulse(t, at: crest, width: 1.05)
        let liftBoost = 0.48 * sinPulse(t, at: lift, width: 0.78)
        let fade = 1 - smooth(t, from: decay, to: end)
        return min(1, body * 0.50 + crestBoost + liftBoost) * fade
    }

    static func ringProgress(_ t: TimeInterval, born: TimeInterval, life: TimeInterval = 1.90) -> Double {
        clamp01((t - born) / life)
    }

    static func sparkProgress(_ t: TimeInterval, born: TimeInterval, life: TimeInterval) -> Double {
        clamp01((t - born) / life)
    }

    static func heartBeat(_ t: TimeInterval) -> Double {
        guard t >= firstHit, t < decay else { return 0 }
        let u = (t - firstHit).truncatingRemainder(dividingBy: beat)
        if u < 0.08 { return smooth(u, from: 0, to: 0.08) }
        if u < 0.28 { return 1 - smooth(u, from: 0.08, to: 0.28) }
        return 0
    }

    static func sinPulse(_ t: TimeInterval, at mark: TimeInterval, width: TimeInterval) -> Double {
        let x = abs(t - mark) / width
        guard x < 1 else { return 0 }
        return (1 + cos(.pi * x)) / 2
    }
}

struct CoffeeThankYouOverlay: View {
    var onFinished: () -> Void
    var previewTime: TimeInterval? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var startedAt = Date()
    @State private var sparks: [ThankYouSpark] = ThankYouSpark.choreography()
    @State private var finished = false

    var body: some View {
        TimelineView(.animation(paused: previewTime != nil)) { context in
            let t = previewTime ?? max(0, context.date.timeIntervalSince(startedAt))
            stage(at: t)
        }
        .background(Color.black.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .interactiveDismissDisabled()
        .onAppear {
            if previewTime == nil {
                startedAt = Date()
                CoffeeSounds.thankYou()
                scheduleHaptics()
                Task { @MainActor in
                    let hold = max(CoffeeThankYouCue.end, min(CoffeeSounds.thankYouDuration, 17.0))
                    try? await Task.sleep(nanoseconds: UInt64(hold * 1_000_000_000))
                    finish()
                }
            }
        }
        .onDisappear {
            CoffeeSounds.stopThankYou()
        }
    }

    @ViewBuilder
    private func stage(at t: TimeInterval) -> some View {
        let veil = CoffeeThankYouCue.veilOpacity(t)
        let bloom = CoffeeThankYouCue.bloomStrength(t)
        ZStack {
            Color.black.opacity(veil)
                .ignoresSafeArea()
            RadialGradient(
                colors: [
                    Color(red: 0.48, green: 0.10, blue: 0.18).opacity(0.78 * bloom),
                    Color(red: 0.16, green: 0.03, blue: 0.07).opacity(0.48 * bloom),
                    Color.black.opacity(0.12 * veil)
                ],
                center: .center,
                startRadius: 6,
                endRadius: 580
            )
            .ignoresSafeArea()
            .offset(y: -48)

            ZStack {
                if reduceMotion == false {
                    ForEach(ThankYouRing.rings) { ring in
                        ringView(ring, t: t)
                    }
                }
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 1, green: 0.46, blue: 0.56).opacity(0.46 * CoffeeThankYouCue.glowStrength(t)),
                                Color(red: 1, green: 0.78, blue: 0.70).opacity(0.10 * CoffeeThankYouCue.glowStrength(t)),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 6,
                            endRadius: 190
                        )
                    )
                    .frame(width: 380, height: 380)
                    .opacity(CoffeeThankYouCue.heroOpacity(t))
                    .blur(radius: 2)
                hero(at: t)
                if reduceMotion == false {
                    ForEach(sparks) { spark in
                        sparkView(spark, t: t)
                    }
                    orbit(at: t)
                }
            }
            .offset(y: -48)

            titles(at: t)
                .offset(y: 148)
        }
        .ignoresSafeArea()
    }

    private func hero(at t: TimeInterval) -> some View {
        let opacity = CoffeeThankYouCue.heroOpacity(t)
        let glow = CoffeeThankYouCue.glowStrength(t)
        let scale: CGFloat = reduceMotion ? 1 : CoffeeThankYouCue.heroScale(t)
        return ZStack {
            Image(systemName: "heart.fill")
                .font(.system(size: 118, weight: .medium))
                .foregroundStyle(Color(red: 0.98, green: 0.34, blue: 0.46).opacity(0.22 + 0.48 * glow))
                .scaleEffect(1.18 + 0.20 * glow)
                .blur(radius: 10 + 8 * glow)
                .opacity(opacity)
            Image(systemName: "heart.fill")
                .font(.system(size: 112, weight: .medium))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(red: 1, green: 0.82, blue: 0.86),
                            Color(red: 0.97, green: 0.36, blue: 0.48),
                            Color(red: 0.68, green: 0.08, blue: 0.24)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 112, weight: .medium))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.28),
                                    Color.white.opacity(0.05),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
                .shadow(
                    color: Color(red: 0.94, green: 0.20, blue: 0.34).opacity((0.36 + 0.48 * glow) * opacity),
                    radius: 28 + 34 * glow
                )
                .opacity(opacity)
        }
        .scaleEffect(scale)
        .accessibilityHidden(true)
    }

    private func titles(at t: TimeInterval) -> some View {
        VStack(spacing: 8) {
            Text("Dziękuję")
                .font(.system(size: 44, weight: .semibold, design: .rounded))
                .tracking(-0.8)
            Text("że jesteś.")
                .font(.system(size: 19, weight: .regular))
                .tracking(1.4)
                .foregroundStyle(Color.white.opacity(0.62))
        }
        .foregroundStyle(Color.white)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 28)
        .scaleEffect(reduceMotion ? 1 : CoffeeThankYouCue.titleScale(t))
        .offset(y: reduceMotion ? 0 : CoffeeThankYouCue.titleOffsetY(t))
        .opacity(CoffeeThankYouCue.titleOpacity(t))
    }

    private func ringView(_ ring: ThankYouRing, t: TimeInterval) -> some View {
        let p = CoffeeThankYouCue.easeOut(CoffeeThankYouCue.ringProgress(t, born: ring.born, life: ring.life))
        let fade = (1 - p) * ring.strength
        return Circle()
            .stroke(ring.tint.opacity(0.28 * fade), lineWidth: ring.line)
            .frame(width: ring.start + CGFloat(p) * ring.travel, height: ring.start + CGFloat(p) * ring.travel)
            .opacity(p > 0 && p < 1 ? 1 : 0)
            .blur(radius: p * 0.6)
    }

    private func sparkView(_ spark: ThankYouSpark, t: TimeInterval) -> some View {
        let p = CoffeeThankYouCue.sparkProgress(t, born: spark.born, life: spark.life)
        let eased = CoffeeThankYouCue.easeOut(p)
        let fade: Double
        if p <= 0 {
            fade = 0
        } else if p < 0.12 {
            fade = p / 0.12
        } else if p < 0.72 {
            fade = 1
        } else {
            fade = max(0, 1 - (p - 0.72) / 0.28)
        }
        switch spark.kind {
        case .pearl:
            return AnyView(
                Circle()
                    .fill(spark.color)
                    .frame(width: spark.size, height: spark.size)
                    .offset(
                        x: spark.end.width * (0.12 + 0.88 * eased),
                        y: spark.end.height * (0.12 + 0.88 * eased)
                    )
                    .scaleEffect(0.30 + 0.70 * eased)
                    .opacity(fade * spark.opacity)
            )
        case .lantern:
            return AnyView(
                Image(systemName: "heart.fill")
                    .font(.system(size: spark.size, weight: .medium))
                    .foregroundStyle(spark.color)
                    .offset(
                        x: spark.end.width * eased,
                        y: spark.end.height * eased - CGFloat(28 * eased)
                    )
                    .scaleEffect(0.42 + 0.58 * eased)
                    .opacity(fade * spark.opacity)
                    .rotationEffect(.degrees(Double(spark.end.width) * 0.04 * eased))
            )
        }
    }

    private func orbit(at t: TimeInterval) -> some View {
        let appear = CoffeeThankYouCue.smooth(t, from: CoffeeThankYouCue.firstHit, to: CoffeeThankYouCue.firstHit + 0.70)
        let fade = 1 - CoffeeThankYouCue.smooth(t, from: CoffeeThankYouCue.decay - 0.40, to: CoffeeThankYouCue.end - 0.30)
        let opacity = appear * fade * (0.42 + 0.40 * CoffeeThankYouCue.glowStrength(t))
        return ForEach(0..<6, id: \.self) { index in
            let angle = (t * 0.28) + (Double(index) / 6.0) * .pi * 2
            let radius = 118 + 10 * sin(t * 0.72 + Double(index))
            Circle()
                .fill(index.isMultiple(of: 2) ? Color.white.opacity(0.92) : Color(red: 1, green: 0.88, blue: 0.82))
                .frame(width: index.isMultiple(of: 3) ? 4.2 : 2.8, height: index.isMultiple(of: 3) ? 4.2 : 2.8)
                .offset(x: cos(angle) * radius, y: sin(angle) * radius)
                .opacity(opacity)
                .blur(radius: 0.3)
        }
    }

    private func scheduleHaptics() {
        guard reduceMotion == false else {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(CoffeeThankYouCue.firstHit * 1_000_000_000))
            UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.55)
            try? await Task.sleep(nanoseconds: 55_000_000)
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred(intensity: 1)
            try? await Task.sleep(nanoseconds: UInt64((CoffeeThankYouCue.crest - CoffeeThankYouCue.firstHit) * 1_000_000_000))
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred(intensity: 0.95)
            try? await Task.sleep(nanoseconds: 90_000_000)
            UIImpactFeedbackGenerator(style: .medium).impactOccurred(intensity: 0.75)
            try? await Task.sleep(nanoseconds: UInt64((CoffeeThankYouCue.lift - CoffeeThankYouCue.crest - 0.09) * 1_000_000_000))
            UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.72)
        }
    }

    private func finish() {
        guard finished == false else { return }
        finished = true
        CoffeeSounds.stopThankYou()
        onFinished()
    }
}

struct ThankYouRing: Identifiable {
    var id: Int
    var born: TimeInterval
    var life: TimeInterval
    var start: CGFloat
    var travel: CGFloat
    var line: CGFloat
    var strength: Double
    var tint: Color

    static let rings: [ThankYouRing] = {
        let white = Color.white
        let rose = Color(red: 1, green: 0.80, blue: 0.84)
        let gold = Color(red: 1, green: 0.91, blue: 0.80)
        return [
            ThankYouRing(id: 1, born: 0.95, life: 2.35, start: 118, travel: 460, line: 1.1, strength: 0.92, tint: white),
            ThankYouRing(id: 2, born: 1.12, life: 2.05, start: 114, travel: 360, line: 0.75, strength: 0.42, tint: rose),
            ThankYouRing(id: 3, born: 2.45, life: 1.85, start: 120, travel: 310, line: 0.7, strength: 0.36, tint: white),
            ThankYouRing(id: 4, born: 3.60, life: 1.80, start: 120, travel: 300, line: 0.7, strength: 0.34, tint: rose),
            ThankYouRing(id: 5, born: 5.85, life: 2.55, start: 124, travel: 490, line: 1.15, strength: 0.72, tint: gold),
            ThankYouRing(id: 6, born: 6.55, life: 2.15, start: 120, travel: 400, line: 1.0, strength: 0.86, tint: white),
            ThankYouRing(id: 7, born: 6.78, life: 1.95, start: 116, travel: 340, line: 0.8, strength: 0.58, tint: rose),
            ThankYouRing(id: 8, born: 6.95, life: 1.80, start: 112, travel: 280, line: 0.7, strength: 0.44, tint: white),
            ThankYouRing(id: 9, born: 7.25, life: 1.70, start: 110, travel: 250, line: 0.65, strength: 0.32, tint: gold),
            ThankYouRing(id: 10, born: 11.45, life: 2.00, start: 118, travel: 320, line: 0.85, strength: 0.52, tint: rose),
            ThankYouRing(id: 11, born: 11.85, life: 1.80, start: 114, travel: 280, line: 0.7, strength: 0.38, tint: white)
        ]
    }()
}

struct ThankYouSpark: Identifiable {
    enum Kind {
        case pearl
        case lantern
    }

    var id: Int
    var born: TimeInterval
    var life: TimeInterval
    var end: CGSize
    var size: CGFloat
    var color: Color
    var opacity: Double
    var kind: Kind

    static func choreography() -> [ThankYouSpark] {
        let rose = Color(red: 1, green: 0.72, blue: 0.76)
        let champagne = Color(red: 1, green: 0.90, blue: 0.80)
        let pearl = Color.white
        var sparks: [ThankYouSpark] = []

        func pearls(idBase: Int, born: TimeInterval, count: Int, distance: CGFloat, spin: Double) {
            for index in 0..<count {
                let angle = (Double(index) / Double(count)) * .pi * 2 + spin
                let reach = distance + CGFloat(index % 3) * 20
                sparks.append(
                    ThankYouSpark(
                        id: idBase + index,
                        born: born + Double(index % 4) * 0.04,
                        life: 2.7 + Double(index % 3) * 0.22,
                        end: CGSize(width: cos(angle) * reach, height: sin(angle) * reach * 0.92),
                        size: index.isMultiple(of: 3) ? 5.8 : 3.8,
                        color: [pearl, rose, champagne, pearl][index % 4],
                        opacity: 0.70,
                        kind: .pearl
                    )
                )
            }
        }

        func lanterns(idBase: Int, born: TimeInterval, count: Int) {
            for index in 0..<count {
                let angle = (Double(index) / Double(count)) * .pi * 2 + 0.18
                let reach: CGFloat = 96 + CGFloat(index % 4) * 28
                sparks.append(
                    ThankYouSpark(
                        id: idBase + index,
                        born: born + Double(index) * 0.055,
                        life: 3.4 + Double(index % 3) * 0.35,
                        end: CGSize(
                            width: cos(angle) * reach * 0.72,
                            height: -abs(sin(angle)) * reach - 40 - CGFloat(index % 3) * 18
                        ),
                        size: CGFloat([14, 18, 12, 16][index % 4]),
                        color: [rose, champagne, pearl, rose][index % 4].opacity(0.92),
                        opacity: 0.88,
                        kind: .lantern
                    )
                )
            }
        }

        pearls(idBase: 0, born: 0.95, count: 8, distance: 128, spin: 0.10)
        pearls(idBase: 20, born: 2.45, count: 6, distance: 142, spin: 0.38)
        pearls(idBase: 40, born: 3.60, count: 6, distance: 136, spin: 0.06)
        lanterns(idBase: 100, born: 6.55, count: 8)
        pearls(idBase: 50, born: 6.70, count: 10, distance: 164, spin: 0.24)
        pearls(idBase: 70, born: 7.25, count: 6, distance: 148, spin: 0.52)
        lanterns(idBase: 120, born: 11.55, count: 6)
        pearls(idBase: 90, born: 11.85, count: 8, distance: 138, spin: 0.20)
        return sparks
    }
}
