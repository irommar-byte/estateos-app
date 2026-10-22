import Accelerate
import Foundation

/// Search in plain Polish: "Ania na plaży w lipcu 2023", "pies na śniegu", "paragon z Biedronki".
/// The sentence is taken apart into what can be checked exactly (people, places, dates, kinds of
/// media, text on the photo) and what has to be *seen* (the rest), which CLIP compares with
/// every photo's picture vector. Everything runs on the device.
struct HourWindow: Equatable {
    let start: Int
    let end: Int

    /// Windows may cross midnight (21 → 4).
    func contains(_ hour: Int) -> Bool {
        start <= end ? (start...end).contains(hour) : (hour >= start || hour <= end)
    }
}

struct SmartQuery: Equatable {
    struct Chip: Hashable, Identifiable {
        enum Kind: Hashable { case person, place, date, kind, text, scene }
        let kind: Kind
        let title: String
        var id: String { "\(kind)-\(title)" }

        var symbol: String {
            switch kind {
            case .person: return "person.crop.circle"
            case .place: return "mappin.and.ellipse"
            case .date: return "calendar"
            case .kind: return "photo.on.rectangle"
            case .text: return "text.viewfinder"
            case .scene: return "sparkles"
            }
        }
    }

    var people: [Int64] = []
    var places: [String] = []
    var years: Set<Int> = []
    var months: Set<Int> = []
    var range: ClosedRange<Date>?
    var hours: HourWindow?
    var traits: PhotoTraits = []
    var favorites = false
    var quoted: [String] = []
    /// Words still to be understood by looking at the photos (folded Polish).
    var sceneWords: [String] = []
    /// English for CLIP from the built-in dictionary; empty when some word is not in it.
    var dictionaryEnglish = ""
    var unknownWords: [String] = []
    var chips: [Chip] = []

    var hasScene: Bool { !sceneWords.isEmpty }
    var scenePolish: String { sceneWords.joined(separator: " ") }
}

@MainActor
enum SmartSearch {
    // MARK: Understanding the sentence

