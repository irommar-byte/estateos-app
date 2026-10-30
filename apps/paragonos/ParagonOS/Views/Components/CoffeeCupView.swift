import SwiftUI

/// Porcelain coffee cup drawn in one Canvas: cylinder-shaded body, saucer, crema, steam.
/// `drinking` is true while the pour sound plays: a stream falls in and the cup fills in time with it.
struct CoffeeCupView: View {
    var size: CoffeeSize
    var selected: Bool
    var drinking: Bool
    var reduceMotion: Bool
    var compact: Bool = false
    var showsCaption: Bool = true
    var steamAt: Date? = nil
    @State private var pourStart: Date?
    @Environment(\.colorScheme) private var colorScheme

    /// Matches coffee_sound.mp3 (3.24 s): stream for ~2.6 s, then settle.
    static let pourDuration: Double = 3.1

    private var well: CGFloat { compact ? 68 : 96 }

    var body: some View {
        VStack(spacing: compact ? 4 : 6) {
            art
                .frame(width: well, height: well)
            if showsCaption {
                Text(LocalizedStringKey(size.title))
                    .font(compact ? .caption2.weight(.semibold) : .caption.weight(.semibold))
                    .foregroundStyle(selected ? .primary : .secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .onAppear { startPourIfNeeded(drinking) }
        .onChange(of: drinking) { _, now in startPourIfNeeded(now) }
        .task(id: pourStart) {
            guard let started = pourStart else { return }
            try? await Task.sleep(for: .seconds(Self.pourDuration + 0.15))
            if pourStart == started { pourStart = nil }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func startPourIfNeeded(_ pouring: Bool) {
        guard pouring, reduceMotion == false else { return }
        pourStart = .now
    }

    private var art: some View {
        let animating = reduceMotion == false && steamAt == nil && (selected || pourStart != nil)
        return TimelineView(.animation(minimumInterval: 1 / 60, paused: animating == false)) { timeline in
            let now = steamAt ?? timeline.date
            let progress = pourStart.map { min(1, max(0, now.timeIntervalSince($0) / Self.pourDuration)) }
            Canvas { context, canvas in
                PorcelainCupArt(
                    size: size,
                    time: now.timeIntervalSinceReferenceDate,
                    pour: progress,
                    steam: selected && reduceMotion == false ? 1 : 0,
                    glow: selected ? 1 : 0,
                    steamWhite: colorScheme == .dark ? 0.92 : 0.55
                )
                .draw(in: &context, canvas: canvas)
            }
        }
        .scaleEffect(selected ? 1.04 : 0.95, anchor: .bottom)
        .offset(y: selected ? -2 : 0)
        .animation(reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.7), value: selected)
    }
}

private struct PorcelainCupArt {
    var size: CoffeeSize
    var time: Double
    var pour: Double?
    var steam: Double
    var glow: Double
    var steamWhite: Double

    private static let fullLevel = 0.86

    private struct CupGeometry {
        var cupWidth: CGFloat      // rim width, fraction of the canvas
        var cupHeight: CGFloat
        var bottomRatio: CGFloat   // foot width relative to the rim
        var saucer: CGFloat        // saucer width, 0 = mug on the table
        var handle: CGFloat
    }

    private var shape: CupGeometry {
        switch size {
        case .small: return CupGeometry(cupWidth: 0.36, cupHeight: 0.24, bottomRatio: 0.62, saucer: 0.68, handle: 0.85)
        case .medium: return CupGeometry(cupWidth: 0.50, cupHeight: 0.29, bottomRatio: 0.56, saucer: 0.86, handle: 1.0)
        case .large: return CupGeometry(cupWidth: 0.46, cupHeight: 0.46, bottomRatio: 0.9, saucer: 0, handle: 1.25)
        }
    }

    private var level: Double {
        guard let pour else { return Self.fullLevel }
        let fill = min(1, pour / 0.84)
        let eased = 1 - pow(1 - fill, 2.2)
        return 0.1 + (Self.fullLevel - 0.1) * eased
    }

    func draw(in ctx: inout GraphicsContext, canvas: CGSize) {
        let u = min(canvas.width, canvas.height)
        let s = shape
        let cx = canvas.width * 0.46
        let base = canvas.height * 0.86
        let rx = s.cupWidth * u / 2
        let ry = rx * 0.26
        let cupBottom = base - (s.saucer > 0 ? u * 0.035 : 0)
        let cupTop = cupBottom - s.cupHeight * u
        let rb = rx * s.bottomRatio
        let thickness = u * 0.022

        // Soft warm light on the table under the selected cup.
        if glow > 0 {
            let r = max(s.saucer, s.cupWidth) * u * 0.62
            ctx.fill(
                Path(ellipseIn: CGRect(x: cx - r, y: base - r * 0.32, width: r * 2, height: r * 0.64)),
                with: .radialGradient(
                    Gradient(colors: [Color(red: 1, green: 0.78, blue: 0.45).opacity(0.22 * glow), .clear]),
                    center: CGPoint(x: cx, y: base), startRadius: 0, endRadius: r
                )
            )
        }

        // Contact shadow.
        let shadowW = (s.saucer > 0 ? s.saucer : s.cupWidth * s.bottomRatio * 1.15) * u
        ctx.drawLayer { layer in
            layer.addFilter(.blur(radius: u * 0.025))
            layer.fill(
                Path(ellipseIn: CGRect(x: cx - shadowW * 0.48, y: base - u * 0.01, width: shadowW * 0.96, height: u * 0.07)),
                with: .color(.black.opacity(0.32))
            )
        }

        if s.saucer > 0 { drawSaucer(&ctx, cx: cx, base: base, u: u, width: s.saucer * u) }

        // Handle sits behind the body.
        let handleH = s.cupHeight * u * 0.62 * s.handle
        let handleRect = CGRect(
            x: cx + rx * 0.62,
            y: cupTop + s.cupHeight * u * 0.14,
            width: handleH * 0.78,
            height: handleH
        )
        let handle = Path(ellipseIn: handleRect)
        let handleStyle = StrokeStyle(lineWidth: u * 0.045, lineCap: .round)
        ctx.stroke(handle, with: .color(.black.opacity(0.12)), style: StrokeStyle(lineWidth: u * 0.052))
        ctx.stroke(handle, with: .linearGradient(
            Gradient(colors: [Color(white: 0.99), Color(white: 0.80), Color(white: 0.62)]),
            startPoint: CGPoint(x: handleRect.midX, y: handleRect.minY),
            endPoint: CGPoint(x: handleRect.midX, y: handleRect.maxY)
        ), style: handleStyle)

        // Body: tulip silhouette with cylinder shading.
        var body = Path()
        body.move(to: CGPoint(x: cx - rx, y: cupTop))
        body.addCurve(
            to: CGPoint(x: cx - rb, y: cupBottom - ry * 0.4),
            control1: CGPoint(x: cx - rx, y: cupTop + s.cupHeight * u * 0.55),
            control2: CGPoint(x: cx - rb - (rx - rb) * 0.35, y: cupBottom - s.cupHeight * u * 0.08)
        )
        body.addQuadCurve(
            to: CGPoint(x: cx + rb, y: cupBottom - ry * 0.4),
            control: CGPoint(x: cx, y: cupBottom + ry * 1.1)
        )
        body.addCurve(
            to: CGPoint(x: cx + rx, y: cupTop),
            control1: CGPoint(x: cx + rb + (rx - rb) * 0.35, y: cupBottom - s.cupHeight * u * 0.08),
            control2: CGPoint(x: cx + rx, y: cupTop + s.cupHeight * u * 0.55)
        )
        body.addQuadCurve(to: CGPoint(x: cx - rx, y: cupTop), control: CGPoint(x: cx, y: cupTop - ry * 2))
        body.closeSubpath()

        ctx.fill(body, with: .linearGradient(
            Gradient(stops: [
                .init(color: Color(red: 0.70, green: 0.69, blue: 0.67), location: 0),
                .init(color: Color(red: 0.86, green: 0.85, blue: 0.83), location: 0.12),
                .init(color: Color(red: 1.00, green: 0.995, blue: 0.985), location: 0.30),
                .init(color: Color(red: 0.96, green: 0.955, blue: 0.94), location: 0.46),
                .init(color: Color(red: 0.84, green: 0.83, blue: 0.81), location: 0.72),
                .init(color: Color(red: 0.70, green: 0.69, blue: 0.67), location: 0.90),
                .init(color: Color(red: 0.79, green: 0.78, blue: 0.76), location: 1)
            ]),
            startPoint: CGPoint(x: cx - rx, y: 0),
            endPoint: CGPoint(x: cx + rx, y: 0)
        ))
        var shade = ctx
        shade.clip(to: body)
        shade.fill(body, with: .linearGradient(
            Gradient(colors: [.clear, .black.opacity(0.16)]),
            startPoint: CGPoint(x: cx, y: cupTop + s.cupHeight * u * 0.45),
            endPoint: CGPoint(x: cx, y: cupBottom)
        ))
        // Glaze highlight streak.
        shade.fill(
            Path(roundedRect: CGRect(x: cx - rx * 0.52, y: cupTop + ry, width: rx * 0.12, height: s.cupHeight * u * 0.62), cornerRadius: rx * 0.06),
            with: .color(.white.opacity(0.55))
        )

        // Opening, inner wall, coffee.
        let rim = CGRect(x: cx - rx, y: cupTop - ry, width: rx * 2, height: ry * 2)
        let inner = rim.insetBy(dx: thickness, dy: thickness * 0.28)
        let innerPath = Path(ellipseIn: inner)
        ctx.fill(innerPath, with: .linearGradient(
            Gradient(colors: [Color(white: 0.62), Color(white: 0.86)]),
            startPoint: CGPoint(x: cx, y: inner.minY),
            endPoint: CGPoint(x: cx, y: inner.maxY)
        ))
        var cup = ctx
        cup.clip(to: innerPath)
        let depth = (1 - level) * Double(s.cupHeight * u) * 0.5
        let shrink = 1 - CGFloat(1 - level) * 0.14
        let surface = CGRect(
            x: cx - inner.width / 2 * shrink,
            y: inner.minY + CGFloat(depth),
            width: inner.width * shrink,
            height: inner.height * shrink
        )
        drawCoffee(&cup, in: surface, u: u)

        // Rim: glazed lip catching the light.
        ctx.stroke(Path(ellipseIn: rim.insetBy(dx: thickness * 0.5, dy: thickness * 0.14)),
                   with: .linearGradient(
                    Gradient(colors: [Color.white, Color(white: 0.9), Color.white]),
                    startPoint: CGPoint(x: rim.minX, y: rim.midY),
                    endPoint: CGPoint(x: rim.maxX, y: rim.midY)
                   ),
                   lineWidth: thickness)
        ctx.stroke(innerPath, with: .color(.black.opacity(0.10)), lineWidth: 0.6)

        if let pour, pour < 0.92 { drawStream(&ctx, cx: cx, to: surface, u: u, progress: pour) }
        if steam > 0 { drawSteam(&ctx, cx: cx, top: cupTop - ry, u: u, width: rx) }
    }

    private func drawSaucer(_ ctx: inout GraphicsContext, cx: CGFloat, base: CGFloat, u: CGFloat, width: CGFloat) {
        let rx = width / 2
        let ry = rx * 0.24
        let plate = CGRect(x: cx - rx, y: base - ry, width: rx * 2, height: ry * 2)
        ctx.fill(Path(ellipseIn: plate.offsetBy(dx: 0, dy: u * 0.018)), with: .color(Color(white: 0.58)))
        ctx.fill(Path(ellipseIn: plate), with: .linearGradient(
            Gradient(colors: [Color(white: 1.0), Color(white: 0.86), Color(white: 0.74)]),
            startPoint: CGPoint(x: cx, y: plate.minY),
            endPoint: CGPoint(x: cx, y: plate.maxY)
        ))
        let well = plate.insetBy(dx: rx * 0.36, dy: ry * 0.36)
        ctx.fill(Path(ellipseIn: well), with: .linearGradient(
            Gradient(colors: [Color(white: 0.80), Color(white: 0.93)]),
            startPoint: CGPoint(x: cx, y: well.minY),
            endPoint: CGPoint(x: cx, y: well.maxY)
        ))
        ctx.stroke(Path(ellipseIn: plate.insetBy(dx: 0.6, dy: 0.4)), with: .color(.white.opacity(0.8)), lineWidth: 0.8)
    }

    private func drawCoffee(_ ctx: inout GraphicsContext, in surface: CGRect, u: CGFloat) {
        let path = Path(ellipseIn: surface)
        ctx.fill(path, with: .radialGradient(
            Gradient(stops: [
                .init(color: Color(red: 0.80, green: 0.58, blue: 0.36), location: 0),
                .init(color: Color(red: 0.58, green: 0.35, blue: 0.17), location: 0.55),
                .init(color: Color(red: 0.25, green: 0.12, blue: 0.05), location: 1)
            ]),
            center: CGPoint(x: surface.midX - surface.width * 0.08, y: surface.midY - surface.height * 0.1),
            startRadius: 0,
            endRadius: surface.width * 0.55
        ))
        // Latte heart on the cappuccino once it is full.
        if size == .medium, level > 0.78 {
            let a = min(1, (level - 0.78) / 0.08)
            let hw = surface.width * 0.22
            let hc = CGPoint(x: surface.midX, y: surface.midY)
            var heart = Path()
            heart.move(to: CGPoint(x: hc.x, y: hc.y + surface.height * 0.24))
            heart.addCurve(to: CGPoint(x: hc.x - hw, y: hc.y - surface.height * 0.05),
                           control1: CGPoint(x: hc.x - hw * 0.5, y: hc.y + surface.height * 0.12),
                           control2: CGPoint(x: hc.x - hw, y: hc.y + surface.height * 0.06))
            heart.addCurve(to: CGPoint(x: hc.x, y: hc.y - surface.height * 0.08),
                           control1: CGPoint(x: hc.x - hw, y: hc.y - surface.height * 0.3),
                           control2: CGPoint(x: hc.x - hw * 0.1, y: hc.y - surface.height * 0.28))
            heart.addCurve(to: CGPoint(x: hc.x + hw, y: hc.y - surface.height * 0.05),
                           control1: CGPoint(x: hc.x + hw * 0.1, y: hc.y - surface.height * 0.28),
                           control2: CGPoint(x: hc.x + hw, y: hc.y - surface.height * 0.3))
            heart.addCurve(to: CGPoint(x: hc.x, y: hc.y + surface.height * 0.24),
                           control1: CGPoint(x: hc.x + hw, y: hc.y + surface.height * 0.06),
                           control2: CGPoint(x: hc.x + hw * 0.5, y: hc.y + surface.height * 0.12))
            ctx.fill(heart, with: .color(Color(red: 0.96, green: 0.90, blue: 0.80).opacity(0.9 * a)))
        }
        // Ripples while pouring.
        if let pour, pour < 0.95 {
            for i in 0..<2 {
                let phase = (time * 1.6 + Double(i) * 0.5).truncatingRemainder(dividingBy: 1)
                let r = CGFloat(phase) * surface.width * 0.42
                let ring = CGRect(x: surface.midX - r, y: surface.midY - r * surface.height / surface.width, width: r * 2, height: r * 2 * surface.height / surface.width)
                ctx.stroke(Path(ellipseIn: ring), with: .color(Color(red: 0.95, green: 0.82, blue: 0.62).opacity(0.5 * (1 - phase))), lineWidth: 0.7)
            }
        }
        // Specular glint.
        ctx.fill(
            Path(ellipseIn: CGRect(x: surface.minX + surface.width * 0.16, y: surface.minY + surface.height * 0.18, width: surface.width * 0.2, height: surface.height * 0.16)),
            with: .color(.white.opacity(0.28))
        )
    }

    private func drawStream(_ ctx: inout GraphicsContext, cx: CGFloat, to surface: CGRect, u: CGFloat, progress: Double) {
        let ending = progress > 0.74 ? max(0, (0.92 - progress) / 0.18) : 1
        let starting = min(1, progress / 0.08)
        let width = u * 0.04 * CGFloat(ending)
        guard width > 0.3 else { return }
        let top = surface.midY - (surface.midY - 0) * CGFloat(starting)
        let wobble = CGFloat(sin(time * 11)) * u * 0.004
        let rect = CGRect(x: cx - width / 2 + wobble, y: top, width: width, height: surface.midY - top)
        ctx.fill(Path(roundedRect: rect, cornerRadius: width / 2), with: .linearGradient(
            Gradient(colors: [Color(red: 0.42, green: 0.22, blue: 0.09), Color(red: 0.30, green: 0.15, blue: 0.06)]),
            startPoint: CGPoint(x: rect.minX, y: 0), endPoint: CGPoint(x: rect.maxX, y: 0)
        ))
        ctx.fill(Path(CGRect(x: rect.minX + width * 0.22, y: rect.minY, width: max(0.5, width * 0.16), height: rect.height)),
                 with: .color(.white.opacity(0.22)))
    }

    private func drawSteam(_ ctx: inout GraphicsContext, cx: CGFloat, top: CGFloat, u: CGFloat, width: CGFloat) {
        let calm = pour.map { $0 > 0.8 ? ($0 - 0.8) / 0.2 : 0.25 } ?? 1
        ctx.drawLayer { layer in
            layer.addFilter(.blur(radius: u * 0.022))
            for i in 0..<3 {
                let period = 3.2 + Double(i) * 0.7
                let phase = (time / period + Double(i) * 0.33).truncatingRemainder(dividingBy: 1)
                let x0 = cx + (CGFloat(i) - 1) * width * 0.42
                let rise = u * 0.30
                var wisp = Path()
                let y0 = top - CGFloat(phase) * rise * 0.25
                wisp.move(to: CGPoint(x: x0, y: y0))
                wisp.addCurve(
                    to: CGPoint(x: x0 + CGFloat(sin((time + Double(i)) * 1.3)) * u * 0.05, y: y0 - rise),
                    control1: CGPoint(x: x0 + u * 0.05 * CGFloat(sin(time * 0.9 + Double(i))), y: y0 - rise * 0.35),
                    control2: CGPoint(x: x0 - u * 0.05 * CGFloat(cos(time * 1.1 + Double(i))), y: y0 - rise * 0.7)
                )
                let alpha = 0.55 * steam * calm * sin(.pi * phase)
                layer.stroke(wisp, with: .color(Color(white: steamWhite).opacity(alpha)),
                             style: StrokeStyle(lineWidth: u * 0.035, lineCap: .round))
            }
        }
    }
}

struct SteamWisp: View {
    var active: Bool
    var dense: Bool
    var clock: Date? = nil

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 24, paused: active == false || clock != nil)) { timeline in
            Canvas { context, size in
                let t = (clock ?? timeline.date).timeIntervalSinceReferenceDate
                for index in 0..<3 {
                    let phase = t / (3.6 + Double(index) * 0.5)
                    let loop = phase.truncatingRemainder(dividingBy: 1)
                    var path = Path()
                    let x = size.width * (0.30 + CGFloat(index) * 0.16)
                    path.move(to: CGPoint(x: x, y: size.height))
                    path.addCurve(
                        to: CGPoint(x: x + CGFloat(sin(loop * .pi * 2) * 3.2), y: 2),
                        control1: CGPoint(x: x + 4, y: size.height * 0.55),
                        control2: CGPoint(x: x - 3.5, y: size.height * 0.28)
                    )
                    let opacity = (dense ? 0.48 : 0.22) * (1 - loop)
                    context.stroke(
                        path,
                        with: .color(Color(red: 0.58, green: 0.54, blue: 0.50).opacity(opacity)),
                        style: StrokeStyle(lineWidth: dense ? 1.6 : 1.1, lineCap: .round)
                    )
                }
            }
        }
        .allowsHitTesting(false)
        .opacity(active ? 1 : 0)
    }
}

struct CoffeeCupStrip: View {
    var selected: CoffeeSize? = .medium
    var drinking: CoffeeSize? = nil
    var steamAt: Date = Date(timeIntervalSinceReferenceDate: 100)
    var compact: Bool = false

    var body: some View {
        HStack(alignment: .bottom, spacing: compact ? 8 : 12) {
            ForEach(CoffeeSize.allCases) { size in
                VStack(spacing: compact ? 6 : 8) {
                    CoffeeCupView(
                        size: size,
                        selected: selected == size,
                        drinking: drinking == size,
                        reduceMotion: false,
                        compact: compact,
                        steamAt: steamAt
                    )
                    Text(size.fallbackPrice)
                        .font(compact ? .caption2.weight(.semibold).monospacedDigit() : .caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(selected == size ? .secondary : .tertiary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(24)
        .frame(width: compact ? 360 : 390, height: compact ? 200 : 240)
        .background(ParagonTheme.surface)
    }
}
