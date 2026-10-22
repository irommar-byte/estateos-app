import Foundation

enum TVSearch {
    static func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
            .replacingOccurrences(of: "ł", with: "l")
            .replacingOccurrences(of: "Ł", with: "l")
            .lowercased()
    }

    static func tokens(_ text: String) -> [String] {
        fold(text).split(whereSeparator: { $0.isWhitespace || $0 == "," }).map(String.init).filter { !$0.isEmpty }
    }

    /// Polish month and weekday names, plus the app's own language when it is not Polish,
    /// so "lipiec", "July" and "липень" all find July.
    private static let locales: [Locale] = Localization.isPolish
        ? [Locale(identifier: "pl_PL")]
        : [Locale(identifier: "pl_PL"), Localization.locale]

    private static func symbols(_ pick: (DateFormatter) -> [String]?) -> [String] {
        var joined = [String](repeating: "", count: 12)
        for locale in locales {
            let formatter = DateFormatter()
            formatter.locale = locale
            for (index, name) in (pick(formatter) ?? []).enumerated() where index < joined.count {
                joined[index] += (joined[index].isEmpty ? "" : " ") + fold(name)
            }
        }
        return joined
    }

    private static let monthsNominative: [String] = symbols { $0.standaloneMonthSymbols }
    private static let monthsGenitive: [String] = symbols { $0.monthSymbols }
    private static let weekdays: [String] = Array(symbols { $0.weekdaySymbols }.prefix(7))

    /// Everything a person might type to find this photo, folded to lower case without diacritics.
    static func blob(for asset: LibraryAsset) -> String {
        var parts: [String] = []
        let calendar = Calendar.current
        let c = calendar.dateComponents([.year, .month, .day, .weekday], from: asset.created)
        if let year = c.year { parts.append(String(year)) }
        if let month = c.month, month >= 1, month <= 12 {
            parts.append(monthsNominative[month - 1])
            parts.append(monthsGenitive[month - 1])
        }
        if let day = c.day { parts.append(String(day)) }
        if let weekday = c.weekday, weekday >= 1, weekday <= 7 { parts.append(weekdays[weekday - 1]) }
        let traits = PhotoTraits(rawValue: asset.traits)
        if traits.isVideo { parts.append("wideo film filmy video videos відео фільм фільми") }
        if traits.contains(.live) { parts.append("live zywe живі") }
        if traits.contains(.screenshot) { parts.append("zrzut zrzuty ekranu screenshot screenshots знімок знімки екрана") }
        if traits.contains(.panorama) { parts.append("panorama panoramy panoramiczne panoramas панорама панорами") }
        if traits.contains(.portrait) { parts.append("portret portrety portrait portraits портрет портрети") }
        if traits.contains(.selfie) { parts.append("selfie selfies селфі") }
        if traits.contains(.animated) { parts.append("gif animacja animowane animated анімація анімовані") }
        if asset.favorite { parts.append("ulubione ulubiony serce favorites favourites улюблені") }
        for name in asset.albumNames { parts.append(fold(name)) }
        return fold(parts.joined(separator: " "))
    }
}
