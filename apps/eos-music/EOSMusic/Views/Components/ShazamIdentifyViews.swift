import SwiftUI

// MARK: - Toolbar button

struct ShazamIdentifyButton: View {
    @ObservedObject private var shazam = ShazamIdentifyController.shared
    var size: CGFloat = 40
    @State private var burst = false
    @State private var burstScale: CGFloat = 0.4
    @State private var showCheck = false

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            shazam.userTapped()
        } label: {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: showCheck
                                ? [Color(red: 0.22, green: 0.86, blue: 0.45), Color(red: 0.08, green: 0.62, blue: 0.32)]
                                : [Color(red: 0.07, green: 0.18, blue: 0.55), Color(red: 0.12, green: 0.35, blue: 0.92)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Circle()
                    .strokeBorder(Color.white.opacity(0.28), lineWidth: 1.2)
                if burst {
                    Circle()
                        .stroke(Color.white.opacity(0.85), lineWidth: 2)
                        .scaleEffect(burstScale)
                        .opacity(Double(max(0, 1.35 - burstScale)))
                }
                if showCheck {
                    Image(systemName: "checkmark")
                        .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .transition(.scale.combined(with: .opacity))
                } else {
                    Image(systemName: "shazam.logo.fill")
                        .font(.system(size: size * 0.42, weight: .semibold))
                        .foregroundStyle(.white)
                        .symbolEffect(.pulse, isActive: shazam.isListening)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(width: size, height: size)
            .scaleEffect(showCheck ? 1.08 : 1)
            .shadow(color: (showCheck ? Color.green : Color(red: 0.15, green: 0.35, blue: 0.95)).opacity(0.45), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Rozpoznaj utwór")
        .onChange(of: shazam.celebrationGeneration) { _, generation in
            guard generation > 0 else { return }
            playSuccessBurst()
        }
    }

    private func playSuccessBurst() {
        burst = true
        burstScale = 0.55
        withAnimation(.spring(response: 0.34, dampingFraction: 0.62)) {
            showCheck = true
            burstScale = 1.85
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 900_000_000)
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                showCheck = false
                burst = false
                burstScale = 0.4
            }
        }
    }
}

// MARK: - Sheet

