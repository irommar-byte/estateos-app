import SwiftUI

/// Listing detail — two composed screens plus a photo strip (2026-10 redesign, v3).
///
///  Screen 1 · Oferta     full-bleed photo, title, the key numbers (m², pokoje, cena/m² …) as a
///                        calm spec strip, price and actions. Nothing half-visible at the bottom.
///  Screen 2 · Szczegóły  ALL parameters in one grid, description and contact — composed to fit
///                        exactly one TV screen, so nothing ever sits under the edge.
///  Screen 3 · Zdjęcia    the photo strip.
///
/// The page moves screen by screen: the moment focus enters another screen, the whole page glides
/// to that screen's top in one spring — never a half-scrolled state. The photo behind softens
/// (pre-blurred copy, cross-fade) once you leave screen 1. MENU goes back a screen, then closes.
struct DetailShellView<QRSheet: View>: View {
    let presentation: DetailPresentation
    let isFavorite: Bool
    let favoriteIdleAccent: Color
    let onClose: () -> Void
    let onToggleFavorite: () -> Void
    var isLoadingDescription: Bool = false
    var heroNamespace: Namespace.ID? = nil
    var heroTransitionID: String? = nil
    /// "Może Ci się spodobać" rails at the end of the page (similar area / price / layout).
    var similar: [ShowroomSection] = []
    var onOpenSimilar: (ShowroomItem) -> Void = { _ in }
    @ViewBuilder var qrSheet: () -> QRSheet

    @State private var showQR = false
    @State private var showDescription = false
    @State private var gallery: GalleryRequest?
    @State private var page: DetailPage = .offer
    @FocusState private var focus: DetailFocus?

    private struct GalleryRequest: Identifiable {
        let id = UUID()
        let start: Int
    }

    private enum DetailPage: Hashable { case offer, details, photos, similar }

    private enum DetailFocus: Hashable {
        case gallery, contact, favorite
        case description, contactCard
        case photo(Int)
        case similar(String)

        var page: DetailPage {
            switch self {
            case .gallery, .contact, .favorite: return .offer
            case .description, .contactCard: return .details
            case .photo: return .photos
            case .similar: return .similar
            }
        }
    }

