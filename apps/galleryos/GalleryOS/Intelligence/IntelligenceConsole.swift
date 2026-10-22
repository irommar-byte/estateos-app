import SwiftUI

/// The smart part of GalleryOS™ Core: a neural processor at work and, under it, every process
/// that understands the photos (scenes, faces, text, sentence search, quality, people, memories)
/// with how far it has come.
struct IntelligenceConsole: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var brain = PhotoIntelligence.shared
    @ObservedObject private var cleanup = CleanupCenter.shared
    @ObservedObject private var memories = MemoryCenter.shared

    private var busy: Bool { brain.running && brain.pauseReason == nil }
    private var warm: Bool { brain.pauseReason != nil && !brain.waitingForCopy }

    private var tint: Color {
        warm ? Color(uiColor: .systemOrange) : Color(uiColor: .systemIndigo)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(L("INTELIGENCJA NA URZĄDZENIU"))
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(headline)
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.4)
                    .foregroundStyle(busy ? tint : Color.secondary)
                    .contentTransition(.opacity)
            }
            HStack(spacing: 18) {
                NeuralChip(active: busy, tint: tint)
                    .frame(width: 118, height: 118)
                VStack(alignment: .leading, spacing: 8) {
                    Text(percentText)
                        .font(.system(size: 40, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: fraction))
                        .animation(.spring(response: 0.55, dampingFraction: 0.8), value: percentText)
                    Text(statusText)
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    LoadMeter(active: busy, tint: tint)
                        .frame(height: 14)
                }
            }
            VStack(spacing: 10) {
                ForEach(processes) { process in
                    ProcessRow(process: process, active: busy)
                }
            }
            Text(L("Wszystko liczy się na tym urządzeniu. Nic nie trafia do chmury ani na serwer."))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .coreCard()
        .animation(.smooth(duration: 0.5), value: busy)
        .animation(.smooth(duration: 0.4), value: brain.progress)
        // The later stages are built from the analysis; here they are kept up to date as it grows.
        .task(id: brain.revision / 25) {
            // After the Core has slid in: building these at once made the slide stutter.
            try? await Task.sleep(for: .milliseconds(800))
            guard !Task.isCancelled else { return }
            await memories.refresh(library: library)
            await cleanup.refresh(library: library)
        }
    }

    private var fraction: Double {
        let p = brain.progress
        guard p.total > 0 else { return 0 }
        return min(1, Double(p.analyzed) / Double(p.total))
    }

    private var percentText: String { "\(Int((fraction * 100).rounded(.down)))%" }

    private var headline: String {
        if brain.waitingForCopy { return L("CZEKA NA KOPIĘ") }
        if warm { return L("PRZERWA · CIEPŁO") }
        if busy { return L("PRACUJE") }
        if brain.clustering { return L("GRUPUJE OSOBY") }
        if brain.waitingForPreviews > 0 { return L("CZEKA NA SERWER") }
        return fraction >= 0.999 ? L("GOTOWE") : L("CZEKA")
    }

    /// Always the true reason: working, waiting for previews from the server, done, or why not.
    private var statusText: String {
        let p = brain.progress
        if let reason = brain.pauseReason { return reason }
        if busy { return L("Przeglądam \(PhotoFormat.grouped(p.analyzed)) z \(PhotoFormat.grouped(p.total)) zdjęć") }
        if brain.waitingForPreviews > 0 {
            return L("Pobieram z serwera podglądy \(PhotoFormat.grouped(brain.waitingForPreviews)) zdjęć. Wrócę do nich za chwilę.")
        }
        if fraction >= 0.999 { return L("Cała biblioteka przejrzana") }
        if brain.skippedForNow > 0 {
            return L("Serwer nie dał jeszcze podglądu \(PhotoFormat.grouped(brain.skippedForNow)) zdjęć. Spróbuję przy następnym uruchomieniu.")
        }
        return L("Ruszy, gdy aplikacja będzie otwarta albo nocą przy ładowaniu")
    }

    /// One pass looks at each photo for scenes, faces, text and quality at once, so those share
    /// one bar. The stages built on top of it have their own, real progress.
    private var processes: [SmartProcess] {
        let p = brain.progress
        let total = max(p.total, 1)
        func part(_ value: Int, of whole: Int) -> Double { whole > 0 ? min(1, Double(value) / Double(whole)) : 0 }
        var list: [SmartProcess] = [
            SmartProcess(
                id: "analysis", symbol: "eye", title: L("Analiza zdjęć"),
                detail: L("\(PhotoFormat.grouped(p.labeled)) scen · \(PhotoFormat.grouped(p.faces)) twarzy · \(PhotoFormat.grouped(p.withText)) z napisami"),
                fraction: part(p.analyzed, of: total), tint: Color(uiColor: .systemCyan)
            ),
        ]
        if brain.searchAvailable {
            list.append(SmartProcess(
                id: "clip", symbol: "sparkle.magnifyingglass", title: L("Indeks wyszukiwania zdaniem"),
                detail: L("\(PhotoFormat.grouped(p.vectors)) zdjęć rozumianych opisem"),
                fraction: part(p.vectors, of: total), tint: Color(uiColor: .systemPurple)
            ))
        }
        if brain.peopleAvailable {
            list.append(SmartProcess(
                id: "people", symbol: "person.2.crop.square.stack", title: L("Rozpoznawanie osób"),
                detail: brain.clustering
                    ? L("Porządkuję twarze…")
                    : (brain.unknownCount > 0
                        ? L("\(p.people) osób · \(PhotoFormat.grouped(brain.unknownCount)) twarzy czeka na przypisanie (Osoby → Nieznane)")
                        : L("\(PhotoFormat.grouped(p.placed)) z \(PhotoFormat.grouped(p.recognisable)) twarzy w \(p.people) osobach")),
                // Grouping is done when it is not running: faces nobody is named for wait for you,
                // they are not unfinished work.
                fraction: brain.clustering ? nil : (p.recognisable > 0 ? 1 : 0), tint: Color(uiColor: .systemOrange)
            ))
        }
        let suggestions = cleanup.report.totalSuggested.count
        list.append(SmartProcess(
            id: "cleanup", symbol: "camera.aperture", title: L("Porządki"),
            detail: cleanup.working ? L("Szukam podobnych i nieudanych…") : L("\(PhotoFormat.grouped(suggestions)) propozycji do przejrzenia"),
            fraction: cleanup.working ? nil : (cleanup.ready ? 1 : 0), tint: Color(uiColor: .systemTeal)
        ))
        let stories = memories.memories.count + memories.trips.count
        list.append(SmartProcess(
            id: "memories", symbol: "sparkles.rectangle.stack", title: L("Wspomnienia i podróże"),
            detail: stories == 0
                ? L("Pojawią się, gdy w bibliotece będą wyjazdy albo dni sprzed lat")
                : L("\(memories.memories.count) wspomnień · \(memories.trips.count) podróży"),
            fraction: memories.building ? nil : (memories.ready ? 1 : 0), tint: Color(uiColor: .systemPink)
        ))
        return list
    }
}

