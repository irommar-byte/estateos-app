import ImageIO
import MapKit
import Photos
import SwiftUI
import UniformTypeIdentifiers

// MARK: What the file itself says

/// What the original file says about itself: camera, lens, exposure, format and size.
struct PhotoMetadata: Equatable {
    var filename: String?
    var format: String?
    var bytes: Int64?
    var camera: String?
    var lensModel: String?
    var focal35: Double?
    var focal: Double?
    var aperture: Double?
    var iso: Int?
    var shutter: Double?
    var bias: Double?

    var hasExposure: Bool { iso != nil || aperture != nil || shutter != nil }

    /// "Przedni aparat", "Aparat szerokokątny", "Teleobiektyw", as in Photos.
    var lensName: String? {
        let lower = lensModel?.lowercased() ?? ""
        if lower.contains("front") { return L("Przedni aparat") }
        if let focal35 {
            if focal35 <= 16 { return L("Aparat ultraszerokokątny") }
            if focal35 <= 35 { return L("Aparat szerokokątny") }
            return L("Teleobiektyw")
        }
        if lower.contains("back") { return L("Tylny aparat") }
        return nil
    }
}

@MainActor
enum PhotoMetadataReader {
    /// Reads the original: from Photos for a photo on this device, from the downloaded original for
    /// a server copy. Nothing is changed in the file.
    static func read(id: String, library: PhotoLibrary) async -> PhotoMetadata {
        if let asset = library.asset(id: id) {
            return await read(asset: asset)
        }
        var info = PhotoMetadata()
        if let server = LibraryEngine.shared.serverAsset(id), let primary = server.resources.first {
            info.bytes = Int64(primary.bytes)
            info.format = format(ext: primary.ext)
        }
        if let file = LibraryEngine.shared.localOriginal(id: id) ?? library.cloudMedia(id: id)?.still {
            let parsed = await Task.detached(priority: .userInitiated) { parse(url: file) }.value
            merge(parsed, into: &info)
        }
        return info
    }

