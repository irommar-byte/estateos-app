import Foundation

enum LoyaltyCatalog {
    static let customID = "custom"

    private static let bundled: [LoyaltyProgram] = {
        guard let url = Bundle.main.url(forResource: "LoyaltyPrograms", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(File.self, from: data) else {
            return []
        }
        return decoded.programs.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }()

    static var all: [LoyaltyProgram] { bundled }

    static func program(id: String) -> LoyaltyProgram? {
        bundled.first { $0.id == id }
    }

    static func programForRetailer(_ retailerID: String) -> LoyaltyProgram {
        let aliases: [String: String] = [
            "lidl": "lidlplus"
        ]
        let key = aliases[retailerID] ?? retailerID
        if let found = program(id: key) { return found }
        let policy = RetailerCatalog.policy(id: retailerID)
        if let found = all.first(where: { fold($0.name) == fold(policy.name) }) {
            return found
        }
        return LoyaltyProgram(
            id: retailerID,
            name: policy.name,
            programName: policy.name,
            domain: "",
            color: "#3A3A3C",
            keywords: [],
            barcode: BarcodeSymbology.code128.rawValue
        )
    }

    static func search(_ query: String) -> [LoyaltyProgram] {
        let needle = fold(query)
        if needle.isEmpty { return all }
        return all.filter { program in
            fold(program.name).contains(needle)
                || fold(program.programName).contains(needle)
                || program.keywords.contains { fold($0).contains(needle) }
                || fold(program.domain).contains(needle)
        }
    }

    static func match(ocrText: String, barcode: String) -> LoyaltyProgram? {
        let haystack = fold([ocrText, barcode].joined(separator: " "))
        guard haystack.isEmpty == false else { return nil }
        var best: (program: LoyaltyProgram, score: Int)?
        for program in all {
            let names = ([program.name, program.programName] + program.keywords)
                .map(fold)
                .filter { $0.isEmpty == false }
            for needle in names {
                guard containsKeyword(needle, in: haystack) else { continue }
                let score = needle.count + (needle == fold(program.name) ? 2 : 0)
                if best == nil || score > best!.score {
                    best = (program, score)
                }
            }
        }
        return best?.program
    }

    static func fold(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pl_PL"))
            .lowercased()
    }

    static func containsKeyword(_ needle: String, in haystack: String) -> Bool {
        if needle.isEmpty { return false }
        if needle.contains(" ") {
            return haystack.contains(needle)
        }
        var start = haystack.startIndex
        while let range = haystack.range(of: needle, range: start..<haystack.endIndex) {
            let beforeOK = range.lowerBound == haystack.startIndex
                || haystack[haystack.index(before: range.lowerBound)].isLetter == false
            let afterOK = range.upperBound == haystack.endIndex
                || haystack[range.upperBound].isLetter == false
            if beforeOK && afterOK { return true }
            start = range.upperBound
        }
        return false
    }

    private struct File: Codable {
        var programs: [LoyaltyProgram]
    }
}