struct SmartProcess: Identifiable, Equatable {
    let id: String
    let symbol: String
    let title: String
    let detail: String
    /// nil while working without a measurable end (shown as a moving shimmer).
    let fraction: Double?
    let tint: Color
}

private struct ProcessRow: View {
    let process: SmartProcess
    let active: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: process.symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(process.tint)
                .symbolEffect(.pulse, options: .repeating, isActive: active && (process.fraction ?? 0) < 1)
                .frame(width: 30, height: 30)
                .background(Circle().fill(process.tint.opacity(0.14)))
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(process.title)
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text(process.fraction.map { "\(Int(($0 * 100).rounded(.down)))%" } ?? "…")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(process.tint)
                        .contentTransition(.numericText())
                }
                ProcessBar(fraction: process.fraction, tint: process.tint, active: active)
                    .frame(height: 4)
                Text(process.detail)
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct ProcessBar: View {
    let fraction: Double?
    let tint: Color
    let active: Bool
    @Environment(\.coreMotion) private var motion
    /// The bars fill up from empty once the panel has landed, like gauges coming alive.
    @State private var grown = false

    var body: some View {
        GeometryReader { proxy in
            let filled = proxy.size.width * CGFloat(fraction ?? 0.35) * (grown ? 1 : 0)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.08))
                Capsule()
                    .fill(LinearGradient(colors: [tint.opacity(0.55), tint], startPoint: .leading, endPoint: .trailing))
                    .frame(width: filled)
                if motion, (active && (fraction ?? 0) < 1) || fraction == nil {
                    // A glint running along the filled part while the work goes on (clock driven,
                    // so it never animates anything around it).
                    TimelineView(.animation(minimumInterval: 1 / 60)) { context in
                        let raw = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.8) / 1.8
                        let phase = raw < 0.5 ? 2 * raw * raw : 1 - pow(-2 * raw + 2, 2) / 2
                        Capsule()
                            .fill(LinearGradient(colors: [.clear, .white.opacity(0.7), .clear], startPoint: .leading, endPoint: .trailing))
                            .frame(width: 34)
                            .offset(x: CGFloat(phase) * (filled + 34) - 34)
                    }
                    .frame(width: filled, alignment: .leading)
                    .clipShape(Capsule())
                }
            }
        }
        .clipShape(Capsule())
        .animation(.spring(response: 0.7, dampingFraction: 0.86), value: fraction)
        .onAppear { if motion { grow() } }
        .onChange(of: motion) { _, value in if value { grow() } }
    }

    private func grow() {
        guard !grown else { return }
        withAnimation(.spring(response: 1.0, dampingFraction: 0.82)) { grown = true }
    }
}