struct ShazamIdentifySheet: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject private var shazam = ShazamIdentifyController.shared

    private let discSize: CGFloat = 118
    private let navy = Color(red: 0.04, green: 0.08, blue: 0.22)
    private let navyDeep = Color(red: 0.02, green: 0.04, blue: 0.12)

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [navy, navyDeep],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Deep vignette
            RadialGradient(
                colors: [
                    Color(red: 0.12, green: 0.28, blue: 0.75).opacity(shazam.isListening ? 0.28 + shazam.inputLevel * 0.22 : 0.12),
                    .clear,
                ],
                center: .center,
                startRadius: 20,
                endRadius: 280
            )
            .ignoresSafeArea()
            .animation(.easeOut(duration: 0.18), value: shazam.inputLevel)

            VStack(spacing: 0) {
                Capsule()
                    .fill(Color.white.opacity(0.28))
                    .frame(width: 36, height: 5)
                    .padding(.top, 10)
                    .padding(.bottom, 18)

                Spacer(minLength: 8)

                ZStack {
                    ShazamRippleField(
                        level: shazam.inputLevel,
                        isActive: shazam.isListening && !shazam.isCelebrating,
                        discSize: discSize
                    )
                    .opacity(shazam.isDismissing ? 0 : 1)

                    ShazamLevelRing(
                        level: shazam.peakLevel,
                        isActive: shazam.isListening && !shazam.isCelebrating,
                        discSize: discSize
                    )
                    .opacity(shazam.isDismissing ? 0 : 1)

                    if shazam.isCelebrating || shazam.isDismissing {
                        ShazamSuccessBloom(isDismissing: shazam.isDismissing, discSize: discSize)
                    }

                    ShazamFlipDisc(
                        size: discSize,
                        isFlipped: shazam.isFlipped,
                        isListening: shazam.isListening,
                        inputLevel: shazam.inputLevel,
                        artworkURL: shazam.isFlipped ? nil : (shazam.addSucceeded == true ? shazam.artworkURL : nil)
                    )
                    .scaleEffect(shazam.isDismissing ? 0.42 : (shazam.isCelebrating ? 1.06 : 1))
                    .opacity(shazam.isDismissing ? 0 : 1)
                    .offset(y: shazam.isDismissing ? 36 : 0)
                    .blur(radius: shazam.isDismissing ? 8 : 0)
                }
                .frame(height: discSize + 160)
                .padding(.bottom, 8)

                VStack(spacing: 6) {
                    Text(headline)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                        .contentTransition(.opacity)
                        .animation(.easeOut(duration: 0.28), value: shazam.titleLine)

                    Text(subheadline)
                        .font(.system(size: 15, weight: .medium, design: .rounded))
                        .foregroundStyle(Color.white.opacity(0.55))
                        .multilineTextAlignment(.center)
                        .frame(minHeight: 20)
                        .animation(.easeOut(duration: 0.28), value: shazam.artistLine)
                }
                .padding(.horizontal, 28)
                .opacity(shazam.isDismissing ? 0 : 1)
                .offset(y: shazam.isDismissing ? 20 : 0)

                Spacer(minLength: 16)

                continuousToggle
                    .padding(.horizontal, 22)
                    .padding(.bottom, 10)
                    .opacity(shazam.isDismissing ? 0 : 1)

                Text(footerHint)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.35))
                    .padding(.bottom, 22)
                    .opacity(shazam.isDismissing ? 0 : 1)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear { shazam.bind(app) }
        .animation(.spring(response: 0.62, dampingFraction: 0.84), value: shazam.isDismissing)
        .animation(.spring(response: 0.48, dampingFraction: 0.78), value: shazam.isFlipped)
        .animation(.spring(response: 0.5, dampingFraction: 0.8), value: shazam.isCelebrating)
    }

    private var headline: String {
        if shazam.isCelebrating || shazam.addSucceeded == true {
            return shazam.titleLine.isEmpty ? "Dodano" : shazam.titleLine
        }
        if shazam.addSucceeded == false, !shazam.titleLine.isEmpty, shazam.titleLine != "Słucham…" {
            return shazam.titleLine
        }
        if shazam.isListening {
            return shazam.continuousListening ? "Szukamy dalej" : "Słucham…"
        }
        return shazam.titleLine
    }

    private var subheadline: String {
        if shazam.isCelebrating || shazam.addSucceeded == true {
            if !shazam.artistLine.isEmpty { return shazam.artistLine }
            return shazam.addStatus.isEmpty ? "Dodano do SHAZAM" : shazam.addStatus
        }
        if shazam.addSucceeded == false {
            return shazam.addStatus.isEmpty ? " " : shazam.addStatus
        }
        if shazam.isListening {
            return shazam.continuousListening ? "Zostań z nami" : "Nasłuchuję otoczenia…"
        }
        if shazam.addSucceeded == nil, !shazam.addStatus.isEmpty {
            return shazam.addStatus
        }
        return shazam.artistLine.isEmpty ? " " : shazam.artistLine
    }

    private var footerHint: String {
        if shazam.isListening {
            return "Przesuń w dół, aby anulować"
        }
        return " "
    }

    private var continuousToggle: some View {
        Toggle(isOn: $shazam.continuousListening) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Ciągłe nasłuchiwanie")
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                Text("Wykrywa utwory jeden po drugim, aż wyłączysz")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.45))
            }
        }
        .tint(Color(red: 0.25, green: 0.55, blue: 1.0))
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.07))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.35), radius: 16, y: 8)
        )
    }
}

// MARK: - Level ring (reacts to what Shazam hears)

private struct ShazamLevelRing: View {
    let level: CGFloat
    let isActive: Bool
    let discSize: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    Color.white.opacity(0.16 + Double(level) * 0.62),
                    lineWidth: 2.2 + level * 8
                )
                .frame(width: discSize + 16, height: discSize + 16)
                .scaleEffect(1 + level * 0.14)
            Circle()
                .stroke(
                    Color(red: 0.45, green: 0.72, blue: 1).opacity(0.08 + Double(level) * 0.42),
                    lineWidth: 12 + level * 18
                )
                .frame(width: discSize + 26, height: discSize + 26)
                .scaleEffect(1 + level * 0.26)
                .blur(radius: 0.4 + level * 1.8)
        }
        .opacity(isActive ? 1 : 0)
        .animation(.interactiveSpring(response: 0.11, dampingFraction: 0.7), value: level)
        .allowsHitTesting(false)
    }
}

private struct ShazamSuccessBloom: View {
    let isDismissing: Bool
    let discSize: CGFloat
    @State private var expanded = false

