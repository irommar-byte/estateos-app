import Foundation
import SwiftUI

struct ResolvedLocalityCountry: Equatable, Hashable {
    let name: String
    let isoCode: String

    var flagEmoji: String {
        LocalityCountry.flagEmoji(isoCode: isoCode)
    }

    var displayLine: String {
        "\(flagEmoji)  \(name)"
    }
}

enum LocalityCountry {
    static let defaultName = "Polska"
    static let defaultCode = "PL"

    private static let foreignCityISO: [String: String] = [
        "berlin": "DE", "hamburg": "DE", "munchen": "DE", "muenchen": "DE",
        "frankfurt": "DE", "koln": "DE", "cologne": "DE", "dresden": "DE",
        "monachium": "DE", "wien": "AT", "vienna": "AT", "wieden": "AT",
        "praha": "CZ", "prague": "CZ", "praga": "CZ",
        "bratislava": "SK", "kyiv": "UA", "kiev": "UA",
        "london": "GB", "londyn": "GB", "paris": "FR", "paryz": "FR",
        "madryt": "ES", "madrid": "ES", "lizbona": "PT", "lisboa": "PT",
        "rzym": "IT", "rome": "IT", "roma": "IT",
        "budapeszt": "HU", "bukareszt": "RO", "ateny": "GR",
        "sztokholm": "SE", "kopenhaga": "DK",
        "nowy jork": "US", "new york": "US", "nyc": "US",
        "los angeles": "US", "chicago": "US", "miami": "US",
        "amsterdam": "NL", "brussels": "BE", "bruxelles": "BE", "bruksela": "BE",
        "toronto": "CA", "sydney": "AU", "melbourne": "AU",
        "zurych": "CH", "zurich": "CH", "genewa": "CH",
    ]

    private static let polishMetro: Set<String> = [
        "warszawa", "warsaw", "krakow", "kraków", "wroclaw", "wrocław",
        "poznan", "poznań", "lodz", "łódź", "lublin", "gdansk", "gdańsk",
        "gdynia", "sopot", "katowice", "rybnik", "bialystok", "białystok",
        "zamosc", "zamość", "szczecin", "bydgoszcz", "rzeszow", "rzeszów",
        "torun", "toruń", "olsztyn", "kielce", "opole", "gorzow", "zielona gora",
        "zielona góra", "radom", "czestochowa", "częstochowa", "gliwice", "sosnowiec",
    ]

    private static let isoToPLName: [String: String] = [
        "PL": "Polska", "DE": "Niemcy", "CZ": "Czechy", "SK": "Słowacja",
        "UA": "Ukraina", "BY": "Białoruś", "LT": "Litwa", "US": "Stany Zjednoczone",
        "AU": "Australia", "GB": "Wielka Brytania", "CA": "Kanada", "FR": "Francja",
        "ES": "Hiszpania", "IT": "Włochy", "NL": "Holandia", "BE": "Belgia",
        "CH": "Szwajcaria", "AT": "Austria", "PT": "Portugalia", "HU": "Węgry",
        "RO": "Rumunia", "GR": "Grecja", "SE": "Szwecja", "DK": "Dania",
    ]

    static func flagEmoji(isoCode: String) -> String {
        let code = isoCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard code.count == 2,
              let first = code.unicodeScalars.first,
              let second = code.unicodeScalars.dropFirst().first,
              let a = UnicodeScalar(127397 + Int(first.value)),
              let b = UnicodeScalar(127397 + Int(second.value)) else {
            return "🏳️"
        }
        return String(String.UnicodeScalarView([a, b]))
    }

    static func label(forISO code: String) -> String {
        let iso = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if let mapped = isoToPLName[iso] { return mapped }
        let locale = Locale(identifier: "pl_PL")
        if let name = locale.localizedString(forRegionCode: iso), !name.isEmpty {
            return name
        }
        return iso.isEmpty ? defaultName : iso
    }