/// A processor die under load: pins, traces with data running in, cores lighting up in waves,
/// a glowing heart. Still and dim when there is nothing to do.
private struct NeuralChip: View {
    let active: Bool
    let tint: Color
    @Environment(\.colorScheme) private var scheme
    @Environment(\.coreMotion) private var motion

    var body: some View {
        ZStack {
            // The glow is a still picture behind the chip; a live shadow redrawn every frame cost
            // more than the chip itself.
            Circle()
                .fill(RadialGradient(colors: [tint.opacity(active ? (scheme == .dark ? 0.5 : 0.3) : 0.1), .clear],
                                     center: .center, startRadius: 4, endRadius: 70))
                .scaleEffect(active ? 1.1 : 0.8)
                .animation(.spring(response: 0.9, dampingFraction: 0.8), value: active)
            TimelineView(.animation(minimumInterval: 1 / 60, paused: !(active && motion))) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                Canvas(rendersAsynchronously: true) { canvas, size in
                    draw(canvas, size: size, t: active && motion ? t : 0)
                }
            }
        }
    }

    private func draw(_ canvas: GraphicsContext, size: CGSize, t: Double) {
        let side = min(size.width, size.height)
        let die = CGRect(x: (size.width - side * 0.62) / 2, y: (size.height - side * 0.62) / 2, width: side * 0.62, height: side * 0.62)
        let dark = scheme == .dark
        let pinColor = Color(white: dark ? 0.62 : 0.55)

        // Traces from the edges into the pins, with data pulses running inwards.
        for edge in 0..<4 {
            for index in 0..<5 {
                let offset = die.minX + die.width * (CGFloat(index) + 0.5) / 5
                var start = CGPoint.zero, end = CGPoint.zero
                switch edge {
                case 0: start = CGPoint(x: offset, y: 0); end = CGPoint(x: offset, y: die.minY)
                case 1: start = CGPoint(x: offset, y: size.height); end = CGPoint(x: offset, y: die.maxY)
                case 2:
                    let y = die.minY + die.height * (CGFloat(index) + 0.5) / 5
                    start = CGPoint(x: 0, y: y); end = CGPoint(x: die.minX, y: y)
                default:
                    let y = die.minY + die.height * (CGFloat(index) + 0.5) / 5
                    start = CGPoint(x: size.width, y: y); end = CGPoint(x: die.maxX, y: y)
                }
                var trace = Path()
                trace.move(to: start)
                trace.addLine(to: end)
                canvas.stroke(trace, with: .color(pinColor.opacity(0.35)), lineWidth: 1.2)
                if active {
                    let speed = 1.1 + Double((index * 7 + edge * 3) % 5) * 0.25
                    let phase = (t * speed + Double(index) * 0.37 + Double(edge) * 0.21).truncatingRemainder(dividingBy: 1)
                    let point = CGPoint(x: start.x + (end.x - start.x) * phase, y: start.y + (end.y - start.y) * phase)
                    let dot = Path(ellipseIn: CGRect(x: point.x - 1.8, y: point.y - 1.8, width: 3.6, height: 3.6))
                    canvas.fill(dot, with: .color(tint.opacity(0.95)))
                }
            }
        }

        // Package and die.
        let package = Path(roundedRect: die.insetBy(dx: -4, dy: -4), cornerRadius: 10)
        // Graphite at night, brushed aluminium by day.
        let metal = dark ? [Color(white: 0.24), Color(white: 0.1)] : [Color(white: 0.97), Color(white: 0.82)]
        canvas.fill(package, with: .linearGradient(Gradient(colors: metal),
                                                     startPoint: CGPoint(x: die.minX, y: die.minY), endPoint: CGPoint(x: die.maxX, y: die.maxY)))
        let rim = dark ? [Color.white.opacity(0.55), .white.opacity(0.05), .white.opacity(0.3)] : [Color.white, Color.black.opacity(0.12), Color.black.opacity(0.2)]
        canvas.stroke(package, with: .linearGradient(Gradient(colors: rim),
                                                       startPoint: CGPoint(x: die.minX, y: die.minY), endPoint: CGPoint(x: die.maxX, y: die.maxY)), lineWidth: 1)

        // 4 × 4 cores lighting up in waves.
        let grid = 4
        let gap: CGFloat = 3
        let cell = (die.width - gap * CGFloat(grid + 1)) / CGFloat(grid)
        for row in 0..<grid {
            for column in 0..<grid {
                let rect = CGRect(x: die.minX + gap + CGFloat(column) * (cell + gap),
                                  y: die.minY + gap + CGFloat(row) * (cell + gap), width: cell, height: cell)
                let wave = sin(t * 6 + Double(row * 3 + column * 5) * 0.9) * 0.5 + 0.5
                let flicker = sin(t * 17 + Double(row * 11 + column * 7)) * 0.5 + 0.5
                let load = active ? 0.25 + 0.75 * (wave * 0.7 + flicker * 0.3) : (dark ? 0.12 : 0.18)
                let core = Path(roundedRect: rect, cornerRadius: 2.5)
                canvas.fill(core, with: .color(tint.opacity(load)))
            }
        }

        // The glowing heart.
        let pulse = active ? 0.55 + 0.45 * (sin(t * 3.2) * 0.5 + 0.5) : 0.25
        let heart = CGRect(x: die.midX - die.width * 0.18, y: die.midY - die.height * 0.18, width: die.width * 0.36, height: die.height * 0.36)
        canvas.fill(Path(roundedRect: heart, cornerRadius: 5),
                    with: .radialGradient(Gradient(colors: [.white.opacity(pulse), tint.opacity(pulse), tint.opacity(0)]),
                                          center: CGPoint(x: heart.midX, y: heart.midY), startRadius: 0, endRadius: heart.width * 0.8))
    }
}

