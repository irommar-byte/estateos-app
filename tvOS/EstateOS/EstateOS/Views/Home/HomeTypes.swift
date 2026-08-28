import SwiftUI

enum HomeTab: String, CaseIterable, Hashable {
    case showroom = "Showroom"
    case search = "Szukaj"
    case favorites = "Ulubione"
    case account = "Konto"

    var accessibilityLabel: String {
        switch self {
        case .showroom: return "Showroom, przeglądaj oferty"
        case .search: return "Szukaj w katalogu"
        case .favorites: return "Ulubione oferty"
        case .account: return "Konto i ustawienia"
        }
    }

    var iconName: String {
        switch self {
        case .showroom: return "play.rectangle.fill"
        case .search: return "magnifyingglass"
        case .favorites: return "heart.fill"
        case .account: return "gearshape"
        }
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

enum HomeAccountFocus: Hashable {
    case refresh
    case login
    case advanced
    case topShelf(TopShelfPresentationStyle)
}
