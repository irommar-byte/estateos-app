import Foundation

enum ObjectSearch {
    static let synonyms: [String: [String]] = [
        "samochód": ["car", "automobile"],
        "samochod": ["car", "automobile"],
        "auto": ["car", "automobile"],
        "auta": ["car", "automobile"],
        "pies": ["dog", "canine", "puppy"],
        "psa": ["dog", "canine", "puppy"],
        "psy": ["dog", "canine", "puppy"],
        "kot": ["cat", "kitten"],
        "kota": ["cat", "kitten"],
        "koty": ["cat", "kitten"],
        "plaża": ["beach", "coast", "seashore"],
        "plaza": ["beach", "coast", "seashore"],
        "morze": ["beach", "ocean", "sea", "coast"],
        "góry": ["mountain", "cliff", "alp"],
        "gory": ["mountain", "cliff", "alp"],
        "las": ["forest", "woodland", "tree"],
        "jedzenie": ["food", "meal", "dish"],
        "tort": ["cake", "dessert"],
        "ciasto": ["cake", "dessert"],
        "kwiat": ["flower", "blossom"],
        "kwiaty": ["flower", "blossom"],
        "zachód": ["sunset", "sun"],
        "zachod": ["sunset", "sun"],
        "niebo": ["sky"],
        "śnieg": ["snow"],
        "snieg": ["snow"],
        "rower": ["bicycle", "bike"],
        "motocykl": ["motorcycle"],
        "pociąg": ["train"],
        "pociag": ["train"],
        "samolot": ["airplane", "aircraft"],
        "most": ["bridge"],
        "budynek": ["building"],
        "dom": ["house", "home"],
        "dziecko": ["baby", "child"],
        "niemowlę": ["baby"],
        "niemowle": ["baby"]
    ]

    static func match(photos: [PhotoRef], labels: [String: [String]], query: String) -> [String] {
        let tokens = query
            .lowercased()
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "pl_PL"))
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
        let meaningful = tokens.filter { isKnown($0) }
        guard !meaningful.isEmpty else { return [] }
        return photos.compactMap { photo in
            meaningful.allSatisfy { tokenMatches($0, photo: photo, labels: labels[photo.id] ?? []) } ? photo.id : nil
        }
    }

    static func isObjectQuery(_ query: String) -> Bool {
        let tokens = query
            .lowercased()
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "pl_PL"))
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map(String.init)
        return tokens.contains { synonyms[$0] != nil }
    }

    private static func isKnown(_ token: String) -> Bool {
        if synonyms[token] != nil { return true }
        if kind(for: token) != nil { return true }
        if token.count == 4, Int(token) != nil { return true }
        return false
    }

    private static func tokenMatches(_ token: String, photo: PhotoRef, labels: [String]) -> Bool {
        if let year = Int(token), token.count == 4 {
            return Calendar.current.component(.year, from: photo.created) == year
        }
        if let trait = kind(for: token) {
            if trait == .favorite { return photo.isFavorite }
            return photo.traits.contains(trait)
        }
        let wanted = Set(synonyms[token] ?? [])
        return labels.contains { wanted.contains($0) }
    }

    private static func kind(for token: String) -> PhotoTraits? {
        switch token {
        case "wideo", "film", "filmy", "video":
            return .video
        case "selfie", "selfies":
            return .selfie
        case "live", "zywe":
            return .live
        case "zrzut", "zrzuty", "screenshot", "screenshots":
            return .screenshot
        case "panorama", "panoramy":
            return .panorama
        case "portret", "portrety":
            return .portrait
        case "ulubione", "ulubionych":
            return .favorite
        case "raw":
            return .raw
        default:
            return nil
        }
    }
}

private extension PhotoTraits {
    static let favorite = PhotoTraits(rawValue: 1 << 10)
}