    private var imageURLs: [URL] { presentation.imageURLs }
    private var softened: Bool { page != .offer }
    private var firstFocus: DetailFocus { imageURLs.isEmpty ? .contact : .gallery }
    private static var pageSpring: Animation { .spring(response: 0.6, dampingFraction: 0.92) }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                EOSBackdrop(url: imageURLs.first)
                EOSBackdrop(url: imageURLs.first, soft: true)
                    .overlay(Color.black.opacity(0.52))
                    .opacity(softened ? 1 : 0)
                EOSBackdropScrim()
                    .opacity(softened ? 0 : 1)

                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 0) {
                            offerScreen
                                .frame(height: geo.size.height, alignment: .bottomLeading)
                                .id(DetailPage.offer)

                            detailsScreen
                                .frame(height: geo.size.height, alignment: .topLeading)
                                .id(DetailPage.details)

                            if imageURLs.count > 1 {
                                photosScreen
                                    .id(DetailPage.photos)
                            }

                            if !similar.isEmpty {
                                similarScreen
                                    .id(DetailPage.similar)
                            }
                        }
                    }
                    .scrollClipDisabled()
                    .onChange(of: focus) { _, newFocus in
                        guard let newPage = newFocus?.page, newPage != page else { return }
                        withAnimation(Self.pageSpring) {
                            page = newPage
                            proxy.scrollTo(newPage, anchor: .top)
                        }
                    }
                }
            }
            .animation(.easeInOut(duration: 0.45), value: softened)
        }
        .defaultFocus($focus, firstFocus)
        .onAppear { focus = firstFocus }
        .onExitCommand {
            switch page {
            case .offer: onClose()
            case .details: focus = firstFocus
            case .photos: focus = .description
            case .similar: focus = imageURLs.count > 1 ? .photo(0) : .description
            }
        }
        .fullScreenCover(isPresented: $showQR, content: qrSheet)
        .fullScreenCover(item: $gallery) { request in
            EOSGalleryView(
                urls: imageURLs,
                title: presentation.title,
                startIndex: request.start,
                info: GalleryOfferInfo(presentation: presentation, eyebrow: eyebrow)
            )
        }
        .fullScreenCover(isPresented: $showDescription) {
            DescriptionReader(
                title: presentation.title,
                text: presentation.descriptionText ?? "",
                backdrop: imageURLs.first
            )
        }
    }

    // MARK: Screen 1 · Oferta

    private var offerScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(eyebrow)
                .font(.system(size: 20, weight: .bold))
                .tracking(2.4)
                .foregroundStyle(.white.opacity(0.78))
                .lineLimit(1)
                .padding(.bottom, 16)

            Text(presentation.title)
                .font(.system(size: 72, weight: .bold))
                .tracking(-1)
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .shadow(color: .black.opacity(0.35), radius: 24, y: 4)
                .frame(maxWidth: 1300, alignment: .leading)
                .padding(.bottom, 30)

            if !keyFacts.isEmpty {
                keyFactsStrip
                    .padding(.bottom, 30)
            }

            HStack(alignment: .firstTextBaseline, spacing: 22) {
                Text(presentation.priceText)
                    .font(.system(size: 52, weight: .semibold))
                    .tracking(-0.5)
                    .foregroundStyle(.white)
                if let stats = presentation.ownerStats {
                    Label("\(stats.views)", systemImage: "eye.fill")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                    Label("\(stats.favorites)", systemImage: "heart.fill")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
            }

            HStack(spacing: 24) {
                if !imageURLs.isEmpty {
                    Button { gallery = GalleryRequest(start: 0) } label: {
                        Label("Zdjęcia · \(imageURLs.count)", systemImage: "photo.on.rectangle.angled")
                    }
                    .eosButton()
                    .focused($focus, equals: .gallery)
                }
                Button { showQR = true } label: {
                    Label("Kontakt", systemImage: "qrcode")
                }
                .eosButton()
                .focused($focus, equals: .contact)
                Button(action: onToggleFavorite) {
                    Image(systemName: isFavorite ? "heart.fill" : "heart")
                        .foregroundStyle(isFavorite ? Color.pink : Color.primary)
                        .accessibilityLabel(isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych")
                }
                .eosButton()
                .focused($focus, equals: .favorite)
            }
            .padding(.top, 34)

            HStack(spacing: 10) {
                Text("Wszystkie parametry, opis i kontakt")
                Image(systemName: "chevron.down")
            }
            .font(.system(size: 21, weight: .medium))
            .foregroundStyle(.white.opacity(0.62))
            .padding(.top, 40)
            .opacity(page == .offer ? 1 : 0)
        }
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusSection()
    }

    /// The numbers people look for first, as one calm row: value large, label small.
    private var keyFactsStrip: some View {
        HStack(alignment: .center, spacing: 0) {
            ForEach(Array(keyFacts.enumerated()), id: \.element.id) { index, row in
                if index > 0 {
                    Rectangle()
                        .fill(Color.white.opacity(0.22))
                        .frame(width: 1.5, height: 56)
                        .padding(.horizontal, 36)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(row.value)
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(row.label.uppercased())
                        .font(.system(size: 17, weight: .semibold))
                        .tracking(1.6)
                        .foregroundStyle(.white.opacity(0.6))
                        .lineLimit(1)
                }
                .fixedSize()
            }
        }
    }

    private var keyFacts: [DetailPresentation.SpecRow] { presentation.keyFacts }

    private var eyebrow: String {
        [presentation.transactionBadgeText, presentation.locationLine]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
            .uppercased()
    }

    // MARK: Screen 2 · Szczegóły

    private var detailsScreen: some View {
        VStack(alignment: .leading, spacing: 30) {
            HStack(alignment: .firstTextBaseline, spacing: 20) {
                Text("Szczegóły")
                    .font(.system(size: 44, weight: .bold))
                    .tracking(-0.5)
                Text(presentation.title)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(presentation.priceText)
                    .font(.system(size: 32, weight: .semibold))
            }
            .foregroundStyle(.white)

            if !presentation.specRows.isEmpty {
                factsGrid
            }

            HStack(alignment: .top, spacing: 32) {
                descriptionCard
                contactCard
            }
            .focusSection()

            Spacer(minLength: 0)
        }
        .padding(.top, 70)
    }

    /// Every parameter, sized so up to 16 fit on screen 2 together with description and contact.
    private var factsGrid: some View {
        let rows = Array(presentation.specRows.prefix(16))
        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 20), count: 4),
            alignment: .leading,
            spacing: 20
        ) {
            ForEach(rows) { row in
                HStack(spacing: 18) {
                    Image(systemName: row.icon)
                        .font(.system(size: 26, weight: .medium))
                        .foregroundStyle(.white.opacity(0.72))
                        .frame(width: 36)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(row.label)
                            .font(.system(size: 18, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))
                            .lineLimit(1)
                        Text(row.value)
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 24)
                .frame(height: rows.count > 12 ? 82 : 96)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.13), lineWidth: 1)
                )
            }
        }
    }

    private var descriptionCard: some View {
        Button { showDescription = true } label: {
            VStack(alignment: .leading, spacing: 14) {
                Text("OPIS")
                    .font(.system(size: 18, weight: .bold))
                    .tracking(2)
                    .foregroundStyle(.secondary)
                if let text = presentation.descriptionText, !text.isEmpty {
                    Text(text)
                        .font(.system(size: 24))
                        .lineSpacing(6)
                        .lineLimit(4)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                    Text("Czytaj całość ›")
                        .font(.system(size: 22, weight: .semibold))
                } else if isLoadingDescription {
                    HStack(spacing: 14) {
                        ProgressView()
                        Text("Wczytywanie opisu…").font(.system(size: 24))
                    }
                } else {
                    Text("Ta oferta nie ma jeszcze opisu.")
                        .font(.system(size: 24))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(34)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .frame(height: 260, alignment: .topLeading)
        }
        .buttonStyle(.card)
        .focused($focus, equals: .description)
    }

    private var contactCard: some View {
        Button { showQR = true } label: {
            HStack(spacing: 28) {
                Image(systemName: "qrcode")
                    .font(.system(size: 110, weight: .regular))
                    .frame(width: 150, height: 150)
                VStack(alignment: .leading, spacing: 10) {
                    Text("KONTAKT")
                        .font(.system(size: 18, weight: .bold))
                        .tracking(2)
                        .foregroundStyle(.secondary)
                    Text("Zadzwoń lub napisz z iPhone’a")
                        .font(.system(size: 27, weight: .semibold))
                    Text("Kod QR otworzy tę ofertę w EstateOS na telefonie.")
                        .font(.system(size: 21))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .padding(34)
            .frame(width: 680, height: 260, alignment: .leading)
        }
        .buttonStyle(.card)
        .focused($focus, equals: .contactCard)
    }

    // MARK: Screen 4 · Może Ci się spodobać

    private var similarScreen: some View {
        VStack(alignment: .leading, spacing: 56) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Może Ci się spodobać")
                    .font(.system(size: 44, weight: .bold))
                    .tracking(-0.5)
                    .foregroundStyle(.white)
                Text("Podobne oferty — wybierz, aby przejść dalej. MENU wraca do poprzedniej.")
                    .font(.system(size: 21, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
            ForEach(similar) { section in
                VStack(alignment: .leading, spacing: 4) {
                    ShowroomSectionHeader(section: section)
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(alignment: .top, spacing: 48) {
                            ForEach(section.items) { item in
                                EOSPosterCard(
                                    imageURL: item.imageURL,
                                    title: item.title,
                                    subtitle: item.cardSubtitle,
                                    width: 400,
                                    action: { onOpenSimilar(item) }
                                ) {
                                    if let badge = item.badge {
                                        EOSGlassBadge(text: badge, tint: Color(red: 0.5, green: 0.86, blue: 0.66))
                                    }
                                }
                                .focused($focus, equals: .similar("\(section.id)|\(item.id)"))
                            }
                        }
                        .padding(.vertical, 36)
                    }
                    .scrollClipDisabled()
                }
                .focusSection()
                .onAppear {
                    EOSImageCache.prefetch(urls: section.items.prefix(6).compactMap(\.imageURL), size: .card)
                }
            }
        }
        .padding(.top, 70)
        .padding(.bottom, 140)
    }

    // MARK: Screen 3 · Zdjęcia

    private var photosScreen: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Zdjęcia")
                .font(.system(size: 44, weight: .bold))
                .tracking(-0.5)
                .foregroundStyle(.white)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 40) {
                    ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, url in
                        Button { gallery = GalleryRequest(start: index) } label: {
                            EOSCachedRemoteImage(url: url, contentMode: .fill) {
                                Color.white.opacity(0.08)
                            }
                            .frame(width: 480, height: 270)
                            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                            .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 26, style: .continuous))
                            .hoverEffect(.highlight)
                        }
                        .buttonStyle(.borderless)
                        .focused($focus, equals: .photo(index))
                        .accessibilityLabel("Zdjęcie \(index + 1) z \(imageURLs.count)")
                    }
                }
                .padding(.vertical, 40)
            }
            .scrollClipDisabled()
            .frame(height: 350)
        }
        .padding(.top, 70)
        .padding(.bottom, 120)
        .focusSection()
    }
}

