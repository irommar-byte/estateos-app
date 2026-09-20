import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 18.0, *)
struct EOSPlayingValueProvider: ControlValueProvider {
    var previewValue: Bool { false }

    func currentValue() async throws -> Bool {
        let snapshot = EOSControlSnapshotReader.load()
        return !snapshot.isStale && snapshot.isPlaying
    }
}

@available(iOS 18.0, *)
struct EOSFavoriteValueProvider: ControlValueProvider {
    var previewValue: Bool { false }

    func currentValue() async throws -> Bool {
        let snapshot = EOSControlSnapshotReader.load()
        return !snapshot.isStale && snapshot.hasCurrentTrack && snapshot.isFavorite
    }
}

@available(iOS 18.0, *)
struct EOSShazamControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: EOSControlKind.shazam) {
            ControlWidgetButton(action: EOSShazamControlIntent()) {
                Label(EOSControlSnapshotReader.load().shazamStatusText, systemImage: "shazam.logo")
            }
        }
        .displayName("Shazam")
        .description("Rozpoznaje utwór i dodaje go do playlisty SHAZAM.")
    }
}

@available(iOS 18.0, *)
struct EOSPlayPauseControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: EOSControlKind.playPause, provider: EOSPlayingValueProvider()) { isPlaying in
            ControlWidgetToggle(isOn: isPlaying, action: EOSPlayPauseControlIntent()) {
                Label(isPlaying ? "Pauza" : "Odtwarzaj", systemImage: isPlaying ? "pause.fill" : "play.fill")
            }
        }
        .displayName("Odtwarzaj")
        .description("Odtwarza albo wstrzymuje bieżący utwór.")
    }
}

@available(iOS 18.0, *)
struct EOSNextControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: EOSControlKind.next) {
            ControlWidgetButton(action: EOSNextTrackControlIntent()) {
                Label("Następny", systemImage: "forward.fill")
            }
        }
        .displayName("Następny")
        .description("Przechodzi do następnego utworu.")
    }
}

@available(iOS 18.0, *)
struct EOSFavoriteControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: EOSControlKind.favorite, provider: EOSFavoriteValueProvider()) { isFavorite in
            ControlWidgetToggle(isOn: isFavorite, action: EOSFavoriteControlIntent()) {
                Label(isFavorite ? "W ulubionych" : "Ulubione", systemImage: isFavorite ? "heart.fill" : "heart")
            }
        }
        .displayName("Ulubione")
        .description("Dodaje albo usuwa bieżący utwór z ulubionych.")
    }
}
