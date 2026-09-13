import Foundation

enum ReceiptParser {
    private static let nipRegex = try! NSRegularExpression(
        pattern: #"\bNIP[:\s]*(?:PL[\s-]*)?([0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{2}-[0-9]{2}|[0-9]{3}-[0-9]{2}-[0-9]{2}-[0-9]{3})\b"#,
        options: [.caseInsensitive]
    )
    private static let plNipRegex = try! NSRegularExpression(
        pattern: #"\bPL[\s-]*([0-9]{10})\b"#,
        options: [.caseInsensitive]
    )
    private static let documentNumberRegex = try! NSRegularExpression(
        pattern: #"\b(?:fv|faktura|paragon|nr)[:\s#]*([A-Z0-9][A-Z0-9\/-]{3,})\b"#,
        options: [.caseInsensitive]
    )

    private static let skipMerchant: [String] = [
        "paragon", "fiskalny", "faktura", "vat", "kopia", "oryginal", "oryginał",
        "nip", "data", "godz", "sprzedawca", "nabywca", "kasa", "www", "http",
        "regulamin", "dziekujemy", "dziękujemy", "zapraszamy", "numer"
    ]

    private static let merchants: [(name: String, category: ReceiptCategory, keys: [String])] = [
        ("Media Expert", .elektronika, ["media expert", "mediaexpert"]),
        ("MediaMarkt", .rtv, ["mediamarkt", "media markt"]),
        ("RTV Euro AGD", .rtv, ["euro agd", "rtv euro", "euro.com"]),
        ("x-kom", .elektronika, ["x-kom", "xkom"]),
        ("Apple", .elektronika, ["apple store", "istyle", "iSpot", "ispot"]),
        ("Samsung", .elektronika, ["samsung"]),
        ("Komputronik", .elektronika, ["komputronik"]),
        ("Neonet", .agd, ["neonet"]),
        ("Zelmer", .agd, ["zelmer"]),
        ("Dyson", .agd, ["dyson"]),
        ("Reserved", .ubrania, ["reserved"]),
        ("H&M", .ubrania, ["h&m", "h & m"]),
        ("Zara", .ubrania, ["zara"]),
        ("Cropp", .ubrania, ["cropp"]),
        ("House", .ubrania, ["house "]),
        ("Mohito", .ubrania, ["mohito"]),
        ("Sinsay", .ubrania, ["sinsay"]),
        ("CCC", .buty, ["ccc"]),
        ("Deichmann", .buty, ["deichmann"]),
        ("eobuwie", .buty, ["eobuwie"]),
        ("Empik", .rozrywka, ["empik"]),
        ("Helios", .rozrywka, ["helios"]),
        ("Cinema City", .rozrywka, ["cinema city"]),
        ("Biedronka", .spozywcze, ["biedronka"]),
        ("Lidl", .spozywcze, ["lidl"]),
        ("Kaufland", .spozywcze, ["kaufland"]),
        ("Aldi", .spozywcze, ["aldi"]),
        ("Carrefour", .spozywcze, ["carrefour"]),
        ("Auchan", .spozywcze, ["auchan"]),
        ("Dino", .spozywcze, ["dino"]),
        ("Netto", .spozywcze, ["netto"]),
        ("Stokrotka", .spozywcze, ["stokrotka"]),
        ("Żabka", .spozywcze, ["zabka", "żabka"]),
        ("Rossmann", .zdrowie, ["rossmann"]),
        ("DOZ", .zdrowie, ["doz "]),
        ("Gemini", .zdrowie, ["gemini"]),
        ("IKEA", .dom, ["ikea"]),
        ("Castorama", .dom, ["castorama"]),
        ("Leroy Merlin", .dom, ["leroy merlin", "leroymerlin"]),
        ("OBI", .dom, ["obi"]),
        ("Jysk", .dom, ["jysk"]),
        ("Pepco", .dom, ["pepco"]),
        ("Action", .dom, ["action"]),
        ("Orlen", .paliwo, ["orlen"]),
        ("BP", .paliwo, ["bp "]),
        ("Shell", .paliwo, ["shell"]),
        ("Circle K", .paliwo, ["circle k"]),
        ("Inter Cars", .samochod, ["inter cars"]),
        ("Q Service", .samochod, ["q service"]),
        ("Smyk", .dzieci, ["smyk"]),
        ("Decathlon", .sport, ["decathlon"]),
        ("4F", .sport, [" 4f", "4f "]),
        ("InPost", .uslugi, ["inpost"]),
        ("Poczta Polska", .uslugi, ["poczta polska"])
    ]

