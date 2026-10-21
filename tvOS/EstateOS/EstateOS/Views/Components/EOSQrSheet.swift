import SwiftUI

/// "Continue on iPhone" — the TV hands a task to the phone with a QR code (2026-10 redesign).
/// Left: what will open and three short steps. Right: a white card with the code and the
/// EstateOS mark in its centre. Optional blurred photo behind (the offer being shared).
struct EOSQrSheet: View {
    let title: String
    let subtitle: String
    let urlString: String
    var footnote: String? = nil
    var eyebrow: String? = nil
    var backdrop: URL? = nil

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            if let backdrop {
                EOSBackdrop(url: backdrop, soft: true)
                Color.black.opacity(0.55).ignoresSafeArea()
            } else {
                LinearGradient(
                    colors: [Color(red: 0.05, green: 0.07, blue: 0.09), .black],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                RadialGradient(colors: [Color(red: 0.25, green: 0.78, blue: 0.52).opacity(0.18), .clear],
                               center: .topTrailing, startRadius: 40, endRadius: 900)
                    .ignoresSafeArea()
            }

            HStack(alignment: .center, spacing: 100) {
                VStack(alignment: .leading, spacing: 22) {
                    Label(eyebrow ?? "OTWÓRZ NA IPHONIE", systemImage: "iphone.gen3")
                        .font(.system(size: 19, weight: .bold))
                        .tracking(2.2)
                        .foregroundStyle(.white.opacity(0.7))
                    Text(title)
                        .font(.system(size: 64, weight: .bold))
                        .tracking(-0.8)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(subtitle)
                        .font(.system(size: 28, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                        .lineLimit(3)

                    VStack(alignment: .leading, spacing: 16) {
                        step(1, "Otwórz Aparat na iPhonie")
                        step(2, "Skieruj go na kod obok")
                        step(3, "Dotknij powiadomienia EstateOS")
                    }
                    .padding(.top, 18)

                    if let footnote {
                        Text(footnote)
                            .font(.system(size: 20))
                            .foregroundStyle(.white.opacity(0.55))
                            .padding(.top, 10)
                    }

                    Button { dismiss() } label: {
                        Label("Gotowe", systemImage: "checkmark")
                    }
                    .eosButton()
                    .padding(.top, 14)
                }
                .frame(maxWidth: 820, alignment: .leading)

                VStack(spacing: 18) {
                    ZStack {
                        QRCodeImage(text: urlString)
                            .frame(width: 400, height: 400)
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(.white)
                            .frame(width: 96, height: 96)
                            .overlay(
                                Text("E").font(.system(size: 56, weight: .heavy))
                                    .foregroundStyle(Color(red: 0.2, green: 0.7, blue: 0.46))
                            )
                    }
                    .padding(34)
                    .background(RoundedRectangle(cornerRadius: 40, style: .continuous).fill(.white))
                    .shadow(color: .black.opacity(0.5), radius: 50, y: 24)

                    Text(Self.shortURL(urlString))
                        .font(.system(size: 20, weight: .medium).monospaced())
                        .foregroundStyle(.white.opacity(0.55))
                        .lineLimit(1)
                        .frame(maxWidth: 470)
                }
            }
            .foregroundStyle(.white)
            .padding(80)
        }
    }

    private func step(_ n: Int, _ text: String) -> some View {
        HStack(spacing: 18) {
            Text("\(n)")
                .font(.system(size: 22, weight: .bold))
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.white.opacity(0.14)))
            Text(text)
                .font(.system(size: 25, weight: .medium))
        }
    }

    private static func shortURL(_ raw: String) -> String {
        guard let url = URL(string: raw), let host = url.host else { return raw }
        return host + url.path
    }
}
