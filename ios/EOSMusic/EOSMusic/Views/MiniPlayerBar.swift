import SwiftUI

struct MiniPlayerTabInset: ViewModifier {
    @EnvironmentObject private var app: AppModel
    @EnvironmentObject private var video: VideoAppModel

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 8) {
            if app.playback.engine != nil, !app.isFullPlayerPresented, !video.isPlayerPresented {
                MiniPlayerBar()
                    .padding(.horizontal, 8)
            }
        }
    }
}

extension View {
    func miniPlayerTabInset() -> some View {
        modifier(MiniPlayerTabInset())
    }
}

struct MiniPlayerBar: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        if let engine = app.playback.engine {
            MiniPlayerContent(engine: engine)
                .environmentObject(app)
        }
    }
}

private struct MiniPlayerContent: View {
    @ObservedObject var engine: MusicPlaybackEngine
    @EnvironmentObject private var app: AppModel

    var body: some View {
        if let track = engine.currentTrack {
            HStack(spacing: 12) {
                Button {
                    app.expandPlayer()
                } label: {
                    HStack(spacing: 12) {
                        ArtworkImage(url: track.artworkURL, size: 44, cornerRadius: 8)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(track.title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(EOSTheme.textPrimary)
                                .lineLimit(1)
                            Text(track.artist ?? "")
                                .font(.caption)
                                .foregroundStyle(EOSTheme.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)

                if !track.isExternal {
                    DownloadCloudButton(
                        state: app.playbackCloudState(for: track),
                        size: 20,
                        onDownload: { app.downloadCurrentPlayback() },
                        onCancel: { app.cancelDownload(for: track.url) },
                        onRemoveOffline: { app.removeOfflineDownload(for: track.url) }
                    )
                }

                Button {
                    engine.togglePlayPause()
                } label: {
                    Group {
                        if engine.isLoading {
                            ProgressView()
                                .scaleEffect(0.85)
                        } else {
                            Image(systemName: engine.isPlaying ? "pause.fill" : "play.fill")
                                .font(.title3)
                        }
                    }
                    .foregroundStyle(EOSTheme.textPrimary)
                    .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .disabled(engine.isLoading)

                Button {
                    Task { await engine.skipNext() }
                } label: {
                    Image(systemName: "forward.fill")
                        .foregroundStyle(EOSTheme.textSecondary)
                        .frame(width: 36, height: 44)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(EOSTheme.cardBorder, lineWidth: 1)
            )
        }
    }
}