/// Load like an activity monitor: a row of bars that jump while the processor works.
private struct LoadMeter: View {
    let active: Bool
    let tint: Color
    @Environment(\.coreMotion) private var motion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 60, paused: !(active && motion))) { context in
            let t = active && motion ? context.date.timeIntervalSinceReferenceDate : 0
            Canvas(rendersAsynchronously: true) { canvas, size in
                let count = 18
                let spacing: CGFloat = 2
                let width = (size.width - spacing * CGFloat(count - 1)) / CGFloat(count)
                for index in 0..<count {
                    let i = Double(index)
                    // Three slow waves on top of each other: it moves like a real load graph,
                    // smooth and never twitchy.
                    let level: Double
                    if active {
                        let a = sin(t * 2.1 + i * 0.55) * 0.5 + 0.5
                        let b = sin(t * 3.7 - i * 0.9 + 1.3) * 0.5 + 0.5
                        let c = sin(t * 0.8 + i * 0.25) * 0.5 + 0.5
                        level = 0.25 + 0.75 * (a * 0.45 + b * 0.3 + c * 0.25)
                    } else {
                        level = 0.14
                    }
                    let height = max(2, size.height * CGFloat(level))
                    let rect = CGRect(x: CGFloat(index) * (width + spacing), y: size.height - height, width: width, height: height)
                    canvas.fill(Path(roundedRect: rect, cornerRadius: width / 2),
                                with: .linearGradient(Gradient(colors: [tint.opacity(active ? 1 : 0.35), tint.opacity(active ? 0.55 : 0.2)]),
                                                      startPoint: CGPoint(x: rect.midX, y: rect.minY), endPoint: CGPoint(x: rect.midX, y: rect.maxY)))
                }
            }
        }
    }
}