    private static let itemSkip: [String] = [
        "paragon", "fiskalny", "faktura", "vat", "kopia", "oryginal", "oryginał",
        "nip", "data", "godz", "sprzedawca", "nabywca", "kasa", "www", "http",
        "regulamin", "dziekujemy", "dziękujemy", "zapraszamy", "numer",
        "towar lub", "usluga", "usługa", "wartosc", "wartość", "stawka",
        "cena jedn", "liczba", "zaplacono", "zapłacono", "razem", "suma",
        "szt", "brutto", "netto", "ptu", "bdo", "nabywca", "sprzedawca",
        "spolka", "spółka", "ograniczona", "odpowiedzialnoscia", "ul.", "ulica"
    ]

    private static let categoryKeywords: [(ReceiptCategory, [String])] = [
        (.elektronika, [
            "laptop", "notebook", "smartfon", "iphone", "ipad", "telefon", "konsola",
            "usb", "router", "słuchawki", "sluchawki", "kamera", "camera", "hub",
            "aqara", "xiaomi", "smartwatch", "zegarek", "dysk", "ssd", "pendrive",
            "klawiatura", "mysz", "powerbank", "ładowark", "ladowark", "monitor",
            "tablet", "drukarka", "czujnik", "gniazdko", "inteligentn", "yeelight",
            "laserjet", "oswietl", "oświetl"
        ]),
        (.rtv, ["telewizor", "tv ", "soundbar", "kino domowe", "projektor"]),
        (.agd, [
            "pralka", "lodowka", "lodówka", "odkurzacz", "zmywarka", "piekarnik", "mikrofal", "ekspres", "czajnik",
            "dyson", "vacuum", "dtslim", "v12", "v15", "v11", "v10"
        ]),
        (.samochod, ["olej silnik", "klocki ham", "filtr kabin", "opony", "akumulator", "plyn do spryski"]),
        (.paliwo, ["benzyna", "on ", "diesel", "lpg", "paliwo"]),
        (.ubrania, ["koszula", "spodnie", "kurtka", "sukienka", "bluza", "t-shirt", "tshirt"]),
        (.buty, ["buty", "sneakers", "kozaki", "sandały", "sandaly"]),
        (.rozrywka, ["bilet", "gra ", "dvd", "blu-ray", "koncert"]),
        (.spozywcze, ["mleko", "chleb", "maslo", "masło", "jogurt", "woda niegaz"]),
        (.zdrowie, ["leki", "witamina", "plaster", "syrop"]),
        (.dom, ["farba", "wiertarka", "srubka", "śruba", "lampa", "polka", "półka"]),
        (.dzieci, ["pieluch", "smoczek", "zabawk"]),
        (.sport, ["hantel", "rower", "mata do cwiczen"]),
        (.uslugi, ["usługa", "usluga", "naprawa", "abonament"])
    ]

    static func parse(
        lines: [String],
        barcodes: [DetectedBarcode] = [],
        now: Date = .now,
        calendar: Calendar = Calendar(identifier: .gregorian)
    ) -> ReceiptDraft {
        var calendar = calendar
        calendar.timeZone = TimeZone(identifier: "Europe/Warsaw") ?? .current
        let text = lines.joined(separator: "\n")
        let merchant = parseMerchant(lines: lines)
        let nip = parseNIP(in: text)
        let money = parseMoney(in: text)
        let amount = money.gross
        let tax = money.vat
        let dates = parseIssuedDates(in: text, calendar: calendar)
        let issued = dates.first ?? calendar.startOfDay(for: now)
        let documentType: ReceiptDocumentType = fold(text).contains("faktura") ? .invoice : .receipt
        let number = parseDocumentNumber(in: text) ?? barcodes.first?.payload ?? ""
        let payment = parsePayment(in: text)
        let items = uniquedItems(parseItems(lines: lines))
        let itemName = items.joined(separator: " · ")
        let category = inferCategory(merchant: merchant, items: items, text: text)
        let warranty = category.warrantyMonths.flatMap { calendar.date(byAdding: .month, value: $0, to: issued) }
        let returning = category.returnDays.flatMap { calendar.date(byAdding: .day, value: $0, to: issued) }
        var confidence = 0.2
        if merchant.isEmpty == false { confidence += 0.25 }
        if amount > 0 { confidence += 0.3 }
        if dates.isEmpty == false { confidence += 0.15 }
        if nip.isEmpty == false { confidence += 0.1 }

        return ReceiptDraft(
            merchantName: merchant,
            merchantNIP: nip,
            amount: amount,
            taxAmount: tax,
            issuedAt: issued,
            category: category,
            documentType: documentType,
            documentNumber: number,
            payment: payment,
            itemName: itemName,
            ocrText: text,
            ocrConfidence: min(confidence, 1),
            issuedWasPrinted: dates.isEmpty == false,
            warrantyUntil: warranty,
            returnUntil: returning
        )
    }

