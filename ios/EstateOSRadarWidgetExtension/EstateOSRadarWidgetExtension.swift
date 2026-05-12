import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.1, *)
struct RadarLiveActivityAttributes: ActivityAttributes {

    public struct ContentState: Codable, Hashable {
        var transactionType: String
        var city: String
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
    }

    var title: String
}

@available(iOS 16.1, *)
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

    /// Nagłówek nad tickerem — tylko tryb · miasto.
    /// Próg dopasowania jest osobno w `RadarActiveStatusBar` (dolny pasek
    /// z ikoną „scope” i procentami), zgodnie z założeniem UX:
    /// nagłówek = co i gdzie, pasek statusu = stan radaru i czułość.
    private func headlineMessage(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> String {
        let state = context.state
        let city = state.city.isEmpty ? "Polska" : state.city
        let tx = txLabel(state.transactionType)
        return "\(tx) · \(city)"
    }

    /// Linijki rotującego tickera — pomijamy tylko nagłówek statusowy
    /// („Radar aktywny · skan rynku trwa”), bo jego rolę przejął `RadarActiveStatusBar`.
    private func bodyLines(_ context: ActivityViewContext<RadarLiveActivityAttributes>) -> [String] {
        let all = statusMessages(context)
        return Array(all.dropFirst(1))
    }

    @ViewBuilder
    private func radarGlyph(size: CGFloat, emphasized: Bool) -> some View {
        ZStack {
            Circle()
                .stroke(accent.opacity(emphasized ? 0.33 : 0.2), lineWidth: emphasized ? 4 : 2)
                .frame(width: size, height: size)

            Circle()
                .stroke(accent.opacity(emphasized ? 0.25 : 0.12), lineWidth: emphasized ? 2.5 : 1.4)
                .frame(width: size * 0.62, height: size * 0.62)

            Circle()
                .trim(from: 0.04, to: 0.78)
                .stroke(
                    AngularGradient(
                        gradient: Gradient(colors: [accent.opacity(0.2), accent, accent.opacity(0.7)]),
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: emphasized ? 4 : 2.2, lineCap: .round)
                )
                .rotationEffect(.degrees(-126))
                .frame(width: size, height: size)

            Circle()
                .fill(accent)
                .frame(width: emphasized ? 8 : 5, height: emphasized ? 8 : 5)
                .shadow(color: accent.opacity(0.85), radius: emphasized ? 6 : 3)
        }
        .padding(emphasized ? 3 : 2)
    }

    /// Mini-glyph radaru z obracającym się skanerem i pulsującym środkiem
    /// (restored premium). Na AOD przechodzi w statyczny widok bez `repeatForever`.
    private struct MiniRadarGlyph: View {
        let accent: Color
        @State private var spinning = false
        @State private var pulse = false
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            ZStack {
                Circle()
                    .stroke(accent.opacity(0.24), lineWidth: 1.0)
                    .frame(width: 16, height: 16)

                Circle()
                    .stroke(accent.opacity(0.14), lineWidth: 0.9)
                    .frame(width: 10.5, height: 10.5)

                Circle()
                    .trim(from: 0.04, to: 0.24)
                    .stroke(
                        accent.opacity(0.96),
                        style: StrokeStyle(lineWidth: 1.8, lineCap: .round)
                    )
                    .frame(width: 16, height: 16)
                    .rotationEffect(.degrees(spinning && !isLuminanceReduced ? 360 : -72))
                    .animation(
                        isLuminanceReduced
                            ? .default
                            : .linear(duration: 1.4).repeatForever(autoreverses: false),
                        value: spinning
                    )

                Circle()
                    .fill(accent)
                    .frame(
                        width: pulse && !isLuminanceReduced ? 4.4 : 3.6,
                        height: pulse && !isLuminanceReduced ? 4.4 : 3.6
                    )
                    .shadow(color: accent.opacity(0.95), radius: pulse && !isLuminanceReduced ? 4 : 2.5)
                    .animation(
                        isLuminanceReduced
                            ? .default
                            : .easeInOut(duration: 1.0).repeatForever(autoreverses: true),
                        value: pulse
                    )
            }
            .frame(width: 20, height: 20)
            .onAppear {
                guard !isLuminanceReduced else { return }
                spinning = true
                pulse = true
            }
        }
    }

    /// Premium badge z licznikiem dopasowań — pulsujący „glow" w kolorze
    /// akcentu. Na AOD przełącza się w statyczny wariant, zachowując
    /// kontrast i czytelność liczby.
    private struct MatchCountBadge: View {
        let accent: Color
        let count: Int
        @State private var glow = false
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
            ZStack {
                Capsule(style: .continuous)
                    .fill(accent.opacity(0.18))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(accent.opacity(0.38), lineWidth: 1)
                    )
                Text("\(count)")
                    .foregroundColor(accent)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .scaleEffect(glow && !isLuminanceReduced ? 1.04 : 1.0)
                    .opacity(glow && !isLuminanceReduced ? 1.0 : 0.92)
                    .animation(
                        isLuminanceReduced
                            ? .default
                            : .easeInOut(duration: 0.85).repeatForever(autoreverses: true),
                        value: glow
                    )
                    .ifAvailableNumericTransition()
            }
            .frame(minWidth: 28, minHeight: 20)
            .onAppear {
                guard !isLuminanceReduced else { return }
                glow = true
            }
        }
    }

    /// Pulsujący wariant marki — restored premium.
    private struct BrandPulseBadge: View {
        let accent: Color
        @State private var pulse = false
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

        var body: some View {
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
                            .stroke(accent.opacity(pulse && !isLuminanceReduced ? 0.72 : 0.4), lineWidth: 1)
                    )
            )
            .scaleEffect(pulse && !isLuminanceReduced ? 1.04 : 1.0)
            .animation(
                isLuminanceReduced
                    ? .default
                    : .easeInOut(duration: 0.95).repeatForever(autoreverses: true),
                value: pulse
            )
            .onAppear {
                guard !isLuminanceReduced else { return }
                pulse = true
            }
        }
    }

    /// Premium pill „EOS" z animowanym połyskiem — wersja przywrócona
    /// po reżyserskim feedbacku użytkownika („powrócimy do naszej wersji
    /// premium"). Na AOD przełącza się na statyczny widok przez
    /// `@Environment(\.isLuminanceReduced)` — nie palimy baterii w trybie,
    /// w którym animacje i tak nie są widoczne.
    private struct EOSShineBadge: View {
        let accent: Color
        @State private var shine = false
        @Environment(\.isLuminanceReduced) private var isLuminanceReduced

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
                        GeometryReader { geo in
                            let w = geo.size.width
                            LinearGradient(
                                colors: [Color.clear, Color.white.opacity(0.36), Color.clear],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                            .frame(width: max(12, w * 0.3))
                            .rotationEffect(.degrees(18))
                            .offset(x: shine ? w : -w)
                            .blendMode(.screen)
                        }
                        .clipShape(Capsule(style: .continuous))
                    }
                }
            )
            .frame(minWidth: 52, minHeight: 24)
            .onAppear {
                guard !isLuminanceReduced else { return }
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    shine = true
                }
            }
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
                TimelineView(.periodic(from: .now, by: 0.08)) { timeline in
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
                TimelineView(.periodic(from: .now, by: 0.06)) { timeline in
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

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RadarLiveActivityAttributes.self) { context in
            VStack(spacing: 7) {
                HStack(spacing: 12) {
                    radarGlyph(size: 32, emphasized: true)

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 0) {
                            Text("Estate").foregroundColor(textMain)
                            Text("OS").foregroundColor(accent)
                            Text("™").foregroundColor(textMain)
                        }
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .fontWeight(.bold)

                        Text(headlineMessage(context))
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(textDim)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 8)

                    VStack(alignment: .trailing, spacing: 2) {
                        DealroomInboxPill(count: context.state.unreadDealroomMessagesCount)
                        Text("nieprzeczytane")
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundColor(Color(red: 0.98, green: 0.79, blue: 0.24).opacity(0.85))
                    }
                }

                RadarRotatingTicker(
                    accent: accent,
                    lines: bodyLines(context)
                )
                .frame(minHeight: 18)

                RadarActiveStatusBar(
                    accent: accent,
                    minMatchThreshold: context.state.minMatchThreshold
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
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 0) {
                            Text("Estate").foregroundColor(textMain)
                            Text("OS").foregroundColor(accent)
                            Text("™").foregroundColor(textMain)
                        }
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        Text(headlineMessage(context))
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(textDim)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                DynamicIslandExpandedRegion(.trailing) {
                    RadarCountPill(accent: accent, count: context.state.activeMatchesCount)
                        .padding(.vertical, 1)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        RadarRotatingTicker(
                            accent: accent,
                            lines: bodyLines(context),
                            compact: true
                        )
                        .frame(minHeight: 14)

                        RadarActiveStatusBar(
                            accent: accent,
                            minMatchThreshold: context.state.minMatchThreshold,
                            compact: true
                        )
                    }
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

@main
struct EstateOSRadarWidgetBundle: WidgetBundle {

    var body: some Widget {
        if #available(iOS 16.1, *) {
            EstateOSRadarLiveActivity()
        }
    }
}
