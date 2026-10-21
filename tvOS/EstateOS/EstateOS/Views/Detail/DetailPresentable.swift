import SwiftUI

struct DetailPresentation {
    struct SpecRow: Identifiable {
        let id: String
        let label: String
        let value: String
        let icon: String
    }

    struct OwnerStats {
        let views: Int
        let favorites: Int
    }

    var imageURLs: [URL]
    var title: String
    var priceText: String
    var subtitleText: String
    var locationLine: String
    var country: ResolvedLocalityCountry
    var accentColor: Color
    var descriptionText: String?
    var specRows: [SpecRow]
    var specsPanelTitle: String
    var specsPanelIcon: String
    var ownerStats: OwnerStats?
    var transactionBadgeText: String?
    var transactionBadgeIsRent: Bool = false
    var descriptionHeaderTrailing: String?
    /// Spacer wideo (`videoUrl`) — native player, or a YouTube / web link card.
    var video: OfferVideoSource? = nil
    /// Plan i 3D — LiDAR vector plan, plan drawings and the USDZ model.
    var floorPlan: FloorPlanMedia? = nil
}

/// Shared contract for the tvOS detail shell (hero / info / description / gallery).
protocol DetailPresentable {
    var detailPresentation: DetailPresentation { get }
}
