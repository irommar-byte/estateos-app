import Foundation

struct DetectedBarcode: Equatable {
    var payload: String
    var symbology: BarcodeSymbology
}

struct VoucherDraft: Equatable {
    var retailerID: String
    var amount: Double
    var issuedAt: Date
    var expiresAt: Date?
    var barcodePayload: String
    var barcodeSymbology: BarcodeSymbology
    var ticketNumber: String
    var ocrText: String
    var ocrConfidence: Double
    var expiryWasPrinted: Bool
    var issuedWasPrinted: Bool

    var scanIsComplete: Bool {
        amount > 0 && issuedWasPrinted && barcodePayload.isEmpty == false
    }

    func isExpired(now: Date = .now) -> Bool {
        guard let expiresAt else { return false }
        return expiresAt < now
    }

    static func blank(now: Date = .now) -> VoucherDraft {
        VoucherDraft(
            retailerID: "unknown",
            amount: 0,
            issuedAt: now,
            expiresAt: nil,
            barcodePayload: "",
            barcodeSymbology: .unknown,
            ticketNumber: "",
            ocrText: "",
            ocrConfidence: 0,
            expiryWasPrinted: false,
            issuedWasPrinted: false
        )
    }
}

enum VoucherParser {
    private static let amountWithCurrencyRegex = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,4})[.,](\d{2})\s*(?:zł|pln|zl|zt)\b"#,
        options: [.caseInsensitive]
    )
    private static let integerZlotyRegex = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,4})\s*(?:zł|pln|zl|zt)\b"#,
        options: [.caseInsensitive]
    )
    private static let bareAmountRegex = try! NSRegularExpression(
        pattern: #"(?<!\d)(\d{1,4})[.,](\d{2})(?![./-]\d)"#
    )
    private static let amountPrefixCurrencyRegex = try! NSRegularExpression(
        pattern: #"\b(?:zł|pln|zl|zt)\s*(\d{1,4})[.,](\d{2})\b"#,
        options: [.caseInsensitive]
    )
    private static let dateRegex = try! NSRegularExpression(
        pattern: #"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b"#
    )
    private static let isoDateRegex = try! NSRegularExpression(
        pattern: #"\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b"#
    )
    private static let compactIsoDateRegex = try! NSRegularExpression(
        pattern: #"(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)"#
    )
    private static let englishMonthDateRegex = try! NSRegularExpression(
        pattern: #"\b(\d{1,2})[\s./-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s./-]+(\d{2,4})\b"#,
        options: [.caseInsensitive]
    )
    private static let englishMonths: [String: Int] = [
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    ]
    private static let polishMonthDateRegex = try! NSRegularExpression(
        pattern: #"\b(\d{1,2})[\s./-]+(sty|lut|mar|kwi|maj|cze|lip|sie|wrz|paz|lis|gru)[a-z]*[\s./-]+(\d{2,4})\b"#,
        options: [.caseInsensitive]
    )
    private static let polishMonths: [String: Int] = [
        "sty": 1, "lut": 2, "mar": 3, "kwi": 4, "maj": 5, "cze": 6,
        "lip": 7, "sie": 8, "wrz": 9, "paz": 10, "lis": 11, "gru": 12
    ]
    private static let ticketNumberRegex = try! NSRegularExpression(
        pattern: #"\b(?:nr|numer|no\.?|voucher|bon)[:\s#]*([A-Z0-9-]{4,})\b"#,
        options: [.caseInsensitive]
    )
    private static let longDigitsRegex = try! NSRegularExpression(pattern: #"\b(\d{8,})\b"#)
    private static let relativeDaysRegex = try! NSRegularExpression(
        pattern: #"(\d{1,3})\s*dni"#,
        options: [.caseInsensitive]
    )
    private static let taxIDRegex = try! NSRegularExpression(pattern: #"\b(\d{9,11})\b"#)

    static func parse(
        lines: [String],
        barcodes: [DetectedBarcode] = [],
        now: Date = .now,
        calendar: Calendar = Calendar(identifier: .gregorian),
        catalog: [RetailerPolicy]? = nil
    ) -> VoucherDraft {
        var calendar = calendar
        calendar.timeZone = TimeZone(identifier: "Europe/Warsaw") ?? .current
        let text = lines.joined(separator: "\n")
        let retailers = catalog ?? RetailerCatalog.shared
        let policy = matchRetailer(in: text, catalog: retailers)
        let amount = parseAmount(in: text)
        let dates = parseDates(in: text, calendar: calendar)
        let issued = dates.first ?? calendar.startOfDay(for: now)
        let relativeDays = parseRelativeValidityDays(in: text)
        let printedExpiry = parsePrintedExpiry(in: text, dates: dates, calendar: calendar)
        let relativeExpiry = relativeDays.flatMap { calendar.date(byAdding: .day, value: $0, to: issued) }
        let expiry = printedExpiry
            ?? relativeExpiry
            ?? RetailerCatalog.defaultExpiry(for: policy, issuedAt: issued, calendar: calendar)
        let barcode = barcodes.first(where: { !$0.payload.isEmpty })
            ?? parseDigitBarcode(in: text).map { DetectedBarcode(payload: $0, symbology: .code128) }
        let ticketNumber = parseTicketNumber(in: text) ?? barcode?.payload ?? ""
        let confidence = confidenceScore(
            hasRetailer: policy.id != "unknown",
            hasAmount: amount > 0,
            hasDate: dates.isEmpty == false,
            hasBarcode: barcode != nil
        )

        return VoucherDraft(
            retailerID: policy.id,
            amount: amount,
            issuedAt: issued,
            expiresAt: expiry,
            barcodePayload: barcode?.payload ?? "",
            barcodeSymbology: barcode?.symbology ?? .unknown,
            ticketNumber: ticketNumber,
            ocrText: text,
            ocrConfidence: confidence,
            expiryWasPrinted: printedExpiry != nil || relativeDays != nil,
            issuedWasPrinted: dates.isEmpty == false
        )
    }

    static func mergeLive(_ live: VoucherDraft, photo: VoucherDraft) -> VoucherDraft {
        var out = photo
        if out.retailerID == "unknown" {
            out.retailerID = live.retailerID
        }
        if photo.amount > 0 {
            out.amount = photo.amount
        } else if live.amount > 0 {
            out.amount = live.amount
        }
        if photo.issuedWasPrinted {
            out.issuedAt = photo.issuedAt
            out.issuedWasPrinted = true
            out.expiresAt = photo.expiresAt
            out.expiryWasPrinted = photo.expiryWasPrinted
        } else if live.issuedWasPrinted {
            out.issuedAt = live.issuedAt
            out.issuedWasPrinted = true
            out.expiresAt = live.expiresAt
            out.expiryWasPrinted = live.expiryWasPrinted
        }
        if photo.barcodePayload.isEmpty == false {
            out.barcodePayload = photo.barcodePayload
            out.barcodeSymbology = photo.barcodeSymbology
        } else if live.barcodePayload.isEmpty == false {
            out.barcodePayload = live.barcodePayload
            out.barcodeSymbology = live.barcodeSymbology
        }
        out.ticketNumber = preferredTicketNumber(photo.ticketNumber, live.ticketNumber)
        if live.ocrText.isEmpty == false {
            out.ocrText = (live.ocrText + "\n" + photo.ocrText).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return out
    }

    private static func preferredTicketNumber(_ a: String, _ b: String) -> String {
        let candidates = [a, b].filter { $0.isEmpty == false }
        guard let first = candidates.first else { return "" }
        return candidates.min { lhs, rhs in
            let leftShort = lhs.count >= 4 && lhs.count <= 12
            let rightShort = rhs.count >= 4 && rhs.count <= 12
            if leftShort != rightShort { return leftShort }
            return lhs.count < rhs.count
        } ?? first
    }

    static func matchRetailer(in text: String, catalog: [RetailerPolicy]) -> RetailerPolicy {
        let haystack = fold(text)
        let compactHay = compact(text)
        let tokens = haystack.split { $0.isLetter == false }.map(String.init).filter { $0.count >= 4 }
        let observedIDs = taxIDCandidates(in: text)
        let ranked = catalog
            .filter { $0.id != "unknown" }
            .compactMap { policy -> (RetailerPolicy, Int)? in
                var score = 0
                for keyword in policy.keywords {
                    let foldedKeyword = fold(keyword)
                    let compactKeyword = foldedKeyword.replacingOccurrences(of: " ", with: "")
                    if compactKeyword.isEmpty { continue }
                    if haystack.contains(foldedKeyword) || compactHay.contains(compactKeyword) {
                        score = max(score, compactKeyword.count + 10)
                    }
                }
                let name = fold(policy.name)
                let fuzzyLimit = name.count >= 7 ? 3 : 2
                if tokens.contains(where: {
                    let distance = levenshtein($0, name)
                    return distance <= fuzzyLimit && min($0.count, name.count) >= 5
                }) {
                    score = max(score, name.count + 8)
                }
                for taxID in policy.taxIDs {
                    if observedIDs.contains(where: { idsMatch($0, taxID) }) {
                        score = max(score, 80)
                    }
                }
                return score > 0 ? (policy, score) : nil
            }
            .sorted { $0.1 > $1.1 }
        return ranked.first?.0 ?? catalog.first(where: { $0.id == "unknown" }) ?? RetailerCatalog.unknown
    }

    static func parseAmount(in text: String) -> Double {
        let currency = amountCandidates(in: text, currencyRequired: true)
        if let kaucja = amountNearKeyword(in: text, keyword: "kaucj") {
            return kaucja
        }
        if let razem = amountNearKeyword(in: text, keyword: "razem") ?? amountNearKeyword(in: text, keyword: "suma") {
            return razem
        }
        if let best = currency.max() {
            return best
        }
        return amountCandidates(in: text, currencyRequired: false).max() ?? 0
    }

    private static func amountCandidates(in text: String, currencyRequired: Bool) -> [Double] {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        var candidates: [Double] = []
        amountWithCurrencyRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 3 else { return }
            appendAmount(whole: ns.substring(with: match.range(at: 1)), fraction: ns.substring(with: match.range(at: 2)), into: &candidates)
        }
        amountPrefixCurrencyRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 3 else { return }
            appendAmount(whole: ns.substring(with: match.range(at: 1)), fraction: ns.substring(with: match.range(at: 2)), into: &candidates)
        }
        if candidates.isEmpty {
            integerZlotyRegex.enumerateMatches(in: text, range: range) { match, _, _ in
                guard let match, match.numberOfRanges >= 2 else { return }
                let value = Double(ns.substring(with: match.range(at: 1))) ?? 0
                if value > 0, value <= 500 {
                    candidates.append(value)
                }
            }
        }
        if candidates.isEmpty, currencyRequired == false {
            bareAmountRegex.enumerateMatches(in: text, range: range) { match, _, _ in
                guard let match, match.numberOfRanges >= 3 else { return }
                appendAmount(whole: ns.substring(with: match.range(at: 1)), fraction: ns.substring(with: match.range(at: 2)), into: &candidates)
            }
        }
        return candidates
    }

    private static func appendAmount(whole: String, fraction: String, into candidates: inout [Double]) {
        let value = (Double(whole) ?? 0) + (Double(fraction) ?? 0) / 100
        if value > 0, value <= 500 {
            candidates.append(value)
        }
    }

    static func parseDates(in text: String, calendar: Calendar) -> [Date] {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        var dates: [Date] = []
        isoDateRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 4 else { return }
            appendDate(
                day: Int(ns.substring(with: match.range(at: 3))) ?? 0,
                month: Int(ns.substring(with: match.range(at: 2))) ?? 0,
                year: Int(ns.substring(with: match.range(at: 1))) ?? 0,
                calendar: calendar,
                into: &dates
            )
        }
        compactIsoDateRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 4 else { return }
            appendDate(
                day: Int(ns.substring(with: match.range(at: 3))) ?? 0,
                month: Int(ns.substring(with: match.range(at: 2))) ?? 0,
                year: Int(ns.substring(with: match.range(at: 1))) ?? 0,
                calendar: calendar,
                into: &dates
            )
        }
        dateRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 4 else { return }
            let day = Int(ns.substring(with: match.range(at: 1))) ?? 0
            let month = Int(ns.substring(with: match.range(at: 2))) ?? 0
            let yearToken = ns.substring(with: match.range(at: 3))
            if isClockReading(day: day, month: month, yearToken: yearToken) { return }
            appendDate(day: day, month: month, year: Int(yearToken) ?? 0, calendar: calendar, into: &dates)
        }
        let folded = fold(text)
        let foldedNS = folded as NSString
        let foldedRange = NSRange(location: 0, length: foldedNS.length)
        polishMonthDateRegex.enumerateMatches(in: folded, range: foldedRange) { match, _, _ in
            guard let match, match.numberOfRanges >= 4 else { return }
            let monthToken = foldedNS.substring(with: match.range(at: 2)).lowercased()
            let key = String(monthToken.prefix(3))
            guard let month = polishMonths[key] else { return }
            appendDate(
                day: Int(foldedNS.substring(with: match.range(at: 1))) ?? 0,
                month: month,
                year: Int(foldedNS.substring(with: match.range(at: 3))) ?? 0,
                calendar: calendar,
                into: &dates
            )
        }
        englishMonthDateRegex.enumerateMatches(in: folded, range: foldedRange) { match, _, _ in
            guard let match, match.numberOfRanges >= 4 else { return }
            let monthToken = foldedNS.substring(with: match.range(at: 2)).lowercased()
            let key = String(monthToken.prefix(3))
            guard let month = englishMonths[key] else { return }
            appendDate(
                day: Int(foldedNS.substring(with: match.range(at: 1))) ?? 0,
                month: month,
                year: Int(foldedNS.substring(with: match.range(at: 3))) ?? 0,
                calendar: calendar,
                into: &dates
            )
        }
        parseFormatterDates(in: text, calendar: calendar, into: &dates)
        return dates.sorted()
    }

    private static let tokenDateFormatters: [DateFormatter] = {
        let patterns = [
            "yyyy-MM-dd", "yyyy.MM.dd", "yyyy/MM/dd",
            "dd.MM.yyyy", "dd-MM-yyyy", "dd/MM/yyyy",
            "d.MM.yyyy", "d-MM-yyyy", "d/MM/yyyy",
            "dd.MM.yy", "dd-MM-yy", "dd/MM/yy",
            "yyyyMMdd"
        ]
        return patterns.map { pattern in
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(identifier: "Europe/Warsaw")
            formatter.dateFormat = pattern
            formatter.isLenient = false
            return formatter
        }
    }()

    private static let namedMonthFormatters: [DateFormatter] = {
        ["pl_PL", "en_US"].flatMap { localeID in
            ["d MMMM yyyy", "d MMM yyyy", "dd-MMM-yyyy", "dd MMM yyyy"].map { pattern in
                let formatter = DateFormatter()
                formatter.calendar = Calendar(identifier: .gregorian)
                formatter.locale = Locale(identifier: localeID)
                formatter.timeZone = TimeZone(identifier: "Europe/Warsaw")
                formatter.dateFormat = pattern
                formatter.isLenient = false
                return formatter
            }
        }
    }()

    private static func parseFormatterDates(in text: String, calendar: Calendar, into dates: inout [Date]) {
        let tokens = text.split { $0.isWhitespace || ",;|()[]".contains($0) }.map(String.init)
        for token in tokens where token.count >= 6 {
            let compact = token.filter(\.isNumber)
            for formatter in tokenDateFormatters + namedMonthFormatters {
                let usesLetters = formatter.dateFormat?.contains("MMM") == true
                let candidates = usesLetters ? [token] : [token, compact]
                for source in candidates {
                    guard let date = formatter.date(from: source) else { continue }
                    let parts = calendar.dateComponents([.year, .month, .day], from: date)
                    appendDate(
                        day: parts.day ?? 0,
                        month: parts.month ?? 0,
                        year: parts.year ?? 0,
                        calendar: calendar,
                        into: &dates
                    )
                    break
                }
            }
        }
    }

    private static func isClockReading(day: Int, month: Int, yearToken: String) -> Bool {
        let year = Int(yearToken) ?? 0
        if yearToken.count <= 2, year <= 59, day <= 23, month <= 59 {
            if month > 12 { return true }
            if year > 32 { return true }
        }
        return false
    }

    private static func appendDate(day: Int, month: Int, year rawYear: Int, calendar: Calendar, into dates: inout [Date]) {
        var year = rawYear
        if year < 100 { year += 2000 }
        guard (2020...2035).contains(year), (1...12).contains(month), (1...31).contains(day) else { return }
        var components = DateComponents()
        components.calendar = calendar
        components.year = year
        components.month = month
        components.day = day
        guard let date = calendar.date(from: components) else { return }
        let start = calendar.startOfDay(for: date)
        guard calendar.component(.year, from: start) == year,
              calendar.component(.month, from: start) == month,
              calendar.component(.day, from: start) == day else { return }
        if dates.contains(start) == false {
            dates.append(start)
        }
    }

    static func parseDigitBarcode(in text: String) -> String? {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        var best: String?
        longDigitsRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 2 else { return }
            let value = ns.substring(with: match.range(at: 1))
            guard value.count >= 16, value.count <= 40 else { return }
            if value.count >= (best?.count ?? 0) {
                best = value
            }
        }
        return best
    }

    static func parsePrintedExpiry(in text: String, dates: [Date], calendar: Calendar) -> Date? {
        let folded = fold(text)
        let explicitHints = ["wazny do", "wazne do", "do dnia"]
        guard explicitHints.contains(where: { folded.contains($0) }) else { return nil }
        if dates.count >= 2 {
            return dates.last
        }
        return nil
    }

    static func parseRelativeValidityDays(in text: String) -> Int? {
        let folded = fold(text)
        let ns = folded as NSString
        let range = NSRange(location: 0, length: ns.length)
        var best: Int?
        relativeDaysRegex.enumerateMatches(in: folded, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 2 else { return }
            let days = Int(ns.substring(with: match.range(at: 1))) ?? 0
            guard days > 0, days <= 400 else { return }
            let start = max(0, match.range.location - 40)
            let window = ns.substring(with: NSRange(location: start, length: min(ns.length - start, match.range.location - start + match.range.length + 12)))
            if window.contains("wazn") || window.contains("termin") || window.contains("wydan") {
                best = days
            } else if best == nil {
                best = days
            }
        }
        return best
    }

    static func parseTicketNumber(in text: String) -> String? {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        if let match = ticketNumberRegex.firstMatch(in: text, range: range), match.numberOfRanges >= 2 {
            return ns.substring(with: match.range(at: 1))
        }
        if let match = longDigitsRegex.firstMatch(in: text, range: range), match.numberOfRanges >= 2 {
            return ns.substring(with: match.range(at: 1))
        }
        return nil
    }

    private static func amountNearKeyword(in text: String, keyword: String) -> Double? {
        let folded = fold(text)
        guard let range = folded.range(of: keyword) else { return nil }
        let windowStart = folded.index(range.lowerBound, offsetBy: -24, limitedBy: folded.startIndex) ?? folded.startIndex
        let windowEnd = folded.index(range.upperBound, offsetBy: 24, limitedBy: folded.endIndex) ?? folded.endIndex
        let slice = String(folded[windowStart..<windowEnd])
        let currency = amountCandidates(in: slice, currencyRequired: true)
        return currency.max() ?? amountCandidates(in: slice, currencyRequired: false).max()
    }

    private static func taxIDCandidates(in text: String) -> [String] {
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        var ids: [String] = []
        taxIDRegex.enumerateMatches(in: text, range: range) { match, _, _ in
            guard let match, match.numberOfRanges >= 2 else { return }
            ids.append(ns.substring(with: match.range(at: 1)))
        }
        return ids
    }

    static func idsMatch(_ observed: String, _ expected: String) -> Bool {
        if observed == expected { return true }
        guard observed.count == expected.count else { return false }
        let distance = zip(observed, expected).reduce(0) { $0 + ($1.0 == $1.1 ? 0 : 1) }
        return distance <= 1
    }

    private static func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
    }

    private static func compact(_ text: String) -> String {
        fold(text).replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
    }

    static func levenshtein(_ a: String, _ b: String) -> Int {
        let s = Array(a)
        let t = Array(b)
        if s.isEmpty { return t.count }
        if t.isEmpty { return s.count }
        var prev = Array(0...t.count)
        var current = Array(repeating: 0, count: t.count + 1)
        for i in 1...s.count {
            current[0] = i
            for j in 1...t.count {
                let cost = s[i - 1] == t[j - 1] ? 0 : 1
                current[j] = min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost)
            }
            swap(&prev, &current)
        }
        return prev[t.count]
    }

    private static func confidenceScore(hasRetailer: Bool, hasAmount: Bool, hasDate: Bool, hasBarcode: Bool) -> Double {
        var score = 0.15
        if hasRetailer { score += 0.3 }
        if hasAmount { score += 0.3 }
        if hasDate { score += 0.15 }
        if hasBarcode { score += 0.25 }
        return min(score, 1)
    }
}