    private static func read(asset: PHAsset) async -> PhotoMetadata {
        var info = PhotoMetadata()
        let resources = PHAssetResource.assetResources(for: asset)
        let originals: [PHAssetResourceType] = [.photo, .video, .fullSizePhoto, .fullSizeVideo]
        let original = resources.first { originals.contains($0.type) } ?? resources.first
        info.filename = original?.originalFilename
        if let original {
            info.format = format(uti: original.uniformTypeIdentifier)
            if let size = (original.value(forKey: "fileSize") as? NSNumber)?.int64Value, size > 0 {
                info.bytes = size
            }
        }
        guard asset.mediaType == .image else { return info }
        let data: Data? = await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.version = .original
            options.deliveryMode = .highQualityFormat
            options.isNetworkAccessAllowed = true
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
                continuation.resume(returning: data)
            }
        }
        if let data {
            if info.bytes == nil { info.bytes = Int64(data.count) }
            let parsed = await Task.detached(priority: .userInitiated) { parse(data: data) }.value
            merge(parsed, into: &info)
        }
        return info
    }

    private static func merge(_ parsed: PhotoMetadata, into info: inout PhotoMetadata) {
        if info.format == nil { info.format = parsed.format }
        info.camera = parsed.camera
        info.lensModel = parsed.lensModel
        info.focal35 = parsed.focal35
        info.focal = parsed.focal
        info.aperture = parsed.aperture
        info.iso = parsed.iso
        info.shutter = parsed.shutter
        info.bias = parsed.bias
    }

    nonisolated private static func parse(data: Data) -> PhotoMetadata {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return PhotoMetadata() }
        return parse(source: source)
    }

    nonisolated private static func parse(url: URL) -> PhotoMetadata {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return PhotoMetadata() }
        return parse(source: source)
    }

    nonisolated private static func parse(source: CGImageSource) -> PhotoMetadata {
        var info = PhotoMetadata()
        if let type = CGImageSourceGetType(source) as String? { info.format = format(uti: type) }
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else { return info }
        let tiff = properties[kCGImagePropertyTIFFDictionary] as? [CFString: Any] ?? [:]
        let exif = properties[kCGImagePropertyExifDictionary] as? [CFString: Any] ?? [:]
        let make = (tiff[kCGImagePropertyTIFFMake] as? String)?.trimmingCharacters(in: .whitespaces)
        let model = (tiff[kCGImagePropertyTIFFModel] as? String)?.trimmingCharacters(in: .whitespaces)
        if let model, !model.isEmpty {
            if let make, !make.isEmpty, !model.lowercased().hasPrefix(make.lowercased()) {
                info.camera = "\(make) \(model)"
            } else {
                info.camera = model
            }
        }
        info.lensModel = exif[kCGImagePropertyExifLensModel] as? String
        info.focal = (exif[kCGImagePropertyExifFocalLength] as? NSNumber)?.doubleValue
        info.focal35 = (exif[kCGImagePropertyExifFocalLenIn35mmFilm] as? NSNumber)?.doubleValue
        info.aperture = (exif[kCGImagePropertyExifFNumber] as? NSNumber)?.doubleValue
        info.iso = (exif[kCGImagePropertyExifISOSpeedRatings] as? [NSNumber])?.first?.intValue
        info.shutter = (exif[kCGImagePropertyExifExposureTime] as? NSNumber)?.doubleValue
        info.bias = (exif[kCGImagePropertyExifExposureBiasValue] as? NSNumber)?.doubleValue
        return info
    }

    nonisolated static func format(uti: String) -> String? {
        let lower = uti.lowercased()
        if lower.contains("heic") || lower.contains("heif") { return "HEIF" }
        if lower.contains("jpeg") { return "JPEG" }
        if lower.contains("raw-image") || lower.contains("dng") { return "RAW" }
        if lower.contains("quicktime") { return "MOV" }
        if lower.contains("mpeg-4") { return "MP4" }
        if lower.contains("png") { return "PNG" }
        if lower.contains("gif") { return "GIF" }
        return UTType(uti)?.preferredFilenameExtension?.uppercased()
    }

    nonisolated static func format(ext: String) -> String? {
        let lower = ext.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        guard !lower.isEmpty else { return nil }
        switch lower {
        case "heic", "heif": return "HEIF"
        case "jpg", "jpeg": return "JPEG"
        case "dng": return "RAW"
        default: return lower.uppercased()
        }
    }
}

// MARK: The panel

/// Everything about one photo, laid out like Photos: when and which file, the camera with its
/// lens and exposure, who sent it to the server, and the place on a small map at the very bottom.
struct PhotoInfoPanel: View {
    let photo: PhotoRef
    var place: String?
    /// The landscape sheet has no photo above it, so the people are listed here instead.
    var showsPeople = false
    var onMap: () -> Void = {}
    var onPerson: (Int64) -> Void = { _ in }

    @EnvironmentObject private var library: PhotoLibrary
    @State private var metadata: PhotoMetadata?

    var body: some View {
        VStack(spacing: 14) {
            mainCard
            if showsPeople { peopleCard }
            serverCard
            if photo.hasLocation { mapCard }
        }
        .padding(.horizontal, 16)
        .task(id: "\(photo.id)#\(library.cloudRevision)") {
            let read = await PhotoMetadataReader.read(id: photo.id, library: library)
            withAnimation(.smooth(duration: 0.25)) { metadata = read }
        }
    }

    // MARK: Date, file, camera

