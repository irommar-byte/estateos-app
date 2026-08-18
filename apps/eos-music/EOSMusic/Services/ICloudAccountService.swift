import Foundation

enum ICloudAccountState: Equatable {
    case available
    case noAccount

    var isSignedIn: Bool {
        if case .available = self { return true }
        return false
    }

    var label: String {
        switch self {
        case .available: return "Zalogowano do iCloud"
        case .noAccount: return "Brak konta iCloud na tym urządzeniu"
        }
    }
}

enum ICloudAccountService {
    static func currentState() -> ICloudAccountState {
        FileManager.default.ubiquityIdentityToken == nil ? .noAccount : .available
    }
}
