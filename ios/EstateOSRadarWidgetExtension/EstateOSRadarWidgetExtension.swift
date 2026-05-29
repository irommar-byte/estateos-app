import ActivityKit
import WidgetKit
import SwiftUI

/*
 * `@available(iOS 16.1, *)` zdjęte ze struct — deployment target tego
 * widget extension to iOS 16.1+ (Live Activities to API wprowadzone w 16.1),
 * więc atrybut był no-op. Trzymanie go w kombinacji z `@main` na bundle
 * potrafi mylić Swift type-checker w opcjonalnych konfiguracjach (np. przy
 * SwiftUI ViewBuilder typu „some Widget"), co manifestowało się błędem
 * „Generic parameter 'Content' could not be inferred".
 */
struct RadarLiveActivityAttributes: ActivityAttributes {

  public struct ContentState: Codable, Hashable {
    var transactionType: String
    var city: String
    var localityCountry: String
    var localityCountryCode: String
    var districts: [String]
    var propertyType: String
    var maxPrice: Double
    var minArea: Double
    var minYear: Double
    var areaRadiusKm: Double
    var minMatchThreshold: Int
    var activeMatchesCount: Int
    var newMatchesCount: Int
    var unreadDealroomMessagesCount: Int
    var requireBalcony: Bool
    var requireGarden: Bool
    var requireElevator: Bool
    var requireParking: Bool
    var requireFurnished: Bool
    var updatedAtIso: String
    /// Inkrementowany przez natywny heartbeat (~4×/s) — wymusza odświeżenie UI (Uber-style).
    var animationTick: Int
    /// Ms epoch startu animacji — stabilny punkt odniesienia cykli.
    var animationEpochMs: Int64
  }

    var title: String
}

/// Sekwencyjny puls radaru: kropka → pierścień wewn. → środkowy → zewn. → powtórka.
private enum RadarPulseClock {
    static let pulsePeriod: Double = 3.2
    static let stepCount = 4

    struct Sample {
        let phase: Double
        let activeStep: Int
        let stepProgress: Double
    }

    static func sample(at date: Date, epochMs: Int64, frozen: Bool = false) -> Sample {
        if frozen {
            return Sample(phase: 0.25, activeStep: 0, stepProgress: 1.0)
        }
        let elapsed = max(0, date.timeIntervalSince1970 - Double(epochMs) / 1000.0)
        let cycle = elapsed.truncatingRemainder(dividingBy: pulsePeriod)
        let phase = cycle / pulsePeriod
        let stepDuration = pulsePeriod / Double(stepCount)
        let activeStep = Int(cycle / stepDuration) % stepCount
        let stepProgress = (cycle.truncatingRemainder(dividingBy: stepDuration)) / stepDuration
        return Sample(phase: phase, activeStep: activeStep, stepProgress: stepProgress)
    }

    static func elementOpacity(step: Int, activeStep: Int, progress: Double) -> Double {
        let dim = 0.15
        let peak = 0.96
        guard step == activeStep else { return dim }
        let attack = min(1.0, progress / 0.32)
        let eased = attack * attack * (3 - 2 * attack)
        return dim + (peak - dim) * eased
    }
}

/// Bęben napisów — tylko heartbeat (co 2 s), bez wpływu na obrót radaru.
private enum RadarDrumMotion {
    static let tickInterval: Double = 1.0
    static let drumPeriod: Double = 2.0
    static let ticksPerStep: Int = 2

    struct Frame {
        let drumIndex: Int
        let drumNextIndex: Int
        let drumBlend: Double
    }

    static func frame(tick: Int, itemCount: Int) -> Frame {
        let count = max(itemCount, 1)
        let elapsed = Double(max(tick, 0)) * tickInterval
        let drumIndex = (max(tick, 0) / ticksPerStep) % count
        let drumNextIndex = (drumIndex + 1) % count
        let drumElapsed = elapsed.truncatingRemainder(dividingBy: drumPeriod)
        let drumBlend = drumElapsed >= drumPeriod - 0.35
            ? (drumElapsed - (drumPeriod - 0.35)) / 0.35
            : 0.0
        return Frame(
            drumIndex: drumIndex,
            drumNextIndex: drumNextIndex,
            drumBlend: min(1, max(0, drumBlend))
        )
    }

    static func frame(at date: Date, epochMs: Int64, itemCount: Int) -> Frame {
        let elapsed = max(0, date.timeIntervalSince1970 - Double(epochMs) / 1000.0)
        let tick = Int(elapsed / tickInterval)
        return frame(tick: tick, itemCount: itemCount)
    }
}

private struct RadarSmoothTimeline<Content: View>: View {
    let epochMs: Int64
    let frozen: Bool
    let content: (RadarPulseClock.Sample) -> Content

    var body: some View {
        if frozen {
            content(RadarPulseClock.sample(at: Date(), epochMs: epochMs, frozen: true))
        } else if #available(iOS 17.0, *) {
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
                content(RadarPulseClock.sample(at: timeline.date, epochMs: epochMs))
            }
        } else {
            TimelineView(.periodic(from: Date(timeIntervalSince1970: Double(epochMs) / 1000.0), by: 1.0 / 30.0)) { timeline in
                content(RadarPulseClock.sample(at: timeline.date, epochMs: epochMs))
            }
        }
    }
}

struct EstateOSRadarLiveActivity: Widget {
    private let accent = Color(red: 0.10, green: 0.86, blue: 0.53)
    private let textMain = Color.white
    private let textDim = Color.white.opacity(0.72)

    private func txLabel(_ tx: String) -> String {
        tx.uppercased() == "RENT" ? "Wynajem" : "Sprzedaż"
    }

    private func propertyTypeLabel(_ raw: String) -> String {
        switch raw.uppercased() {
        case "FLAT": return "Mieszkanie"
        case "HOUSE": return "Dom"
        case "PLOT": return "Działka"
        case "PREMISES": return "Lokal użytkowy"
        default: return "Dowolny typ"
        }
    }

