import CoreImage.CIFilterBuiltins
import SwiftUI

struct TVPairingView: View {
    @EnvironmentObject private var session: TVSession
    @StateObject private var pairing = TVPairing()
    @State private var appear = false

    var body: some View {
        HStack(alignment: .center, spacing: 80) {
            VStack(alignment: .leading, spacing: 36) {
                TVWordmark(size: 64)
                VStack(alignment: .leading, spacing: 10) {
                    Text(L("Zdjęcia z serwera na wielkim ekranie"))
                        .font(.system(size: 52, weight: .bold, design: .rounded))
                    Text(L("Sparuj Apple TV z GalleryOS na iPhonie. Zajmie to kilka sekund."))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 26) {
                    step(1, L("Otwórz GalleryOS na iPhonie"))
                    step(2, L("W synchronizacji wybierz Apple TV"))
                    step(3, L("Wpisz kod z tego ekranu albo zeskanuj kod QR"))
                }
                VStack(alignment: .leading, spacing: 12) {
                    Label(L("Ten sam Apple ID na iPhonie i Apple TV? Otwórz GalleryOS na iPhonie — Apple TV połączy się samo w kilkanaście sekund, bez kodu."), systemImage: "icloud")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    if !session.cloudNote.isEmpty {
                        Label(session.cloudNote, systemImage: "antenna.radiowaves.left.and.right")
                            .font(.caption)
                            .foregroundStyle(TVTheme.accent)
                            .transition(.opacity)
                    }
                }
                .frame(maxWidth: 820, alignment: .leading)
                .animation(.easeInOut(duration: 0.4), value: session.cloudNote)
            }
            codeCard
        }
        .padding(.horizontal, TVTheme.margin)
        .opacity(appear ? 1 : 0)
        .offset(y: appear ? 0 : 24)
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) { appear = true }
            pairing.run { server, password in
                session.adopt(server, password: password)
            }
        }
        .onDisappear { pairing.stop() }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(spacing: 22) {
            Text("\(number)")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .frame(width: 56, height: 56)
                .background(Circle().fill(TVTheme.accent))
            Text(text)
                .font(.title3)
                .lineLimit(2)
                .frame(maxWidth: 640, alignment: .leading)
        }
    }

    private var codeCard: some View {
        VStack(spacing: 34) {
            switch pairing.state {
            case .starting:
                ProgressView().frame(width: 420, height: 420)
            case .waiting(let code):
                VStack(spacing: 28) {
                    Text(L("Kod parowania"))
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 14) {
                        ForEach(Array(code.enumerated()), id: \.offset) { _, character in
                            Text(String(character))
                                .font(.system(size: 76, weight: .bold, design: .monospaced))
                                .frame(width: 84, height: 112)
                                .background(RoundedRectangle(cornerRadius: 18).fill(Color.white.opacity(0.12)))
                        }
                    }
                    if let qr = Self.qr(pairing.deepLink) {
                        Image(uiImage: qr)
                            .interpolation(.none)
                            .resizable()
                            .frame(width: 220, height: 220)
                            .padding(14)
                            .background(RoundedRectangle(cornerRadius: 22).fill(.white))
                    }
                    Text(L("Czekam na iPhone'a…"))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            case .failed(let message):
                VStack(spacing: 20) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 70))
                        .foregroundStyle(.orange)
                    Text(message)
                        .font(.title3)
                        .multilineTextAlignment(.center)
                        .frame(width: 520)
                }
                .frame(height: 420)
            }
        }
        .padding(48)
        .background(RoundedRectangle(cornerRadius: 40).fill(Color.white.opacity(0.07)))
        .animation(TVTheme.spring, value: pairing.state)
    }

    private static func qr(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)) else { return nil }
        let context = CIContext()
        guard let cg = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