    static func parse(_ raw: String, library: PhotoLibrary, brain: PhotoIntelligence, now: Date = .now) -> SmartQuery {
        var query = SmartQuery()
        var text = raw
        // "…" or "..." in quotes: exact text on the photo.
        for quote in ["\"", "„", "”", "“"] where text.contains(quote) {
            text = text.replacingOccurrences(of: quote, with: "\"")
        }
        let quotedParts = text.split(separator: "\"", omittingEmptySubsequences: false)
        if quotedParts.count >= 3 {
            for (index, part) in quotedParts.enumerated() where index % 2 == 1 {
                let value = PhotoAnalyzer.fold(String(part)).trimmingCharacters(in: .whitespaces)
                if !value.isEmpty {
                    query.quoted.append(value)
                    query.chips.append(.init(kind: .text, title: "„\(part)”"))
                }
            }
            text = quotedParts.enumerated().filter { $0.offset % 2 == 0 }.map { String($0.element) }.joined(separator: " ")
        }

        var words = PhotoAnalyzer.fold(text)
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
        let calendar = Calendar.current

        // Relative dates first: they span two words.
        let joined = " " + words.joined(separator: " ") + " "
        func consume(_ phrase: String) {
            let parts = phrase.split(separator: " ").map(String.init)
            if let start = (0...max(0, words.count - parts.count)).first(where: { Array(words.dropFirst($0).prefix(parts.count)) == parts }) {
                words.removeSubrange(start..<(start + parts.count))
            }
        }
        let year = calendar.component(.year, from: now)
        // Polish, English and Ukrainian (folded: "й" → "и", "ї" → "і").
        let lastYear = ["w zeszlym roku", "rok temu", "last year", "a year ago", "минулого року", "рік тому", "торік"]
        let thisYear = ["w tym roku", "this year", "цього року", "цьогоріч"]
        if let phrase = lastYear.first(where: { joined.contains(" \($0) ") }) {
            query.years.insert(year - 1)
            query.chips.append(.init(kind: .date, title: "\(year - 1)"))
            consume(phrase)
        } else if let phrase = thisYear.first(where: { joined.contains(" \($0) ") }) {
            query.years.insert(year)
            query.chips.append(.init(kind: .date, title: "\(year)"))
            consume(phrase)
        }
        let lastWeek = ["w zeszlym tygodniu", "last week", "минулого тижня"]
        // Word → days back. Typed out so the compiler does not have to guess the tuple types.
        let dayWords: [(String, Int)] = [
            ("wczoraj", 1), ("dzisiaj", 0), ("dzis", 0),
            ("yesterday", 1), ("today", 0),
            ("вчора", 1), ("учора", 1), ("сьогодні", 0),
        ]
        if let match = dayWords.first(where: { words.contains($0.0) }) {
            let (phrase, days) = match
            let title = days == 1 ? L("Wczoraj") : L("Dzisiaj")
            let day = calendar.startOfDay(for: calendar.date(byAdding: .day, value: -days, to: now) ?? now)
            query.range = day...(calendar.date(byAdding: .day, value: 1, to: day) ?? now)
            query.chips.append(.init(kind: .date, title: title))
            consume(phrase)
        } else if let phrase = lastWeek.first(where: { joined.contains(" \($0) ") }) {
            let end = calendar.startOfDay(for: now)
            query.range = (calendar.date(byAdding: .day, value: -7, to: end) ?? end)...now
            query.chips.append(.init(kind: .date, title: L("Ostatni tydzień")))
            consume(phrase)
        }

        // Names win over look-alike words ("Maja" is not May, "Marcin" is not March).
        let nameParts = brain.people.filter(\.hasName).flatMap { PhotoAnalyzer.fold($0.name).split(separator: " ").map(String.init) }
        var remaining: [String] = []
        for word in words {
            if word.count >= 3, nameParts.contains(where: { Self.sameStem(word, $0) }) {
                remaining.append(word)
                continue
            }
            if let number = Int(word), word.count == 4, (1990...(year + 1)).contains(number) {
                query.years.insert(number)
                query.chips.append(.init(kind: .date, title: word))
                continue
            }
            if let month = Self.month(word) {
                query.months.insert(month)
                query.chips.append(.init(kind: .date, title: Self.monthTitle(month)))
                continue
            }
            if let season = Self.season(word) {
                query.months.formUnion(season.months)
                query.chips.append(.init(kind: .date, title: season.title))
                continue
            }
            if let hours = Self.timeOfDay(word) {
                query.hours = hours.range
                query.chips.append(.init(kind: .date, title: hours.title))
                continue
            }
            if let kind = Self.kind(word) {
                if kind.favorite { query.favorites = true } else { query.traits.insert(kind.trait) }
                query.chips.append(.init(kind: .kind, title: kind.title))
                continue
            }
            if Self.stopWords.contains(word) { continue }
            remaining.append(word)
        }

        // People, by name stem ("z Anią", "Tomkiem").
        var afterPeople: [String] = []
        for word in remaining {
            let found = brain.people.filter { person in
                guard person.hasName else { return false }
                return PhotoAnalyzer.fold(person.name).split(separator: " ").contains { Self.sameStem(word, String($0)) }
            }
            if !found.isEmpty, word.count >= 3 {
                for person in found where !query.people.contains(person.id) {
                    query.people.append(person.id)
                    query.chips.append(.init(kind: .person, title: person.name))
                }
            } else {
                afterPeople.append(word)
            }
        }

        // Places the library already knows by name ("w Krakowie", "Zakopane").
        let placeNames = Set(library.placeNames.values)
        var afterPlaces: [String] = []
        for word in afterPeople {
            guard word.count >= 4, Self.translation(word) == nil else {
                afterPlaces.append(word)
                continue
            }
            let matches = placeNames.filter { name in
                PhotoAnalyzer.fold(name).split(whereSeparator: { !$0.isLetter }).contains { Self.sameStem(word, String($0)) }
            }
            if matches.isEmpty {
                afterPlaces.append(word)
            } else {
                query.places.append(word)
                if let first = matches.sorted().first {
                    query.chips.append(.init(kind: .place, title: first.split(separator: ",").first.map(String.init) ?? first))
                }
            }
        }

        query.sceneWords = afterPlaces
        var english: [String] = []
        for word in afterPlaces {
            if Localization.isEnglish {
                // English is what CLIP reads: the words go straight in.
                english.append(word)
            } else if let known = Self.translation(word) {
                english.append(known)
            } else {
                query.unknownWords.append(word)
            }
        }
        query.dictionaryEnglish = english.joined(separator: " ")
        if query.hasScene {
            let scene = afterPlaces.joined(separator: " ")
            query.chips.append(.init(kind: .scene, title: scene.prefix(1).uppercased() + String(scene.dropFirst())))
        }
        return query
    }

