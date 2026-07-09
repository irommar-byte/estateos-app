import SwiftUI

struct OfferDetailView: View {
    @EnvironmentObject private var app: AppModel
    let offer: EstateOffer
    @State private var showQR = false
    @State private var photoIndex = 0
    @State private var slideDirection: PhotoSlide = .none
    @State private var showsDetails = false
    @FocusState private var focusedAction: DetailAction?

    private enum DetailAction: Hashable {
        case close, moreInfo, favorite, contact
    }

    private enum PhotoSlide {
        case none, forward, back
    }

    private var imageURLs: [URL] {
        EOSOfferMedia.imageURLs(for: offer)
    }

    private var currentImageURL: URL? {
        guard !imageURLs.isEmpty else { return nil }
        let idx = min(max(0, photoIndex), imageURLs.count - 1)
        return imageURLs[idx]
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()

                EOSFullBleedOfferImage(url: currentImageURL)
                    .id("\(offer.id)-\(photoIndex)")
                    .transition(photoTransition)
                    .ignoresSafeArea()
                    .scaleEffect(showsDetails ? 1.05 : 1.0)
                    .blur(radius: showsDetails ? 10 : 0)

                cinematicGradients

                if showsDetails {
                    Color.black.opacity(0.42)
                        .ignoresSafeArea()
                        .transition(.opacity)
                }

                VStack(spacing: 0) {
                    topBar
                    if showsDetails {
                        detailsScroll(height: proxy.size.height)
                    } else {
                        Spacer()
                        heroPanel
                    }
                }
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.86), value: showsDetails)
        .sheet(isPresented: $showQR) {
            ContactQrSheet(offer: offer)
        }
        .onAppear {
            photoIndex = 0
            showsDetails = false
            focusedAction = .moreInfo
        }
        .onChange(of: showsDetails) { _, expanded in
            focusedAction = expanded ? .close : .moreInfo
        }
    }

    // MARK: - Hero

    private var heroPanel: some View {
        VStack(alignment: .leading, spacing: 22) {
            headerBlock

            compactStatsRow

            HStack(spacing: 16) {
                actionButtons

                Spacer()

                Button {
                    openDetails()
                } label: {
                    Label("Więcej informacji", systemImage: "chevron.up")
                }
                .buttonStyle(EOSDetailActionButtonStyle())
                .focused($focusedAction, equals: .moreInfo)
                .onMoveCommand { direction in
                    if direction == .up { openDetails() }
                }
            }
        }
        .padding(.horizontal, 56)
        .padding(.bottom, 52)
        .focusSection()
        .onMoveCommand { direction in
            switch direction {
            case .left: changePhoto(by: -1)
            case .right: changePhoto(by: 1)
            case .up: openDetails()
            default: break
            }
        }
    }

    // MARK: - Details (full-height scroll)

    private func detailsScroll(height: CGFloat) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 26) {
                headerBlock

                compactStatsRow

                if let desc = offer.displayDescription {
                    detailSection("Opis", icon: "text.alignleft") {
                        Text(desc)
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineSpacing(8)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                detailSection("Lokalizacja", icon: "map") {
                    VStack(alignment: .leading, spacing: 12) {
                        detailRow("Miasto", offer.city)
                        detailRow("Dzielnica", offer.district)
                    }
                }

                detailSection("Parametry", icon: "square.grid.2x2") {
                    VStack(alignment: .leading, spacing: 12) {
                        detailRow("Typ nieruchomości", offer.displayPropertyType)
                        detailRow("Transakcja", offer.transactionLabel)
                        detailRow("Metraż", offer.area.map { "\(Int($0)) m²" })
                        detailRow("Pokoje", offer.rooms.map { String(format: "%.0f", $0) })
                        detailRow("Cena", EOSFormat.pricePLN(offer.price))
                        detailRow("Cena za m²", offer.pricePerSqm.map { EOSFormat.pricePerSqmPLN($0) })
                    }
                }

                HStack(spacing: 16) {
                    actionButtons
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 56)
            .padding(.top, 12)
            .padding(.bottom, 64)
        }
        .frame(maxHeight: height - 100)
        .focusSection()
        .onMoveCommand { direction in
            if direction == .down {
                closeDetails()
            }
        }
    }

    // MARK: - Shared UI

    private var topBar: some View {
        HStack {
            Button {
                if showsDetails {
                    closeDetails()
                } else {
                    app.closeDetail()
                }
            } label: {
                Label(showsDetails ? "Zwiń" : "Zamknij", systemImage: showsDetails ? "chevron.down" : "xmark")
            }
            .buttonStyle(EOSDetailChromeButtonStyle())
            .focused($focusedAction, equals: .close)
            .onMoveCommand { direction in
                if !showsDetails, direction == .up { openDetails() }
                if showsDetails, direction == .down { closeDetails() }
            }

            Spacer()

            if imageURLs.count > 1 {
                photoCounter
            }
        }
        .padding(.horizontal, 56)
        .padding(.top, 36)
        .padding(.bottom, showsDetails ? 8 : 0)
    }

    private var headerBlock: some View {
        HStack(alignment: .top, spacing: 20) {
            VStack(alignment: .leading, spacing: 10) {
                if !offer.displayLocation.isEmpty {
                    Label(offer.displayLocation, systemImage: "mappin.and.ellipse")
                        .font(.title3.weight(.medium))
                        .foregroundStyle(.white.opacity(0.75))
                }
                EOSAdaptiveTitle(
                    text: offer.title,
                    maxLines: showsDetails ? 4 : 2,
                    maxSize: showsDetails ? 42 : 46,
                    minSize: 28
                )
                .foregroundStyle(.white)
            }
            Spacer(minLength: 12)
            transactionBadge
        }
    }

    private var photoCounter: some View {
        HStack(spacing: 8) {
            if !showsDetails {
                Button { changePhoto(by: -1) } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)
                .opacity(imageURLs.count > 1 ? 1 : 0.3)
            }

            Text("\(photoIndex + 1) / \(max(imageURLs.count, 1))")
                .font(.caption.weight(.semibold).monospacedDigit())

            if !showsDetails {
                Button { changePhoto(by: 1) } label: {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.plain)
                .opacity(imageURLs.count > 1 ? 1 : 0.3)
            }
        }
        .foregroundStyle(.white.opacity(0.8))
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule(style: .continuous).fill(.ultraThinMaterial.opacity(0.45)))
    }

    private var compactStatsRow: some View {
        HStack(spacing: 12) {
            compactStat("Cena", EOSFormat.pricePLN(offer.price), highlight: true)
            compactStat("Metraż", offer.area.map { "\(Int($0)) m²" } ?? "—")
            compactStat("Pokoje", offer.rooms.map { String(format: "%.0f", $0) } ?? "—")
            compactStat("zł/m²", offer.displayPricePerSqm)
            if let type = offer.displayPropertyType {
                compactStat("Typ", type)
            }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        if app.session != nil {
            Button {
                Task { await app.toggleFavorite(offer) }
            } label: {
                Label(
                    app.isFavorite(offer.id) ? "Ulubione" : "Dodaj",
                    systemImage: app.isFavorite(offer.id) ? "heart.fill" : "heart"
                )
            }
            .buttonStyle(EOSDetailActionButtonStyle(accent: .pink))
            .focused($focusedAction, equals: .favorite)
        }

        Button {
            showQR = true
        } label: {
            Label("Kontakt", systemImage: "qrcode")
        }
        .buttonStyle(EOSDetailActionButtonStyle())
        .focused($focusedAction, equals: .contact)
    }

    private var cinematicGradients: some View {
        LinearGradient(
            colors: [
                .black.opacity(0.55),
                .clear,
                .clear,
                .black.opacity(showsDetails ? 0.15 : 0.4),
                .black.opacity(showsDetails ? 0.5 : 0.9),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }

    private var transactionBadge: some View {
        Text(offer.transactionLabel.uppercased())
            .font(.system(size: 11, weight: .heavy, design: .rounded))
            .tracking(1.1)
            .foregroundStyle(.white.opacity(0.9))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule(style: .continuous).fill(.white.opacity(0.14)))
            .overlay(Capsule(style: .continuous).stroke(.white.opacity(0.2), lineWidth: 1))
    }

    private func compactStat(_ title: String, _ value: String, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.7)
                .foregroundStyle(.white.opacity(0.45))
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(highlight ? Color(red: 0.45, green: 0.92, blue: 0.68) : .white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 15)
        .eosGlass(cornerRadius: 16, opacity: 0.32)
    }

    private func detailSection<Content: View>(
        _ title: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: icon)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
            content()
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .eosGlass(cornerRadius: 22, opacity: 0.26)
    }

    private func detailRow(_ label: String, _ value: String?) -> some View {
        let text = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return Group {
            if !text.isEmpty {
                HStack(alignment: .firstTextBaseline) {
                    Text(label)
                        .font(.body.weight(.medium))
                        .foregroundStyle(.secondary)
                        .frame(width: 200, alignment: .leading)
                    Text(text)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.92))
                }
            }
        }
    }

    private var photoTransition: AnyTransition {
        slideDirection == .none ? .opacity : .opacity.combined(with: .scale(scale: 1.02))
    }

    private func openDetails() {
        withAnimation(.spring(response: 0.5, dampingFraction: 0.86)) {
            showsDetails = true
        }
    }

    private func closeDetails() {
        withAnimation(.spring(response: 0.5, dampingFraction: 0.86)) {
            showsDetails = false
        }
    }

    private func changePhoto(by delta: Int) {
        guard imageURLs.count > 1 else { return }
        slideDirection = delta > 0 ? .forward : .back
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
            photoIndex = (photoIndex + delta + imageURLs.count) % imageURLs.count
        }
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
            .scaleEffect(isFocused ? 1.06 : (configuration.isPressed ? 0.97 : 1.0))
            .shadow(color: .white.opacity(isFocused ? 0.16 : 0), radius: isFocused ? 18 : 0, y: 6)
            .animation(.spring(response: 0.38, dampingFraction: 0.78), value: isFocused)
    }
}

struct EOSDetailActionButtonStyle: ButtonStyle {
    var accent: Color = .white
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.callout.weight(.semibold))
            .foregroundStyle(isFocused ? .black : .white.opacity(0.92))
            .padding(.horizontal, 24)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isFocused ? AnyShapeStyle(.white) : AnyShapeStyle(.ultraThinMaterial.opacity(0.4)))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(isFocused ? .clear : accent.opacity(0.25), lineWidth: 1)
            )
            .scaleEffect(isFocused ? 1.07 : (configuration.isPressed ? 0.97 : 1.0))
            .shadow(color: .white.opacity(isFocused ? 0.2 : 0), radius: isFocused ? 20 : 0, y: 8)
            .animation(.spring(response: 0.4, dampingFraction: 0.76), value: isFocused)
    }
}
