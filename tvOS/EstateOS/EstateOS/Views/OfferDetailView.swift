import SwiftUI

struct OfferDetailView: View {
    @EnvironmentObject private var app: AppModel
    let offer: EstateOffer

    /// Prefer refreshed payload from AppModel (catalog list often lacks body copy).
    private var liveOffer: EstateOffer {
        if let selected = app.selectedOffer, selected.id == offer.id {
            return selected
        }
        return offer
    }

    private enum Mode: Equatable { case hero, info, description, gallery }
    private enum Landing: Hashable {
        case moreInfo, galleryEntry, infoClose, descriptionCard, descriptionClose
        case galleryThumb(Int), galleryImmersive
    }

    @State private var mode: Mode = .hero
    @State private var showQR = false
    @State private var photoIndex = 0
    @State private var galleryStripVisible = true
    @FocusState private var landing: Landing?

    private var imageURLs: [URL] { EOSOfferMedia.imageURLs(for: liveOffer) }
    private var currentImageURL: URL? {
        guard !imageURLs.isEmpty else { return nil }
        return imageURLs[min(max(0, photoIndex), imageURLs.count - 1)]
    }
    private var descriptionText: String? { liveOffer.displayDescription }
    private var isRent: Bool { (liveOffer.transactionType ?? "").uppercased().contains("RENT") }
    @State private var isLoadingDescription = false

    private struct SpecRow: Identifiable {
        let id: String; let label: String; let value: String; let icon: String
    }

    private var specRows: [SpecRow] {
        let raw: [(String, String, String, String?)] = [
            ("tx", "Transakcja", "arrow.left.arrow.right", liveOffer.transactionLabel),
            ("type", "Typ", "building.2", liveOffer.displayPropertyType),
            ("price", "Cena", "tag", EOSFormat.pricePLN(liveOffer.price)),
            ("area", "Metraż", "square.split.bottomrightquarter", liveOffer.area.map { "\(Int($0)) m²" }),
            ("rooms", "Pokoje", "bed.double", liveOffer.rooms.map { String(format: "%.0f", $0) }),
            ("ppsm", "Cena za m²", "chart.bar", liveOffer.pricePerSqm != nil ? liveOffer.displayPricePerSqm : nil),
            ("city", "Miasto", "mappin.and.ellipse", liveOffer.city),
            ("district", "Dzielnica", "map", liveOffer.district),
        ]
        return raw.compactMap { id, label, icon, value in
            guard let value else { return nil }
            let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !v.isEmpty, v != "—" else { return nil }
            return SpecRow(id: id, label: label, value: v, icon: icon)
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            EOSFullBleedOfferImage(url: currentImageURL)
                .ignoresSafeArea()
                .blur(radius: (mode == .info || mode == .description) ? 16 : 0)
                .opacity((mode == .info || mode == .description) ? 0.55 : 1)
            if mode != .gallery {
                LinearGradient(
                    colors: [.black.opacity(0.4), .clear, .black.opacity(0.35), .black.opacity(0.92)],
                    startPoint: .top, endPoint: .bottom
                ).ignoresSafeArea().allowsHitTesting(false)
            }
            if mode == .info || mode == .description {
                Color.black.opacity(0.55).ignoresSafeArea()
            }
            switch mode {
            case .hero:
                VStack(spacing: 0) { topCloseOnly; Spacer(minLength: 0); heroCard }
            case .info: fullInfoScreen
            case .description: fullDescriptionScreen
            case .gallery: galleryScreen
            }
        }
        .animation(.easeOut(duration: 0.22), value: mode)
        .animation(.easeOut(duration: 0.15), value: photoIndex)
        .sheet(isPresented: $showQR) { ContactQrSheet(offer: liveOffer) }
        .onAppear {
            mode = .hero
            photoIndex = 0
            landing = .moreInfo
            if descriptionText == nil {
                isLoadingDescription = true
                Task {
                    await app.refreshSelectedOfferDetail(id: offer.id)
                    isLoadingDescription = false
                }
            }
        }
        .onChange(of: liveOffer.description) { _, _ in
            if descriptionText != nil { isLoadingDescription = false }
        }
        .onChange(of: mode) { _, newMode in
            switch newMode {
            case .hero: landing = .moreInfo
            case .info: landing = .descriptionCard
            case .description: landing = .descriptionClose
            case .gallery:
                galleryStripVisible = true
                landing = .galleryThumb(photoIndex)
            }
        }
        .onExitCommand {
            switch mode {
            case .hero: app.closeDetail()
            case .info: mode = .hero
            case .description: mode = .info
            case .gallery:
                if !galleryStripVisible { showGalleryStrip() } else { mode = .hero }
            }
        }
    }

