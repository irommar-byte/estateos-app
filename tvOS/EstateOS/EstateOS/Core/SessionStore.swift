import Foundation

enum SessionStore {
    private static let key = "estateos.tvos.session"
    private static let suiteName = "group.pl.estateos.app.tvos"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    static func load() -> EstateSession? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(EstateSession.self, from: data)
    }

    static func save(_ session: EstateSession) throws {
        let data = try JSONEncoder().encode(session)
        defaults.set(data, forKey: key)
        defaults.synchronize()
    }

    static func clear() {
        defaults.removeObject(forKey: key)
        defaults.synchronize()
    }
}
