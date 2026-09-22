import AVFoundation
import AVKit
import SwiftUI
import UIKit

/// Live audio route. AirPlay (Apple TV, HomePod, telewizory z AirPlay 2) and Bluetooth
/// stay on the system route; the TV remote drives the existing remote commands.
@MainActor
final class PlaybackOutputRoute: ObservableObject {
    static let shared = PlaybackOutputRoute()

    @Published private(set) var deviceName = "Ten iPhone"
    @Published private(set) var isExternal = false
    @Published private(set) var symbol = "iphone"

    private var started = false

    func start() {
        guard !started else {
            refresh()
            return
        }
        started = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(refresh),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        refresh()
    }

    @objc func refresh() {
        let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
        if let airPlay = outputs.first(where: { $0.portType == .airPlay }) {
            deviceName = airPlay.portName
            isExternal = true
            symbol = "airplayaudio"
            return
        }
        if let cast = outputs.first(where: { Self.isCastPort($0) }) {
            deviceName = cast.portName
            isExternal = true
            symbol = "tv"
            return
        }
        if let bluetooth = outputs.first(where: {
            $0.portType == .bluetoothA2DP || $0.portType == .bluetoothLE || $0.portType == .bluetoothHFP
        }) {
            deviceName = bluetooth.portName
            isExternal = true
            symbol = "hifispeaker"
            return
        }
        if let hdmi = outputs.first(where: { $0.portType == .HDMI }) {
            deviceName = hdmi.portName.isEmpty ? "Telewizor" : hdmi.portName
            isExternal = true
            symbol = "tv"
            return
        }
        deviceName = "Ten iPhone"
        isExternal = false
        symbol = "iphone"
    }

    private static func isCastPort(_ port: AVAudioSessionPortDescription) -> Bool {
        let name = port.portName.lowercased()
        return name.contains("chromecast") || name.contains("google cast") || name.contains("android tv")
    }
}

/// System AirPlay picker. Audio routes first so Apple TV and AirPlay 2 TVs
/// (including many Google TV sets) appear as the output, not a video mirror.
struct PlaybackRouteCaption: View {
    @ObservedObject private var route = PlaybackOutputRoute.shared

    var body: some View {
        if route.isExternal {
            Label(route.deviceName, systemImage: route.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(EOSTheme.textSecondary)
                .lineLimit(1)
                .accessibilityLabel("Odtwarzanie na \(route.deviceName)")
        }
    }
}

struct MusicRouteButton: UIViewRepresentable {
    var tint: UIColor = .label
    var activeTint: UIColor = UIColor(EOSTheme.accent)

    func makeUIView(context: Context) -> AVRoutePickerView {
        let picker = AVRoutePickerView()
        picker.prioritizesVideoDevices = false
        picker.tintColor = tint
        picker.activeTintColor = activeTint
        return picker
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {
        uiView.prioritizesVideoDevices = false
        uiView.tintColor = tint
        uiView.activeTintColor = activeTint
    }
}

/// Second screen (AirPlay mirror, HDMI): cinema now playing. The phone stays the remote.
@MainActor
final class ExternalPlaybackStage {
    static let shared = ExternalPlaybackStage()

    private var window: UIWindow?
    private weak var app: AppModel?

    func bind(_ app: AppModel) {
        self.app = app
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenDidConnect(_:)),
            name: UIScreen.didConnectNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenDidDisconnect(_:)),
            name: UIScreen.didDisconnectNotification,
            object: nil
        )
        UIScreen.screens.filter { $0 != .main }.forEach(attach)
    }

    @objc private func screenDidConnect(_ note: Notification) {
        guard let screen = note.object as? UIScreen else { return }
        attach(screen)
    }

    @objc private func screenDidDisconnect(_ note: Notification) {
        guard let screen = note.object as? UIScreen else { return }
        if window?.screen == screen {
            window?.isHidden = true
            window = nil
        }
    }

    private func attach(_ screen: UIScreen) {
        guard screen != .main, let app else { return }
        if window?.screen == screen { return }
        let host = UIHostingController(rootView: ExternalNowPlayingView().environmentObject(app))
        host.view.backgroundColor = .black
        let next = UIWindow(frame: screen.bounds)
        next.screen = screen
        next.rootViewController = host
        next.isHidden = false
        window = next
    }
}

private struct ExternalNowPlayingView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let engine = app.playback.engine, let track = engine.currentTrack {
                stage(engine: engine, track: track)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "airplayaudio")
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(.white.opacity(0.7))
                    Text("EOS Music")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.white)
                }
            }
        }
    }

    private func stage(engine: MusicPlaybackEngine, track: MusicPlaybackTrack) -> some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { _ in
            let time = engine.livePlaybackTime()
            let duration = max(engine.liveDuration(), 1)
            VStack(spacing: 28) {
                ArtworkImage(
                    url: track.artworkURL,
                    size: 420,
                    cornerRadius: 18,
                    fallbackImage: engine.displayArtwork(for: track),
                    identity: track.id,
                    placeholderTitle: track.title,
                    placeholderSubtitle: track.artist
                )
                .shadow(color: .black.opacity(0.45), radius: 24, y: 12)
                VStack(spacing: 8) {
                    Text(track.title)
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                    if let artist = track.artist, !artist.isEmpty {
                        Text(artist)
                            .font(.title2)
                            .foregroundStyle(.white.opacity(0.72))
                            .lineLimit(1)
                    }
                }
                VStack(spacing: 8) {
                    ProgressView(value: min(1, max(0, time / duration)))
                        .tint(.white)
                    HStack {
                        Text(Self.clock(time))
                        Spacer()
                        Text(Self.clock(duration))
                    }
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.7))
                }
                .frame(maxWidth: 640)
            }
            .padding(48)
        }
    }

    private static func clock(_ value: Double) -> String {
        guard value.isFinite, value >= 0 else { return "0:00" }
        let total = Int(value.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