    private var topCloseOnly: some View {
        HStack {
            Button { app.closeDetail() } label: { Label("Zamknij", systemImage: "xmark") }
                .buttonStyle(EOSDetailChromeButtonStyle()).focusEffectDisabled()
            Spacer()
        }
        .padding(.horizontal, 56).padding(.top, 32).focusSection()
    }

    private var transactionCapsule: some View {
        Text(liveOffer.transactionLabel.uppercased())
            .font(.caption.weight(.black)).tracking(1.1)
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(Capsule().fill(isRent ? Color.blue : Color.green))
            .foregroundStyle(.white)
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                transactionCapsule
                if !liveOffer.displayLocation.isEmpty {
                    Label(liveOffer.displayLocation, systemImage: "mappin.and.ellipse")
                        .font(.callout.weight(.semibold)).foregroundStyle(.white.opacity(0.75))
                }
            }
            EOSAdaptiveTitle(text: liveOffer.title, maxLines: 2, maxSize: 46, minSize: 28).foregroundStyle(.white)
            Text(EOSFormat.pricePLN(liveOffer.price))
                .font(.system(size: 36, weight: .bold, design: .rounded)).foregroundStyle(.green)
            Text([
                liveOffer.transactionLabel,
                liveOffer.displayPropertyType,
                liveOffer.area.map { "\(Int($0)) m²" },
                liveOffer.rooms.map { String(format: "%.0f pok.", $0) },
            ].compactMap { $0 }.joined(separator: "  ·  "))
            .font(.title3.weight(.medium)).foregroundStyle(.white.opacity(0.82)).lineLimit(2)

