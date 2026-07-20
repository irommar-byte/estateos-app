import SwiftUI

/// Natychmiastowy pełny ekran serialu — ładuje odcinki w tle z retry (Cloudflare/Flare).
struct SeriesOpenRequest: Identifiable, Hashable {
    var id: String { url }
    let url: String
    let title: String
    var thumbnail: String? = nil
}

struct SeriesEpisodesLoaderView: View {
    @EnvironmentObject private var app: AppModel

    let request: SeriesOpenRequest
    var backLabel: String = "Wróć"
    let onBack: () -> Void

    @State private var info: VideoInfoResponse?
    @State private var errorMessage: String?
    @State private var attempt = 0
    @FocusState private var backFocused: Bool

    private let maxAttempts = 4

    var body: some View {
        Group {
            if let info {
                SeriesEpisodesView(info: info, backLabel: backLabel, onBack: onBack)
                    .environmentObject(app)
            } else {
                loadingChrome
            }
        }
        .task(id: request.url) { await loadWithRetries() }
    }

    private var loadingChrome: some View {
        ZStack {
            NostalgieAmbientBackground()

            VStack(alignment: .leading, spacing: 28) {
                Button(backLabel) { onBack() }
                    .buttonStyle(.bordered)
                    .focused($backFocused)

                HStack(alignment: .top, spacing: 28) {
                    AsyncImage(url: request.thumbnail.flatMap(URL.init(string:))) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            Color.white.opacity(0.08)
                        }
                    }
                    .frame(width: 220, height: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                    VStack(alignment: .leading, spacing: 16) {
                        Text(MediaCardCopy.decodedTitle(request.title))
                            .font(NostalgieFont.rounded(44, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(3)

                        Text("Lista odcinków")
                            .font(NostalgieFont.metadata)
                            .foregroundStyle(.white.opacity(0.7))

                        if let errorMessage {
                            Text(errorMessage)
                                .font(NostalgieFont.caption)
                                .foregroundStyle(.orange)
                            Button("Spróbuj ponownie") {
                                Task { await loadWithRetries() }
                            }
                            .buttonStyle(.borderedProminent)
                        } else {
                            ProgressView()
                                .scaleEffect(1.3)
                                .padding(.top, 8)
                            Text(attemptText)
                                .font(NostalgieFont.caption)
                                .foregroundStyle(.white.opacity(0.75))
                        }
                    }
                    Spacer(minLength: 0)
                }
                Spacer(minLength: 0)
            }
            .padding(48)
        }
        .onAppear { backFocused = true }
    }

    private var attemptText: String {
        if attempt <= 1 {
            return "Ładuję odcinki z CDA-HD… to może potrwać do ~90 s"
        }
        return "Ponawiam pobieranie listy odcinków (\(attempt)/\(maxAttempts))…"
    }

    private func loadWithRetries() async {
        errorMessage = nil
        for i in 1...maxAttempts {
            attempt = i
            do {
                let fetched = try await app.api.fetchInfo(url: request.url)
                if fetched.isPlaylist == true, !fetched.playableEpisodes.isEmpty {
                    info = fetched
                    return
                }
                errorMessage = "Nie znaleziono odcinków na stronie serialu."
            } catch {
                errorMessage = error.localizedDescription
            }
            if i < maxAttempts {
                errorMessage = nil
                try? await Task.sleep(nanoseconds: UInt64(2_500_000_000 * i))
            }
        }
    }
}