    private func priceLabel(value: Double, type: String) -> String {
        let isRent = type.uppercased() == "RENT"
        if isRent || value < 100_000 {
            let formatter = NumberFormatter()
            formatter.numberStyle = .decimal
            formatter.locale = Locale(identifier: "pl_PL")
            formatter.maximumFractionDigits = 0
            return "\(formatter.string(from: NSNumber(value: Int(value.rounded()))) ?? "\(Int(value))") zł"
        }
        if value >= 1_000_000 {
            let millions = value / 1_000_000
            let decimals = millions >= 10 ? 0 : 1
            let formatter = NumberFormatter()
            formatter.numberStyle = .decimal
            formatter.locale = Locale(identifier: "pl_PL")
            formatter.minimumFractionDigits = decimals
            formatter.maximumFractionDigits = decimals
            return "\(formatter.string(from: NSNumber(value: millions)) ?? "\(millions)") mln zł"
        }
        let thousands = Int((value / 1000.0).rounded())
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.maximumFractionDigits = 0
        return "\(formatter.string(from: NSNumber(value: thousands)) ?? "\(thousands)") tys. zł"
    }

    private func districtsLabel(_ districts: [String]) -> String {
        if districts.isEmpty { return "" }
        if districts.count <= 2 { return districts.joined(separator: ", ") }
        return "\(districts.prefix(2).joined(separator: ", ")) +\(districts.count - 2)"
    }

    private func flagEmoji(iso: String) -> String {
        let u = iso.uppercased().filter { $0.isLetter }
        guard u.count == 2 else { return "🏳️" }
        let base: UInt32 = 127397
        var emoji = ""
        for scalar in u.unicodeScalars {
            if let flag = UnicodeScalar(base + scalar.value) {
                emoji.append(String(flag))
            }
        }
        return emoji.isEmpty ? "🏳️" : emoji
    }

    private func locationPlaceLabel(_ state: RadarLiveActivityAttributes.ContentState) -> String {
        let country = state.localityCountry.isEmpty ? "Polska" : state.localityCountry
        let iso = state.localityCountryCode.isEmpty ? "PL" : state.localityCountryCode
        let flag = flagEmoji(iso: iso)
        var place = state.city.isEmpty ? country : state.city
        if place == "Reszta kraju" {
            if let locality = state.districts.first(where: { !$0.isEmpty && $0.count != 2 }) {
                place = locality
            }
        }
        if place.caseInsensitiveCompare(country) == .orderedSame {
            return "\(flag) \(country)"
        }
        return "\(place) \(flag) \(country)"
    }