    // MARK: Finding

    struct Hit {
        let id: String
        let score: Float
    }

    /// `english` is the scene in English (from Apple's translation or the dictionary).
    static func run(_ query: SmartQuery, english: String?, library: PhotoLibrary, brain: PhotoIntelligence) async -> [String] {
        let calendar = Calendar.current
        var personPhotos: Set<String>?
        for person in query.people {
            let ids = Set(brain.photos(of: person))
            personPhotos = personPhotos.map { $0.intersection(ids) } ?? ids
        }
        let placeWords = query.places
        let names = library.placeNames
        var candidates = library.allPhotos.filter { photo in
            if library.isConcealed(photo.id) { return false }
            if let personPhotos, !personPhotos.contains(photo.id) { return false }
            if !query.years.isEmpty, !query.years.contains(calendar.component(.year, from: photo.created)) { return false }
            if !query.months.isEmpty, !query.months.contains(calendar.component(.month, from: photo.created)) { return false }
            if let range = query.range, !range.contains(photo.created) { return false }
            if let hours = query.hours, !hours.contains(calendar.component(.hour, from: photo.created)) { return false }
            if !query.traits.isEmpty, !photo.traits.isSuperset(of: query.traits) { return false }
            if query.favorites, !photo.isFavorite { return false }
            if !placeWords.isEmpty {
                guard let place = names[PhotoGrouping.dayKey(photo.created, calendar: calendar)] else { return false }
                let folded = PhotoAnalyzer.fold(place).split(whereSeparator: { !$0.isLetter }).map(String.init)
                guard placeWords.allSatisfy({ word in folded.contains { sameStem(word, $0) } }) else { return false }
            }
            return true
        }
        let insights = brain.insights
        if !query.quoted.isEmpty {
            candidates = candidates.filter { photo in
                guard let words = insights[photo.id]?.words, !words.isEmpty else { return false }
                return query.quoted.allSatisfy { words.contains($0) }
            }
        }
        guard query.hasScene else {
            return candidates.sorted { $0.created > $1.created }.map(\.id)
        }

        // What has to be seen: text on the photo, scene labels and the CLIP picture vector.
        let words = query.sceneWords
        var wantedWords: [String] = words.flatMap { word -> [String] in ObjectSearch.synonyms[word] ?? [] }
        if Localization.isEnglish { wantedWords.append(contentsOf: words) }
        for word in words {
            guard let english = translation(word) else { continue }
            wantedWords.append(contentsOf: english.split(separator: " ").map(String.init))
        }
        let labelWanted = Set(wantedWords.map(singular))
        let sceneEnglish = (english?.isEmpty == false ? english! : query.dictionaryEnglish)
        var textVector: [Float]?
        if brain.searchAvailable, !sceneEnglish.isEmpty {
            let prompt = "a photo of " + sceneEnglish
            textVector = await Task.detached(priority: .userInitiated) { IntelligenceModels.shared.textVector(prompt) }.value
        }

        var hits: [Hit] = []
        hits.reserveCapacity(candidates.count)
        var clipScores: [String: Float] = [:]
        if let textVector {
            let withVectors = candidates.compactMap { photo in insights[photo.id]?.clip.map { (photo.id, $0) } }
            clipScores = await Task.detached(priority: .userInitiated) {
                score(withVectors, against: textVector)
            }.value
        }
        // CLIP scores are relative to the library: keep what clearly stands out from the rest
        // (two standard deviations above the average), never anything near the noise floor.
        let values = Array(clipScores.values)
        let mean = values.isEmpty ? 0 : values.reduce(0, +) / Float(values.count)
        let spread = values.isEmpty ? 0 : (values.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Float(values.count)).squareRoot()
        let cut = max(0.19, mean + 2 * spread)
        let wantsScreens = query.traits.contains(.screenshot)
        for photo in candidates {
            // A screenshot of a search screen is not a photo of mountains.
            if photo.traits.contains(.screenshot), !wantsScreens, query.quoted.isEmpty, !words.contains(where: { ["zrzut", "zrzuty", "screenshot", "screenshots", "скріншот", "знімок", "знімки"].contains($0) }) { continue }
            let insight = insights[photo.id]
            let ocr = insight?.words ?? ""
            let ocrHit = !ocr.isEmpty && words.filter { $0.count >= 4 }.contains { ocr.contains($0) }
            let labelHit = (insight?.labels ?? []).contains { label in
                label.1 >= 0.35 && label.0.split(separator: "_").contains { labelWanted.contains(singular(String($0))) }
            }
            if let clip = clipScores[photo.id] {
                guard clip >= cut || ocrHit || labelHit else { continue }
                hits.append(Hit(id: photo.id, score: clip + (labelHit ? 0.02 : 0) + (ocrHit ? 0.05 : 0)))
            } else if ocrHit || labelHit {
                hits.append(Hit(id: photo.id, score: (ocrHit ? 0.3 : 0) + (labelHit ? 0.25 : 0)))
            }
        }
        return hits.sorted { $0.score > $1.score }.prefix(800).map(\.id)
    }