            HStack(spacing: 14) {
                Button { Task { await app.toggleFavorite(liveOffer) } } label: {
                    Label(app.isFavorite(liveOffer.id) ? "W ulubionych" : "Ulubione",
                          systemImage: app.isFavorite(liveOffer.id) ? "heart.fill" : "heart")
                }
                .buttonStyle(.borderedProminent).focusEffectDisabled()
                .tint(app.isFavorite(liveOffer.id) ? .pink : .white.opacity(0.28)).foregroundStyle(.white)

                Button { showQR = true } label: { Label("Kontakt QR", systemImage: "qrcode") }
                    .buttonStyle(EOSDetailActionButtonStyle()).focusEffectDisabled()

                Spacer(minLength: 8)

                if imageURLs.count > 1 {
                    Button { mode = .gallery } label: { Label("Galeria", systemImage: "photo.on.rectangle.angled") }
                        .buttonStyle(EOSDetailActionButtonStyle()).focusEffectDisabled()
                        .focused($landing, equals: .galleryEntry)
                }
                Button { mode = .info } label: { Label("Więcej informacji", systemImage: "info.circle") }
                    .buttonStyle(EOSDetailActionButtonStyle(accent: .green)).focusEffectDisabled()
                    .focused($landing, equals: .moreInfo)
            }
        }
        .padding(30).frame(maxWidth: 1200, alignment: .leading)
        .eosGlass(cornerRadius: 28, opacity: 0.32)
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Color.white.opacity(0.16), lineWidth: 1))
        .padding(.horizontal, 56).padding(.bottom, 48).focusSection()
    }

    private var fullInfoScreen: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { mode = .hero } label: { Label("Zwiń", systemImage: "chevron.down") }
                    .buttonStyle(EOSDetailChromeButtonStyle()).focusEffectDisabled()
                    .focused($landing, equals: .infoClose)
                Text("Szczegóły oferty").font(.title2.weight(.bold)).foregroundStyle(.white)
                transactionCapsule
                Spacer()
                if imageURLs.count > 1 {
                    Button { mode = .gallery } label: { Label("Galeria", systemImage: "photo.on.rectangle.angled") }
                        .buttonStyle(EOSDetailActionButtonStyle()).focusEffectDisabled()
                }
                Button { showQR = true } label: { Label("Kontakt QR", systemImage: "qrcode") }
                    .buttonStyle(EOSDetailActionButtonStyle(accent: .green)).focusEffectDisabled()
                Button { Task { await app.toggleFavorite(liveOffer) } } label: {
                    Label(app.isFavorite(liveOffer.id) ? "W ulubionych" : "Ulubione",
                          systemImage: app.isFavorite(liveOffer.id) ? "heart.fill" : "heart")
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: app.isFavorite(liveOffer.id) ? .pink : .green))
                .focusEffectDisabled()
            }
            .padding(.horizontal, 48).padding(.top, 28).padding(.bottom, 16).focusSection()

            GeometryReader { geo in
                HStack(alignment: .top, spacing: 28) {
                    leftInfoColumn(availableHeight: geo.size.height)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    specsListPanel
                        .frame(width: min(560, geo.size.width * 0.4), alignment: .topLeading)
                        .frame(maxHeight: .infinity, alignment: .top)
                }
                .padding(.horizontal, 48).padding(.bottom, 28)
                .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            }
        }
    }

    private func leftInfoColumn(availableHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    transactionCapsule
                    if !liveOffer.displayLocation.isEmpty {
                        Label(liveOffer.displayLocation, systemImage: "mappin.and.ellipse")
                            .font(.callout.weight(.semibold)).foregroundStyle(.white.opacity(0.7))
                    }
                }
                EOSAdaptiveTitle(text: liveOffer.title, maxLines: 2, maxSize: 36, minSize: 24).foregroundStyle(.white)
                Text(EOSFormat.pricePLN(liveOffer.price))
                    .font(.system(size: 30, weight: .bold, design: .rounded)).foregroundStyle(.green)
                Text([liveOffer.transactionLabel, liveOffer.displayPropertyType, liveOffer.area.map { "\(Int($0)) m²" }]
                    .compactMap { $0 }.joined(separator: "  ·  "))
                    .font(.body.weight(.medium)).foregroundStyle(.white.opacity(0.78))
            }
            .padding(.bottom, 18)

            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1).padding(.bottom, 18)

            if let descriptionText {
                Button { mode = .description } label: {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Opis", systemImage: "text.alignleft")
                            .font(.title3.weight(.bold)).foregroundStyle(.white.opacity(0.95))
                        Text(descriptionText)
                            .font(.system(size: 23, weight: .regular, design: .rounded))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineSpacing(7)
                            .multilineTextAlignment(.leading)
                            .lineLimit(14)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .frame(maxWidth: .infinity, minHeight: max(160, availableHeight - 260), alignment: .topLeading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(EOSDetailCardButtonStyle()).focusEffectDisabled()
                .focused($landing, equals: .descriptionCard)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Opis", systemImage: "text.alignleft")
                        .font(.title3.weight(.bold)).foregroundStyle(.white.opacity(0.95))
                    if isLoadingDescription {
                        ProgressView()
                            .tint(.white)
                        Text("Ładowanie opisu…")
                            .font(.system(size: 22, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.7))
                    } else {
                        Text("Brak opisu dla tej oferty.")
                            .font(.system(size: 22, weight: .medium, design: .rounded))
                            .foregroundStyle(.white.opacity(0.55))
                    }
                }
                .frame(maxWidth: .infinity, minHeight: max(160, availableHeight - 260), alignment: .topLeading)
            }
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color(white: 0.08).opacity(0.92)))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Color.white.opacity(0.14), lineWidth: 1))
    }

    private var specsListPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Dane oferty", systemImage: "list.bullet.rectangle")
                .font(.headline.weight(.bold)).foregroundStyle(.white.opacity(0.95))
            VStack(spacing: 0) {
                ForEach(specRows) { row in
                    HStack(alignment: .center, spacing: 14) {
                        Image(systemName: row.icon).font(.body.weight(.semibold)).foregroundStyle(Color.green).frame(width: 28)
                        Text(row.label).font(.callout.weight(.medium)).foregroundStyle(.white.opacity(0.55))
                            .frame(width: 130, alignment: .leading).fixedSize(horizontal: true, vertical: false)
                        Text(row.value).font(.body.weight(.semibold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 9).padding(.horizontal, 4)
                    if row.id != specRows.last?.id { Divider().overlay(Color.white.opacity(0.1)) }
                }
            }
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color(white: 0.08).opacity(0.92)))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Color.white.opacity(0.14), lineWidth: 1))
    }

    private var fullDescriptionScreen: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { mode = .info } label: { Label("Wróć", systemImage: "chevron.left") }
                    .buttonStyle(EOSDetailChromeButtonStyle()).focusEffectDisabled()
                    .focused($landing, equals: .descriptionClose)
                Text("Opis").font(.title2.weight(.bold)).foregroundStyle(.white)
                transactionCapsule
                Spacer()
            }
            .padding(.horizontal, 48).padding(.top, 28).padding(.bottom, 12).focusSection()

            if let descriptionText {
                EOSScreenFitText(text: descriptionText, maxSize: 40, minSize: 18, lineSpacing: 8)
                    .padding(.horizontal, 56).padding(.vertical, 20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color(white: 0.06).opacity(0.88)))
                    .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(Color.white.opacity(0.12), lineWidth: 1))
                    .padding(.horizontal, 48).padding(.bottom, 40)
                    .focusSection()
            }
        }
    }

    private var galleryScreen: some View {
        ZStack(alignment: .bottom) {
            if !galleryStripVisible {
                Color.clear
                    .contentShape(Rectangle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .focusable()
                    .focusEffectDisabled()
                    .focused($landing, equals: .galleryImmersive)
                    .onTapGesture { showGalleryStrip() }
                    .onMoveCommand { d in
                        if d == .left { stepGalleryPhoto(-1) }
                        if d == .right { stepGalleryPhoto(1) }
                    }
                    .zIndex(1)
            }

            VStack(spacing: 0) {
                HStack {
                    if galleryStripVisible {
                        Button { mode = .hero } label: { Label("Zamknij galerię", systemImage: "xmark") }
                            .buttonStyle(EOSDetailChromeButtonStyle()).focusEffectDisabled()
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
                .padding(.horizontal, 48).padding(.top, 28)
                .allowsHitTesting(galleryStripVisible)
                .focusSection()
                Spacer(minLength: 0)
            }.zIndex(2)

            galleryFilmstrip
                .offset(y: galleryStripVisible ? 0 : 260)
                .opacity(galleryStripVisible ? 1 : 0)
                .allowsHitTesting(galleryStripVisible)
                .animation(.spring(response: 0.45, dampingFraction: 0.86), value: galleryStripVisible)
                .zIndex(3)
        }
    }

    private var galleryFilmstrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(Array(imageURLs.enumerated()), id: \.offset) { index, url in
                    Button { enterGalleryImmersive(at: index) } label: {
                        EOSOfferThumbnail(url: url, height: 130).frame(width: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(photoIndex == index ? Color.green : Color.white.opacity(0.25),
                                        lineWidth: photoIndex == index ? 3 : 1))
                            .opacity(photoIndex == index ? 1 : 0.7)
                    }
                    .buttonStyle(EOSGalleryThumbButtonStyle()).focusEffectDisabled()
                    .focused($landing, equals: .galleryThumb(index))
                }
            }
            .padding(.horizontal, 48).padding(.vertical, 18)
        }
        .padding(.bottom, 36).padding(.top, 8).frame(maxWidth: .infinity)
        .background(LinearGradient(colors: [.clear, .black.opacity(0.55), .black.opacity(0.9)],
                                   startPoint: .top, endPoint: .bottom).ignoresSafeArea(edges: .bottom))
        .focusSection()
    }

    private func enterGalleryImmersive(at index: Int) {
        photoIndex = index
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) { galleryStripVisible = false }
        landing = .galleryImmersive
    }
    private func showGalleryStrip() {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) { galleryStripVisible = true }
        landing = .galleryThumb(photoIndex)
    }
    private func stepGalleryPhoto(_ delta: Int) {
        guard imageURLs.count > 1 else { return }
        photoIndex = (photoIndex + delta + imageURLs.count) % imageURLs.count
    }
}


