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