    nonisolated private static func score(_ items: [(String, [UInt16])], against text: [Float]) -> [String: Float] {
        guard !items.isEmpty, text.count == 512 else { return [:] }
        var result: [String: Float] = [:]
        result.reserveCapacity(items.count)
        var floats = [Float](repeating: 0, count: 512)
        for (id, bits) in items where bits.count == 512 {
            bits.withUnsafeBufferPointer { source in
                floats.withUnsafeMutableBufferPointer { target in
                    HalfFloats.unpack(source, into: target)
                }
            }
            var dot: Float = 0
            vDSP_dotpr(floats, 1, text, 1, &dot, 512)
            result[id] = dot
        }
        return result
    }

    // MARK: Words

    /// "mountains" and Vision's "mountain" are the same thing.
    nonisolated static func singular(_ word: String) -> String {
        if word.hasSuffix("ies"), word.count > 4 { return String(word.dropLast(3)) + "y" }
        if word.hasSuffix("s"), !word.hasSuffix("ss"), word.count > 3 { return String(word.dropLast()) }
        return word
    }

    /// Same word up to Polish endings: "krakowie"/"krakow", "tomkiem"/"tomek", "ania"/"anią".
    static func sameStem(_ a: String, _ b: String) -> Bool {
        guard a.count >= 3, b.count >= 3 else { return a == b }
        if a == b { return true }
        let common = zip(a, b).prefix { $0 == $1 }.count
        return common >= max(3, min(a.count, b.count) - 2)
    }

    private static let stopWords: Set<String> = [
        "w", "we", "na", "z", "ze", "o", "od", "do", "przy", "pod", "nad", "i", "a", "oraz", "lub", "albo",
        "moj", "moja", "moje", "moi", "moim", "nasz", "nasza", "nasze", "zdjecie", "zdjecia", "zdjec",
        "foto", "fotki", "fotka", "gdzie", "jak", "kiedy", "ktore", "ktory", "ktora", "pokaz", "znajdz", "szukaj",
        "the", "of", "an", "in", "on", "with", "at", "photo", "photos", "picture", "pictures", "my", "show", "me",
        "sie", "jest", "sa", "byl", "bylo", "bylismy", "bylam", "bylem", "po", "za", "przed", "u",
        "a", "and", "or", "from", "near", "find", "all", "some",
        "в", "у", "на", "з", "із", "зі", "та", "і", "и", "або", "мои", "моя", "моє", "моі", "наш", "наша", "наші", "своі",
        "фото", "фотографія", "фотографії", "знімки", "де", "коли", "покажи", "знаиди", "біля", "під", "над",
        "до", "від", "по", "за", "перед", "це", "мені",
    ]

