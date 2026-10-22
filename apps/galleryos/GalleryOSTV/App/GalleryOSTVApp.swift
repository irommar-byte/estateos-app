import SwiftUI

@main
struct GalleryOSTVApp: App {
    @StateObject private var session = TVSession()
    @Environment(\.scenePhase) private var phase

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
                .onChange(of: phase) { _, now in
                    guard now == .active else { return }
                    Task { await session.recheckAccess() }
                    // Back on screen: what the iPhone changed meanwhile (new photos, deletions) shows at once.
                    session.library.refresh()
                }
        }
    }
}
