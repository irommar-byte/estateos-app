import SwiftUI
import AVKit
import CoreImage.CIFilterBuiltins

// MARK: - Offer video (2026-10)
//
// `Offer.videoUrl` is a free-text link from the seller. Neither the website nor the iPhone app
// plays it today, and tvOS has no browser — so on the TV it used to be lost.
//   • Direct media (mp4 / mov / m4v / HLS m3u8, or a file on estateos.pl) → the native tvOS
//     player (AVPlayerViewController): full screen, Siri-remote scrubbing, chapters bar, PiP.
//   • YouTube → a cinematic card with the film's thumbnail, "Otwórz w YouTube" (the YouTube app
//     on Apple TV) and a QR code to watch on the phone.
//   • Any other page (Vimeo, Facebook, a 3D tour site…) → the same card with a QR code.

enum OfferVideoSource: Equatable {
    case direct(URL)
    case youtube(id: String, page: URL)
    case web(URL)

    init?(raw: String?) {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        let normalized = raw.hasPrefix("http") ? raw : (raw.hasPrefix("/") ? "https://estateos.pl\(raw)" : "https://\(raw)")
        guard let url = URL(string: normalized), let host = url.host?.lowercased() else { return nil }
        if let id = Self.youtubeID(url: url, host: host) {
            self = .youtube(id: id, page: URL(string: "https://www.youtube.com/watch?v=\(id)")!)
            return
        }
        let ext = url.pathExtension.lowercased()
        let ownUpload = host.hasSuffix("estateos.pl") && ext.isEmpty == false && !["html", "htm", "php"].contains(ext)
        if ["mp4", "mov", "m4v", "m3u8"].contains(ext) || ownUpload {
            self = .direct(url)
            return
        }
        self = .web(url)
    }

    private static func youtubeID(url: URL, host: String) -> String? {
        if host.contains("youtu.be") {
            return url.pathComponents.dropFirst().first
        }
        guard host.contains("youtube.com") else { return nil }
        if let v = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "v" })?.value {
            return v
        }
        let parts = url.pathComponents
        if let i = parts.firstIndex(where: { $0 == "shorts" || $0 == "embed" || $0 == "live" }), i + 1 < parts.count {
            return parts[i + 1]
        }
        return nil
    }
}

struct OfferVideoScreen: View {
    let source: OfferVideoSource
    let title: String
    let backdrop: URL?

    var body: some View {
        switch source {
        case .direct(let url):
            NativeVideoPlayer(url: url, title: title)
                .ignoresSafeArea()
        case .youtube(let id, let page):
            VideoLinkCard(
                title: title,
                headline: "Film z oferty",
                note: "Film jest na YouTube. Otwórz go w aplikacji YouTube na Apple TV albo zeskanuj kod, by obejrzeć na telefonie.",
                thumbnail: URL(string: "https://i.ytimg.com/vi/\(id)/maxresdefault.jpg"),
                fallbackBackdrop: backdrop,
                link: page,
                appURL: URL(string: "youtube://watch/\(id)")
            )
        case .web(let url):
            VideoLinkCard(
                title: title,
                headline: "Materiał wideo",
                note: "Ten film jest na stronie zewnętrznej. Zeskanuj kod, aby obejrzeć go na telefonie lub tablecie.",
                thumbnail: nil,
                fallbackBackdrop: backdrop,
                link: url,
                appURL: nil
            )
        }
    }
}

/// The system tvOS player — the most "Apple" way to watch: transport bar, scrubbing, info panel.
private struct NativeVideoPlayer: UIViewControllerRepresentable {
    let url: URL
    let title: String

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let item = AVPlayerItem(url: url)
        let titleItem = AVMutableMetadataItem()
        titleItem.identifier = .commonIdentifierTitle
        titleItem.value = title as NSString
        titleItem.extendedLanguageTag = "und"
        item.externalMetadata = [titleItem]
        let player = AVPlayer(playerItem: item)
        let controller = AVPlayerViewController()
        controller.player = player
        player.play()
        return controller
    }

    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {}

    static func dismantleUIViewController(_ controller: AVPlayerViewController, coordinator: ()) {
        controller.player?.pause()
    }
}

/// Cinematic card for videos the TV can't play itself.
private struct VideoLinkCard: View {
    let title: String
    let headline: String
    let note: String
    let thumbnail: URL?
    let fallbackBackdrop: URL?
    let link: URL
    let appURL: URL?

    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var appUnavailable = false

    var body: some View {
        ZStack {
            // Offer photo underneath; the film's own frame on top once it loads (YouTube has no
            // maxres frame for some uploads — then the offer photo simply stays).
            EOSBackdrop(url: fallbackBackdrop, soft: true)
            if let thumbnail { EOSBackdrop(url: thumbnail) }
            LinearGradient(colors: [.black.opacity(0.2), .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            HStack(alignment: .bottom, spacing: 60) {
                VStack(alignment: .leading, spacing: 18) {
                    Label(headline.uppercased(), systemImage: "play.rectangle.fill")
                        .font(.system(size: 20, weight: .bold))
                        .tracking(2)
                        .foregroundStyle(.white.opacity(0.75))
                    Text(title)
                        .font(.system(size: 60, weight: .bold))
                        .tracking(-0.8)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(appUnavailable ? "Nie udało się otworzyć aplikacji YouTube — zeskanuj kod obok." : note)
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                        .frame(maxWidth: 900, alignment: .leading)
                    HStack(spacing: 24) {
                        if let appURL {
                            Button {
                                openURL(appURL) { accepted in appUnavailable = !accepted }
                            } label: {
                                Label("Otwórz w YouTube", systemImage: "play.fill")
                            }
                            .eosButton()
                        }
                        Button { dismiss() } label: {
                            Label("Wróć do oferty", systemImage: "chevron.backward")
                        }
                        .eosButton()
                    }
                    .padding(.top, 16)
                }
                Spacer(minLength: 0)
                VStack(spacing: 16) {
                    QRCodeImage(text: link.absoluteString)
                        .frame(width: 260, height: 260)
                        .padding(22)
                        .background(RoundedRectangle(cornerRadius: 28, style: .continuous).fill(.white))
                    Text("Obejrzyj na telefonie")
                        .font(.system(size: 21, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.8))
                }
            }
            .foregroundStyle(.white)
            .padding(.bottom, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
    }
}

/// Crisp QR code (nearest-neighbour scaled).
struct QRCodeImage: View {
    let text: String

    var body: some View {
        if let image = Self.make(text) {
            Image(uiImage: image)
                .interpolation(.none)
                .resizable()
                .scaledToFit()
        } else {
            Image(systemName: "qrcode").resizable().scaledToFit().foregroundStyle(.black)
        }
    }

    private static func make(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "H"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        guard let cg = CIContext().createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