    private func radiusValueLabel(_ km: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "pl_PL")
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        let value = formatter.string(from: NSNumber(value: km)) ?? "\(km)"
        return "\(value) km"
    }

    private func statusMessages(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> [String] {
        let state = context.state

        // Pierwsza linia jest „placeholderem statusu” — `bodyLines` ją pomija,
        // bo dolny `RadarActiveStatusBar` lepiej pokazuje „Radar aktywny”
        // z animowanymi kropkami. Zostawiamy ją wyłącznie dla fallback-notification.
        var lines: [String] = ["Radar aktywny · skan rynku trwa"]

        // Linia 2 (dolna): typ · od metrażu · do ceny [ · NOWE! N ]
        // Liczbę dopasowań pokazujemy WYŁĄCZNIE, gdy są nowe od ostatniego
        // wejścia na zakładkę Radar — zgodnie z kontraktem RN.
        var bottom: [String] = [propertyTypeLabel(state.propertyType)]
        if state.minArea > 0 { bottom.append("od \(Int(state.minArea.rounded())) m²") }
        if state.maxPrice > 0 { bottom.append("do \(priceLabel(value: state.maxPrice, type: state.transactionType))") }
        if state.newMatchesCount > 0 {
            bottom.append("NOWE! \(state.newMatchesCount)")
        }
        lines.append(bottom.joined(separator: " · "))

        // Linia 4: dzielnice albo obszar (jeśli ustawione)
        if state.areaRadiusKm > 0 {
            lines.append("Obszar mapy: \(radiusValueLabel(state.areaRadiusKm))")
        } else if !state.districts.isEmpty {
            lines.append("Dzielnice: \(districtsLabel(state.districts))")
        }

        // Linia 5: rok budowy (opcjonalnie)
        if state.minYear > 0 {
            lines.append("Rok budowy: od \(Int(state.minYear.rounded())) r.")
        }

        // Linia 6: wymagania (opcjonalnie)
        var requirements: [String] = []
        if state.requireBalcony { requirements.append("balkon") }
        if state.requireGarden { requirements.append("ogród") }
        if state.requireElevator { requirements.append("winda") }
        if state.requireParking { requirements.append("parking") }
        if state.requireFurnished { requirements.append("umeblowane") }
        if !requirements.isEmpty {
            lines.append("Wymagania: \(requirements.joined(separator: ", "))")
        }

        return lines
    }

    /// Nagłówek nad tickerem — tylko tryb · miasto. Bezpośrednio za nim
    /// renderujemy `MatchThresholdBadge` (procent dopasowania z pulsującym
    /// co 20 s halo), więc tu zostaje sam string „Wynajem · Piaseczno".
    private func headlineMessage(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> String {
        let state = context.state
        let tx = txLabel(state.transactionType)
        return "\(tx) · \(locationPlaceLabel(state))"
    }

    /// Linijki rotującego tickera — pomijamy tylko nagłówek statusowy
    /// („Radar aktywny · skan rynku trwa”), bo jego rolę przejął `RadarActiveStatusBar`.
    private func bodyLines(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> [String] {
        let all = statusMessages(context)
        return Array(all.dropFirst(1))
    }

    /// Wszystkie parametry kalibracji jako jeden ciąg do paska newsów (bez lokalizacji —
    /// miasto i flaga są już w nagłówku nad tickerem).
    private func allCalibrationMarqueeText(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> String {
        var parts: [String] = rotatingParamItems(context)
        parts.append("Próg dopasowania: \(context.state.minMatchThreshold)%")
        if context.state.newMatchesCount > 0 {
            parts.append("NOWE dopasowania: \(context.state.newMatchesCount)")
        }
        if parts.isEmpty {
            parts.append("Skan rynku · sygnały rejestrowane")
        }
        return parts.joined(separator: "   ◆   ")
    }

    /// Duży glyph — kropka + 3 pierścienie, sekwencyjne zapalanie (bez obracającej kreski).
    private struct LargeAnimatedRadarGlyph: View {
        let accent: Color
        let size: CGFloat
        let epochMs: Int64

        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            RadarSmoothTimeline(epochMs: epochMs, frozen: isLuminanceReduced) { sample in
                glyph(sample: sample)
            }
            .frame(width: size + 6, height: size + 6)
        }

        @ViewBuilder
        private func glyph(sample: RadarPulseClock.Sample) -> some View {
            let dotBase = max(6, size * 0.18)
            let ringInner = size * 0.36
            let ringMid = size * 0.64
            let ringOuter = size * 0.92

            ZStack {
                pulseRing(
                    diameter: ringOuter,
                    step: 3,
                    sample: sample,
                    idleWidth: 1.6,
                    activeWidth: 2.6
                )
                pulseRing(
                    diameter: ringMid,
                    step: 2,
                    sample: sample,
                    idleWidth: 1.5,
                    activeWidth: 2.4
                )
                pulseRing(
                    diameter: ringInner,
                    step: 1,
                    sample: sample,
                    idleWidth: 1.4,
                    activeWidth: 2.2
                )
                pulseDot(
                    base: dotBase,
                    step: 0,
                    sample: sample
                )
            }
        }

        private func pulseRing(
            diameter: CGFloat,
            step: Int,
            sample: RadarPulseClock.Sample,
            idleWidth: CGFloat,
            activeWidth: CGFloat
        ) -> some View {
            let active = sample.activeStep == step
            let opacity = RadarPulseClock.elementOpacity(
                step: step,
                activeStep: sample.activeStep,
                progress: sample.stepProgress
            )
            return Circle()
                .stroke(accent.opacity(opacity), lineWidth: active ? activeWidth : idleWidth)
                .frame(width: diameter, height: diameter)
                .shadow(color: accent.opacity(active ? 0.55 : 0), radius: active ? 4 : 0)
        }

        private func pulseDot(base: CGFloat, step: Int, sample: RadarPulseClock.Sample) -> some View {
            let active = sample.activeStep == step
            let opacity = RadarPulseClock.elementOpacity(
                step: step,
                activeStep: sample.activeStep,
                progress: sample.stepProgress
            )
            let scale = active ? 1.0 + 0.18 * sample.stepProgress : 0.88
            return Circle()
                .fill(accent.opacity(opacity))
                .frame(width: base * scale, height: base * scale)
                .shadow(color: accent.opacity(active ? 0.9 : 0.2), radius: active ? 5 : 2)
        }
    }

    /// 10-segmentowy pasek — ten sam zegar co radar (TimelineView, płynnie).
    private struct RadarSyncedScanBar: View {
        let accent: Color
        let epochMs: Int64
        let frozen: Bool
        var compact: Bool = false

        private static let segmentIndices: [Int] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        private static let segmentCount: Double = 10

        var body: some View {
            RadarSmoothTimeline(epochMs: epochMs, frozen: frozen) { sample in
                HStack(spacing: 2) {
                    ForEach(Self.segmentIndices, id: \.self) { i in
                        animatedSegment(at: i, phase: sample.phase)
                    }
                }
            }
            .frame(width: compact ? 64 : 78)
        }

        private func animatedSegment(at i: Int, phase: Double) -> some View {
            let segStart = Double(i) / Self.segmentCount
            let segEnd = Double(i + 1) / Self.segmentCount
            let isLeading = phase >= segStart && phase < segEnd
            let opacity = segmentOpacity(phase: phase, segStart: segStart, segEnd: segEnd)
            return RoundedRectangle(cornerRadius: 1.4, style: .continuous)
                .fill(accent)
                .frame(width: compact ? 2.4 : 2.8, height: compact ? 8 : 10)
                .opacity(opacity)
                .scaleEffect(isLeading ? 1.18 : 1.0, anchor: .center)
                .shadow(color: accent.opacity(isLeading ? 0.85 : 0), radius: isLeading ? 3 : 0)
        }

        private func segmentOpacity(phase: Double, segStart: Double, segEnd: Double) -> Double {
            if phase < segStart { return 0.16 }
            if phase < segEnd {
                let local = (phase - segStart) / (segEnd - segStart)
                return 0.16 + 0.84 * local
            }
            return 1.0
        }
    }

    /// Bęben parametrów — co 2 s (heartbeat), bez scrolla.
    private struct RadarParamDrum: View {
        let accent: Color
        let items: [String]
        let drum: RadarDrumMotion.Frame
        var compact: Bool = false

        private var fontSize: CGFloat { compact ? 11 : 12 }

        var body: some View {
            let safeItems = items.isEmpty ? ["Skan rynku · sygnały rejestrowane"] : items
            let current = safeItems[drum.drumIndex % safeItems.count]
            let next = safeItems[drum.drumNextIndex % safeItems.count]
            let blend = drum.drumBlend

            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.08))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.22), lineWidth: 0.7)
                    )

                Text(current)
                    .font(.system(size: fontSize, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .truncationMode(.tail)
                    .padding(.horizontal, 12)
                    .opacity(1 - blend)
                    .blur(radius: blend * 1.4)
                    .offset(y: blend * 2)

                Text(next)
                    .font(.system(size: fontSize, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .truncationMode(.tail)
                    .padding(.horizontal, 12)
                    .opacity(blend)
                    .blur(radius: (1 - blend) * 1.4)
                    .offset(y: (1 - blend) * -2)
            }
            .frame(height: compact ? 22 : 26)
            .clipped()
        }
    }

    /// Tryb uśpienia (AOD) — statyczny komunikat zamiast rotacji parametrów.
    private struct RadarLiveScanActiveBanner: View {
        let accent: Color
        var compact: Bool = false

        var body: some View {
            HStack(spacing: compact ? 5 : 7) {
                Text("||")
                    .font(.system(size: compact ? 9 : 10, weight: .black, design: .monospaced))
                    .foregroundColor(accent.opacity(0.45))
                HStack(spacing: 5) {
                    Circle()
                        .fill(accent)
                        .frame(width: compact ? 4 : 5, height: compact ? 4 : 5)
                    Text("LIVE SCANNER ACTIVE")
                        .font(.system(size: compact ? 9.5 : 10.5, weight: .heavy, design: .monospaced))
                        .foregroundColor(.white.opacity(0.92))
                        .tracking(compact ? 0.6 : 1.0)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Circle()
                        .fill(accent.opacity(0.55))
                        .frame(width: compact ? 4 : 5, height: compact ? 4 : 5)
                }
                Text("||")
                    .font(.system(size: compact ? 9 : 10, weight: .black, design: .monospaced))
                    .foregroundColor(accent.opacity(0.45))
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, compact ? 8 : 10)
            .padding(.vertical, compact ? 4 : 5)
            .background(
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.07))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.28), lineWidth: 0.8)
                    )
            )
        }
    }

    /// Dolna linia: typ + pasek skanera + bęben LUB banner w trybie uśpienia.
    private struct RadarUnifiedTicker: View {
        let accent: Color
        let staticLabel: String
        let paramItems: [String]
        let epochMs: Int64
        let animationTick: Int
        var compact: Bool = false

        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            let frozen = isLuminanceReduced

            HStack(spacing: 8) {
                staticPill
                    .layoutPriority(0)
                if frozen {
                    RadarLiveScanActiveBanner(accent: accent, compact: compact)
                        .layoutPriority(1)
                } else {
                    RadarSyncedScanBar(accent: accent, epochMs: epochMs, frozen: false, compact: compact)
                    drumTicker
                        .layoutPriority(1)
                }
            }
        }

        @ViewBuilder
        private var drumTicker: some View {
            if #available(iOS 17.0, *) {
                TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { timeline in
                    RadarParamDrum(
                        accent: accent,
                        items: paramItems,
                        drum: RadarDrumMotion.frame(at: timeline.date, epochMs: epochMs, itemCount: paramItems.count),
                        compact: compact
                    )
                }
            } else {
                TimelineView(.periodic(from: Date(timeIntervalSince1970: Double(epochMs) / 1000.0), by: 1.0 / 30.0)) { timeline in
                    RadarParamDrum(
                        accent: accent,
                        items: paramItems,
                        drum: RadarDrumMotion.frame(at: timeline.date, epochMs: epochMs, itemCount: paramItems.count),
                        compact: compact
                    )
                }
            }
        }

        private var staticPill: some View {
            Text(staticLabel)
                .font(.system(size: compact ? 11 : 12.5, weight: .heavy, design: .rounded))
                .foregroundColor(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    Capsule(style: .continuous)
                        .fill(Color.white.opacity(0.10))
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(accent.opacity(0.42), lineWidth: 0.9)
                        )
                )
        }
    }

    /// Stary anchor dla pozostałych dekoracji (badge pulse) — główna animacja idzie przez heartbeat.
    private enum RadarAnimationClock {
        static let anchor = Date(timeIntervalSince1970: 1_700_000_000)
    }

    /// Slajdy bębna parametrów kalibracji (co 2 s).
    private func rotatingParamItems(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> [String] {
        let state = context.state
        var items: [String] = []

        var areaPrice: [String] = []
        if state.minArea > 0 { areaPrice.append("od \(Int(state.minArea.rounded())) m²") }
        if state.maxPrice > 0 {
            areaPrice.append("do \(priceLabel(value: state.maxPrice, type: state.transactionType))")
        }
        if !areaPrice.isEmpty { items.append(areaPrice.joined(separator: " · ")) }

        if state.areaRadiusKm > 0 {
            items.append("Obszar mapy: \(radiusValueLabel(state.areaRadiusKm))")
        } else if !state.districts.isEmpty {
            items.append("Dzielnice: \(districtsLabel(state.districts))")
        }

        if state.minYear > 0 {
            items.append("Rok budowy: od \(Int(state.minYear.rounded())) r.")
        }

        var reqs: [String] = []
        if state.requireBalcony { reqs.append("balkon") }
        if state.requireGarden { reqs.append("ogród") }
        if state.requireElevator { reqs.append("winda") }
        if state.requireParking { reqs.append("parking") }
        if state.requireFurnished { reqs.append("umeblowane") }
        if !reqs.isEmpty { items.append("Wymagania: \(reqs.joined(separator: ", "))") }

        items.append("Próg dopasowania: \(state.minMatchThreshold)%")
        if state.newMatchesCount > 0 {
            items.append("NOWE dopasowania: \(state.newMatchesCount)")
        }

        if items.isEmpty { items.append("Skan rynku · sygnały rejestrowane") }
        return items
    }

    @ViewBuilder
    private func radarGlyph(size: CGFloat, emphasized: Bool, epochMs: Int64 = 0) -> some View {
        LargeAnimatedRadarGlyph(
            accent: accent,
            size: size,
            epochMs: epochMs > 0 ? epochMs : Int64(Date().timeIntervalSince1970 * 1000)
        )
        .padding(emphasized ? 3 : 2)
    }

    /// Mini-glyph — ten sam puls co duży radar (kropka + 3 pierścienie).
    private struct MiniRadarGlyph: View {
        let accent: Color
        let epochMs: Int64

        var body: some View {
            LargeAnimatedRadarGlyph(accent: accent, size: 16, epochMs: epochMs)
                .frame(width: 20, height: 20)
        }
    }

    /// Premium badge z licznikiem dopasowań — pulsujący „glow" w kolorze
    /// akcentu. Na AOD przełącza się w statyczny wariant, zachowując
    /// kontrast i czytelność liczby.
    private struct MatchCountBadge: View {
        let accent: Color
        let count: Int
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            ZStack {
                Capsule(style: .continuous)
                    .fill(accent.opacity(0.18))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.38), lineWidth: 1)
                    )
                Group {
                    if isLuminanceReduced {
                        countLabel(scale: 1.0, opacity: 0.92)
                    } else {
                        TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 1.0 / 24.0)) { timeline in
                            let t = timeline.date.timeIntervalSince1970
                            let wave = 0.5 + 0.5 * sin((t * 2 * .pi) / 0.85)
                            countLabel(scale: 1.0 + 0.04 * wave, opacity: 0.92 + 0.08 * wave)
                        }
                    }
                }
            }
            .frame(minWidth: 28, minHeight: 20)
        }

        private func countLabel(scale: Double, opacity: Double) -> some View {
            Text("\(count)")
                .foregroundColor(accent)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .monospacedDigit()
                .scaleEffect(scale)
                .opacity(opacity)
                .ifAvailableNumericTransition()
        }
    }

    /// Pulsujący wariant marki — restored premium.
    private struct BrandPulseBadge: View {
        let accent: Color
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            Group {
                if isLuminanceReduced {
                    badge(strokeOpacity: 0.4, scale: 1.0)
                } else {
                    TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 1.0 / 24.0)) { timeline in
                        let t = timeline.date.timeIntervalSince1970
                        let wave = 0.5 + 0.5 * sin((t * 2 * .pi) / 0.95)
                        badge(strokeOpacity: 0.4 + 0.32 * wave, scale: 1.0 + 0.04 * wave)
                    }
                }
            }
        }

        private func badge(strokeOpacity: Double, scale: Double) -> some View {
            HStack(spacing: 0) {
                Text("E").foregroundColor(.white)
                Text("OS").foregroundColor(accent)
            }
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule(style: .continuous)
                    .fill(accent.opacity(0.14))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(strokeOpacity), lineWidth: 1)
                    )
            )
            .scaleEffect(scale)
        }
    }

    /// Premium pill „EOS" z animowanym połyskiem — wersja przywrócona
    /// po reżyserskim feedbacku użytkownika („powrócimy do naszej wersji
    /// premium"). Na AOD przełącza się na statyczny widok przez
    /// `@Environment(\.isLuminanceReduced)` — nie palimy baterii w trybie,
    /// w którym animacje i tak nie są widoczne.
    private struct EOSShineBadge: View {
        let accent: Color
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        private let shinePeriod: Double = 1.2

        var body: some View {
            ZStack {
                Capsule(style: .continuous)
                    .fill(Color.black.opacity(0.65))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.5), lineWidth: 1.1)
                    )

                HStack(spacing: 0) {
                    Text("E").foregroundColor(.white)
                    Text("OS").foregroundColor(accent)
                }
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
            }
            .overlay(
                Group {
                    if !isLuminanceReduced {
                        TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 1.0 / 30.0)) { timeline in
                            let t = timeline.date.timeIntervalSince1970
                            let phase = (t.truncatingRemainder(dividingBy: shinePeriod)) / shinePeriod
                            GeometryReader { geo in
                                let w = max(geo.size.width, 1)
                                LinearGradient(
                                    colors: [Color.clear, Color.white.opacity(0.36), Color.clear],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                                .frame(width: max(12, w * 0.3))
                                .rotationEffect(.degrees(18))
                                .offset(x: -w + phase * 2 * w)
                                .blendMode(.screen)
                            }
                        }
                        .clipShape(Capsule(style: .continuous))
                    }
                }
            )
            .frame(minWidth: 52, minHeight: 24)
        }
    }

    /// Próg dopasowania (np. „⊕ 83%") z **pulsującym halo co 20 s**.
    ///
    /// Logika animacji: `TimelineView(.periodic(by: 0.08))` daje 12,5 fps
    /// (wystarczające dla miękkiej zmiany alfa/koloru ramki), a `sin(π·p)`
    /// generuje płynne `0 → 1 → 0` w oknie `glowDuration` w obrębie cyklu
    /// `glowPeriod = 20 s`. Resztę cyklu (≈18 s) badge wygląda jak zwykłe
    /// szkło — daje to wrażenie, że celownik „chwyta sygnał" co 20 s.
    /// Na AOD (`isLuminanceReduced`) wyłączamy `TimelineView` i renderujemy
    /// statyczny wariant — Apple wymaga energooszczędności.
    private struct MatchThresholdBadge: View {
        let accent: Color
        let threshold: Int
        var compact: Bool = false

        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        private let glowPeriod: Double = 20
        private let glowDuration: Double = 1.6

        var body: some View {
            Group {
                if isLuminanceReduced {
                    content(pulse: 0)
                } else {
                    TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 0.08)) { timeline in
                        content(pulse: computePulse(at: timeline.date))
                    }
                }
            }
        }

        // Wyciągnięte z `TimelineView { ... }` closure, bo SwiftUI 5+ traktuje
        // ten closure jako `@ViewBuilder`. Stary kod miał wewnątrz
        // `let pulse: Double` + `if/else` przypisujące do `pulse` — co
        // result-builder próbował zinterpretować jako `_ConditionalContent`
        // gałęzi View, czego nie da się dopasować do `Double`. Efektem
        // ubocznym był błąd kompilatora „Generic parameter 'Content' could
        // not be inferred". Funkcja czysto obliczeniowa rozwiązuje problem.
        private func computePulse(at date: Date) -> Double {
            let t = date.timeIntervalSince1970
            let phase = t.truncatingRemainder(dividingBy: glowPeriod)
            guard phase < glowDuration else { return 0 }
            let p = phase / glowDuration
            return sin(p * .pi) // 0..1..0
        }

        private func content(pulse: Double) -> some View {
            HStack(spacing: 4) {
                Image(systemName: "scope")
                    .font(.system(size: compact ? 10 : 11, weight: .semibold))
                    .foregroundColor(accent)
                Text("\(threshold)%")
                    .font(.system(size: compact ? 10 : 11, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .monospacedDigit()
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 2.5)
            .background(
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.08 + 0.05 * pulse))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.4 + 0.55 * pulse), lineWidth: 0.9 + 1.0 * pulse)
                    )
                    .shadow(color: accent.opacity(0.85 * pulse), radius: 6 * pulse)
            )
            .scaleEffect(1.0 + 0.04 * pulse)
            .fixedSize()
        }
    }

    /// Czerwona pulsująca pigułka „• NOWE N" — widoczna **tylko** gdy radar
    /// wykrył nowe oferty od ostatniej wizyty użytkownika na ekranie Radar.
    /// Rytm pulsu ≈ 1 s, sterowany cosinusem, więc jest miękki i nie
    /// szarpie wzroku.
    private struct NewOffersPill: View {
        let count: Int
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            let red = Color(red: 0.96, green: 0.31, blue: 0.31)
            Group {
                if isLuminanceReduced {
                    pill(red: red, fillOpacity: 1.0, glow: 0.5)
                } else {
                    TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 0.08)) { timeline in
                        let t = timeline.date.timeIntervalSince1970
                        let phase = t.truncatingRemainder(dividingBy: 1.0)
                        let pulse = 0.55 + 0.45 * (1.0 - cos(2 * .pi * phase)) / 2
                        pill(red: red, fillOpacity: pulse, glow: pulse * 0.9)
                    }
                }
            }
        }

        private func pill(red: Color, fillOpacity: Double, glow: Double) -> some View {
            HStack(spacing: 3) {
                Circle()
                    .fill(Color.white)
                    .frame(width: 4, height: 4)
                Text("NOWE \(count)")
                    .font(.system(size: 9.5, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .monospacedDigit()
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(
                Capsule(style: .continuous)
                    .fill(red.opacity(fillOpacity))
                    .shadow(color: red.opacity(glow), radius: 4)
            )
            .fixedSize()
        }
    }

    /// Premium rotacja linijek konfiguracji radaru — jedna linia widoczna,
    /// gładki blur-replace crossfade w stylu Apple.
    ///
    /// • Crossfade trwa 1,4 s, animacja sterowana fazą wewnątrz cyklu
    ///   (opacity + blur + scale + offset jednocześnie),
    /// • `TimelineView(.periodic(by: 0.08))` daje 12,5 fps, co
    ///   zapewnia płynność blur-replace,
    /// • Na AOD (`isLuminanceReduced`) zwracamy statyczny widok bez
    ///   `TimelineView` i bez blur — Apple wymaga oszczędności
    ///   w trybie obniżonej luminancji.
    private struct RadarRotatingTicker: View {
        let accent: Color
        let lines: [String]
        var compact: Bool = false
        var rotationSeconds: Double = 12
        var crossfadeSeconds: Double = 1.4

        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            let safeLines = lines.isEmpty ? ["Radar aktywny · skan rynku trwa"] : lines

            if isLuminanceReduced {
                TickerLineView(text: safeLines[0], accent: accent, compact: compact)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 0.08)) { timeline in
                    let t = timeline.date.timeIntervalSince1970
                    let cycle = t / rotationSeconds
                    let currentIdx = Int(floor(cycle)) % safeLines.count
                    let nextIdx = (currentIdx + 1) % safeLines.count
                    let phase = cycle.truncatingRemainder(dividingBy: 1)

                    let fadeStart = max(0.0, 1.0 - (crossfadeSeconds / rotationSeconds))
                    let rawFade = phase > fadeStart ? (phase - fadeStart) / (1 - fadeStart) : 0
                    let fade = easeInOutCubic(min(1, max(0, rawFade)))

                    ZStack(alignment: .leading) {
                        TickerLineView(text: safeLines[currentIdx], accent: accent, compact: compact)
                            .opacity(1 - fade)
                            .blur(radius: fade * 1.6)
                            .scaleEffect(1 - fade * 0.03, anchor: .leading)
                            .offset(y: -fade * 3)

                        TickerLineView(text: safeLines[nextIdx], accent: accent, compact: compact)
                            .opacity(fade)
                            .blur(radius: (1 - fade) * 1.6)
                            .scaleEffect(0.97 + fade * 0.03, anchor: .leading)
                            .offset(y: (1 - fade) * 3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }

        private func easeInOutCubic(_ x: Double) -> Double {
            x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2
        }
    }

    /// Dolny pasek statusu — „Skan rynku · sygnały rejestrowane” z animowanym
    /// **10-segmentowym paskiem radaru** (kreseczki zapalają się po kolei
    /// od lewej do prawej, wypełniają całość, po czym snapują resetem
    /// i pasek zaczyna się rysować od nowa).
    ///
    /// Dlaczego taki wzór:
    ///   • klasyczna typing-indicator metafora 3-kropek nie kojarzyła się
    ///     z pracującą maszyną — sugerowała „ktoś pisze”,
    ///   • 10 kreseczek z czoło-świecącą kreską (`leading edge glow`)
    ///     przypomina rysunek wiązki radaru / pasek progresu skanera,
    ///   • każdy reset (po 2,4 s) wygląda jak nowy „obrót anteny",
    ///   • opcjonalny premium glow + scale na bieżąco rysowanej kresce
    ///     dają wrażenie żywej maszyny.
    ///
    /// Tekst „Skan rynku · sygnały rejestrowane" jest specyficznie maszynowy,
    /// w odróżnieniu od neutralnego „monitoring trwa".
    private struct RadarActiveStatusBar: View {
        let accent: Color
        let minMatchThreshold: Int
        var compact: Bool = false

        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        /// Czas pełnego cyklu „wypełnienia" 10 kresek.
        /// 2,4 s daje rytm bliski pulsacji żywego sprzętu:
        /// ~250 ms na kreskę, snap reset czytelny ale nie irytujący.
        private let cycleSeconds: Double = 2.4
        /// Indeksy 10 segmentów paska radaru jako statyczna tablica.
        /// Używamy `[Int]` zamiast `Range<Int>`, bo SwiftUI ma w `ForEach`
        /// kilka konkurujących przeładowań (m.in. dla `Binding<C>`) i przy
        /// `0..<runtimeInt` kompilator wpada w nie pierwsze — co dawało
        /// błędy „Generic parameter 'C' could not be inferred" i
        /// „Cannot convert value of type 'Range<Int>' to 'Binding<C>'".
        /// `[Int]` to jednoznaczna `RandomAccessCollection<Int>`.
        private static let segmentIndices: [Int] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        private static let segmentCount: Double = 10

        var body: some View {
            HStack(spacing: 10) {
                radarBar
                    .frame(width: compact ? 64 : 78)

                Text("Skan rynku · sygnały rejestrowane")
                    .font(.system(size: compact ? 10 : 11, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.82))
                    .lineLimit(1)
                    .layoutPriority(1)

                Spacer(minLength: 6)

                HStack(spacing: 4) {
                    Image(systemName: "scope")
                        .font(.system(size: compact ? 10 : 11, weight: .semibold))
                        .foregroundColor(accent)
                    Text("\(minMatchThreshold)%")
                        .font(.system(size: compact ? 10 : 11, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 2.5)
                .background(
                    Capsule(style: .continuous)
                        .fill(Color.white.opacity(0.08))
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(accent.opacity(0.4), lineWidth: 0.8)
                        )
                )
            }
        }

        @ViewBuilder
        private var radarBar: some View {
            if isLuminanceReduced {
                // AOD: statyczny pasek 30%-fill, bez TimelineView.
                staticBar(progress: 0.3)
            } else {
                TimelineView(.periodic(from: RadarAnimationClock.anchor, by: 0.06)) { timeline in
                    let t = timeline.date.timeIntervalSince1970
                    let phase = t.truncatingRemainder(dividingBy: cycleSeconds) / cycleSeconds
                    animatedBar(phase: phase)
                }
            }
        }

        private func staticBar(progress: Double) -> some View {
            HStack(spacing: 2) {
                ForEach(Self.segmentIndices, id: \.self) { i in
                    staticSegment(at: i, progress: progress)
                }
            }
        }

        private func animatedBar(phase: Double) -> some View {
            HStack(spacing: 2) {
                ForEach(Self.segmentIndices, id: \.self) { i in
                    animatedSegment(at: i, phase: phase)
                }
            }
        }

        /// Helper z prostym ciałem — kompilator nie ma problemu z dedukcją
        /// typu zwracanego, więc `ForEach` ma jednoznaczny `Content`.
        private func staticSegment(at i: Int, progress: Double) -> some View {
            let segStart = Double(i) / Self.segmentCount
            let isFilled = progress >= segStart
            return segment(
                opacity: isFilled ? 0.8 : 0.18,
                scale: 1.0,
                glow: 0
            )
        }

        /// Helper liczący opacity/scale/glow dla jednej kreski.
        /// Wcześniejszy inline `let opacity: Double` + `if/else if/else`
        /// wewnątrz closure'a `ForEach` mylił type-checker SwiftUI
        /// (był tzw. „expressions too complex" przy niektórych SDK).
        private func animatedSegment(at i: Int, phase: Double) -> some View {
            let segStart = Double(i) / Self.segmentCount
            let segEnd = Double(i + 1) / Self.segmentCount
            let isLeading = phase >= segStart && phase < segEnd
            let opacity = segmentOpacity(phase: phase, segStart: segStart, segEnd: segEnd)
            return segment(
                opacity: opacity,
                scale: isLeading ? 1.18 : 1.0,
                glow: isLeading ? 0.8 : 0
            )
        }

        private func segmentOpacity(phase: Double, segStart: Double, segEnd: Double) -> Double {
            if phase < segStart { return 0.16 }
            if phase < segEnd {
                let local = (phase - segStart) / (segEnd - segStart)
                return 0.16 + 0.84 * local
            }
            return 1.0
        }

        @ViewBuilder
        private func segment(opacity: Double, scale: Double, glow: Double) -> some View {
            RoundedRectangle(cornerRadius: 1.4, style: .continuous)
                .fill(accent)
                .frame(width: compact ? 2.4 : 2.8, height: compact ? 8 : 10)
                .opacity(opacity)
                .scaleEffect(scale, anchor: .center)
                .shadow(color: accent.opacity(glow), radius: glow > 0 ? 3 : 0)
        }
    }

    /// Widok pojedynczej linii tickera. Jeśli zawiera segment „NOWE! N",
    /// renderuje go jako wyróżnioną czerwoną kapsułę zamiast zwykłego tekstu.
    private struct TickerLineView: View {
        let text: String
        let accent: Color
        let compact: Bool

        var body: some View {
            // Rozdzielamy linię po separatorze „ · ” i wyłapujemy segment „NOWE! N”.
            let parts = text.components(separatedBy: " · ")
            HStack(spacing: 6) {
                ForEach(Array(parts.enumerated()), id: \.offset) { idx, part in
                    if part.hasPrefix("NOWE!") {
                        Text(part)
                            .font(.system(size: compact ? 11 : 12, weight: .heavy, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color(red: 0.96, green: 0.31, blue: 0.31))
                                    .shadow(color: Color(red: 0.96, green: 0.31, blue: 0.31).opacity(0.6), radius: 4)
                            )
                    } else {
                        Text(part)
                            .font(.system(size: compact ? 11 : 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.92))
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    if idx < parts.count - 1 {
                        Text("·")
                            .font(.system(size: compact ? 11 : 12, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.42))
                    }
                }
            }
        }
    }

    private struct RadarCountPill: View {
        let accent: Color
        let count: Int

        var body: some View {
            HStack(spacing: 6) {
                Circle()
                    .fill(accent)
                    .frame(width: 6, height: 6)
                    .shadow(color: accent.opacity(0.85), radius: 4)
                Text("\(count)")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.08))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.35), lineWidth: 0.9)
                    )
            )
        }
    }

    private struct DealroomInboxPill: View {
        let count: Int

        var body: some View {
            HStack(spacing: 6) {
                Image(systemName: "envelope.fill")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(Color(red: 0.98, green: 0.79, blue: 0.24))
                Text("\(count)")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule(style: .continuous)
                    .fill(Color.black.opacity(0.45))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(Color(red: 0.98, green: 0.79, blue: 0.24).opacity(0.45), lineWidth: 0.8)
                    )
            )
        }
    }

    /// Prawy róg Live Activity: priorytet „nowe dopasowania radaru”, potem Dealroom.
    private struct RadarTrailingBadge: View {
        let newMatchesCount: Int
        let unreadDealroomCount: Int

        var body: some View {
            VStack(alignment: .trailing, spacing: 2) {
                if newMatchesCount > 0 {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(Color(red: 0.96, green: 0.31, blue: 0.31))
                        Text("\(newMatchesCount)")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.black.opacity(0.45))
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(Color(red: 0.96, green: 0.31, blue: 0.31).opacity(0.55), lineWidth: 0.8)
                            )
                    )
                    Text("nowe oferty")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundColor(Color(red: 0.96, green: 0.31, blue: 0.31).opacity(0.9))
                        .lineLimit(1)
                } else {
                    DealroomInboxPill(count: unreadDealroomCount)
                    Text("wiadomości")
                        .font(.system(size: 10, weight: .medium, design: .rounded))
                        .foregroundColor(Color(red: 0.98, green: 0.79, blue: 0.24).opacity(0.85))
                        .lineLimit(1)
                }
            }
        }
    }

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RadarLiveActivityAttributes.self) { context in
            let paramItems = rotatingParamItems(context)
            let epochMs = context.state.animationEpochMs
            let animationTick = context.state.animationTick

            VStack(spacing: 8) {
                HStack(spacing: 12) {
                    LargeAnimatedRadarGlyph(
                        accent: accent,
                        size: 32,
                        epochMs: epochMs
                    )

                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 0) {
                            Text("Estate").foregroundColor(textMain)
                            Text("OS").foregroundColor(accent)
                            Text("™").foregroundColor(textMain)
                        }
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .fontWeight(.bold)
                        .lineLimit(1)

                        HStack(spacing: 6) {
                            Text(headlineMessage(context))
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundColor(textDim)
                                .lineLimit(1)
                                .minimumScaleFactor(0.55)
                                .truncationMode(.tail)
                            MatchThresholdBadge(
                                accent: accent,
                                threshold: context.state.minMatchThreshold
                            )
                            if context.state.newMatchesCount > 0 {
                                NewOffersPill(count: context.state.newMatchesCount)
                            }
                        }
                        .lineLimit(1)
                    }

                    Spacer(minLength: 8)

                    RadarTrailingBadge(
                        newMatchesCount: context.state.newMatchesCount,
                        unreadDealroomCount: context.state.unreadDealroomMessagesCount
                    )
                }

                RadarUnifiedTicker(
                    accent: accent,
                    staticLabel: propertyTypeLabel(context.state.propertyType),
                    paramItems: paramItems,
                    epochMs: epochMs,
                    animationTick: animationTick
                )
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(
                LinearGradient(
                    colors: [Color.black.opacity(0.55), Color.black.opacity(0.25)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(accent)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    EOSShineBadge(accent: accent)
                        .padding(.vertical, 2)
                        .padding(.leading, 2)
                }

                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 0) {
                            Text("Estate").foregroundColor(textMain)
                            Text("OS").foregroundColor(accent)
                            Text("™").foregroundColor(textMain)
                        }
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .lineLimit(1)

                        HStack(spacing: 5) {
                            Text(headlineMessage(context))
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundColor(textDim)
                                .lineLimit(1)
                                .minimumScaleFactor(0.55)
                                .truncationMode(.tail)
                            MatchThresholdBadge(
                                accent: accent,
                                threshold: context.state.minMatchThreshold,
                                compact: true
                            )
                            if context.state.newMatchesCount > 0 {
                                NewOffersPill(count: context.state.newMatchesCount)
                            }
                        }
                        .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    RadarCountPill(accent: accent, count: context.state.activeMatchesCount)
                        .padding(.vertical, 1)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    let paramItems = rotatingParamItems(context)
                    RadarUnifiedTicker(
                        accent: accent,
                        staticLabel: propertyTypeLabel(context.state.propertyType),
                        paramItems: paramItems,
                        epochMs: context.state.animationEpochMs,
                        animationTick: context.state.animationTick,
                        compact: true
                    )
                    .padding(.top, 3)
                }
            } compactLeading: {
                EOSShineBadge(accent: accent)

            } compactTrailing: {
                MatchCountBadge(accent: accent, count: context.state.activeMatchesCount)

            } minimal: {
                EOSShineBadge(accent: accent)
            }
            .keylineTint(accent.opacity(0.72))
        }
    }
}