// MARK: - Full description

private struct DescriptionReader: View {
    let title: String
    let text: String
    let backdrop: URL?

    var body: some View {
        ZStack {
            EOSBackdrop(url: backdrop, soft: true)
                .overlay(Color.black.opacity(0.5))
            VStack(alignment: .leading, spacing: 28) {
                Text(title)
                    .font(.system(size: 44, weight: .bold))
                    .lineLimit(2)
                EOSScreenFitText(text: text, maxSize: 36, minSize: 24)
            }
            .padding(56)
            .eosGlassPanel(cornerRadius: 44)
            .padding(.horizontal, 160)
            .padding(.vertical, 80)
        }
    }
}

// MARK: - Key facts (shared by the detail page and the gallery info card)

extension DetailPresentation {
    /// Up to five headline facts, in the order a buyer scans them.
    var keyFacts: [SpecRow] {
        let preferred = [
            "area", "rooms", "ppsm", "floor", "built", "type",          // nieruchomości
            "year", "mileage", "power", "fuel", "gear",                  // samochody
        ]
        let byId = Dictionary(specRows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return Array(preferred.compactMap { byId[$0] }.prefix(5))
    }
}

/// What the gallery's ▲ info card shows about the listing.
struct GalleryOfferInfo {
    let eyebrow: String
    let title: String
    let price: String
    let facts: [DetailPresentation.SpecRow]

