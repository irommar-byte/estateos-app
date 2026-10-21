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

    private enum DetailPage: Hashable { case offer, details, photos }

    private enum DetailFocus: Hashable {
        case gallery, contact, favorite
        case description, contactCard
        case photo(Int)

        var page: DetailPage {
            switch self {
            case .gallery, .contact, .favorite: return .offer
            case .description, .contactCard: return .details
            case .photo: return .photos
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
            }
        }
        .fullScreenCover(isPresented: $showQR, content: qrSheet)
        .fullScreenCover(item: $gallery) { request in
            EOSGalleryView(urls: imageURLs, title: presentation.title, startIndex: request.start)
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

    /// Up to five headline facts, in the order a buyer scans them.
    private var keyFacts: [DetailPresentation.SpecRow] {
        let preferred = [
            "area", "rooms", "ppsm", "type",                             // nieruchomości
            "year", "mileage", "power", "fuel", "gear",                  // samochody
        ]
        let byId = Dictionary(presentation.specRows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return preferred.compactMap { byId[$0] }.prefix(5).map { $0 }
    }

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

// MARK: - Gallery

/// Full-screen gallery (layers, back to front):
///   1. the photo, edge to edge (Ken Burns only while the chrome is hidden)
///   2. a soft bottom gradient
///   3. a compact title capsule, top-left
///   4. a slim glass filmstrip pinned to the bottom — fixed height, never covering the photo
/// ◀ ▶ moves through the strip and the big photo follows instantly. Select hides/shows the
/// chrome, ⏯ runs a slideshow, MENU first brings the chrome back, then closes. The strip
/// never disappears by itself.
struct EOSGalleryView: View {
    let urls: [URL]
    let title: String

    @Environment(\.dismiss) private var dismiss
    @State private var index: Int
    /// The big photo follows `index` once the strip stops moving (no download per flicked thumb).
    @State private var photoIndex: Int
    @State private var photoTask: Task<Void, Never>?
    @State private var chromeHidden = false
    @State private var slideshow: Task<Void, Never>?
    @FocusState private var focusedThumb: Int?

    private static let thumbSize = CGSize(width: 224, height: 126)
    private static let stripPadding: CGFloat = 22

    init(urls: [URL], title: String, startIndex: Int) {
        self.urls = urls
        self.title = title
        let start = min(max(0, startIndex), max(0, urls.count - 1))
        _index = State(initialValue: start)
        _photoIndex = State(initialValue: start)
    }

    var body: some View {
        ZStack {
            // 1. Photo — swaps only when the next one is decoded, so it never flashes black.
            Color.black.ignoresSafeArea()
            if urls.indices.contains(photoIndex) {
                EOSBackdrop(url: urls[photoIndex])
            }

            // 2. Gradient (only under the strip)
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.62),
                    .init(color: .black.opacity(0.55), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .opacity(chromeHidden ? 0 : 1)

            // 3 + 4. Chrome
            VStack(alignment: .leading, spacing: 0) {
                titleCapsule
                Spacer(minLength: 0)
                filmstrip
            }
            .opacity(chromeHidden ? 0 : 1)
        }
        .animation(.easeInOut(duration: 0.35), value: chromeHidden)
        .defaultFocus($focusedThumb, index)
        .onAppear {
            focusedThumb = index
            prefetchNeighbours()
        }
        .onPlayPauseCommand { toggleSlideshow() }
        .onExitCommand {
            if chromeHidden {
                chromeHidden = false
            } else {
                slideshow?.cancel()
                dismiss()
            }
        }
        .onDisappear {
            slideshow?.cancel()
            photoTask?.cancel()
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
            if slideshow != nil {
                Image(systemName: "play.fill").font(.system(size: 18))
            }
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
                        Button { chromeHidden.toggle() } label: {
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
                        .accessibilityLabel("Zdjęcie \(i + 1) z \(urls.count)")
                    }
                }
                .padding(.horizontal, 32)
                .padding(.vertical, Self.stripPadding)
            }
            .scrollClipDisabled()
            .frame(height: height)   // a horizontal ScrollView is greedy vertically — pin it
            .onAppear { proxy.scrollTo(index, anchor: .center) }
            .onChange(of: index) { _, i in
                withAnimation(EOSMotion.gallery) { proxy.scrollTo(i, anchor: .center) }
            }
        }
        .frame(maxWidth: .infinity)
        .eosGlassPanel(cornerRadius: 36)
        .focusSection()
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
        let around = [photoIndex + 1, photoIndex - 1, photoIndex + 2].filter { urls.indices.contains($0) }
        EOSImageCache.prefetch(urls: around.map { urls[$0] }, size: .screen)
    }

    private func toggleSlideshow() {
        if let running = slideshow {
            running.cancel()
            slideshow = nil
            return
        }
        chromeHidden = true
        slideshow = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                guard !Task.isCancelled, !urls.isEmpty else { return }
                let next = (index + 1) % urls.count
                index = next
                photoIndex = next
                focusedThumb = next
                prefetchNeighbours()
            }
        }
    }
}