    private var mainCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text(dateLine)
                    .font(.body.weight(.semibold))
                HStack(spacing: 6) {
                    Image(systemName: onServer ? "checkmark.icloud" : ThisDevice.symbol)
                    Text(metadata?.filename ?? kindText)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            Divider()
            HStack(spacing: 8) {
                Text(metadata?.camera ?? kindText)
                    .lineLimit(1)
                if metadata == nil {
                    ProgressView().controlSize(.small)
                }
                Spacer(minLength: 8)
                if let format = metadata?.format {
                    Text(format)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Color(uiColor: .tertiarySystemFill)))
                }
                ForEach(badges, id: \.self) { symbol in
                    Image(systemName: symbol)
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(Color(uiColor: .tertiarySystemFill)))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            Divider()
            VStack(alignment: .leading, spacing: 3) {
                if let lens = lensLine { Text(lens) }
                Text(sizeLine)
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            if let metadata, metadata.hasExposure {
                Divider()
                exposureRow(metadata)
                    .padding(.vertical, 12)
            }
        }
        .infoCard()
    }

    private func exposureRow(_ info: PhotoMetadata) -> some View {
        let items: [String] = [
            info.iso.map { "ISO \($0)" },
            (info.focal35 ?? info.focal).map { "\(Int($0.rounded())) mm" },
            info.bias.map { Self.ev($0) },
            info.aperture.map { "ƒ" + Self.decimal($0) },
            info.shutter.map { Self.shutter($0) },
        ].compactMap { $0 }
        return HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                if index > 0 {
                    Rectangle()
                        .fill(Color(uiColor: .separator))
                        .frame(width: 1, height: 18)
                }
                Text(item)
                    .font(.subheadline)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 8)
    }

    // MARK: People (landscape sheet)

    @ViewBuilder
    private var peopleCard: some View {
        let faces = PhotoIntelligence.shared.personFaces(in: photo.id)
        if !faces.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(faces) { item in
                        Button { onPerson(item.person.id) } label: {
                            VStack(spacing: 6) {
                                FaceAvatar(face: item.face, size: 52)
                                Text(item.person.title)
                                    .font(.caption)
                                    .lineLimit(1)
                                    .foregroundStyle(item.person.hasName ? Color.primary : GalleryTheme.accent)
                            }
                            .frame(width: 70)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .infoCard()
        }
    }

    // MARK: Server

    @ViewBuilder
    private var serverCard: some View {
        let engine = LibraryEngine.shared
        if let asset = engine.serverAsset(photo.id) {
            VStack(alignment: .leading, spacing: 0) {
                cardTitle(L("Serwer"), symbol: "server.rack")
                row(L("Wgrane przez"), who(asset.owner, name: asset.ownerName, mine: engine.isMine(asset)))
                Divider().padding(.leading, 16)
                row(L("Urządzenie"), asset.device ?? L("nie zapisano"))
                if let uploaded = asset.uploadedAt {
                    Divider().padding(.leading, 16)
                    row(L("Wgrano"), Self.moment(uploaded))
                }
                if let deleted = asset.deletedAt, !LibraryRules.isPurged(asset) {
                    Divider().padding(.leading, 16)
                    row(L("Usunięte przez"), who(asset.deletedBy, name: asset.deletedByName, mine: GalleryOwner.isMe(asset.deletedBy)))
                    Divider().padding(.leading, 16)
                    row(L("Usunięto"), Self.moment(deleted))
                }
            }
            .padding(.bottom, 4)
            .infoCard()
        } else if !photo.id.hasPrefix("cloud:"), let note = engine.stateNote(photo.id) {
            VStack(alignment: .leading, spacing: 0) {
                cardTitle(L("Serwer"), symbol: "server.rack")
                Label(note, systemImage: "icloud.slash")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
            }
            .infoCard()
        }
    }

    // MARK: Map

    private var mapCard: some View {
        Button(action: onMap) {
            VStack(spacing: 0) {
                if let latitude = photo.latitude, let longitude = photo.longitude {
                    let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
                    Map(initialPosition: .region(MKCoordinateRegion(
                        center: coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012)
                    )), interactionModes: []) {
                        Annotation("", coordinate: coordinate, anchor: .bottom) {
                            MapPhotoPin(id: photo.id, library: library)
                        }
                    }
                    .id(photo.id)
                    .frame(height: 190)
                    .allowsHitTesting(false)
                }
                HStack(spacing: 4) {
                    Text(place?.isEmpty == false ? place! : L("Pokaż na mapie"))
                        .lineLimit(1)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
                .foregroundStyle(GalleryTheme.accent)
                .padding(16)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .infoCard()
        .accessibilityLabel(L("Otwórz mapę"))
    }

    // MARK: Texts

    private var onServer: Bool {
        photo.id.hasPrefix("cloud:") || library.isUploaded(photo.id)
    }

    private var badges: [String] {
        var list: [String] = []
        if photo.traits.contains(.live) { list.append("livephoto") }
        if photo.traits.contains(.portrait) { list.append("person.crop.square") }
        if photo.traits.contains(.panorama) { list.append("pano") }
        return list
    }

    /// "Sobota, 29 czerwca 2024 o 20:43".
    private var dateLine: String {
        let day = DateFormatter()
        day.locale = Localization.locale
        day.setLocalizedDateFormatFromTemplate("EEEEdMMMMyyyy")
        let time = DateFormatter()
        time.locale = Localization.locale
        time.dateFormat = "HH:mm"
        let text = L("\(day.string(from: photo.created)) o \(time.string(from: photo.created))")
        return text.prefix(1).uppercased() + text.dropFirst()
    }

    private var lensLine: String? {
        guard let metadata else { return nil }
        var parts: [String] = []
        if let focal = metadata.focal35 ?? metadata.focal { parts.append("\(Int(focal.rounded())) mm") }
        if let aperture = metadata.aperture { parts.append("ƒ" + Self.decimal(aperture)) }
        let optics = parts.joined(separator: " ")
        if let name = metadata.lensName {
            return optics.isEmpty ? name : "\(name) — \(optics)"
        }
        if let lens = metadata.lensModel, !lens.isEmpty { return lens }
        return optics.isEmpty ? nil : optics
    }

    /// "12 MP • 4032 × 3024 • 3,3 MB", and the length of a film.
    private var sizeLine: String {
        var parts: [String] = []
        let pixels = Double(photo.pixelWidth * photo.pixelHeight) / 1_000_000
        if photo.traits.isVideo {
            parts.append(PhotoFormat.duration(photo.duration))
        } else if pixels > 0 {
            parts.append(pixels >= 1 ? "\(Int(pixels.rounded())) MP" : Self.decimal(pixels) + " MP")
        }
        if photo.pixelWidth > 0 { parts.append("\(photo.pixelWidth) × \(photo.pixelHeight)") }
        if let bytes = metadata?.bytes, bytes > 0 { parts.append(ByteText.amount(bytes)) }
        return parts.joined(separator: " • ")
    }

    private var kindText: String {
        if photo.traits.isVideo { return L("Wideo") }
        if photo.traits.contains(.live) { return L("Live Photo") }
        if photo.traits.contains(.raw) { return "RAW" }
        if photo.traits.contains(.portrait) { return L("Portret") }
        if photo.traits.contains(.panorama) { return L("Panorama") }
        if photo.traits.contains(.screenshot) { return L("Zrzut ekranu") }
        return L("Zdjęcie")
    }

    private func who(_ fingerprint: String?, name: String?, mine: Bool) -> String {
        let cleaned = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if mine {
            return cleaned.isEmpty ? L("Ty (to konto iCloud)") : L("Ty · \(cleaned)")
        }
        if !cleaned.isEmpty { return cleaned }
        if fingerprint?.hasPrefix("device:") == true { return L("Inne urządzenie") }
        return L("Inne konto iCloud")
    }

    private func cardTitle(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 6)
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
            Spacer(minLength: 12)
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
    }

    /// "22 października 2026, 17:49:12": the date and the exact time.
    static func moment(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(date: .long, time: .standard).locale(Localization.locale))
    }

    static func decimal(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)).locale(Localization.locale))
    }

    static func ev(_ value: Double) -> String {
        if abs(value) < 0.05 { return "0 ev" } // l10n:skip
        return (value > 0 ? "+" : "−") + decimal(abs(value)) + " ev"
    }

    static func shutter(_ seconds: Double) -> String {
        guard seconds > 0 else { return "" }
        if seconds >= 1 { return decimal(seconds) + " s" }
        return "1/\(Int((1 / seconds).rounded())) s" // l10n:skip
    }
}