    init(presentation: DetailPresentation, eyebrow: String) {
        self.eyebrow = eyebrow
        title = presentation.title
        price = presentation.priceText
        facts = presentation.keyFacts
    }
}

// MARK: - Gallery

/// Gallery with two modes.
///
/// STRIP — photo behind, title capsule, glass filmstrip at the bottom. ◀ ▶ browse thumbnails,
///         the big photo follows when the strip rests. Select on a thumbnail → FULL SCREEN.
/// FULL SCREEN — nothing but the photo. ◀ ▶ glide photo to photo (directional slide with a
///         touch of depth), a small counter appears and fades. ▲ raises a glass card with the
///         essentials of the listing, ▼ lowers it. ⏯ slideshow. MENU → back to the strip;
///         MENU on the strip closes the gallery.
struct EOSGalleryView: View {
    let urls: [URL]
    let title: String
    var info: GalleryOfferInfo? = nil

    private enum Mode { case strip, fullscreen }

    @Environment(\.dismiss) private var dismiss
    @State private var mode: Mode = .strip
    @State private var index: Int
    /// The strip's big photo follows `index` once the strip stops moving.
    @State private var photoIndex: Int
    @State private var photoTask: Task<Void, Never>?
    @State private var direction: EOSGallerySlideDirection = .none
    @State private var showInfo = false
    @State private var showCounter = false
    @State private var counterTask: Task<Void, Never>?
    @State private var slideshow: Task<Void, Never>?
    @FocusState private var focusedThumb: Int?
    @FocusState private var stageFocused: Bool

    private static let thumbSize = CGSize(width: 224, height: 126)
    private static let stripPadding: CGFloat = 22

    init(urls: [URL], title: String, startIndex: Int, info: GalleryOfferInfo? = nil) {
        self.urls = urls
        self.title = title
        self.info = info
        let start = min(max(0, startIndex), max(0, urls.count - 1))
        _index = State(initialValue: start)
        _photoIndex = State(initialValue: start)
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch mode {
            case .strip:
                stripMode
                    .transition(.opacity)
            case .fullscreen:
                fullscreenMode
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: mode)
        .onPlayPauseCommand { toggleSlideshow() }
        .onExitCommand {
            switch mode {
            case .fullscreen:
                if showInfo {
                    withAnimation(Self.cardSpring) { showInfo = false }
                } else {
                    leaveFullscreen()
                }
            case .strip:
                stopSlideshow()
                dismiss()
            }
        }
        .onDisappear {
            stopSlideshow()
            photoTask?.cancel()
            counterTask?.cancel()
        }
    }

