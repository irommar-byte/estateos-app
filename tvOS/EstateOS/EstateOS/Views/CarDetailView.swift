import SwiftUI
import UIKit
import CoreImage

/// Apple TV car preview: Hero → pełny ekran informacji / immersyjna galeria.
struct CarDetailView: View {
    @EnvironmentObject private var app: AppModel
    let car: CarListing

    private enum Mode: Equatable {
        case hero
        case info
        case description
        case gallery
    }

    private enum Landing: Hashable {
        case moreInfo
        case galleryEntry
        case infoClose
        case descriptionCard
        case descriptionClose
        case galleryThumb(Int)
        case galleryImmersive
    }

    @State private var mode: Mode = .hero
    @State private var showQR = false
    @State private var photoIndex = 0
    /// When false: full-bleed photo, L/R changes shots; OK brings the strip back.
    @State private var galleryStripVisible = true
    @FocusState private var landing: Landing?

    private var imageURLs: [URL] {
        var seen = Set<String>()
        return car.imageCandidates.compactMap { raw -> URL? in
            guard !seen.contains(raw) else { return nil }
            seen.insert(raw)
            return EOSOfferMedia.imageURL(from: raw)
        }
    }

    private var currentImageURL: URL? {
        guard !imageURLs.isEmpty else { return nil }
        return imageURLs[min(max(0, photoIndex), imageURLs.count - 1)]
    }

    private var descriptionText: String? {
        OfferPresentation.plainDescription(from: car.description)
    }

    private struct SpecRow: Identifiable {
        let id: String
        let label: String
        let value: String
        let icon: String
    }

    private var specRows: [SpecRow] {
        let raw: [(String, String, String, String?)] = [
            ("make", "Marka", "car.fill", car.make),
            ("model", "Model", "tag", car.model),
            ("year", "Rok", "calendar", car.year > 0 ? "\(car.year)" : nil),
            ("mileage", "Przebieg", "speedometer", car.mileageKm > 0 ? CarPresentation.mileageLabel(car.mileageKm) : nil),
            ("fuel", "Paliwo", "fuelpump", car.fuelType),
            ("gear", "Skrzynia", "gearshape.2", car.transmission),
            ("body", "Nadwozie", "car", car.bodyType),
            ("power", "Moc", "bolt.fill", car.enginePower),
            ("capacity", "Pojemność", "engine.combustion", car.engineCapacity),
            ("generation", "Generacja", "square.stack", car.generation),
            ("trim", "Wersja", "star", car.trimVersion),
            ("color", "Kolor", "paintpalette", car.exteriorColor),
            ("doors", "Drzwi", "car", car.doorCount.map(String.init)),
            ("city", "Miasto", "mappin.and.ellipse", car.city.isEmpty ? nil : car.city),
            ("country", "Kraj", "globe.europe.africa", "\(car.resolvedCountry.flagEmoji) \(car.resolvedCountry.name)"),
            ("vin", "VIN", "barcode", car.vinMasked),
        ]
        return raw.compactMap { id, label, icon, value in
            guard let value else { return nil }
            let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !v.isEmpty else { return nil }
            return SpecRow(id: id, label: label, value: v, icon: icon)
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            EOSFullBleedOfferImage(url: currentImageURL)
                .ignoresSafeArea()
                .opacity((mode == .info || mode == .description) ? 0.28 : 1)

            if mode != .gallery {
                heroVeil
            }

            if mode == .info || mode == .description {
                Color.black.opacity(0.55).ignoresSafeArea()
            }

            switch mode {
            case .hero:
                VStack(spacing: 0) {
                    topCloseOnly
                    Spacer(minLength: 0)
                    heroCard
                }
            case .info:
                fullInfoScreen
            case .description:
                fullDescriptionScreen
            case .gallery:
                galleryScreen
            }
        }
        .animation(.easeOut(duration: 0.22), value: mode)
        .animation(.easeOut(duration: 0.15), value: photoIndex)
        .sheet(isPresented: $showQR) {
            CarContactQrSheet(car: car)
        }
        .onAppear {
            mode = .hero
            photoIndex = 0
            landing = .moreInfo
        }
        .onChange(of: mode) { _, newMode in
            switch newMode {
            case .hero:
                landing = .moreInfo
            case .info:
                landing = .descriptionCard
            case .description:
                landing = .descriptionClose
            case .gallery:
                galleryStripVisible = true
                landing = .galleryThumb(photoIndex)
            }
        }
        .onExitCommand {
            switch mode {
            case .hero:
                app.closeCarDetail()
            case .info:
                mode = .hero
            case .description:
                mode = .info
            case .gallery:
                if !galleryStripVisible {
                    showGalleryStrip()
                } else {
                    mode = .hero
                }
            }
        }
    }

