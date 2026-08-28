import Foundation

enum TvErrorMessages {
    static func message(for error: Error) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return "Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie."
            case .timedOut:
                return "Przekroczono czas oczekiwania. Spróbuj ponownie za chwilę."
            case .cannotFindHost, .cannotConnectToHost:
                return "Nie można połączyć się z serwerem EstateOS."
            default:
                break
            }
        }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain {
            return "Błąd sieci (\(ns.code)). Spróbuj ponownie."
        }
        let desc = error.localizedDescription
        if desc.isEmpty || desc == "The operation couldn't be completed." {
            return "Coś poszło nie tak. Spróbuj ponownie."
        }
        return desc
    }
}
