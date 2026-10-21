import SwiftUI

struct TVRootView: View {
    @EnvironmentObject private var session: TVSession
    @State private var intro = true

    var body: some View {
        ZStack {
            TVTheme.background.ignoresSafeArea()
            switch session.state {
            case .checking:
                TVLaunchView()
            case .needsPairing:
                TVPairingView()
                    .transition(.opacity)
            case .locked:
                TVLockedView()
                    .transition(.opacity)
            case .ready:
                TVReadyView()
                    .transition(.opacity)
            }
            if intro {
                LaunchCinema {
                    withAnimation(.easeIn(duration: 0.35)) { intro = false }
                }
                .transition(.opacity)
                .zIndex(2)
                .ignoresSafeArea()
            }
        }
        .animation(TVTheme.spring, value: session.state)
    }
}

struct TVLockedView: View {
    var body: some View {
        VStack(spacing: 24) {
            TVWordmark(size: 72)
            Text("Trzy dni minęły. Apple TV otwiera bibliotekę razem z opłaconym GalleryOS na iPhonie.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 760)
        }
        .padding(48)
    }
}

struct TVLaunchView: View {
    var body: some View {
        VStack(spacing: 28) {
            TVWordmark(size: 72)
            ProgressView()
        }
    }
}

/// Main content once a server is paired: tabs, plus a full screen state while nothing is loaded yet.
struct TVReadyView: View {
    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var session: TVSession

    var body: some View {
        ZStack {
            if library.isEmpty {
                switch library.phase {
                case .failed(let message):
                    TVProblemView(message: message)
                case .ready:
                    TVEmptyView()
                default:
                    TVConnectingView()
                }
            } else {
                TVMainTabs()
            }
        }
        .animation(TVTheme.spring, value: library.isEmpty)
    }
}

struct TVConnectingView: View {
    @EnvironmentObject private var session: TVSession

    var body: some View {
        VStack(spacing: 30) {
            TVWordmark(size: 72)
            ProgressView()
            Text("Łączę z \(session.server?.title ?? "serwerem")")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }
}

struct TVEmptyView: View {
    @EnvironmentObject private var library: TVLibrary

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.system(size: 96))
                .foregroundStyle(TVTheme.accent)
            Text("Biblioteka jest jeszcze pusta")
                .font(.title)
            Text("Zdjęcia pojawią się tutaj, gdy iPhone skopiuje je na serwer.")
                .font(.title3)
                .foregroundStyle(.secondary)
            Button("Odśwież") { library.refresh() }
        }
        .multilineTextAlignment(.center)
    }
}

struct TVProblemView: View {
    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var session: TVSession
    let message: String

    var body: some View {
        VStack(spacing: 28) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 96))
                .foregroundStyle(.orange)
            Text("Nie mogę połączyć z serwerem")
                .font(.title)
            Text(message)
                .font(.title3)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 1000)
            HStack(spacing: 28) {
                Button("Spróbuj ponownie") { library.retry() }
                Button("Sparuj od nowa", role: .destructive) { session.forget() }
            }
        }
        .multilineTextAlignment(.center)
    }
}
