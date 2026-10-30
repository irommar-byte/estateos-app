import XCTest
@testable import ParagonOS

final class LocaleSupportTests: XCTestCase {
    override func tearDown() {
        AppLocale.override = nil
        super.tearDown()
    }

    func testAppLanguageLocales() {
        XCTAssertEqual(AppLanguage.pl.locale.identifier, "pl_PL")
        XCTAssertTrue(AppLanguage.en.locale.identifier.lowercased().hasPrefix("en"))
        XCTAssertEqual(AppLanguage.uk.locale.identifier, "uk_UA")
        XCTAssertEqual(AppLanguage.system.rawValue, "system")
    }

    func testMoneyStaysPLNInEnglishAndUkrainian() {
        AppLocale.apply(.en)
        let english = MoneyFormat.string(12.5)
        XCTAssertTrue(english.contains("PLN") || english.contains("zł") || english.contains("12"), english)
        AppLocale.apply(.uk)
        let ukrainian = MoneyFormat.string(12.5)
        XCTAssertTrue(ukrainian.contains("PLN") || ukrainian.contains("zł") || ukrainian.contains("12"), ukrainian)
        AppLocale.apply(.pl)
        let polish = MoneyFormat.string(12.5)
        XCTAssertTrue(polish.contains("zł") || polish.contains("PLN"), polish)
    }

    func testXcstringsHasEnglishAndUkrainianCoffeeCopy() throws {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let catalog = try String(
            contentsOf: root.appendingPathComponent("ParagonOS/Resources/Localizable.xcstrings"),
            encoding: .utf8
        )
        XCTAssertTrue(catalog.contains("\"en\""))
        XCTAssertTrue(catalog.contains("\"uk\""))
        XCTAssertTrue(catalog.contains("A coffee? Only if you want."))
        XCTAssertTrue(catalog.contains("Кава? Тільки якщо хочеш."))
        XCTAssertTrue(catalog.contains("Może kawa? Nic nie musisz."))
        XCTAssertTrue(catalog.contains("Dziękuję że jesteś."))
        XCTAssertTrue(catalog.contains("Thank you for being here."))
        XCTAssertTrue(catalog.contains("Nie udało się otworzyć płatności Apple."))
    }

    func testCoffeeProductIdentifiers() {
        XCTAssertEqual(CoffeeSize.small.productID, "pl.paragonos.app.coffee.small")
        XCTAssertEqual(CoffeeSize.medium.productID, "pl.paragonos.app.coffee.medium")
        XCTAssertEqual(CoffeeSize.large.productID, "pl.paragonos.app.coffee.large")
        XCTAssertEqual(CoffeeSize.small.fallbackPrice, "5 zł")
        XCTAssertEqual(CoffeeSize.medium.fallbackPrice, "10 zł")
        XCTAssertEqual(CoffeeSize.large.fallbackPrice, "20 zł")
        XCTAssertEqual(CoffeeSize.allCases.map(\.id), CoffeeSize.allCases.map(\.productID))
    }

    @MainActor
    func testCoffeePriceIsAlwaysZlotyNotDollars() {
        let store = CoffeeTipStore.shared
        for size in CoffeeSize.allCases {
            let price = store.price(for: size)
            XCTAssertFalse(price.contains("$"), price)
            XCTAssertFalse(price.lowercased().contains("usd"), price)
            XCTAssertTrue(price.contains("zł"), price)
        }
        XCTAssertEqual(store.price(for: .small), "5 zł")
        XCTAssertEqual(store.price(for: .medium), "10 zł")
        XCTAssertEqual(store.price(for: .large), "20 zł")
        XCTAssertEqual(CoffeeSize.allCases.map(\.self), [.small, .medium, .large])
    }

    func testCoffeeThankYouAudioIsBundled() {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let url = root.appendingPathComponent("ParagonOS/Resources/Sounds/coffee_thank_you.mp3")
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        let sounds = try? String(contentsOf: root.appendingPathComponent("ParagonOS/Services/CoffeeSounds.swift"), encoding: .utf8)
        XCTAssertTrue(sounds?.contains("coffee_thank_you") == true)
        XCTAssertTrue(sounds?.contains("func thankYou") == true)
    }

    func testRelativePastUsesPolishNotEnglishAgo() {
        AppLocale.apply(.pl)
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let justNow = PolishDates.relativePast(now.addingTimeInterval(-12), now: now)
        XCTAssertEqual(justNow, "przed chwilą")
        let minutes = PolishDates.relativePast(now.addingTimeInterval(-47 * 60), now: now)
        XCTAssertFalse(minutes.localizedCaseInsensitiveContains("ago"), minutes)
        XCTAssertTrue(minutes.localizedCaseInsensitiveContains("min"), minutes)
        AppLocale.apply(.en)
        let english = PolishDates.relativePast(now.addingTimeInterval(-60), now: now)
        XCTAssertFalse(english.contains("min."), english)
    }
}