/// The photo itself as the pin on the small map, like Photos does.
private struct MapPhotoPin: View {
    let id: String
    /// Passed in: map annotations are drawn apart from the rest of the screen.
    let library: PhotoLibrary
    @State private var image: UIImage?

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color(uiColor: .tertiarySystemFill))
                if let image {
                    Image(uiImage: image).resizable().scaledToFill()
                }
            }
            .frame(width: 54, height: 54)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .padding(3)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(.white))
            Triangle()
                .fill(.white)
                .frame(width: 14, height: 8)
        }
        .shadow(color: .black.opacity(0.3), radius: 5, y: 2)
        .task(id: id) {
            if let asset = library.asset(id: id) {
                image = await PhotoIntelligence.request(asset, side: 160)
            } else {
                image = library.thumbnail(id: id)
            }
        }
    }

    private struct Triangle: Shape {
        func path(in rect: CGRect) -> Path {
            Path { path in
                path.move(to: CGPoint(x: rect.minX, y: rect.minY))
                path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
                path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
                path.closeSubpath()
            }
        }
    }
}

/// The people in the photo, as small round faces over its bottom left corner. A person without a
/// name gets a question mark, as in Photos.
struct InfoPeopleBadges: View {
    let photoID: String
    let onPerson: (Int64) -> Void
    @ObservedObject private var brain = PhotoIntelligence.shared