    /// "Lipiec", "July", "Липень": the stand-alone month name in the app's language.
    static func monthTitle(_ month: Int) -> String {
        let formatter = DateFormatter()
        formatter.locale = Localization.locale
        let names = formatter.standaloneMonthSymbols ?? []
        guard (1...names.count).contains(month) else { return "\(month)" }
        let name = names[month - 1]
        return name.prefix(1).uppercased() + name.dropFirst()
    }

    private static func month(_ word: String) -> Int? {
        let english = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        if let index = english.firstIndex(of: word) { return index + 1 }
        // Polish months and their endings (lipiec, lipca, lipcu…); colours and names excluded.
        let stems: [(String, Int)] = [
            ("stycz", 1), ("lut", 2), ("marz", 3), ("marc", 3), ("kwie", 4), ("maj", 5), ("czerw", 6), ("lip", 7),
            ("sierp", 8), ("wrze", 9), ("pazdziern", 10), ("listopad", 11), ("grud", 12),
        ]
        if word.hasPrefix("czerwon") || word.hasPrefix("marcin") { return nil }
        // Ukrainian (січень, січня, у січні…); "квіти" (flowers) and "липа" (lime tree) stay words.
        let ukrainian: [(String, Int)] = [
            ("січ", 1), ("лют", 2), ("берез", 3), ("квітн", 4), ("квітен", 4), ("травн", 5), ("травен", 5),
            ("червн", 6), ("червен", 6), ("липн", 7), ("липен", 7), ("серпн", 8), ("серпен", 8),
            ("вересн", 9), ("вересен", 9), ("жовтн", 10), ("жовтен", 10), ("листопад", 11), ("грудн", 12), ("груден", 12),
        ]
        if word.hasPrefix("березов") || word.hasPrefix("березка") { return nil }
        for (stem, month) in ukrainian where word.hasPrefix(stem) && word.count <= stem.count + 4 {
            return month
        }
        for (stem, month) in stems where word.hasPrefix(stem) && word.count <= stem.count + 4 {
            return month
        }
        return nil
    }

    private static func season(_ word: String) -> (months: Set<Int>, title: String)? {
        switch word {
        case "lato", "latem", "lata", "lecie", "wakacje", "wakacjach", "wakacji", "summer", "holidays",
             "літо", "влітку", "літа", "літні", "літом", "канікули", "відпустка", "відпустці":
            return ([6, 7, 8], L("Lato"))
        case "zima", "zimie", "zimy", "zimowe", "winter", "зима", "взимку", "зими", "зимові", "зимою":
            return ([12, 1, 2], L("Zima"))
        case "wiosna", "wiosny", "wiosenne", "spring", "весна", "навесні", "весни", "весняні", "весною":
            return ([3, 4, 5], L("Wiosna"))
        case "jesien", "jesienia", "jesieni", "jesienne", "autumn", "fall", "осінь", "восени", "осені", "осінні", "осінню":
            return ([9, 10, 11], L("Jesień"))
        case "swieta", "swietach", "wigilia", "wigilie", "christmas", "різдво", "різдва", "свята", "святвечір":
            return ([12], L("Święta"))
        default:
            return nil
        }
    }

    private static func timeOfDay(_ word: String) -> (range: HourWindow, title: String)? {
        switch word {
        case "rano", "ranek", "poranek", "poranku", "morning", "ранок", "вранці", "зранку", "ранку":
            return (HourWindow(start: 5, end: 10), L("Rano"))
        case "poludnie", "poludniu", "noon", "полудень", "опівдні":
            return (HourWindow(start: 11, end: 14), L("Południe"))
        case "wieczorem", "wieczor", "wieczorne", "evening", "вечір", "ввечері", "увечері", "вечора":
            return (HourWindow(start: 18, end: 22), L("Wieczór"))
        case "noca", "nocy", "nocne", "night", "ніч", "вночі", "уночі", "ночі", "нічні":
            return (HourWindow(start: 21, end: 4), L("Noc"))
        default: return nil
        }
    }

