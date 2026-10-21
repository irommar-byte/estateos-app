import SwiftUI

/// Listing detail as ONE scrolling page (2026-10 redesign) — replaces the old hidden
/// hero → info → description → gallery mode machine.
///
/// Screen 1: full-bleed photo, title, price, actions (Zdjęcia is focused first).
/// Scroll ▼: facts grid, description card, contact card, photo rail. The photo behind
/// blurs and dims as you scroll so the glass panels stay readable.
/// MENU always closes the page in one step.
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
    @State private var scrolled = false
    @FocusState private var primaryFocused: Bool

    private struct GalleryRequest: Identifiable {
        let id = UUID()
        let start: Int
    }

    private var imageURLs: [URL] { presentation.imageURLs }
    private static var topAnchor: String { "detail-top" }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                EOSBackdrop(url: imageURLs.first)
                    .blur(radius: scrolled ? 50 : 0)
                    .overlay(Color.black.opacity(scrolled ? 0.45 : 0))
                    .animation(.easeInOut(duration: 0.5), value: scrolled)
                EOSBackdropScrim()
                    .opacity(scrolled ? 0.6 : 1)

                ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 64) {
                        hero
                            .frame(height: geo.size.height * 0.86, alignment: .bottomLeading)
                            .id(Self.topAnchor)
                        if !presentation.specRows.isEmpty { factsGrid }
                        HStack(alignment: .top, spacing: 36) {
                            descriptionCard
                            contactCard
                        }
                        .focusSection()
                        if imageURLs.count > 1 { photoRail }
                    }
                    .padding(.bottom, 90)
                }
                .scrollClipDisabled()
                .onScrollGeometryChange(for: Bool.self) { geometry in
                    geometry.contentOffset.y > 160
                } action: { _, isScrolled in
                    scrolled = isScrolled
                }
                // MENU: from further down the page, back to the top first; from the top, close.
                .onExitCommand {
                    if scrolled {
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.9)) {
                            proxy.scrollTo(Self.topAnchor, anchor: .top)
                        }
                        primaryFocused = true
                    } else {
                        onClose()
                    }
                }
                }
            }
        }
        .defaultFocus($primaryFocused, true)
        .onAppear { primaryFocused = true }
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

    // MARK: Screen 1

    private var hero: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(eyebrow)
                .font(.system(size: 20, weight: .bold))
                .tracking(2)
                .foregroundStyle(.white.opacity(0.78))
                .lineLimit(1)
            Text(presentation.title)
                .font(.system(size: 76, weight: .bold))
                .tracking(-1)
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .shadow(color: .black.opacity(0.35), radius: 24, y: 4)
            if !presentation.subtitleText.isEmpty {
                Text(presentation.subtitleText)
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(.white.opacity(0.86))
                    .lineLimit(1)
            }
            HStack(alignment: .firstTextBaseline, spacing: 22) {
                Text(presentation.priceText)
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(.white)
                if let stats = presentation.ownerStats {
                    Label("\(stats.views)", systemImage: "eye.fill")
                    Label("\(stats.favorites)", systemImage: "heart.fill")
                }
            }
            .font(.system(size: 22, weight: .medium))
            .foregroundStyle(.white.opacity(0.7))

            HStack(spacing: 24) {
                if !imageURLs.isEmpty {
                    Button { gallery = GalleryRequest(start: 0) } label: {
                        Label("Zdjęcia · \(imageURLs.count)", systemImage: "photo.on.rectangle.angled")
                    }
                    .eosButton()
                    .focused($primaryFocused)
                }
                Button { showQR = true } label: {
                    Label("Kontakt", systemImage: "qrcode")
                }
                .eosButton()
                Button(action: onToggleFavorite) {
                    Image(systemName: isFavorite ? "heart.fill" : "heart")
                        .foregroundStyle(isFavorite ? Color.pink : Color.primary)
                        .accessibilityLabel(isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych")
                }
                .eosButton()
            }
            .padding(.top, 22)

            HStack(spacing: 10) {
                Text("Szczegóły i opis")
                Image(systemName: "chevron.down")
            }
            .font(.system(size: 21, weight: .medium))
            .foregroundStyle(.white.opacity(0.6))
            .padding(.top, 34)
            .opacity(scrolled ? 0 : 1)
        }
        .frame(maxWidth: 1240, alignment: .leading)
        .focusSection()
    }

    private var eyebrow: String {
        [presentation.transactionBadgeText, presentation.locationLine]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
            .uppercased()
    }

    // MARK: Scroll content

    private var factsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 24), count: 4), alignment: .leading, spacing: 24) {
            ForEach(presentation.specRows) { row in
                HStack(spacing: 18) {
                    Image(systemName: row.icon)
                        .font(.system(size: 28, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(width: 40)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.label)
                            .font(.system(size: 19, weight: .medium))
                            .foregroundStyle(.white.opacity(0.62))
                        Text(row.value)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 26)
                .padding(.vertical, 22)
                .eosGlassPanel(cornerRadius: 28)
            }
        }
    }

    private var descriptionCard: some View {
        Button { showDescription = true } label: {
            VStack(alignment: .leading, spacing: 14) {
                Text("OPIS")
                    .font(.system(size: 19, weight: .bold))
                    .tracking(2)
                    .foregroundStyle(.secondary)
                if let text = presentation.descriptionText, !text.isEmpty {
                    Text(text)
                        .font(.system(size: 25))
                        .lineSpacing(6)
                        .lineLimit(6)
                        .multilineTextAlignment(.leading)
                    Text("Czytaj całość ›")
                        .font(.system(size: 22, weight: .semibold))
                } else if isLoadingDescription {
                    HStack(spacing: 14) {
                        ProgressView()
                        Text("Wczytywanie opisu…").font(.system(size: 24))
                    }
                } else {
                    Text("Ta oferta nie ma jeszcze opisu.")
                        .font(.system(size: 25))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(36)
            .frame(maxWidth: .infinity, minHeight: 300, alignment: .topLeading)
        }
        .buttonStyle(.card)
        .disabled((presentation.descriptionText ?? "").isEmpty)
    }

    private var contactCard: some View {
        Button { showQR = true } label: {
            HStack(spacing: 28) {
                Image(systemName: "qrcode")
                    .font(.system(size: 120, weight: .regular))
                    .frame(width: 170, height: 170)
                VStack(alignment: .leading, spacing: 12) {
                    Text("KONTAKT")
                        .font(.system(size: 19, weight: .bold))
                        .tracking(2)
                        .foregroundStyle(.secondary)
                    Text("Zadzwoń lub napisz z iPhone’a")
                        .font(.system(size: 28, weight: .semibold))
                    Text("Pokaż kod QR — oferta otworzy się w EstateOS na telefonie.")
                        .font(.system(size: 22))
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
            }
            .padding(36)
            .frame(width: 720, alignment: .leading)
            .frame(minHeight: 300)
        }
        .buttonStyle(.card)
    }

    private var photoRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Zdjęcia")
                .font(.system(size: 32, weight: .semibold))
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 40) {
                    ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, url in
                        Button { gallery = GalleryRequest(start: index) } label: {
                            EOSCachedRemoteImage(url: url, contentMode: .fill) {
                                Color.white.opacity(0.08)
                            }
                            .frame(width: 400, height: 225)
                            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                            .contentShape(.hoverEffect, RoundedRectangle(cornerRadius: 24, style: .continuous))
                            .hoverEffect(.highlight)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Zdjęcie \(index + 1) z \(imageURLs.count)")
                    }
                }
                .padding(.vertical, 36)
            }
            .scrollClipDisabled()
        }
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
            EOSBackdrop(url: backdrop)
                .blur(radius: 60)
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
    @State private var direction: EOSGallerySlideDirection = .none
    @State private var chromeHidden = false
    @State private var slideshow: Task<Void, Never>?
    @FocusState private var focusedThumb: Int?

    private static let thumbSize = CGSize(width: 224, height: 126)
    private static let stripPadding: CGFloat = 22

    init(urls: [URL], title: String, startIndex: Int) {
        self.urls = urls
        self.title = title
        _index = State(initialValue: min(max(0, startIndex), max(0, urls.count - 1)))
    }

    var body: some View {
        ZStack {
            // 1. Photo
            Color.black.ignoresSafeArea()
            if urls.indices.contains(index) {
                EOSFullBleedOfferImage(url: urls[index], ambient: chromeHidden, quietPlaceholder: true)
                    .id(index)
                    .transition(direction.transition)
                    .ignoresSafeArea()
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
        .animation(EOSMotion.gallery, value: index)
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
        .onDisappear { slideshow?.cancel() }
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
                            EOSCachedRemoteImage(url: url, contentMode: .fill) {
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
        direction = i > index ? .forward : .back
        index = i
        prefetchNeighbours()
    }

    private func prefetchNeighbours() {
        let around = [index - 1, index + 1, index + 2].filter { urls.indices.contains($0) }
        EOSImageCache.prefetch(urls: around.map { urls[$0] })
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
                direction = .forward
                index = next
                focusedThumb = next
            }
        }
    }
}