    /// Kraj z oferty: pola zapisane przy pinezce na mapie (`localityCountry` / `localityCountryCode`).
    /// Nie zgadujemy kraju z nazwy miasta, gdy API już podało państwo.
    static func resolve(
        city: String?,
        district: String? = nil,
        localityCountry: String?,
        localityCountryCode: String?
    ) -> ResolvedLocalityCountry {
        let apiCode = (localityCountryCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let apiName = (localityCountry ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let apiValid = apiCode.count == 2 && apiCode.unicodeScalars.allSatisfy { CharacterSet.uppercaseLetters.contains($0) }

        // 1) Źródło prawdy: kraj zapisany przy dodawaniu (Mapbox / pinezka).
        if apiValid {
            let name = apiName.isEmpty ? label(forISO: apiCode) : localizedPolishName(apiName, iso: apiCode)
            return ResolvedLocalityCountry(name: name, isoCode: apiCode)
        }
        if !apiName.isEmpty {
            if let iso = isoFromPolishOrEnglishName(apiName) {
                return ResolvedLocalityCountry(name: localizedPolishName(apiName, iso: iso), isoCode: iso)
            }
            return ResolvedLocalityCountry(name: apiName, isoCode: "XX")
        }

        // 2) Tylko legacy oferty bez pól kraju — ostatnia deska (nie nadpisuje mapy).
        if let inferred = inferFromPlace(city: city, district: district) {
            return inferred
        }
        return ResolvedLocalityCountry(name: defaultName, isoCode: defaultCode)
    }

    private static func isoFromPolishOrEnglishName(_ raw: String) -> String? {
        let key = normalize(raw)
        let map: [String: String] = [
            "polska": "PL", "poland": "PL",
            "niemcy": "DE", "germany": "DE",
            "czechy": "CZ", "czechia": "CZ", "czech republic": "CZ",
            "słowacja": "SK", "slovakia": "SK",
            "ukraina": "UA", "ukraine": "UA",
            "stany zjednoczone": "US", "united states": "US", "usa": "US",
            "wielka brytania": "GB", "united kingdom": "GB",
            "francja": "FR", "france": "FR",
            "hiszpania": "ES", "spain": "ES",
            "włochy": "IT", "italy": "IT",
            "austria": "AT", "kanada": "CA", "canada": "CA",
            "australia": "AU", "holandia": "NL", "netherlands": "NL",
        ]
        return map[key]
    }

    private static func localizedPolishName(_ raw: String, iso: String) -> String {
        let key = normalize(raw)
        if key == "poland" || key == "polska" { return "Polska" }
        if key == "united states" || key == "usa" || key == "stany zjednoczone" {
            return "Stany Zjednoczone"
        }
        if let fromIso = isoToPLName[iso] { return fromIso }
        return raw
    }


    private static func inferFromPlace(city: String?, district: String?) -> ResolvedLocalityCountry? {
        let hay = [city, district]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        guard !hay.isEmpty else { return nil }
        let key = normalize(hay)

        if let iso = foreignCityISO[key] {
            return ResolvedLocalityCountry(name: label(forISO: iso), isoCode: iso)
        }
        // Match leading city token / contains known foreign city
        for (cityKey, iso) in foreignCityISO {
            if key == cityKey || key.hasPrefix(cityKey + " ") || key.contains(" " + cityKey) {
                return ResolvedLocalityCountry(name: label(forISO: iso), isoCode: iso)
            }
        }
        let cityOnly = normalize(city ?? "")
        if polishMetro.contains(cityOnly) {
            return ResolvedLocalityCountry(name: defaultName, isoCode: defaultCode)
        }
        return nil
    }

    private static func normalize(_ value: String) -> String {
        value
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Location row with waving country flag + country name.
struct EOSCountryLocationLabel: View {
    let locationLine: String
    let country: ResolvedLocalityCountry
    var font: Font = .callout.weight(.semibold)
    var foreground: Color = .white.opacity(0.75)

    @State private var wave = false

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "mappin.and.ellipse")
                .font(font)
            if !locationLine.isEmpty {
                Text(locationLine)
                    .font(font)
                    .lineLimit(1)
            }
            Text(country.flagEmoji)
                .font(.system(size: 22))
                .rotationEffect(.degrees(wave ? 8 : -8), anchor: .bottom)
                .animation(
                    .easeInOut(duration: 0.85).repeatForever(autoreverses: true),
                    value: wave
                )
                .accessibilityLabel(country.name)
            Text(country.name)
                .font(font)
                .lineLimit(1)
        }
        .foregroundStyle(foreground)
        .onAppear { wave = true }
    }
}
