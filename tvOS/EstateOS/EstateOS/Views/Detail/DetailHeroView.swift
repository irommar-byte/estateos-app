import SwiftUI

enum DetailShellMode: Equatable { case hero, info, description, gallery }

enum DetailLanding: Hashable {
    case moreInfo, galleryEntry, infoClose, descriptionCard, descriptionClose
    case galleryThumb(Int), galleryImmersive
}

struct DetailHeroView: View {
    let presentation: DetailPresentation
    let isFavorite: Bool
    let favoriteIdleAccent: Color
    let onClose: () -> Void
    let onToggleFavorite: () -> Void
    @Binding var showQR: Bool
    @Binding var mode: DetailShellMode
    @FocusState.Binding var landing: DetailLanding?
    var heroNamespace: Namespace.ID?
    var heroTransitionID: String?

    var body: some View {
        VStack(spacing: 0) {
            topCloseOnly
            Spacer(minLength: 0)
            heroCard
        }
    }

    private var topCloseOnly: some View {
        HStack {
            Button(action: onClose) {
                Label("Zamknij", systemImage: "xmark")
            }
            .buttonStyle(EOSDetailChromeButtonStyle())
            .focusEffectDisabled()
            .accessibilityLabel("Zamknij szczegóły oferty")
            Spacer()
        }
        .padding(.horizontal, 56)
        .padding(.top, 32)
        .focusSection()
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

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 10) {
                transactionCapsule
                EOSCountryLocationLabel(
                    locationLine: presentation.locationLine,
                    country: presentation.country
                )
            }
            EOSAdaptiveTitle(text: presentation.title, maxLines: 2, maxSize: 46, minSize: 28)
                .foregroundStyle(.white)
            Text(presentation.priceText)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(presentation.accentColor)
            Text(presentation.subtitleText)
                .font(.title3.weight(.medium))
                .foregroundStyle(.white.opacity(0.82))
                .lineLimit(2)
            if let stats = presentation.ownerStats {
                EOSListingStatsRow(
                    views: stats.views,
                    favorites: stats.favorites,
                    accent: presentation.accentColor
                )
            }
            actionRow
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Oferta: \(presentation.title), \(presentation.priceText)")
    }

    private var actionRow: some View {
        HStack(spacing: 14) {
            Button(action: onToggleFavorite) {
                Label(
                    isFavorite ? "W ulubionych" : "Ulubione",
                    systemImage: isFavorite ? "heart.fill" : "heart"
                )
            }
            .buttonStyle(EOSDetailActionButtonStyle(accent: isFavorite ? .pink : favoriteIdleAccent))
            .focusEffectDisabled()
            .accessibilityLabel(isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych")

            Button { showQR = true } label: {
                Label("Otwórz na iPhone", systemImage: "iphone.and.arrow.forward")
            }
            .buttonStyle(EOSDetailActionButtonStyle())
            .focusEffectDisabled()
            .accessibilityLabel("Otwórz ofertę na iPhonie przez kod QR")

            Spacer(minLength: 8)

            if presentation.imageURLs.count > 1 {
                Button { mode = .gallery } label: {
                    Label("Galeria", systemImage: "photo.on.rectangle.angled")
                }
                .buttonStyle(EOSDetailActionButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .galleryEntry)
                .accessibilityLabel("Otwórz galerię zdjęć")
            }
            Button { mode = .info } label: {
                Label("Więcej informacji", systemImage: "info.circle")
            }
            .buttonStyle(EOSDetailActionButtonStyle(accent: presentation.accentColor))
            .focusEffectDisabled()
            .focused($landing, equals: .moreInfo)
            .accessibilityLabel("Więcej informacji o ofercie")
        }
    }
}
