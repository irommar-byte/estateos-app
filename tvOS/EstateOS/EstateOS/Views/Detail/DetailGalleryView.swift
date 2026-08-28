import SwiftUI

struct DetailGalleryView: View {
    let presentation: DetailPresentation
    @Binding var mode: DetailShellMode
    @Binding var photoIndex: Int
    @Binding var galleryStripVisible: Bool
    @Binding var gallerySlide: EOSGallerySlideDirection
    @FocusState.Binding var landing: DetailLanding?
    var onScheduleFilmstripHide: () -> Void
    var onCancelFilmstripHide: () -> Void

    private var imageURLs: [URL] { presentation.imageURLs }

    var body: some View {
        ZStack(alignment: .bottom) {
            if !galleryStripVisible {
                Color.clear
                    .contentShape(Rectangle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .focusable()
                    .focusEffectDisabled()
                    .focused($landing, equals: .galleryImmersive)
                    .onTapGesture { showGalleryStrip() }
                    .onPlayPauseCommand { showGalleryStrip() }
                    .onMoveCommand { direction in
                        switch direction {
                        case .left: stepGalleryPhoto(-1)
                        case .right: stepGalleryPhoto(1)
                        default: break
                        }
                    }
                    .zIndex(1)
            }

            VStack(spacing: 0) {
                HStack {
                    if galleryStripVisible {
                        Button { mode = .hero } label: {
                            Label("Zamknij galerię", systemImage: "xmark")
                        }
                        .buttonStyle(EOSDetailChromeButtonStyle())
                        .focusEffectDisabled()
                        .accessibilityLabel("Zamknij galerię")
                    }
                    Spacer()
                    Text("\(photoIndex + 1) / \(max(imageURLs.count, 1))")
                        .font(.system(size: galleryStripVisible ? 24 : 32, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, galleryStripVisible ? 18 : 22)
                        .padding(.vertical, galleryStripVisible ? 10 : 12)
                        .background(Capsule(style: .continuous).fill(.black.opacity(0.45)))
                        .overlay(Capsule(style: .continuous).stroke(Color.white.opacity(0.2), lineWidth: 1))
                }
                .padding(.horizontal, 48)
                .padding(.top, 28)
                .allowsHitTesting(galleryStripVisible)
                .focusSection()
                Spacer(minLength: 0)
                galleryCaptionPanel
                    .padding(.horizontal, 56)
                    .padding(.bottom, galleryStripVisible ? 232 : 64)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .zIndex(2)

            galleryFilmstrip
                .offset(y: galleryStripVisible ? 0 : 260)
                .opacity(galleryStripVisible ? 1 : 0)
                .allowsHitTesting(galleryStripVisible)
                .animation(.spring(response: 0.45, dampingFraction: 0.86), value: galleryStripVisible)
                .zIndex(3)
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.86), value: photoIndex)
    }

    @ViewBuilder
    private var transactionCapsule: some View {
        if let badge = presentation.transactionBadgeText {
            Text(badge.uppercased())
                .font(.caption.weight(.black))
                .tracking(1.1)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(
                        presentation.transactionBadgeIsRent
                            ? Color(red: 0.45, green: 0.55, blue: 0.72)
                            : presentation.accentColor
                    )
                )
                .foregroundStyle(.white)
        }
    }

    private var galleryCaptionPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                transactionCapsule
                EOSCountryLocationLabel(
                    locationLine: presentation.locationLine,
                    country: presentation.country,
                    font: .system(size: 16, weight: .medium, design: .rounded),
                    foreground: .white.opacity(0.82)
                )
            }
            EOSAdaptiveTitle(text: presentation.title, maxLines: 2, maxSize: 32, minSize: 20)
                .foregroundStyle(.white)
            Text(presentation.priceText)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundStyle(presentation.accentColor)
        }
        .padding(24)
        .eosGlass(cornerRadius: 26, opacity: 0.4)
        .frame(maxWidth: 620, alignment: .leading)
        .shadow(color: .black.opacity(0.35), radius: 24, y: 14)
        .id(photoIndex)
        .transition(.opacity.combined(with: .move(edge: .leading)))
    }

    private var galleryFilmstrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, url in
                    Button { enterGalleryImmersive(at: index) } label: {
                        EOSOfferThumbnail(url: url, height: 130)
                            .frame(width: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(
                                        photoIndex == index ? presentation.accentColor : Color.white.opacity(0.25),
                                        lineWidth: photoIndex == index ? 3 : 1
                                    )
                            )
                            .opacity(photoIndex == index ? 1 : 0.7)
                    }
                    .buttonStyle(EOSGalleryThumbButtonStyle())
                    .focusEffectDisabled()
                    .focused($landing, equals: .galleryThumb(index))
                    .accessibilityLabel("Zdjęcie \(index + 1) z \(imageURLs.count)")
                }
            }
            .padding(.horizontal, 48)
            .padding(.vertical, 18)
        }
        .padding(.bottom, 36)
        .padding(.top, 8)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [.clear, .black.opacity(0.55), .black.opacity(0.9)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
        )
        .focusSection()
    }

    private func enterGalleryImmersive(at index: Int) {
        gallerySlide = index > photoIndex ? .forward : (index < photoIndex ? .back : .none)
        photoIndex = index
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
            galleryStripVisible = false
        }
        landing = .galleryImmersive
        onCancelFilmstripHide()
    }

    private func showGalleryStrip() {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
            galleryStripVisible = true
        }
        landing = .galleryThumb(photoIndex)
        onScheduleFilmstripHide()
    }

    private func stepGalleryPhoto(_ delta: Int) {
        guard imageURLs.count > 1 else { return }
        gallerySlide = delta > 0 ? .forward : .back
        photoIndex = (photoIndex + delta + imageURLs.count) % imageURLs.count
    }
}