    static func parseMerchant(lines: [String]) -> String {
        let full = lines.joined(separator: "\n")
        let seller = fold(sellerSlice(of: full))
        let joined = fold(full)
        for merchant in merchants {
            if merchant.keys.contains(where: { matchesMerchantKey(seller, key: $0) }) {
                return merchant.name
            }
        }
        for merchant in merchants {
            if merchant.keys.contains(where: { matchesMerchantKey(joined, key: $0) }) {
                return merchant.name
            }
        }
        if let company = sellerCompanyName(in: sellerSlice(of: full)) {
            return company
        }
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmed.count >= 3, trimmed.count <= 42 else { continue }
            let folded = fold(trimmed)
            if skipMerchant.contains(where: { folded.contains($0) }) { continue }
            if trimmed.contains(where: \.isLetter) == false { continue }
            if folded.contains("nip") { continue }
            if folded.contains("netto") || folded.contains("brutto") { continue }
            return trimmed
        }
        return ""
    }

    static func parseNIP(in text: String) -> String {
        let sellerPart = sellerSlice(of: text)
        if let nip = firstNIP(in: sellerPart) {
            return nip
        }
        return firstNIP(in: text) ?? ""
    }

    static func parseAmount(in text: String) -> Double {
        parseMoney(in: text).gross
    }

    static func parseItems(lines: [String]) -> [String] {
        var items: [String] = []
        var inTable = false
        var skippingBuyer = false
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmed.isEmpty == false else { continue }
            let folded = fold(trimmed)
            if folded.contains("nabywca") {
                skippingBuyer = true
                continue
            }
            if folded.contains("towar lub") || folded.contains("nazwa towar") || folded.hasPrefix("lp.")
                || (folded.contains("nazwa") && (folded.contains("ilosc") || folded.contains("ilość") || folded.contains("stawka") || folded.contains("lp"))) {
                skippingBuyer = false
                inTable = true
                continue
            }
            if skippingBuyer { continue }
            if folded.contains("wartosc faktury") || folded.contains("wartość faktury")
                || folded.hasPrefix("zaplacono") || folded.hasPrefix("zapłacono")
                || folded.hasPrefix("razem") || folded.hasPrefix("suma") {
                if items.isEmpty == false { break }
                inTable = false
                continue
            }
            guard let cleaned = cleanedItemName(trimmed) else { continue }
            let cleanedFold = fold(cleaned)
            if itemSkip.contains(where: { skip in
                skip.count <= 6
                    ? cleanedFold.split(whereSeparator: { $0.isWhitespace || $0.isPunctuation }).contains { $0 == skip }
                    : cleanedFold.contains(skip)
            }) { continue }
            if cleanedFold.range(of: #"\d{2}-\d{3}"#, options: .regularExpression) != nil { continue }
            let hadPrice = trimmed.range(of: #"\d+[.,]\d{2}"#, options: .regularExpression) != nil
            let isProduct = looksLikeItem(cleaned) && (inTable || hadPrice || categoryFromKeywords(cleaned) != nil)
            guard isProduct else { continue }
            if let last = items.last, itemsLookSame(last, cleaned) {
                if cleaned.count > last.count {
                    items[items.count - 1] = cleaned
                }
                continue
            }
            if let last = items.last, shouldMergeItem(previous: last, next: cleaned) {
                items[items.count - 1] = last + " " + cleaned
            } else {
                items.append(cleaned)
            }
        }
        return items
    }

    static func collapsedItemName(_ raw: String) -> String {
        uniquedItems(splitItemChunks(raw)).joined(separator: " · ")
    }

    static func uniquedItems(_ items: [String]) -> [String] {
        var kept: [String] = []
        for item in items {
            let trimmed = item.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmed.count >= 4 else { continue }
            if let index = kept.firstIndex(where: { itemsLookSame($0, trimmed) }) {
                if trimmed.count > kept[index].count {
                    kept[index] = trimmed
                }
            } else {
                kept.append(trimmed)
            }
        }
        return kept
    }

    static func inferCategory(merchant: String, text: String) -> ReceiptCategory {
        inferCategory(merchant: merchant, items: parseItems(lines: text.components(separatedBy: "\n")), text: text)
    }

    static func inferCategory(merchant: String, items: [String], text: String) -> ReceiptCategory {
        if let fromItems = categoryFromKeywords(items.joined(separator: "\n")) {
            return fromItems
        }
        let merchantHaystack = fold(merchant)
        for merchantRule in merchants {
            if merchantRule.keys.contains(where: { merchantHaystack.contains($0) }) {
                return merchantRule.category
            }
        }
        return categoryFromKeywords(text) ?? .inne
    }

    static func applyCategoryDates(category: ReceiptCategory, issuedAt: Date, calendar: Calendar = .current) -> (warranty: Date?, returning: Date?) {
        var calendar = calendar
        calendar.timeZone = TimeZone(identifier: "Europe/Warsaw") ?? .current
        let warranty = category.warrantyMonths.flatMap { calendar.date(byAdding: .month, value: $0, to: issuedAt) }
        let returning = category.returnDays.flatMap { calendar.date(byAdding: .day, value: $0, to: issuedAt) }
        return (warranty, returning)
    }

    private static func parseVAT(in text: String) -> Double {
        parseMoney(in: text).vat
    }

    private static func parseDocumentNumber(in text: String) -> String? {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        let labeled = try! NSRegularExpression(
            pattern: #"(?:faktura(?:\s+vat)?(?:\s+numer)?|nr(?:\s*faktury)?|numer(?:\s+faktury)?)[:\s#]*([0-9]{6,})"#,
            options: [.caseInsensitive]
        )
        if let match = labeled.firstMatch(in: text, range: range), match.numberOfRanges >= 2 {
            return ns.substring(with: match.range(at: 1))
        }
        guard let match = documentNumberRegex.firstMatch(in: text, range: range), match.numberOfRanges >= 2 else {
            return nil
        }
        return ns.substring(with: match.range(at: 1))
    }

    private static func parsePayment(in text: String) -> ReceiptPaymentMethod {
        let folded = fold(text)
        let cash = paymentAmount(after: ["gotowka", "gotowke", "gotowk", "cash"], in: folded)
        let card = paymentAmount(after: ["karta", "visa", "mastercard", "apple pay", "google pay"], in: folded)
        if cash > 0, card > 0 {
            return card >= cash ? .card : .cash
        }
        let section = paymentSection(from: folded)
        if let fromSection = payment(inFolded: section), fromSection != .unknown {
            return fromSection
        }
        return payment(inFolded: folded) ?? .unknown
    }

    private static func paymentAmount(after labels: [String], in folded: String) -> Double {
        var best: Double = 0
        for label in labels {
            var search = folded.startIndex
            while let range = folded.range(of: label, range: search..<folded.endIndex) {
                let window = String(folded[range.upperBound...].prefix(18))
                let value = parseMoney(in: window).gross
                if value > best {
                    best = value
                }
                search = range.upperBound
            }
        }
        return best
    }

    private static func paymentSection(from folded: String) -> String {
        let markers = ["zaplacono", "zapłata", "platnosc", "płatnosc", "forma platnosci", "sposob zaplaty"]
        var best: String.Index?
        for marker in markers {
            if let range = folded.range(of: marker) {
                if best == nil || range.lowerBound < best! {
                    best = range.lowerBound
                }
            }
        }
        guard let start = best else { return folded }
        return String(folded[start...])
    }

    private static func payment(inFolded folded: String) -> ReceiptPaymentMethod? {
        if containsToken(folded, needles: ["blik"]) { return .blik }
        if containsToken(folded, needles: ["przelew"]) { return .transfer }
        if looksLikeCash(folded) { return .cash }
        if containsToken(folded, needles: ["karta", "visa", "mastercard", "apple pay", "google pay"]) { return .card }
        return nil
    }

    private static func looksLikeCash(_ folded: String) -> Bool {
        if folded.contains("gotowk") || folded.contains("gotowka") || folded.contains("gotowke") { return true }
        if folded.contains("cash") || folded.contains("got.") { return true }
        let tokens = folded.split(whereSeparator: { $0.isWhitespace || $0.isPunctuation }).map(String.init)
        return tokens.contains { token in
            guard token.count >= 4, token.count <= 10 else { return false }
            return levenshtein(token, "gotowka") <= 2 || levenshtein(token, "gotowke") <= 2
        }
    }

    private static func containsToken(_ folded: String, needles: [String]) -> Bool {
        needles.contains(where: { folded.contains($0) })
    }

    private static func sellerSlice(of text: String) -> String {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        let buyer = try! NSRegularExpression(pattern: #"nabywca"#, options: [.caseInsensitive])
        if let match = buyer.firstMatch(in: text, range: range) {
            return ns.substring(to: match.range.location)
        }
        return text
    }

    private static func firstNIP(in text: String) -> String? {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        if let match = nipRegex.firstMatch(in: text, range: range), match.numberOfRanges >= 2 {
            return ns.substring(with: match.range(at: 1)).filter(\.isNumber)
        }
        if let match = plNipRegex.firstMatch(in: text, range: range), match.numberOfRanges >= 2 {
            return ns.substring(with: match.range(at: 1)).filter(\.isNumber)
        }
        return nil
    }

    private static func categoryFromKeywords(_ text: String) -> ReceiptCategory? {
        let haystack = fold(text)
        for (category, keys) in categoryKeywords {
            if keys.contains(where: { haystack.contains($0) }) {
                return category
            }
        }
        return nil
    }

    private static func cleanedItemName(_ line: String) -> String? {
        var value = line.trimmingCharacters(in: .whitespacesAndNewlines)
        value = value.replacingOccurrences(of: #"^\d{1,3}[\.\)]\s+"#, with: "", options: .regularExpression)
        value = value.replacingOccurrences(of: #"^\d{1,3}\s+(?=[A-Z0-9])"#, with: "", options: .regularExpression)
        value = value.replacingOccurrences(of: #"\s+\d+\*\d+(?:[.,]\d{2})?"#, with: "", options: .regularExpression)
        value = value.replacingOccurrences(of: #"\s+\d{1,3}(?:,\d{3})+\.\d{2}A?"#, with: "", options: .regularExpression)
        value = value.replacingOccurrences(of: #"\s+\d+(?:[.,]\d{2})A?(?:\s+\d+(?:[.,]\d{2})A?)*\s*$"#, with: "", options: .regularExpression)
        value = value.replacingOccurrences(of: #"\s+\d+\s*(?:szt|szt\.|kg|g|l|mb|ea)\b.*"#, with: "", options: [.regularExpression, .caseInsensitive])
        value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let folded = fold(value)
        if folded.range(of: #"^\d+\s*(szt|kg|g|l)\b"#, options: .regularExpression) != nil { return nil }
        guard value.count >= 4, value.count <= 120 else { return nil }
        return value
    }

    private static func looksLikeItem(_ name: String) -> Bool {
        let letters = name.filter(\.isLetter).count
        guard letters >= 4 else { return false }
        let folded = fold(name)
        if folded.contains("nip") || folded.contains("http") || folded.contains("www") { return false }
        if name.filter(\.isNumber).count > max(letters * 2, 8) { return false }
        return true
    }

    private static func shouldMergeItem(previous: String, next: String) -> Bool {
        next.count <= 24 && next.contains(where: \.isLetter) && next.filter(\.isNumber).count < 4
            && previous.count <= 64 && itemsLookSame(previous, next) == false
    }

    private static func splitItemChunks(_ raw: String) -> [String] {
        raw
            .replacingOccurrences(of: " · ", with: "\u{1e}")
            .replacingOccurrences(of: " - ", with: "\u{1e}")
            .split(separator: "\u{1e}")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.isEmpty == false }
    }

    static func itemsLookSame(_ a: String, _ b: String) -> Bool {
        let first = fold(a)
        let second = fold(b)
        if first == second { return true }
        if first.count >= 8, second.count >= 8, first.contains(second) || second.contains(first) {
            return true
        }
        let limit = max(2, min(first.count, second.count) / 5)
        return levenshtein(first, second) <= limit
    }

    private static func levenshtein(_ a: String, _ b: String) -> Int {
        let aChars = Array(a)
        let bChars = Array(b)
        if aChars.isEmpty { return bChars.count }
        if bChars.isEmpty { return aChars.count }
        var prev = Array(0...bChars.count)
        var current = Array(repeating: 0, count: bChars.count + 1)
        for (i, aChar) in aChars.enumerated() {
            current[0] = i + 1
            for (j, bChar) in bChars.enumerated() {
                let cost = aChar == bChar ? 0 : 1
                current[j + 1] = min(prev[j + 1] + 1, current[j] + 1, prev[j] + cost)
            }
            prev = current
        }
        return prev[bChars.count]
    }

    private static func amountValue(whole: String, fraction: String) -> Double? {
        let compact = whole
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00a0}", with: "")
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: ".", with: "")
        let value = (Double(compact) ?? 0) + (Double(fraction) ?? 0) / 100
        guard value > 0, value <= 1_000_000 else { return nil }
        return value
    }

    private static func matchesMerchantKey(_ haystack: String, key: String) -> Bool {
        let needle = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard needle.isEmpty == false, haystack.contains(needle) else { return false }
        if needle == "netto" {
            return isGroceryNetto(haystack)
        }
        if needle.count <= 4 {
            let pattern = "(?<![a-z0-9])\(NSRegularExpression.escapedPattern(for: needle))(?![a-z0-9])"
            return haystack.range(of: pattern, options: .regularExpression) != nil
        }
        return true
    }

    private static func isGroceryNetto(_ haystack: String) -> Bool {
        haystack.range(
            of: #"(?m)(^|\n)\s*netto(\s+sp|\s+sklep|\s*$)"#,
            options: .regularExpression
        ) != nil
            || haystack.contains("sklep netto")
            || haystack.contains("netto sp")
    }

    private static func sellerCompanyName(in text: String) -> String? {
        let lines = text.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            let folded = fold(trimmed)
            guard folded.contains("sp. z") || folded.contains("sp z o") || folded.contains("spolka") else { continue }
            let brand = trimmed.split(whereSeparator: { $0.isWhitespace }).first.map(String.init) ?? trimmed
            if brand.count >= 3, skipMerchant.contains(where: { fold(brand).contains($0) }) == false {
                return brand
            }
        }
        return nil
    }

    private struct MoneyParse {
        var gross: Double
        var vat: Double
    }

    private enum MoneyKind {
        case payable
        case gross
        case net
        case vat
        case rate
        case other
    }

    private static func parseMoney(in text: String) -> MoneyParse {
        let hits = moneyHits(in: text)
        let payable = hits.filter { $0.kind == .payable || $0.kind == .gross }.map(\.value)
        let net = hits.filter { $0.kind == .net }.map(\.value)
        let vatHits = hits.filter { $0.kind == .vat }.map(\.value)
        let other = hits.filter { $0.kind == .other }.map(\.value)
        var gross = payable.max() ?? 0
        if gross == 0 {
            gross = other.max() ?? 0
        }
        if let bigger = other.max(), gross > 0, bigger > gross * 1.35 {
            gross = bigger
        }
        if gross == 0, let netValue = net.max(), let vatValue = vatHits.max() {
            gross = netValue + vatValue
        }
        var vat = vatHits.filter { $0 < max(gross * 0.45, 1) }.max() ?? 0
        if isVATRate(vat), gross > 40 {
            vat = vatHits.filter { isVATRate($0) == false && $0 < gross * 0.45 }.max() ?? 0
        }
        if vat == 0, gross > 40, let netValue = net.max(), netValue < gross {
            vat = ((gross - netValue) * 100).rounded() / 100
        }
        return MoneyParse(gross: gross, vat: vat)
    }

    private static func isVATRate(_ value: Double) -> Bool {
        [0, 5, 7, 8, 23].contains { abs(value - $0) < 0.001 }
    }

    private static func moneyHits(in text: String) -> [(value: Double, kind: MoneyKind)] {
        let ns = text as NSString
        var consumed = IndexSet()
        var hits: [(value: Double, kind: MoneyKind)] = []
        let patterns: [String] = [
            #"(?<![\d.,])(\d{1,3}(?:,\d{3})+)\.(\d{2})"#,
            #"(?<![\d.,])(\d{1,3}(?:[ \u00a0]\d{3})+),(\d{2})"#,
            #"(?<![\d.,])(\d{1,3}(?:\.\d{3})+),(\d{2})"#,
            #"(?<![\d.,])(\d{1,7})[.,](\d{2})A?(?![.,]\d)"#
        ]
        for pattern in patterns {
            let regex = try! NSRegularExpression(pattern: pattern, options: [])
            regex.enumerateMatches(in: text, range: NSRange(location: 0, length: ns.length)) { match, _, _ in
                guard let match, match.numberOfRanges >= 3 else { return }
                let full = match.range
                if let span = Range(full), consumed.intersection(IndexSet(integersIn: span)).isEmpty == false {
                    return
                }
                guard let value = amountValue(
                    whole: ns.substring(with: match.range(at: 1)),
                    fraction: ns.substring(with: match.range(at: 2))
                ) else { return }
                if let span = Range(full) {
                    consumed.insert(integersIn: span)
                }
                let lineRange = ns.lineRange(for: full)
                let offset = max(0, full.location - lineRange.location)
                let line = ns.substring(with: lineRange)
                let prefix = fold(String(line.prefix(offset)))
                hits.append((value, classifyMoney(prefix: prefix, value: value)))
            }
        }
        return hits
    }

    private static func classifyMoney(prefix: String, value: Double) -> MoneyKind {
        let local = fold(prefix)
        if isVATRate(value), local.contains("stawka") || local.contains("%") || local.contains("ptu") || local.contains("vat") {
            return .rate
        }
        if local.contains("suma ptu") || local.contains("suma vat") || local.contains("suma podatku")
            || local.contains("kwota podatku") || local.contains("ptu:") || local.contains("ptu ") {
            return .vat
        }
        if local.contains("do zaplaty") || local.contains("wartosc faktury")
            || local.contains("zaplacono") || local.contains("suma pln") || local.contains("suma:")
            || local.contains("razem do") || (local.contains("razem") && local.contains("brutto")) {
            return .payable
        }
        if local.contains("suma"), local.contains("ptu") == false, local.contains("vat") == false, local.contains("podatek") == false {
            return .payable
        }
        if local.contains("wartosc brutto") || local.contains("gross") {
            return .gross
        }
        if local.contains("wartosc netto") || local.contains("cena netto") || local.contains("cena jednostkowa") {
            return .net
        }
        if (local.contains("vat") || local.contains("ptu") || local.contains("podatek")) && isVATRate(value) == false {
            return .vat
        }
        if local.contains("razem") {
            return local.contains("netto") ? .net : .payable
        }
        return .other
    }

    private static func parseIssuedDates(in text: String, calendar: Calendar) -> [Date] {
        let folded = fold(text)
        let labels = [
            "data sprzedazy",
            "data wystawienia faktury",
            "data wystawienia",
            "data zakupu",
            "sprzedano dnia"
        ]
        for label in labels {
            if let range = folded.range(of: label) {
                let window = String(folded[range.upperBound...].prefix(72))
                let dates = VoucherParser.parseDates(in: window, calendar: calendar)
                if dates.isEmpty == false {
                    return dates
                }
            }
        }
        var cleaned = folded
        let skipped = ["fault report date", "fault report", "termin platnosci", "data waznosci"]
        for skip in skipped {
            while let range = cleaned.range(of: skip) {
                let end = cleaned.index(range.upperBound, offsetBy: 56, limitedBy: cleaned.endIndex) ?? cleaned.endIndex
                cleaned.replaceSubrange(range.lowerBound..<end, with: " ")
            }
        }
        return VoucherParser.parseDates(in: cleaned, calendar: calendar)
    }

    private static func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
    }
}