private extension View {
    @ViewBuilder
    func ifAvailableNumericTransition() -> some View {
        if #available(iOS 17.0, *) {
            self.contentTransition(.numericText())
        } else {
            self
        }
    }
}

/*
 * Bundle widgetu — pojedyncza Live Activity z `EstateOSRadarLiveActivity`.
 *
 * Historia błędu „Generic parameter 'Content' could not be inferred":
 *   • PIERWOTNIE `body` używał `if #available(iOS 16.1, *) { ... }` BEZ
 *     `else` — `@WidgetBundleBuilder` (jak każdy SwiftUI result-builder)
 *     wymaga deterministycznego typu zwracanego, więc pusty `else`-fallback
 *     niwelował dedukcję `Content`.
 *   • Następnie `@available(iOS 16.1, *)` na `@main struct` w połączeniu
 *     z `@available(iOS 16.1, *)` na `EstateOSRadarLiveActivity` i
 *     `RadarLiveActivityAttributes` powodował, że Swift próbował rozwiązać
 *     symbole jako warunkowo dostępne — i znowu wpadał w niededukowalność
 *     przy `some Widget`.
 *
 * Aktualne rozwiązanie:
 *   1. Deployment target = iOS 16.1+ (i tak wymóg dla Live Activities),
 *      więc usunęliśmy WSZYSTKIE atrybuty `@available(iOS 16.1, *)` —
 *      type-checker nie ma już alternatyw do rozważenia.
 *   2. `body` zwraca jednoznacznie `EstateOSRadarLiveActivity()` jako
 *      `some Widget`, bez warunków.
 *   3. ODDZIELNY incydent z tym samym komunikatem dotyczył
 *      `MatchThresholdBadge` — closure `TimelineView { timeline in ... }`
 *      jest w SwiftUI 5+ traktowany jako `@ViewBuilder`, więc kalkulacja
 *      `let pulse: Double` z gałęziami `if/else` była interpretowana jako
 *      `_ConditionalContent` View'ów. Logika została wyciągnięta do
 *      `computePulse(at:)` — patrz tamta metoda.
 */
@main
struct EstateOSRadarWidgetBundle: WidgetBundle {
    var body: some Widget {
            EstateOSRadarLiveActivity()
    }
}