    private var heroVeil: some View {
        LinearGradient(
            colors: [
                .black.opacity(0.4),
                .clear,
                .black.opacity(0.35),
                .black.opacity(0.92),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    // MARK: - Hero

    private var topCloseOnly: some View {
        HStack {
            Button { app.closeCarDetail() } label: {
                Label("Zamknij", systemImage: "xmark")
            }
            .buttonStyle(EOSDetailChromeButtonStyle())
            .focusEffectDisabled()
            Spacer()
        }
        .padding(.horizontal, 56)
        .padding(.top, 32)
        .focusSection()
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            EOSCountryLocationLabel(
                locationLine: car.city,
                country: car.resolvedCountry
            )

            EOSAdaptiveTitle(text: car.displayHeadline, maxLines: 2, maxSize: 46, minSize: 28)
                .foregroundStyle(.white)

            Text(car.displayPrice)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(.cyan)

            Text(car.displaySpecs)
                .font(.title3.weight(.medium))
                .foregroundStyle(.white.opacity(0.82))
                .lineLimit(2)

            HStack(spacing: 14) {
                Button { app.toggleFavoriteCar(car) } label: {
                    Label(
                        app.isFavoriteCar(car.id) ? "W ulubionych" : "Ulubione",
                        systemImage: app.isFavoriteCar(car.id) ? "heart.fill" : "heart"
                    )
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: app.isFavoriteCar(car.id) ? .pink : .cyan))
                .focusEffectDisabled()

                Button { showQR = true } label: {
                    Label("Kontakt QR", systemImage: "qrcode")
                }
                .buttonStyle(EOSDetailActionButtonStyle())
                .focusEffectDisabled()

                Spacer(minLength: 8)

                if imageURLs.count > 1 {
                    Button {
                        mode = .gallery
                    } label: {
                        Label("Galeria", systemImage: "photo.on.rectangle.angled")
                    }
                    .buttonStyle(EOSDetailActionButtonStyle())
                    .focusEffectDisabled()
                    .focused($landing, equals: .galleryEntry)
                }

                Button {
                    mode = .info
                } label: {
                    Label("Więcej informacji", systemImage: "info.circle")
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: .cyan))
                .focusEffectDisabled()
                .focused($landing, equals: .moreInfo)
            }
        }
        .padding(30)
        .frame(maxWidth: 1200, alignment: .leading)
        .eosGlass(cornerRadius: 28, opacity: 0.32)
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.16), lineWidth: 1)
        )
        .padding(.horizontal, 56)
        .padding(.bottom, 48)
        .focusSection()
    }

    // MARK: - Full-screen info

    private var fullInfoScreen: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { mode = .hero } label: {
                    Label("Zwiń", systemImage: "chevron.down")
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .infoClose)

                Text("Szczegóły oferty")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)

                Spacer()

                if imageURLs.count > 1 {
                    Button { mode = .gallery } label: {
                        Label("Galeria", systemImage: "photo.on.rectangle.angled")
                    }
                    .buttonStyle(EOSDetailActionButtonStyle())
                    .focusEffectDisabled()
                }

                Button { showQR = true } label: {
                    Label("Kontakt QR", systemImage: "qrcode")
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: .cyan))
                .focusEffectDisabled()

                Button { app.toggleFavoriteCar(car) } label: {
                    Label(
                        app.isFavoriteCar(car.id) ? "W ulubionych" : "Ulubione",
                        systemImage: app.isFavoriteCar(car.id) ? "heart.fill" : "heart"
                    )
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: app.isFavoriteCar(car.id) ? .pink : .cyan))
                .focusEffectDisabled()
            }
            .padding(.horizontal, 48)
            .padding(.top, 28)
            .padding(.bottom, 16)
            .focusSection()

            GeometryReader { geo in
                HStack(alignment: .top, spacing: 28) {
                    leftInfoColumn(availableHeight: geo.size.height)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    specsListPanel
                        .frame(width: min(560, geo.size.width * 0.4), alignment: .topLeading)
                        .frame(maxHeight: .infinity, alignment: .top)
                }
                .padding(.horizontal, 48)
                .padding(.bottom, 28)
                .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            }
        }
    }

    private func leftInfoColumn(availableHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                EOSCountryLocationLabel(
                locationLine: car.city,
                country: car.resolvedCountry
            )
                EOSAdaptiveTitle(text: car.displayHeadline, maxLines: 2, maxSize: 36, minSize: 24)
                    .foregroundStyle(.white)
                Text(car.displayPrice)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(.cyan)
                Text(car.displaySpecs)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.white.opacity(0.78))
            }
            .padding(.bottom, 18)

            if let descriptionText {
                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(height: 1)
                    .padding(.bottom, 18)

                Button { mode = .description } label: {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Opis", systemImage: "text.alignleft")
                            .font(.title3.weight(.bold))
                            .foregroundStyle(.white.opacity(0.95))

                        Text(descriptionText)
                            .font(.system(size: 23, weight: .regular, design: .rounded))
                            .foregroundStyle(.white.opacity(0.9))
                            .lineSpacing(7)
                            .multilineTextAlignment(.leading)
                            .lineLimit(12)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .frame(maxWidth: .infinity, minHeight: max(160, availableHeight - 260), alignment: .topLeading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(EOSDetailCardButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .descriptionCard)
            }
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(white: 0.08).opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
    }

    private var specsListPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Dane techniczne", systemImage: "wrench.and.screwdriver")
                .font(.headline.weight(.bold))
                .foregroundStyle(.white.opacity(0.95))

            VStack(spacing: 0) {
                ForEach(specRows) { row in
                    HStack(alignment: .center, spacing: 14) {
                        Image(systemName: row.icon)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Color.cyan)
                            .frame(width: 28, alignment: .center)

                        Text(row.label)
                            .font(.callout.weight(.medium))
                            .foregroundStyle(.white.opacity(0.55))
                            .frame(width: 120, alignment: .leading)
                            .fixedSize(horizontal: true, vertical: false)

                        Text(row.value)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 9)
                    .padding(.horizontal, 4)

                    if row.id != specRows.last?.id {
                        Divider().overlay(Color.white.opacity(0.1))
                    }
                }
            }
        }
        .padding(26)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(white: 0.08).opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
    }

    // MARK: - Full-screen description

    private var fullDescriptionScreen: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { mode = .info } label: {
                    Label("Wróć", systemImage: "chevron.left")
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .descriptionClose)

                Text("Opis")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)

                Spacer(minLength: 0)

                Text(car.displayHeadline)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.55))
                    .lineLimit(1)
            }
            .padding(.horizontal, 48)
            .padding(.top, 28)
            .padding(.bottom, 12)
            .focusSection()

            if let descriptionText {
                EOSScreenFitText(text: descriptionText, maxSize: 40, minSize: 18, lineSpacing: 8)
                    .padding(.horizontal, 56)
                    .padding(.vertical, 20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .fill(Color(white: 0.06).opacity(0.88))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    )
                    .padding(.horizontal, 48)
                    .padding(.bottom, 40)
                    .focusSection()
            }
        }
    }

    // MARK: - Gallery (photo + bottom strip)

    private var galleryScreen: some View {
        ZStack(alignment: .bottom) {
            // Immersive: full-bleed photo only — no white focus plate
            if !galleryStripVisible {
                Color.clear
                    .contentShape(Rectangle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .focusable()
                    .focusEffectDisabled()
                    .focused($landing, equals: .galleryImmersive)
                    .onTapGesture { showGalleryStrip() }
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
                    }

                    Spacer()

                    Text("\(photoIndex + 1) / \(max(imageURLs.count, 1))")
                        .font(.system(size: galleryStripVisible ? 24 : 32, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, galleryStripVisible ? 18 : 22)
                        .padding(.vertical, galleryStripVisible ? 10 : 12)
                        .background(
                            Capsule(style: .continuous)
                                .fill(.black.opacity(0.45))
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                }
                .padding(.horizontal, 48)
                .padding(.top, 28)
                .allowsHitTesting(galleryStripVisible)
                .focusSection()

                Spacer(minLength: 0)
            }
            .zIndex(2)

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
                    Button {
                        enterGalleryImmersive(at: index)
                    } label: {
                        EOSOfferThumbnail(url: url, height: 130)
                            .frame(width: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(
                                        photoIndex == index ? Color.cyan : Color.white.opacity(0.25),
                                        lineWidth: photoIndex == index ? 3 : 1
                                    )
                            )
                            .opacity(photoIndex == index ? 1 : 0.7)
                    }
                    .buttonStyle(EOSGalleryThumbButtonStyle())
                    .focusEffectDisabled()
                    .focused($landing, equals: .galleryThumb(index))
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
        photoIndex = index
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
            galleryStripVisible = false
        }
        landing = .galleryImmersive
    }

    private func showGalleryStrip() {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
            galleryStripVisible = true
        }
        landing = .galleryThumb(photoIndex)
    }

    private func stepGalleryPhoto(_ delta: Int) {
        guard imageURLs.count > 1 else { return }
        photoIndex = (photoIndex + delta + imageURLs.count) % imageURLs.count
    }
}



