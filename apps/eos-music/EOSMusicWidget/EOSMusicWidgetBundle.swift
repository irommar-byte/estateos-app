import SwiftUI
import WidgetKit

@main
struct EOSMusicWidgetBundle: WidgetBundle {
    var body: some Widget {
        DownloadLiveActivity()
        ShazamLiveActivity()
        if #available(iOS 18.0, *) {
            EOSShazamControl()
            EOSPlayPauseControl()
            EOSNextControl()
            EOSFavoriteControl()
        }
    }
}
