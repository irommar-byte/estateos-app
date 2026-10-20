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

    private static let monthsNominative: [String] = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        return formatter.standaloneMonthSymbols.map(fold)
    }()

    private static let monthsGenitive: [String] = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        return formatter.monthSymbols.map(fold)
    }()

    private static let weekdays: [String] = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pl_PL")
        return formatter.weekdaySymbols.map(fold)
    }()

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
        if traits.isVideo { parts.append("wideo film filmy video") }
        if traits.contains(.live) { parts.append("live zywe") }
        if traits.contains(.screenshot) { parts.append("zrzut zrzuty ekranu screenshot") }
        if traits.contains(.panorama) { parts.append("panorama") }
        if traits.contains(.portrait) { parts.append("portret portrety") }
        if traits.contains(.selfie) { parts.append("selfie") }
        if traits.contains(.animated) { parts.append("gif animacja animowane") }
        if asset.favorite { parts.append("ulubione ulubiony serce") }
        for name in asset.albumNames { parts.append(fold(name)) }
        return parts.joined(separator: " ")
    }
}
