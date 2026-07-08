import Foundation

enum SessionStore {
    private static let key = "estateos.tvos.session"

    static func load() -> EstateSession? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(EstateSession.self, from: data)
    }

    static func save(_ session: EstateSession) throws {
        let data = try JSONEncoder().encode(session)
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
