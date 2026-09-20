import SwiftUI

struct ShazamIdentifyButton: View {
    @ObservedObject private var shazam = ShazamIdentifyController.shared
    var size: CGFloat = 40

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            shazam.userTapped()
        } label: {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [EOSTheme.accent, EOSTheme.accentSecondary],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Circle()
                    .strokeBorder(Color.white.opacity(0.28), lineWidth: 1.2)
                Circle()
                    .stroke(EOSTheme.accent.opacity(shazam.isListening ? 0.45 : 0), lineWidth: 2)
                    .scaleEffect(shazam.isListening ? 1.22 : 1)
                    .opacity(shazam.isListening ? 0.4 : 0)
                Image(systemName: "shazam.logo.fill")
                    .font(.system(size: size * 0.42, weight: .semibold))
                    .foregroundStyle(.white)
                    .symbolEffect(.pulse, isActive: shazam.isListening)
            }
            .frame(width: size, height: size)
            .shadow(color: EOSTheme.accent.opacity(0.28), radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Rozpoznaj utwór")
        .animation(.easeOut(duration: 1.05).repeatForever(autoreverses: true), value: shazam.isListening)
    }
}

struct ShazamIdentifySheet: View {
    @EnvironmentObject private var app: AppModel
    @ObservedObject private var shazam = ShazamIdentifyController.shared

    var body: some View {
        VStack(spacing: 18) {
            Capsule()
                .fill(Color.secondary.opacity(0.35))
                .frame(width: 36, height: 5)
                .padding(.top, 8)

            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [EOSTheme.accent, EOSTheme.accentSecondary],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 86, height: 86)
                if let artworkURL = shazam.artworkURL {
                    AsyncImage(url: artworkURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        listeningGlyph
                    }
                    .frame(width: 86, height: 86)
                    .clipShape(Circle())
                } else {
                    listeningGlyph
                }
                Circle()
                    .stroke(EOSTheme.accent.opacity(shazam.isListening ? 0.5 : 0.15), lineWidth: 2)
                    .frame(width: 104, height: 104)
                    .scaleEffect(shazam.isListening ? 1.08 : 1)
            }
            .animation(.easeOut(duration: 0.9).repeatForever(autoreverses: true), value: shazam.isListening)

            VStack(spacing: 4) {
                Text(shazam.titleLine)
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(EOSTheme.textPrimary)
                    .frame(maxWidth: .infinity)
                Text(shazam.artistLine.isEmpty ? " " : shazam.artistLine)
                    .font(.subheadline)
                    .foregroundStyle(EOSTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 8)

            HStack(spacing: 8) {
                Image(systemName: shazam.addSucceeded == true ? "checkmark.circle.fill" : (shazam.addSucceeded == false ? "xmark.circle.fill" : "waveform"))
                    .foregroundStyle(shazam.addSucceeded == true ? EOSTheme.accent : (shazam.addSucceeded == false ? Color.secondary : EOSTheme.accentSecondary))
                Text(statusLine)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 4)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
        .background(.ultraThinMaterial)
        .onAppear { shazam.bind(app) }
    }

    private var statusLine: String {
        if !shazam.addStatus.isEmpty { return shazam.addStatus }
        if shazam.isListening { return "Nasłuchuję otoczenia…" }
        return " "
    }

    private var listeningGlyph: some View {
        Image(systemName: "shazam.logo.fill")
            .font(.system(size: 36, weight: .semibold))
            .foregroundStyle(.white)
            .symbolEffect(.pulse, isActive: shazam.isListening)
    }
}
