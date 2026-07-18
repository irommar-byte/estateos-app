import SwiftUI
import UIKit
import CoreImage

struct CarDetailView: View {
    @EnvironmentObject private var app: AppModel
    let car: CarListing
    @State private var showQR = false
    @State private var photoIndex = 0
    @State private var showsDetails = false
    @FocusState private var focusedAction: DetailAction?

    private enum DetailAction: Hashable {
        case close, moreInfo, favorite, contact
    }

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

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Color.black.ignoresSafeArea()
                EOSFullBleedOfferImage(url: currentImageURL)
                    .id("car-\(car.id)-\(photoIndex)")
                    .ignoresSafeArea()
                    .scaleEffect(showsDetails ? 1.05 : 1.0)
                    .blur(radius: showsDetails ? 10 : 0)

                LinearGradient(
                    colors: [.clear, .black.opacity(0.35), .black.opacity(0.92)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                if showsDetails {
                    Color.black.opacity(0.42).ignoresSafeArea()
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
            CarContactQrSheet(car: car)
        }
        .onAppear {
            photoIndex = 0
            showsDetails = false
            focusedAction = .moreInfo
        }
    }

    private var topBar: some View {
        HStack {
            Button {
                if showsDetails { showsDetails = false } else { app.closeCarDetail() }
            } label: {
                Label(showsDetails ? "Zwiń" : "Zamknij", systemImage: showsDetails ? "chevron.down" : "xmark")
            }
            .buttonStyle(EOSDetailChromeButtonStyle())
            .focused($focusedAction, equals: .close)

            Spacer()

            if imageURLs.count > 1 {
                Text("\(photoIndex + 1) / \(imageURLs.count)")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(.ultraThinMaterial.opacity(0.45)))
            }
        }
        .padding(.horizontal, 56)
        .padding(.top, 36)
    }

    private var heroPanel: some View {
        VStack(alignment: .leading, spacing: 20) {
            if !car.city.isEmpty {
                Label(car.city, systemImage: "mappin.and.ellipse")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white.opacity(0.75))
            }
            EOSAdaptiveTitle(text: car.displayHeadline, maxLines: 2, maxSize: 46, minSize: 28)
                .foregroundStyle(.white)

            Text(car.displayPrice)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(.cyan)

            Text(car.displaySpecs)
                .font(.title3)
                .foregroundStyle(.white.opacity(0.8))

            HStack(spacing: 16) {
                Button {
                    app.toggleFavoriteCar(car)
                } label: {
                    Label(
                        app.isFavoriteCar(car.id) ? "W ulubionych" : "Ulubione",
                        systemImage: app.isFavoriteCar(car.id) ? "heart.fill" : "heart"
                    )
                }
                .buttonStyle(.borderedProminent)
                .tint(app.isFavoriteCar(car.id) ? .pink : .white.opacity(0.35))
                .foregroundStyle(.white)
                .focused($focusedAction, equals: .favorite)

                Button {
                    showQR = true
                } label: {
                    Label("Kontakt QR", systemImage: "qrcode")
                }
                .buttonStyle(EOSDetailActionButtonStyle())
                .focused($focusedAction, equals: .contact)

                Spacer()

                Button {
                    showsDetails = true
                    focusedAction = .close
                } label: {
                    Label("Więcej informacji", systemImage: "chevron.up")
                }
                .buttonStyle(EOSDetailActionButtonStyle())
                .focused($focusedAction, equals: .moreInfo)
            }
        }
        .padding(.horizontal, 56)
        .padding(.bottom, 52)
        .focusSection()
        .onMoveCommand { direction in
            switch direction {
            case .left: changePhoto(by: -1)
            case .right: changePhoto(by: 1)
            case .up: showsDetails = true
            default: break
            }
        }
    }

    private func detailsScroll(height: CGFloat) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 24) {
                EOSAdaptiveTitle(text: car.displayHeadline, maxLines: 3, maxSize: 40, minSize: 26)
                    .foregroundStyle(.white)
                Text(car.displayPrice)
                    .font(.title.bold())
                    .foregroundStyle(.cyan)

                if let desc = OfferPresentation.plainDescription(from: car.description) {
                    detailBlock("Opis", icon: "text.alignleft") {
                        Text(desc)
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineSpacing(8)
                    }
                }

                detailBlock("Dane techniczne", icon: "wrench.and.screwdriver") {
                    VStack(alignment: .leading, spacing: 10) {
                        row("Marka", car.make)
                        row("Model", car.model)
                        row("Rok", car.year > 0 ? "\(car.year)" : nil)
                        row("Przebieg", CarPresentation.mileageLabel(car.mileageKm))
                        row("Paliwo", car.fuelType)
                        row("Skrzynia", car.transmission)
                        row("Nadwozie", car.bodyType)
                        row("Moc", car.enginePower)
                        row("Pojemność", car.engineCapacity)
                        row("Generacja", car.generation)
                        row("Wersja", car.trimVersion)
                        row("Kolor", car.exteriorColor)
                        row("Drzwi", car.doorCount.map(String.init))
                        row("VIN", car.vinMasked)
                    }
                }

                Button {
                    showQR = true
                } label: {
                    Label("Pokaż QR kontaktu", systemImage: "qrcode")
                }
                .buttonStyle(EOSDetailActionButtonStyle())
                .focused($focusedAction, equals: .contact)
            }
            .padding(.horizontal, 56)
            .padding(.bottom, 64)
        }
        .frame(maxHeight: height - 100)
        .focusSection()
        .onMoveCommand { direction in
            if direction == .down { showsDetails = false }
        }
    }

    private func detailBlock<Content: View>(_ title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: icon)
                .font(.headline.weight(.bold))
                .foregroundStyle(.white.opacity(0.9))
            content()
        }
        .padding(22)
        .eosGlass(cornerRadius: 22, opacity: 0.36)
    }

    private func row(_ label: String, _ value: String?) -> some View {
        Group {
            if let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                HStack {
                    Text(label).foregroundStyle(.secondary)
                    Spacer()
                    Text(value).foregroundStyle(.white)
                }
                .font(.title3)
            }
        }
    }

    private func changePhoto(by delta: Int) {
        guard imageURLs.count > 1 else { return }
        photoIndex = (photoIndex + delta + imageURLs.count) % imageURLs.count
    }
}

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