// MARK: - Button styles

struct EOSDetailChromeButtonStyle: ButtonStyle {
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .foregroundStyle(.white.opacity(configuration.isPressed ? 0.7 : 0.92))
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(Capsule(style: .continuous).fill(.ultraThinMaterial.opacity(isFocused ? 0.62 : 0.38)))
            .overlay(Capsule(style: .continuous).stroke(.white.opacity(isFocused ? 0.55 : 0.2), lineWidth: isFocused ? 2 : 1))
            .scaleEffect(isFocused ? 1.12 : (configuration.isPressed ? 0.98 : 1.0))
            .shadow(color: .black.opacity(isFocused ? 0.4 : 0.12), radius: isFocused ? 18 : 6, y: isFocused ? 10 : 3)
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}

struct EOSDetailActionButtonStyle: ButtonStyle {
    var accent: Color = .white
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .foregroundStyle(.white.opacity(0.95))
            .padding(.horizontal, 24)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(AnyShapeStyle(.ultraThinMaterial.opacity(0.42)))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(isFocused ? .clear : accent.opacity(0.25), lineWidth: 1)
            )
            .scaleEffect(isFocused ? 1.12 : (configuration.isPressed ? 0.98 : 1.0))
            .animation(.easeOut(duration: 0.18), value: isFocused)
    }
}
