import SwiftUI

/// Sections of the glass sidebar. `.showroom` is the real-estate showroom (kept as the case name
/// so older call sites like `tab = .showroom` still mean "Nieruchomości").
enum HomeTab: String, CaseIterable, Hashable {
    case showroom = "Nieruchomości"
    case cars = "Samochody"
    case map = "Mapa"
    case search = "Szukaj"
    case favorites = "Ulubione"
    case account = "Konto"

    var brand: CatalogBrand? {
        switch self {
        case .showroom, .map: return .home
        case .cars: return .car
        default: return nil
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .showroom: return "Nieruchomości, przeglądaj oferty"
        case .cars: return "Samochody, przeglądaj auta"
        case .map: return "Mapa ofert"
        case .search: return "Szukaj ofert, agentów i biur"
        case .favorites: return "Ulubione oferty"
        case .account: return "Konto i ustawienia"
        }
    }

    var iconName: String {
        switch self {
        case .showroom: return "house.fill"
        case .cars: return "car.fill"
        case .map: return "map.fill"
        case .search: return "magnifyingglass"
        case .favorites: return "heart.fill"
        case .account: return "person.crop.circle"
        }
    }

    static func tab(for brand: CatalogBrand) -> HomeTab {
        brand == .car ? .cars : .showroom
    }
}

enum HomeChromeFocus: Hashable {
    case tab(HomeTab)
    case brandSwitcher
    case moreFilters
}

enum HomeShowroomFocus: Hashable {
    case hero
    case firstRail
}

enum HomeAuxFocus: Hashable {
    case searchQuery
}

enum HomeAccountFocus: Hashable {
    case refresh
    case login
    case advanced
    case topShelf(TopShelfPresentationStyle)
}
