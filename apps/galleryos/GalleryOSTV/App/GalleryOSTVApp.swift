import SwiftUI

@main
struct GalleryOSTVApp: App {
    @StateObject private var session = TVSession()

    var body: some Scene {
        WindowGroup {
            TVRootView()
                .environmentObject(session)
                .environmentObject(session.library)
                .environmentObject(session.library.pipeline)
                .environmentObject(session.library.link)
                .environmentObject(session.library.placeFeed)
                .preferredColorScheme(.dark)
                .tint(TVTheme.accent)
                .task { await session.start() }
        }
    }
}