    private static func kind(_ word: String) -> (trait: PhotoTraits, favorite: Bool, title: String)? {
        switch word {
        case "wideo", "film", "filmy", "filmik", "filmiki", "nagranie", "nagrania", "video", "videos", "movie", "movies",
             "відео", "фільм", "фільми", "ролик", "ролики":
            return (.video, false, L("Wideo"))
        case "selfie", "selfiki", "selfies", "селфі": return (.selfie, false, L("Selfie"))
        case "live", "живі": return (.live, false, "Live Photos")
        case "zrzut", "zrzuty", "screenshot", "screenshots", "screen", "скріншот", "скріншоти", "знімок", "знімки":
            return (.screenshot, false, L("Zrzuty ekranu"))
        case "panorama", "panoramy", "panoramiczne", "panoramas", "панорама", "панорами":
            return (.panorama, false, L("Panoramy"))
        case "portret", "portrety", "portretowe", "portrait", "portraits", "портрет", "портрети":
            return (.portrait, false, L("Portrety"))
        case "ulubione", "ulubionych", "ulubiony", "favorites", "favourites", "favorite", "улюблені", "улюблене":
            return ([], true, L("Ulubione"))
        case "raw": return (.raw, false, "RAW")
        default: return nil
        }
    }

    /// Polish → English for the words people use most when looking for photos. Apple's on-device
    /// translation handles the rest; this keeps common searches instant and works without it.
    static func translation(_ word: String) -> String? {
        if let exact = dictionary[word] ?? ukrainian[word] { return exact }
        for (stem, english) in stems where word.hasPrefix(stem) {
            return english
        }
        return nil
    }

