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
    private static let sumRegex = try! NSRegularExpression(
        pattern: #"(?:suma|razem|do zaplaty|do zapłaty|wartosc faktury|wartość faktury|gross|total|brutto)[^\d]{0,24}(\d{1,3}(?:[ \u00a0]\d{3})*|\d{1,7})[.,](\d{2})"#,
        options: [.caseInsensitive]
    )
    private static let currencyAmountRegex = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,3}(?:[ \u00a0]\d{3})*|\d{1,7})[.,](\d{2})\s*(?:zł|pln|zl|zt)\b"#,
        options: [.caseInsensitive]
    )
    private static let vatRegex = try! NSRegularExpression(
        pattern: #"(?:VAT|PTU)[^\d]{0,12}(\d{1,5})[.,](\d{2})"#,
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
            "tablet", "drukarka", "czujnik", "gniazdko", "inteligentn"
        ]),
        (.rtv, ["telewizor", "tv ", "soundbar", "kino domowe", "projektor"]),
        (.agd, ["pralka", "lodowka", "lodówka", "odkurzacz", "zmywarka", "piekarnik", "mikrofal", "ekspres", "czajnik"]),
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
        let amount = parseAmount(in: text)
        let tax = parseVAT(in: text)
        let dates = VoucherParser.parseDates(in: text, calendar: calendar)
        let issued = dates.first ?? calendar.startOfDay(for: now)
        let documentType: ReceiptDocumentType = fold(text).contains("faktura") ? .invoice : .receipt
        let number = parseDocumentNumber(in: text) ?? barcodes.first?.payload ?? ""
        let payment = parsePayment(in: text)
        let items = parseItems(lines: lines)
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
        let joined = fold(lines.joined(separator: "\n"))
        for merchant in merchants {
            if merchant.keys.contains(where: { joined.contains($0) }) {
                return merchant.name
            }
        }
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard trimmed.count >= 3, trimmed.count <= 42 else { continue }
            let folded = fold(trimmed)
            if skipMerchant.contains(where: { folded.contains($0) }) { continue }
            if trimmed.contains(where: \.isLetter) == false { continue }
            if folded.contains("nip") { continue }
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
        let folded = fold(text)
        if let fromSum = firstAmount(in: folded, regex: sumRegex) {
            return fromSum
        }
        return amountCandidates(in: text).max() ?? 0
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
            if folded.contains("towar lub") || folded.contains("nazwa towar") || folded.hasPrefix("lp.") {
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
            if itemSkip.contains(where: { cleanedFold.contains($0) }) { continue }
            if cleanedFold.range(of: #"\d{2}-\d{3}"#, options: .regularExpression) != nil { continue }
            let hadPrice = trimmed.range(of: #"\d+[.,]\d{2}"#, options: .regularExpression) != nil
            let isProduct = looksLikeItem(cleaned) && (inTable || hadPrice || categoryFromKeywords(cleaned) != nil)
            guard isProduct else { continue }
            if let last = items.last, shouldMergeItem(previous: last, next: cleaned) {
                items[items.count - 1] = last + " " + cleaned
            } else {
                items.append(cleaned)
            }
        }
        return items
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
        firstAmount(in: fold(text), regex: vatRegex) ?? 0
    }

    private static func parseDocumentNumber(in text: String) -> String? {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = documentNumberRegex.firstMatch(in: text, range: range), match.numberOfRanges >= 2 else {
            return nil
        }
        return ns.substring(with: match.range(at: 1))
    }

    private static func parsePayment(in text: String) -> ReceiptPaymentMethod {
        let folded = fold(text)
        let section = paymentSection(from: folded)
        if let fromSection = payment(inFolded: section), fromSection != .unknown {
            return fromSection
        }
        return payment(inFolded: folded) ?? .unknown
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
        value = value.replacingOccurrences(of: #"\s+\d+(?:[.,]\d{2})(?:\s+\d+(?:[.,]\d{2}))*\s*$"#, with: "", options: .regularExpression)
        value = value.replacingOccurrences(of: #"\s+\d+\s*(?:szt|szt\.|kg|g|l|mb)\b.*"#, with: "", options: [.regularExpression, .caseInsensitive])
        value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let folded = fold(value)
        if folded.range(of: #"^\d+\s*(szt|kg|g|l)\b"#, options: .regularExpression) != nil { return nil }
        guard value.count >= 4, value.count <= 90 else { return nil }
        return value
    }

    private static func looksLikeItem(_ name: String) -> Bool {
        let letters = name.filter(\.isLetter).count
        guard letters >= 4 else { return false }
        let folded = fold(name)
        if folded.contains("nip") || folded.contains("http") || folded.contains("www") { return false }
        if name.filter(\.isNumber).count > letters { return false }
        return true
    }

    private static func shouldMergeItem(previous: String, next: String) -> Bool {
        next.count <= 24 && next.contains(where: \.isLetter) && next.filter(\.isNumber).count < 4
            && previous.count <= 64
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

    private static func amountCandidates(in text: String) -> [Double] {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        var values: [Double] = []
        currencyAmountRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 3 else { return }
            if let value = amountValue(whole: ns.substring(with: match.range(at: 1)), fraction: ns.substring(with: match.range(at: 2))) {
                values.append(value)
            }
        }
        return values
    }

    private static func firstAmount(in text: String, regex: NSRegularExpression) -> Double? {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = regex.firstMatch(in: text, range: range), match.numberOfRanges >= 3 else { return nil }
        return amountValue(whole: ns.substring(with: match.range(at: 1)), fraction: ns.substring(with: match.range(at: 2)))
    }

    private static func amountValue(whole: String, fraction: String) -> Double? {
        let compact = whole.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\u{00a0}", with: "")
        let value = (Double(compact) ?? 0) + (Double(fraction) ?? 0) / 100
        guard value > 0, value <= 1_000_000 else { return nil }
        return value
    }

    private static func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
    }
}
