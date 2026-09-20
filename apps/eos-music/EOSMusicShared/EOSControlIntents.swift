import AppIntents
import Foundation

enum EOSIntentRoutingError: Error, CustomLocalizedStringResourceConvertible {
    case notMainApp
    case notLoggedIn
    case noCurrentTrack
    case unavailable(String)

    var localizedStringResource: LocalizedStringResource {
        switch self {
        case .notMainApp:
            return "Otwórz EOS Music, aby dokończyć."
        case .notLoggedIn:
            return "Zaloguj się w EOS Music"
        case .noCurrentTrack:
            return "Brak aktywnego utworu"
        case .unavailable(let message):
            return LocalizedStringResource(stringLiteral: message)
        }
    }
}

@available(iOS 18.0, *)
struct EOSShazamControlIntent: AudioRecordingIntent, LiveActivityIntent {
    static var title: LocalizedStringResource = "Shazam"
    static var description = IntentDescription("Rozpoznaje utwór i dodaje go do playlisty SHAZAM.")
    static var openAppWhenRun = false
    static var isDiscoverable = true
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    #if compiler(>=6.2)
    @available(iOS 26.0, *)
    static var supportedModes: IntentModes { [.background, .foreground(.dynamic)] }
    #endif

    func perform() async throws -> some IntentResult & ProvidesDialog {
        #if EOS_MAIN_APP
        let status = try await EOSIntentRuntime.shared.performShazamHeadless()
        return .result(dialog: IntentDialog(stringLiteral: EOSControlWidgetStatus.text(status)))
        #else
        throw EOSIntentRoutingError.notMainApp
        return .result(dialog: IntentDialog("Otwórz EOS Music, aby dokończyć."))
        #endif
    }
}

@available(iOS 18.0, *)
struct EOSPlayPauseControlIntent: SetValueIntent, AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Odtwarzaj"
    static var description = IntentDescription("Odtwarza albo wstrzymuje bieżący utwór.")
    static var openAppWhenRun = false
    static var isDiscoverable = true
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    #if compiler(>=6.2)
    @available(iOS 26.0, *)
    static var supportedModes: IntentModes { [.background] }
    #endif

    @Parameter(title: "Odtwarzaj")
    var value: Bool

    func perform() async throws -> some IntentResult {
        #if EOS_MAIN_APP
        try await EOSIntentRuntime.shared.setPlaying(value)
        return .result()
        #else
        throw EOSIntentRoutingError.notMainApp
        return .result()
        #endif
    }
}

@available(iOS 18.0, *)
struct EOSNextTrackControlIntent: AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Następny"
    static var description = IntentDescription("Przechodzi do następnego utworu.")
    static var openAppWhenRun = false
    static var isDiscoverable = true
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    #if compiler(>=6.2)
    @available(iOS 26.0, *)
    static var supportedModes: IntentModes { [.background] }
    #endif

    func perform() async throws -> some IntentResult & ProvidesDialog {
        #if EOS_MAIN_APP
        let title = try await EOSIntentRuntime.shared.skipNext()
        return .result(dialog: IntentDialog(stringLiteral: title))
        #else
        throw EOSIntentRoutingError.notMainApp
        return .result(dialog: IntentDialog("Otwórz EOS Music, aby dokończyć."))
        #endif
    }
}

@available(iOS 18.0, *)
struct EOSFavoriteControlIntent: SetValueIntent, AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Ulubione"
    static var description = IntentDescription("Dodaje albo usuwa bieżący utwór z ulubionych.")
    static var openAppWhenRun = false
    static var isDiscoverable = true
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    #if compiler(>=6.2)
    @available(iOS 26.0, *)
    static var supportedModes: IntentModes { [.background] }
    #endif

    @Parameter(title: "Ulubione")
    var value: Bool

    func perform() async throws -> some IntentResult {
        #if EOS_MAIN_APP
        try await EOSIntentRuntime.shared.setFavoriteCurrent(value)
        return .result()
        #else
        throw EOSIntentRoutingError.notMainApp
        return .result()
        #endif
    }
}

@available(iOS 18.0, *)
struct EOSCancelShazamIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Anuluj Shazam"
    static var openAppWhenRun = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    func perform() async throws -> some IntentResult {
        #if EOS_MAIN_APP
        await EOSIntentRuntime.shared.cancelShazam()
        return .result()
        #else
        throw EOSIntentRoutingError.notMainApp
        return .result()
        #endif
    }
}