    // MARK: Strip mode

    private var stripMode: some View {
        ZStack {
            if urls.indices.contains(photoIndex) {
                EOSBackdrop(url: urls[photoIndex])
            }
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.6),
                    .init(color: .black.opacity(0.6), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: 0) {
                titleCapsule
                Spacer(minLength: 0)
                filmstrip
            }
        }
        .defaultFocus($focusedThumb, index)
        .onAppear {
            focusedThumb = index
            prefetchNeighbours()
        }
    }

    private var titleCapsule: some View {
        HStack(spacing: 14) {
            Text(title)
                .font(.system(size: 24, weight: .semibold))
                .lineLimit(1)
                .frame(maxWidth: 900, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            Text("\(index + 1) / \(urls.count)")
                .font(.system(size: 22, weight: .medium).monospacedDigit())
                .foregroundStyle(.white.opacity(0.75))
        }
        .padding(.horizontal, 26)
        .padding(.vertical, 14)
        .eosGlassPanel(Capsule())
        .fixedSize()
    }

    private var filmstrip: some View {
        let height = Self.thumbSize.height + Self.stripPadding * 2
        return ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 22) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { i, url in
                        Button { enterFullscreen(at: i) } label: {
                            EOSCachedRemoteImage(url: url, contentMode: .fill, size: .thumb) {
                                Color.white.opacity(0.08)
                            }
                            .frame(width: Self.thumbSize.width, height: Self.thumbSize.height)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .hoverEffect(.highlight)
                            .opacity(i == index ? 1 : 0.62)
                            .background(EOSFocusProbe { select(i) })
                        }
                        .buttonStyle(.borderless)
                        .focused($focusedThumb, equals: i)
                        .id(i)
                        .accessibilityLabel("Zdjęcie \(i + 1) z \(urls.count). Otwórz na pełnym ekranie")
                    }
                }
                .padding(.horizontal, 32)
                .padding(.vertical, Self.stripPadding)
            }
            .scrollClipDisabled()
            .frame(height: height)   // a horizontal ScrollView is greedy vertically — pin it
            .onAppear { proxy.scrollTo(index, anchor: .center) }
        }
        .frame(maxWidth: .infinity)
        .eosGlassPanel(cornerRadius: 36)
        .focusSection()
    }

    // MARK: Full-screen mode

    private var fullscreenMode: some View {
        ZStack(alignment: .bottomLeading) {
            // The photo — directional slide with depth when moving through the set.
            ZStack {
                if urls.indices.contains(index) {
                    FullscreenPhoto(url: urls[index])
                        .id(index)
                        .transition(direction.transition)
                }
            }
            .ignoresSafeArea()
            .animation(.spring(response: 0.55, dampingFraction: 0.9), value: index)

            // Soft floor for the info card.
            LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
                .ignoresSafeArea()
                .opacity(showInfo ? 1 : 0)
                .allowsHitTesting(false)

            // Counter capsule — appears on each move, fades away.
            HStack(spacing: 10) {
                Text("\(index + 1) / \(urls.count)")
                    .font(.system(size: 22, weight: .semibold).monospacedDigit())
                if slideshow != nil {
                    Image(systemName: "play.fill").font(.system(size: 16))
                }
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .eosGlassPanel(Capsule())
            .opacity(showCounter || slideshow != nil ? 1 : 0)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .animation(.easeInOut(duration: 0.35), value: showCounter)

            // ▲ info card.
            if showInfo, let info {
                GalleryInfoCard(info: info)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if !showInfo, info != nil, showCounter {
                Label("Informacje o ofercie", systemImage: "chevron.up")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(.white.opacity(0.75))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .eosGlassPanel(Capsule())
                    .transition(.opacity)
            }

            // Invisible focus target that owns the remote in full screen.
            Button { withAnimation(Self.cardSpring) { showInfo.toggle() } } label: {
                Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .buttonStyle(GalleryStageButtonStyle())
            .focused($stageFocused)
            .onMoveCommand(perform: handleMove)
            .accessibilityLabel("Zdjęcie \(index + 1) z \(urls.count)")
        }
        .onAppear {
            stageFocused = true
            flashCounter()
            prefetchNeighbours()
        }
    }

    private static var cardSpring: Animation { .spring(response: 0.5, dampingFraction: 0.88) }

    // MARK: Actions

    private func enterFullscreen(at i: Int) {
        direction = .none
        index = i
        photoIndex = i
        showInfo = false
        mode = .fullscreen
    }

    private func leaveFullscreen() {
        stopSlideshow()
        showInfo = false
        photoIndex = index
        mode = .strip
        focusedThumb = index
    }

    private func handleMove(_ move: MoveCommandDirection) {
        switch move {
        case .left: step(-1)
        case .right: step(1)
        case .up:
            guard info != nil else { return }
            withAnimation(Self.cardSpring) { showInfo = true }
        case .down:
            withAnimation(Self.cardSpring) { showInfo = false }
        default: break
        }
    }

    private func step(_ delta: Int) {
        let next = index + delta
        guard urls.indices.contains(next) else { return }
        direction = delta > 0 ? .forward : .back
        index = next
        flashCounter()
        prefetchNeighbours()
    }

    private func flashCounter() {
        counterTask?.cancel()
        showCounter = true
        counterTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            guard !Task.isCancelled else { return }
            showCounter = false
        }
    }

    private func select(_ i: Int) {
        guard i != index else { return }
        index = i
        photoTask?.cancel()
        photoTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 140_000_000)
            guard !Task.isCancelled else { return }
            photoIndex = i
            prefetchNeighbours()
        }
    }

    private func prefetchNeighbours() {
        let around = [index + 1, index - 1, index + 2].filter { urls.indices.contains($0) }
        EOSImageCache.prefetch(urls: around.map { urls[$0] }, size: .screen)
    }

    private func toggleSlideshow() {
        if slideshow != nil {
            stopSlideshow()
            return
        }
        if mode == .strip { enterFullscreen(at: index) }
        withAnimation(Self.cardSpring) { showInfo = false }
        slideshow = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 4_500_000_000)
                guard !Task.isCancelled, !urls.isEmpty else { return }
                direction = .forward
                index = (index + 1) % urls.count
                prefetchNeighbours()
            }
        }
    }

    private func stopSlideshow() {
        slideshow?.cancel()
        slideshow = nil
    }
}