    var body: some View {
        let faces = brain.personFaces(in: photoID)
        HStack(spacing: -8) {
            ForEach(Array(faces.prefix(6))) { item in
                Button { onPerson(item.person.id) } label: {
                    FaceAvatar(face: item.face, size: 40)
                        .overlay(Circle().strokeBorder(.white.opacity(0.9), lineWidth: 2))
                        .overlay(alignment: .bottomTrailing) {
                            if !item.person.hasName {
                                Image(systemName: "questionmark.circle.fill")
                                    .font(.system(size: 14, weight: .bold))
                                    .symbolRenderingMode(.palette)
                                    .foregroundStyle(.white, GalleryTheme.accent)
                                    .background(Circle().fill(.white).padding(1))
                                    .offset(x: 3, y: 3)
                            }
                        }
                        .shadow(color: .black.opacity(0.3), radius: 4, y: 1)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.person.title)
            }
        }
    }
}

/// A person opened from the info panel.
struct InfoPersonItem: Identifiable {
    let id: Int64
}

extension View {
    fileprivate func infoCard() -> some View {
        background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color(uiColor: .secondarySystemBackground)))
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }
}

// MARK: Landscape

/// In landscape there is no room under the photo: the same panel comes as a sheet.
struct PhotoInfoSheet: View {
    let photo: PhotoRef
    var place: String?
    var onMap: () -> Void = {}
    @EnvironmentObject private var library: PhotoLibrary
    @State private var person: InfoPersonItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                PhotoInfoPanel(photo: photo, place: place, showsPeople: true, onMap: onMap) { id in
                    person = InfoPersonItem(id: id)
                }
                .padding(.vertical, 12)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle(place?.isEmpty == false ? place! : L("Informacje"))
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(item: $person) { item in
            NavigationStack {
                PersonScreen(personID: item.id)
                    .peopleDestinations()
            }
            .environmentObject(library)
        }
    }
}
