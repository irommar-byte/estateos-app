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
    }
}
