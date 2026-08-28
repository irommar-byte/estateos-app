import SwiftUI

struct SplashParticle: Identifiable {
    let id: Int
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var maxOpacity: Double
    var drift: CGFloat
    var warm: Bool
    var fadeDelay: Double
    var speed: CGFloat
}

struct SplashParticleField: View {
    let particles: [SplashParticle]
    let elapsed: TimeInterval

    var body: some View {
        Canvas { context, size in
            for p in particles {
                let fadeIn = min(1, max(0, (elapsed - p.fadeDelay) / 1.6))
                let opacity = p.maxOpacity * fadeIn
                guard opacity > 0.01 else { continue }

                let drift = sin(Double(p.id) + (elapsed * 0.4)) * (p.warm ? 6 : 4)
                let y = (p.y - CGFloat(elapsed) * p.speed).truncatingRemainder(dividingBy: size.height + 40)
                let wrappedY = y < -20 ? y + size.height + 40 : y
                let x = p.x + CGFloat(drift)

                let rect = CGRect(x: x - p.size / 2, y: wrappedY - p.size / 2, width: p.size, height: p.size)
                let color = p.warm
                    ? SplashAnimationTimeline.gold.opacity(opacity)
                    : Color.white.opacity(opacity)
                context.fill(Path(ellipseIn: rect), with: .color(color))
            }
        }
        .allowsHitTesting(false)
    }

    static func makeParticles(in size: CGSize, count: Int = SplashAnimationTimeline.adaptiveParticleCount()) -> [SplashParticle] {
        let warmCount = Int(Double(count) * SplashAnimationTimeline.warmParticleRatio)
        return (0..<count).map { i in
            let warm = i < warmCount
            return SplashParticle(
                id: i,
                x: CGFloat.random(in: 0...max(size.width, 1)),
                y: CGFloat.random(in: 0...max(size.height, 1)),
                size: CGFloat.random(in: warm ? 2.2...4.2 : 1.8...3.8),
                maxOpacity: warm ? Double.random(in: 0.18...0.38) : Double.random(in: 0.28...0.48),
                drift: 0,
                warm: warm,
                fadeDelay: Double.random(in: 0...1.6),
                speed: warm ? CGFloat.random(in: 18...32) : CGFloat.random(in: 28...48)
            )
        }
    }
}