/// One full-screen photo: the cached screen-size image on the first frame when available,
/// otherwise a soft placeholder until it is decoded. Very slow drift keeps it alive.
private struct FullscreenPhoto: View {
    let url: URL
    @State private var drift = false

    var body: some View {
        GeometryReader { geo in
            EOSCachedRemoteImage(url: url, contentMode: .fill, size: .screen) {
                EOSCachedRemoteImage(url: url, contentMode: .fill, size: .card) { Color.black }
                    .blur(radius: 12, opaque: true)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .scaleEffect(drift ? 1.035 : 1)
            .clipped()
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 18).repeatForever(autoreverses: true)) { drift = true }
        }
    }
}

/// The remote's target in full screen: no visible chrome, no focus lift.
private struct GalleryStageButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}

/// ▲ card: the essentials of the listing over the photo, in one calm glass panel.
private struct GalleryInfoCard: View {
    let info: GalleryOfferInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !info.eyebrow.isEmpty {
                Text(info.eyebrow)
                    .font(.system(size: 18, weight: .bold))
                    .tracking(2.2)
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
                    .padding(.bottom, 12)
            }
            Text(info.title)
                .font(.system(size: 44, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .padding(.bottom, 22)

            HStack(alignment: .center, spacing: 0) {
                Text(info.price)
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(.white)
                    .fixedSize()
                ForEach(info.facts) { row in
                    Rectangle()
                        .fill(Color.white.opacity(0.22))
                        .frame(width: 1.5, height: 48)
                        .padding(.horizontal, 30)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.value)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(row.label.uppercased())
                            .font(.system(size: 15, weight: .semibold))
                            .tracking(1.4)
                            .foregroundStyle(.white.opacity(0.6))
                            .lineLimit(1)
                    }
                    .fixedSize()
                }
            }

            HStack(spacing: 28) {
                Label("ukryj", systemImage: "chevron.down")
                Label("zdjęcia", systemImage: "arrow.left.and.right")
                Label("pokaz slajdów", systemImage: "playpause")
            }
            .font(.system(size: 18, weight: .medium))
            .foregroundStyle(.white.opacity(0.55))
            .padding(.top, 26)
        }
        .padding(.horizontal, 44)
        .padding(.vertical, 38)
        .frame(maxWidth: 1500, alignment: .leading)
        .eosGlassPanel(cornerRadius: 40)
    }
}
