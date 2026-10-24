import SwiftUI

private struct PlayerGeometryNamespaceKey: EnvironmentKey {
    static let defaultValue: Namespace.ID? = nil
}

extension EnvironmentValues {
    var playerGeometryNamespace: Namespace.ID? {
        get { self[PlayerGeometryNamespaceKey.self] }
        set { self[PlayerGeometryNamespaceKey.self] = newValue }
    }
}

struct PlayerArtworkGeometry: ViewModifier {
    @Environment(\.playerGeometryNamespace) private var ns

    func body(content: Content) -> some View {
        if let ns {
            content.matchedGeometryEffect(id: "eos.player.artwork", in: ns)
        } else {
            content
        }
    }
}

// MARK: - Zoom mini‑player ↔ pełny player (iOS 18+)

enum PlayerZoomID {
    static let nowPlaying = "eos.nowplaying.zoom"
}

private struct PlayerZoomNamespaceKey: EnvironmentKey {
    static let defaultValue: Namespace.ID? = nil
}

private struct PlayerPresentedFullScreenKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// Namespace z RootView — źródło przejścia zoom dla pełnego playera.
    var playerZoomNamespace: Namespace.ID? {
        get { self[PlayerZoomNamespaceKey.self] }
        set { self[PlayerZoomNamespaceKey.self] = newValue }
    }

    /// Player otwarty jako pełny ekran (bez systemowego uchwytu arkusza) — pokazujemy własny uchwyt.
    var playerPresentedFullScreen: Bool {
        get { self[PlayerPresentedFullScreenKey.self] }
        set { self[PlayerPresentedFullScreenKey.self] = newValue }
    }
}

/// Oznacza mini‑player jako miejsce, z którego „wyrasta” pełny player i do którego wraca.
struct PlayerZoomSource: ViewModifier {
    @Environment(\.playerZoomNamespace) private var ns
    var cornerRadius: CGFloat = EOSLayout.miniPlayerCorner

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), let ns {
            content.matchedTransitionSource(id: PlayerZoomID.nowPlaying, in: ns) { source in
                source.clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            }
        } else {
            content
        }
    }
}
