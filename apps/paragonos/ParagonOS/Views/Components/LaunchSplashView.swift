import SwiftUI
import UIKit

struct LaunchSplashView: View {
    var onFinished: () -> Void

    @State private var spin = false
    @State private var pulse = false
    @State private var showWordmark = false
    @State private var burst = false
    @State private var openPortal = false
    @State private var fadeOut = false
    @State private var bits: [ScatterBit] = []

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()
                RadialGradient(
                    colors: [
                        Color(red: 0.08, green: 0.22, blue: 0.08),
                        Color.black
                    ],
                    center: .center,
                    startRadius: 20,
                    endRadius: max(geo.size.width, geo.size.height)
                )
                .ignoresSafeArea()

                ForEach(bits) { bit in
                    ScatterGlyph(bit: bit)
                        .offset(burst ? bit.end : .zero)
                        .rotationEffect(burst ? bit.endRotation : .degrees(bit.wobble))
                        .scaleEffect(burst ? 1 : 0.12)
                        .opacity(burst ? (openPortal ? 0 : 0.95) : 0)
                }

                VStack(spacing: 22) {
                    RecyclingMark(spinning: spin, pulsing: pulse)
                        .frame(width: 108, height: 108)
                        .scaleEffect(openPortal ? 22 : (showWordmark ? 1 : 0.72))
                        .opacity(openPortal ? 0 : (showWordmark ? 1 : 0))
                    BrandWordmark(size: .largeTitle, primary: .white, os: ParagonTheme.osGreen)
                        .opacity(showWordmark && openPortal == false ? 1 : 0)
                        .offset(y: showWordmark ? 0 : 12)
                    Text("Kwitki wracają. Kaucja też.")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.white.opacity(0.72))
                        .opacity(showWordmark && openPortal == false ? 1 : 0)
                }
            }
            .mask {
                Rectangle()
                    .overlay {
                        Circle()
                            .frame(width: 112, height: 112)
                            .scaleEffect(openPortal ? 28 : 0.001)
                            .blendMode(.destinationOut)
                    }
                    .compositingGroup()
            }
            .onAppear {
                bits = ScatterBit.make(in: geo.size)
                run()
            }
        }
        .ignoresSafeArea()
        .opacity(fadeOut ? 0 : 1)
        .allowsHitTesting(false)
    }

    private func run() {
        LaunchSounds.prepare()
        withAnimation(.easeOut(duration: 0.42)) {
            spin = true
            pulse = true
        }
        withAnimation(.spring(duration: 0.68, bounce: 0.18).delay(0.18)) {
            showWordmark = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.spring(duration: 1.18, bounce: 0.34)) {
                burst = true
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.88) {
            LaunchSounds.cashRegister()
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            }
            withAnimation(.easeIn(duration: 0.62)) {
                openPortal = true
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.48) {
            withAnimation(.easeOut(duration: 0.22)) {
                fadeOut = true
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.7) {
            onFinished()
        }
    }
}

private struct RecyclingMark: View {
    var spinning: Bool
    var pulsing: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: spinning == false)) { timeline in
            let turn = spinning
                ? timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 2.4) / 2.4
                : 0
            ZStack {
                Circle()
                    .fill(ParagonTheme.osGreen.opacity(0.12))
                Circle()
                    .stroke(ParagonTheme.osGreen.opacity(0.28), lineWidth: 9)
                Image(systemName: "arrow.3.trianglehead.clockwise")
                    .font(.system(size: 58, weight: .semibold))
                    .foregroundStyle(ParagonTheme.osGreen)
                    .symbolRenderingMode(.hierarchical)
                    .rotationEffect(.degrees(turn * 360))
                    .scaleEffect(pulsing ? 1.06 : 0.94)
            }
        }
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulsing)
    }
}

private struct ScatterBit: Identifiable {
    enum Kind {
        case receipt
        case can
        case bottle
        case arrow
    }

    let id = UUID()
    let kind: Kind
    let end: CGSize
    let endRotation: Angle
    let wobble: Double
    let size: CGFloat

    static func make(in size: CGSize) -> [ScatterBit] {
        let count = 34
        return (0..<count).map { index in
            let angle = Double(index) / Double(count) * .pi * 2 + Double.random(in: -0.18...0.18)
            let radius = Double.random(in: 0.26...0.68) * max(size.width, size.height)
            let kind: Kind = {
                switch index % 7 {
                case 0: return .can
                case 1: return .bottle
                case 2: return .arrow
                default: return .receipt
                }
            }()
            let glyphSize: CGFloat = {
                switch kind {
                case .receipt: return CGFloat.random(in: 48...86)
                case .can: return CGFloat.random(in: 34...52)
                case .bottle: return CGFloat.random(in: 38...58)
                case .arrow: return CGFloat.random(in: 28...42)
                }
            }()
            return ScatterBit(
                kind: kind,
                end: CGSize(width: cos(angle) * radius, height: sin(angle) * radius * 0.92),
                endRotation: .degrees(Double.random(in: -58...58)),
                wobble: Double.random(in: -14...14),
                size: glyphSize
            )
        }
    }
}

private struct ScatterGlyph: View {
    let bit: ScatterBit

    var body: some View {
        switch bit.kind {
        case .receipt:
            ReceiptChip()
                .frame(width: bit.size * 0.78, height: bit.size * 1.22)
        case .can:
            CanChip()
                .frame(width: bit.size * 0.55, height: bit.size)
        case .bottle:
            Image(systemName: "waterbottle.fill")
                .font(.system(size: bit.size * 0.72, weight: .medium))
                .foregroundStyle(ParagonTheme.osGreen.opacity(0.9))
        case .arrow:
            Image(systemName: "arrow.trianglehead.clockwise")
                .font(.system(size: bit.size * 0.55, weight: .bold))
                .foregroundStyle(ParagonTheme.osGreen)
        }
    }
}

private struct ReceiptChip: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(Color.white.opacity(0.95))
            .overlay(alignment: .top) {
                VStack(spacing: 4) {
                    Capsule().fill(.black.opacity(0.2)).frame(height: 2.4)
                    Capsule().fill(.black.opacity(0.12)).frame(width: 26, height: 2.4)
                    Capsule().fill(.black.opacity(0.1)).frame(width: 20, height: 2)
                    Spacer(minLength: 6)
                    HStack(spacing: 1.4) {
                        ForEach(0..<9, id: \.self) { index in
                            Rectangle()
                                .fill(.black.opacity(index.isMultiple(of: 2) ? 0.58 : 0.18))
                                .frame(width: 1.8)
                        }
                    }
                    .frame(height: 14)
                }
                .padding(7)
            }
            .shadow(color: .black.opacity(0.28), radius: 5, y: 3)
    }
}

private struct CanChip: View {
    var body: some View {
        Capsule()
            .fill(
                LinearGradient(
                    colors: [Color.white.opacity(0.85), Color.gray.opacity(0.55)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay {
                Capsule()
                    .stroke(ParagonTheme.osGreen.opacity(0.45), lineWidth: 1)
            }
            .overlay(alignment: .top) {
                Capsule()
                    .fill(Color.white.opacity(0.7))
                    .frame(height: 5)
                    .padding(.top, 3)
                    .padding(.horizontal, 3)
            }
    }
}