    private static let dictionary: [String: String] = [
        "pies": "dog", "psa": "dog", "psem": "dog", "psy": "dogs", "psami": "dogs", "piesek": "dog", "pieskiem": "dog",
        "kot": "cat", "kota": "cat", "kotem": "cat", "koty": "cats", "kotek": "kitten", "kotki": "kittens",
        "kon": "horse", "konia": "horse", "koniem": "horse", "konie": "horses",
        "ptak": "bird", "ptaki": "birds", "ptakiem": "bird", "ryba": "fish", "ryby": "fish",
        "dziecko": "child", "dzieci": "children", "dzieckiem": "child", "dziecmi": "children", "niemowle": "baby",
        "bobas": "baby", "maluch": "toddler", "rodzina": "family", "przyjaciele": "friends",
        "morze": "sea", "morzem": "sea", "morza": "sea", "ocean": "ocean", "jezioro": "lake", "jeziorem": "lake",
        "rzeka": "river", "rzeki": "river", "las": "forest", "lesie": "forest", "lasem": "forest",
        "gory": "mountains", "gorach": "mountains", "gorami": "mountains", "gora": "mountain", "szczyt": "mountain peak",
        "zachod": "sunset", "zachodzie": "sunset", "zachody": "sunsets", "wschod": "sunrise", "wschodzie": "sunrise",
        "slonca": "sun", "slonce": "sun", "sloncu": "sun", "niebo": "sky", "chmury": "clouds", "tecza": "rainbow",
        "snieg": "snow", "sniegu": "snow", "sniegiem": "snow", "deszcz": "rain", "deszczu": "rain", "mgla": "fog",
        "noc": "night", "miasto": "city", "miescie": "city", "ulica": "street", "ulicy": "street",
        "dom": "house", "domu": "home", "ogrod": "garden", "ogrodzie": "garden", "kuchnia": "kitchen", "kuchni": "kitchen",
        "samochod": "car", "samochodem": "car", "auto": "car", "autem": "car", "rower": "bicycle", "rowerze": "bicycle",
        "motor": "motorcycle", "motocykl": "motorcycle", "samolot": "airplane", "samolocie": "airplane",
        "lodz": "boat", "lodzi": "boat", "statek": "ship", "pociag": "train", "pociagu": "train", "autobus": "bus",
        "jedzenie": "food", "obiad": "dinner", "kolacja": "dinner", "sniadanie": "breakfast", "pizza": "pizza",
        "tort": "birthday cake", "tortem": "birthday cake", "ciasto": "cake", "kawa": "coffee", "kawy": "coffee",
        "wino": "wine", "piwo": "beer", "lody": "ice cream", "owoce": "fruit", "sushi": "sushi", "burger": "burger",
        "urodziny": "birthday party", "urodzinach": "birthday party", "slub": "wedding", "slubie": "wedding",
        "wesele": "wedding party", "weselu": "wedding party", "impreza": "party", "imprezie": "party",
        "koncert": "concert", "koncercie": "concert", "boze": "christmas", "choinka": "christmas tree",
        "choinki": "christmas tree", "prezenty": "gifts", "fajerwerki": "fireworks",
        "plaza": "beach", "plazy": "beach", "plazach": "beach", "basen": "swimming pool", "basenie": "swimming pool",
        "park": "park", "parku": "park", "zamek": "castle", "zamku": "castle", "kosciol": "church", "kosciele": "church",
        "most": "bridge", "moscie": "bridge", "wieza": "tower", "pomnik": "monument", "muzeum": "museum",
        "kwiaty": "flowers", "kwiat": "flower", "kwiatami": "flowers", "drzewo": "tree", "drzewa": "trees",
        "trawa": "grass", "pole": "field", "polu": "field", "wodospad": "waterfall", "jaskinia": "cave",
        "pustynia": "desert", "wyspa": "island", "wyspie": "island", "palmy": "palm trees", "palma": "palm tree",
        "usmiech": "smiling", "usmiechniety": "smiling", "usmiechnieta": "smiling", "smiech": "laughing",
        "selfie": "selfie", "grupowe": "group photo", "grupa": "group of people", "para": "couple",
        "paragon": "receipt", "paragony": "receipts", "faktura": "invoice", "faktury": "invoices",
        "dokument": "document", "dokumenty": "documents", "dowod": "id card", "paszport": "passport",
        "bilet": "ticket", "bilety": "tickets", "menu": "menu", "tablica": "sign", "napis": "text sign",
        "ksiazka": "book", "ksiazki": "books", "komputer": "computer", "telefon": "phone", "zegarek": "watch",
        "buty": "shoes", "sukienka": "dress", "garnitur": "suit", "okulary": "glasses", "kapelusz": "hat",
        "pilka": "ball", "mecz": "football match", "meczu": "football match", "narty": "skiing", "nartach": "skiing",
        "snowboard": "snowboarding", "plywanie": "swimming", "wspinaczka": "climbing", "spacer": "walk",
        "spacerze": "walk", "wycieczka": "trip", "wycieczce": "trip", "kemping": "camping", "namiot": "tent",
        "ognisko": "campfire", "grill": "barbecue", "grillu": "barbecue", "jacht": "yacht", "kajak": "kayak",
        "czarno": "black and white", "biale": "white", "czerwony": "red", "czerwona": "red", "niebieski": "blue",
        "zielony": "green", "zolty": "yellow", "rozowy": "pink", "zloty": "golden",
        "piekny": "beautiful", "piekne": "beautiful", "ladne": "beautiful", "smieszne": "funny",
        "stary": "old", "stare": "old", "nowy": "new", "maly": "small", "duzy": "big",
    ]