    var body: some View {
        Circle()
            .stroke(Color.white.opacity(expanded ? 0 : 0.9), lineWidth: expanded ? 0.6 : 3)
            .frame(width: discSize, height: discSize)
            .scaleEffect(expanded ? (isDismissing ? 2.8 : 1.85) : 0.72)
            .onAppear {
                withAnimation(.spring(response: 0.55, dampingFraction: 0.72)) {
                    expanded = true
                }
            }
            .allowsHitTesting(false)
    }
}

// MARK: - Expanding ripples (real Shazam feel)

private struct ShazamRippleField: View {
    let level: CGFloat
    let isActive: Bool
    let discSize: CGFloat

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !isActive)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            ZStack {
                ForEach(0..<5, id: \.self) { index in
                    ripple(index: index, time: t)
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func ripple(index: Int, time: TimeInterval) -> some View {
        // Staggered phases — rings chase each other outward.
        let period = max(1.35, 2.15 - Double(level) * 0.85)
        let phase = (time / period + Double(index) * 0.2).truncatingRemainder(dividingBy: 1)
        let progress = CGFloat(phase)
        // Level boosts how far and how bright rings travel.
        let maxScale = 1.15 + level * 1.55
        let scale = 1 + progress * maxScale
        let fade = pow(1 - progress, 1.35) * (0.22 + level * 0.55)
        let line = max(0.6, 2.2 - progress * 1.4 + level * 1.1)

        return Circle()
            .stroke(
                Color.white.opacity(Double(fade)),
                lineWidth: line
            )
            .frame(width: discSize, height: discSize)
            .scaleEffect(scale)
            .blur(radius: progress * 0.6)
            .opacity(isActive ? 1 : 0)
    }
}

// MARK: - Flip disc (S → green check)

private struct ShazamFlipDisc: View {
    let size: CGFloat
    let isFlipped: Bool
    let isListening: Bool
    let inputLevel: CGFloat
    let artworkURL: URL?

    var body: some View {
        ZStack {
            discFace(front: true)
                .opacity(isFlipped ? 0 : 1)
                .rotation3DEffect(
                    .degrees(isFlipped ? 90 : 0),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 0.65
                )

            discFace(front: false)
                .opacity(isFlipped ? 1 : 0)
                .rotation3DEffect(
                    .degrees(isFlipped ? 0 : -90),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 0.65
                )
        }
        .frame(width: size, height: size)
        .scaleEffect(isListening && !isFlipped ? 1 + inputLevel * 0.045 : 1)
        .animation(.interactiveSpring(response: 0.14, dampingFraction: 0.75), value: inputLevel)
        .shadow(color: .black.opacity(0.55), radius: 28, y: 16)
        .shadow(
            color: (isFlipped ? Color.green : Color(red: 0.2, green: 0.45, blue: 1))
                .opacity(isFlipped ? 0.55 : 0.35 + inputLevel * 0.35),
            radius: isFlipped ? 32 : 18 + inputLevel * 14,
            y: 8
        )
    }

    @ViewBuilder
    private func discFace(front: Bool) -> some View {
        ZStack {
            Circle()
                .fill(
                    front
                        ? LinearGradient(
                            colors: [
                                Color(red: 0.18, green: 0.42, blue: 0.98),
                                Color(red: 0.08, green: 0.22, blue: 0.72),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        : LinearGradient(
                            colors: [
                                Color(red: 0.22, green: 0.86, blue: 0.45),
                                Color(red: 0.08, green: 0.62, blue: 0.32),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                )

            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.white.opacity(0.55), Color.white.opacity(0.08)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.4
                )

            // Soft inner highlight
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.28), .clear],
                        center: .topLeading,
                        startRadius: 2,
                        endRadius: size * 0.55
                    )
                )
                .blendMode(.plusLighter)
                .opacity(0.7)

            if front {
                if let artworkURL {
                    AsyncImage(url: artworkURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        shazamGlyph
                    }
                    .frame(width: size, height: size)
                    .clipShape(Circle())
                } else {
                    shazamGlyph
                }
            } else {
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
            }
        }
        .frame(width: size, height: size)
    }

    private var shazamGlyph: some View {
        Image(systemName: "shazam.logo.fill")
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 6, y: 2)
            .symbolEffect(.pulse, isActive: isListening && !isFlipped)
    }
}