/// Gentle vertical drift for long preview text (e-book feel).
struct EOSEbookText: View {
    let text: String
    var font: Font = .body
    var lineSpacing: CGFloat = 5

    @State private var drift = false
    @State private var contentHeight: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0

    private var overflow: CGFloat {
        max(0, contentHeight - viewportHeight)
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical, showsIndicators: false) {
                Text(text)
                    .font(font)
                    .foregroundStyle(.white.opacity(0.88))
                    .lineSpacing(lineSpacing)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        GeometryReader { inner in
                            Color.clear.preference(key: EbookHeightKey.self, value: inner.size.height)
                        }
                    )
                    .offset(y: drift && overflow > 8 ? -overflow : 0)
                    .animation(
                        overflow > 8
                            ? .linear(duration: max(10, Double(overflow) / 12)).repeatForever(autoreverses: true)
                            : .default,
                        value: drift
                    )
            }
            .onAppear {
                viewportHeight = geo.size.height
                drift = true
            }
            .onChange(of: geo.size.height) { _, h in
                viewportHeight = h
            }
        }
        .onPreferenceChange(EbookHeightKey.self) { contentHeight = $0 }
        .clipped()
    }
}

struct EbookHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

// MARK: - QR

struct CarContactQrSheet: View {
    let car: CarListing

    private var link: URL {
        URL(string: "https://estateos.pl/cars/\(car.id)")!
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("EstateOS™ Car")
                .font(.title.bold())
            Text(car.displayHeadline)
                .font(.title2)
                .multilineTextAlignment(.center)
            Text("Zeskanuj telefonem, aby otworzyć ogłoszenie i skontaktować się ze sprzedającym.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 640)

            if let image = qrImage(for: link.absoluteString) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 360, height: 360)
                    .padding(20)
                    .background(RoundedRectangle(cornerRadius: 24).fill(.white))
            }

            Text(link.absoluteString)
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }

    private func qrImage(for string: String) -> UIImage? {
        let data = Data(string.utf8)
        guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        let context = CIContext()
        guard let cg = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