    /// The most common Ukrainian search words (folded: "й" → "и", "ї" → "і").
    private static let ukrainian: [String: String] = [
        "тварини": "animals", "тварина": "animal", "народження": "birthday party", "собака": "dog", "собаку": "dog", "собакою": "dog", "пес": "dog", "собаки": "dogs", "кіт": "cat", "кота": "cat",
        "котом": "cat", "коти": "cats", "кошеня": "kitten", "кінь": "horse", "коні": "horses", "птах": "bird", "птахи": "birds",
        "дитина": "child", "діти": "children", "дітьми": "children", "немовля": "baby", "сім'я": "family", "родина": "family",
        "друзі": "friends", "море": "sea", "моря": "sea", "морі": "sea", "океан": "ocean", "озеро": "lake", "озері": "lake",
        "річка": "river", "річці": "river", "ліс": "forest", "лісі": "forest", "гори": "mountains", "горах": "mountains",
        "гора": "mountain", "захід": "sunset", "світанок": "sunrise", "сонце": "sun", "небо": "sky", "хмари": "clouds",
        "веселка": "rainbow", "сніг": "snow", "снігу": "snow", "дощ": "rain", "туман": "fog", "місто": "city", "місті": "city",
        "вулиця": "street", "дім": "house", "вдома": "home", "сад": "garden", "кухня": "kitchen", "машина": "car",
        "автомобіль": "car", "велосипед": "bicycle", "літак": "airplane", "човен": "boat", "поізд": "train", "потяг": "train",
        "іжа": "food", "обід": "dinner", "вечеря": "dinner", "сніданок": "breakfast", "піца": "pizza", "торт": "birthday cake",
        "кава": "coffee", "вино": "wine", "пиво": "beer", "морозиво": "ice cream", "фрукти": "fruit",
        "весілля": "wedding", "свято": "party", "вечірка": "party", "концерт": "concert", "ялинка": "christmas tree",
        "подарунки": "gifts", "феєрверк": "fireworks", "пляж": "beach", "пляжі": "beach", "басеин": "swimming pool",
        "басейн": "swimming pool", "парк": "park", "замок": "castle", "церква": "church", "міст": "bridge", "вежа": "tower",
        "пам'ятник": "monument", "музеи": "museum", "квіти": "flowers", "квітка": "flower", "дерево": "tree",
        "дерева": "trees", "трава": "grass", "поле": "field", "водоспад": "waterfall", "острів": "island",
        "пальми": "palm trees", "усмішка": "smiling", "чек": "receipt", "чеки": "receipts", "рахунок": "invoice",
        "документ": "document", "документи": "documents", "паспорт": "passport", "квиток": "ticket", "квитки": "tickets",
        "меню": "menu", "книга": "book", "книжка": "book", "комп'ютер": "computer", "телефон": "phone", "годинник": "watch",
        "взуття": "shoes", "сукня": "dress", "окуляри": "glasses", "м'яч": "ball", "футбол": "football match",
        "лижі": "skiing", "плавання": "swimming", "прогулянка": "walk", "подорож": "trip", "намет": "tent",
        "багаття": "campfire", "гриль": "barbecue", "червоний": "red", "синіи": "blue", "зелении": "green",
        "жовтии": "yellow", "рожевии": "pink", "гарнии": "beautiful", "гарні": "beautiful", "смішні": "funny",
    ]

    /// Longer stems for inflected forms not listed above.
    private static let stems: [(String, String)] = [
        ("plaz", "beach"), ("zachod", "sunset"), ("wschod", "sunrise"), ("sniez", "snow"), ("snieg", "snow"),
        ("gorsk", "mountains"), ("jezior", "lake"), ("morsk", "sea"), ("lesn", "forest"), ("miejsk", "city"),
        ("urodzin", "birthday party"), ("weseln", "wedding"), ("slubn", "wedding"), ("swiateczn", "christmas"),
        ("samochod", "car"), ("rower", "bicycle"), ("samolot", "airplane"), ("pociag", "train"),
        ("kwiat", "flowers"), ("drzew", "trees"), ("zwierz", "animal"), ("dzieck", "child"), ("dzieci", "children"),
        ("paragon", "receipt"), ("faktur", "invoice"), ("dokument", "document"), ("jedzeni", "food"),
        ("koncert", "concert"), ("impre", "party"), ("basen", "swimming pool"), ("zamk", "castle"),
        ("koscio", "church"), ("wodospad", "waterfall"), ("ognisk", "campfire"), ("narciar", "skiing"),
    ]
}
