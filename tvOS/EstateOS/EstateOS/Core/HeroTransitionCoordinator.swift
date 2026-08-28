import SwiftUI

/// Shared hero zoom id for matchedGeometryEffect between showroom and detail.
enum HeroTransitionID: Hashable {
    case home(Int)
    case car(Int)

    var stringValue: String {
        switch self {
        case .home(let id): return "hero-home-\(id)"
        case .car(let id): return "hero-car-\(id)"
        }
    }
}

@MainActor
final class HeroTransitionCoordinator: ObservableObject {
    @Published var activeID: HeroTransitionID?
    @Published var imageURL: URL?

    func begin(id: HeroTransitionID, imageURL: URL?) {
        activeID = id
        self.imageURL = imageURL
    }

    func end() {
        activeID = nil
        imageURL = nil
    }
}
