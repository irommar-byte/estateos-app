import Foundation

enum QuietPromptKind: Equatable {
    case coffee
    case review
}

struct QuietPromptState: Equatable {
    var installAt: Date
    var saveCount: Int
    var coffeeLastPromptAt: Date?
    var coffeeLastSuccessAt: Date?
    var coffeeRefusals: Int
    var coffeeDisabled: Bool
    var reviewLastPromptAt: Date?
    var reviewCompleted: Bool
    var coffeeSession: String?
    var reviewSession: String?
}

enum QuietPromptPolicy {
    static let coffeeSaveThreshold = 5
    static let reviewSaveThreshold = 8
    static let coffeeCooldown: TimeInterval = 45 * 24 * 60 * 60
    static let reviewMinInstall: TimeInterval = 4 * 24 * 60 * 60
    static let reviewCooldown: TimeInterval = 60 * 24 * 60 * 60
    static let coffeeRefusalCap = 3

    static func coffeeDue(_ state: QuietPromptState, now: Date, session: String) -> Bool {
        if state.coffeeDisabled { return false }
        if state.coffeeRefusals >= coffeeRefusalCap { return false }
        if state.saveCount < coffeeSaveThreshold { return false }
        if state.coffeeSession == session || state.reviewSession == session { return false }
        if let last = state.coffeeLastPromptAt ?? state.coffeeLastSuccessAt,
           now.timeIntervalSince(last) < coffeeCooldown {
            return false
        }
        return true
    }

    static func reviewDue(_ state: QuietPromptState, now: Date, session: String, calendar: Calendar = .current) -> Bool {
        if state.reviewCompleted { return false }
        if state.saveCount < reviewSaveThreshold { return false }
        if now.timeIntervalSince(state.installAt) < reviewMinInstall { return false }
        if state.reviewSession == session || state.coffeeSession == session { return false }
        if let last = state.reviewLastPromptAt, now.timeIntervalSince(last) < reviewCooldown {
            return false
        }
        let coffeeDay = [state.coffeeLastPromptAt, state.coffeeLastSuccessAt].compactMap { $0 }
            .contains { calendar.isDate($0, inSameDayAs: now) }
        if coffeeDay { return false }
        return true
    }

    static func next(_ state: QuietPromptState, now: Date, session: String, calendar: Calendar = .current) -> QuietPromptKind? {
        let review = reviewDue(state, now: now, session: session, calendar: calendar)
        let coffee = coffeeDue(state, now: now, session: session)
        if review { return .review }
        if coffee { return .coffee }
        return nil
    }
}

enum QuietPromptStore {
    private static let suite = UserDefaults.standard
    private static let installKey = "paragonos.installAt"
    private static let savesKey = "paragonos.successfulSaves"
    private static let coffeePromptKey = "paragonos.coffeeLastPromptAt"
    private static let coffeeSuccessKey = "paragonos.coffeeLastSuccessAt"
    private static let coffeeRefusalsKey = "paragonos.coffeeRefusals"
    private static let coffeeDisabledKey = "paragonos.coffeeDisabled"
    private static let reviewPromptKey = "paragonos.reviewLastPromptAt"
    private static let reviewDoneKey = "paragonos.reviewCompleted"

    static func load(now: Date = .now) -> QuietPromptState {
        let install: Date
        if let stored = suite.object(forKey: installKey) as? Date {
            install = stored
        } else {
            suite.set(now, forKey: installKey)
            install = now
        }
        return QuietPromptState(
            installAt: install,
            saveCount: suite.integer(forKey: savesKey),
            coffeeLastPromptAt: suite.object(forKey: coffeePromptKey) as? Date,
            coffeeLastSuccessAt: suite.object(forKey: coffeeSuccessKey) as? Date,
            coffeeRefusals: suite.integer(forKey: coffeeRefusalsKey),
            coffeeDisabled: suite.bool(forKey: coffeeDisabledKey),
            reviewLastPromptAt: suite.object(forKey: reviewPromptKey) as? Date,
            reviewCompleted: suite.bool(forKey: reviewDoneKey),
            coffeeSession: nil,
            reviewSession: nil
        )
    }

    static func recordSave() {
        suite.set(suite.integer(forKey: savesKey) + 1, forKey: savesKey)
    }

    static func markCoffeePrompt(now: Date = .now) {
        suite.set(now, forKey: coffeePromptKey)
    }

    static func markCoffeeSuccess(now: Date = .now) {
        suite.set(now, forKey: coffeeSuccessKey)
        suite.set(0, forKey: coffeeRefusalsKey)
    }

    static func markCoffeeDecline(now: Date = .now) {
        suite.set(now, forKey: coffeePromptKey)
        let next = suite.integer(forKey: coffeeRefusalsKey) + 1
        suite.set(next, forKey: coffeeRefusalsKey)
        if next >= QuietPromptPolicy.coffeeRefusalCap {
            suite.set(true, forKey: coffeeDisabledKey)
        }
    }

    static func markReviewPrompt(now: Date = .now) {
        suite.set(now, forKey: reviewPromptKey)
    }

    static func markReviewCompleted() {
        suite.set(true, forKey: reviewDoneKey)
    }

    #if DEBUG
    static func resetForTests() {
        [
            installKey, savesKey, coffeePromptKey, coffeeSuccessKey, coffeeRefusalsKey,
            coffeeDisabledKey, reviewPromptKey, reviewDoneKey
        ].forEach { suite.removeObject(forKey: $0) }
    }
    #endif
}
