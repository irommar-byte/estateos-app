import SwiftUI

/// Shared mode machine for EstateOS tvOS listing detail (hero → info → description → gallery).
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

    @State private var mode: DetailShellMode = .hero
    @State private var showQR = false
    @State private var photoIndex = 0
    @State private var galleryStripVisible = true
    @State private var gallerySlide: EOSGallerySlideDirection = .none
    @FocusState private var landing: DetailLanding?
    @State private var filmstripHideTask: Task<Void, Never>?

    private var imageURLs: [URL] { presentation.imageURLs }
    private var currentImageURL: URL? {
        guard !imageURLs.isEmpty else { return nil }
        return imageURLs[min(max(0, photoIndex), imageURLs.count - 1)]
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            heroBackgroundImage
            if mode != .gallery {
                LinearGradient(
                    colors: [.black.opacity(0.4), .clear, .black.opacity(0.35), .black.opacity(0.92)],
                    startPoint: .top, endPoint: .bottom
                )
                .ignoresSafeArea()
                .allowsHitTesting(false)
            }
            if mode == .info || mode == .description {
                Color.black.opacity(0.55).ignoresSafeArea()
            }
            switch mode {
            case .hero:
                DetailHeroView(
                    presentation: presentation,
                    isFavorite: isFavorite,
                    favoriteIdleAccent: favoriteIdleAccent,
                    onClose: onClose,
                    onToggleFavorite: onToggleFavorite,
                    showQR: $showQR,
                    mode: $mode,
                    landing: $landing,
                    heroNamespace: heroNamespace,
                    heroTransitionID: heroTransitionID
                )
                .transition(.eosModeTransition)
            case .info, .description:
                DetailInfoView(
                    presentation: presentation,
                    isFavorite: isFavorite,
                    favoriteIdleAccent: favoriteIdleAccent,
                    isLoadingDescription: isLoadingDescription,
                    mode: $mode,
                    showQR: $showQR,
                    onToggleFavorite: onToggleFavorite,
                    landing: $landing
                )
            case .gallery:
                DetailGalleryView(
                    presentation: presentation,
                    mode: $mode,
                    photoIndex: $photoIndex,
                    galleryStripVisible: $galleryStripVisible,
                    gallerySlide: $gallerySlide,
                    landing: $landing,
                    onScheduleFilmstripHide: scheduleFilmstripAutoHide,
                    onCancelFilmstripHide: { filmstripHideTask?.cancel() }
                )
                .transition(.eosModeTransition)
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.88, blendDuration: 0.25), value: mode)
        .animation(.easeOut(duration: 0.15), value: photoIndex)
        .fullScreenCover(isPresented: $showQR, content: qrSheet)
        .onAppear {
            mode = .hero
            photoIndex = 0
            landing = .moreInfo
            prefetchAdjacentPhotos()
        }
        .onChange(of: mode) { _, newMode in
            switch newMode {
            case .hero: landing = .moreInfo
            case .info: landing = .descriptionCard
            case .description: landing = .descriptionClose
            case .gallery:
                galleryStripVisible = true
                landing = .galleryThumb(photoIndex)
                scheduleFilmstripAutoHide()
            }
        }
        .onChange(of: photoIndex) { _, _ in
            prefetchAdjacentPhotos()
            if mode == .gallery, galleryStripVisible { scheduleFilmstripAutoHide() }
        }
        .onChange(of: galleryStripVisible) { _, visible in
            if visible, mode == .gallery { scheduleFilmstripAutoHide() }
            else { filmstripHideTask?.cancel() }
        }
        .onDisappear { filmstripHideTask?.cancel() }
        .onExitCommand { handleExitCommand() }
    }

    @ViewBuilder
    private var heroBackgroundImage: some View {
        let image = EOSFullBleedOfferImage(url: currentImageURL, ambient: mode == .gallery && !galleryStripVisible)
            .id(photoIndex)
            .transition(gallerySlide.transition)
            .ignoresSafeArea()
            .opacity((mode == .info || mode == .description) ? 0.28 : 1)
        if let heroNamespace, let heroTransitionID, mode == .hero {
            image.matchedGeometryEffect(id: heroTransitionID, in: heroNamespace)
        } else {
            image
        }
    }

    private func handleExitCommand() {
        switch mode {
        case .hero: onClose()
        case .info: mode = .hero
        case .description: mode = .info
        case .gallery:
            if !galleryStripVisible { showGalleryStripFromShell() }
            else { mode = .hero }
        }
    }

    private func showGalleryStripFromShell() {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) { galleryStripVisible = true }
        landing = .galleryThumb(photoIndex)
    }

    private func scheduleFilmstripAutoHide() {
        filmstripHideTask?.cancel()
        guard mode == .gallery, galleryStripVisible else { return }
        filmstripHideTask = Task {
            try? await Task.sleep(for: .seconds(4))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard mode == .gallery, galleryStripVisible else { return }
                withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) { galleryStripVisible = false }
                landing = .galleryImmersive
            }
        }
    }

    private func prefetchAdjacentPhotos() {
        guard !imageURLs.isEmpty else { return }
        var neighbors: [URL] = []
        for offset in [-1, 1] {
            let i = photoIndex + offset
            guard i >= 0, i < imageURLs.count else { continue }
            neighbors.append(imageURLs[i])
        }
        EOSImageCache.prefetch(urls: neighbors)
    }
}
