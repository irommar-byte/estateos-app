import SwiftUI

struct DetailInfoView: View {
    let presentation: DetailPresentation
    let isFavorite: Bool
    let favoriteIdleAccent: Color
    let isLoadingDescription: Bool
    @Binding var mode: DetailShellMode
    @Binding var showQR: Bool
    let onToggleFavorite: () -> Void
    @FocusState.Binding var landing: DetailLanding?

    var body: some View {
        Group {
            switch mode {
            case .info:
                fullInfoScreen.transition(.eosModeTransition)
            case .description:
                fullDescriptionScreen.transition(.eosModeTransition)
            default:
                EmptyView()
            }
        }
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

    private var fullInfoScreen: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { mode = .hero } label: {
                    Label("Zwiń", systemImage: "chevron.down")
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .infoClose)
                .accessibilityLabel("Zwiń szczegóły")
                Text("Szczegóły oferty")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
                transactionCapsule
                Spacer()
                if presentation.imageURLs.count > 1 {
                    Button { mode = .gallery } label: {
                        Label("Galeria", systemImage: "photo.on.rectangle.angled")
                    }
                    .buttonStyle(EOSDetailActionButtonStyle())
                    .focusEffectDisabled()
                    .accessibilityLabel("Galeria zdjęć")
                }
                Button { showQR = true } label: {
                    Label("Otwórz na iPhone", systemImage: "iphone.and.arrow.forward")
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: presentation.accentColor))
                .focusEffectDisabled()
                .accessibilityLabel("Otwórz na iPhonie")
                Button(action: onToggleFavorite) {
                    Label(
                        isFavorite ? "W ulubionych" : "Ulubione",
                        systemImage: isFavorite ? "heart.fill" : "heart"
                    )
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: isFavorite ? .pink : favoriteIdleAccent))
                .focusEffectDisabled()
                .accessibilityLabel(isFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych")
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
                HStack(spacing: 10) {
                    transactionCapsule
                    EOSCountryLocationLabel(
                        locationLine: presentation.locationLine,
                        country: presentation.country
                    )
                }
                EOSAdaptiveTitle(text: presentation.title, maxLines: 2, maxSize: 36, minSize: 24)
                    .foregroundStyle(.white)
                Text(presentation.priceText)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(presentation.accentColor)
                Text(presentation.subtitleText)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.white.opacity(0.78))
                if let stats = presentation.ownerStats {
                    EOSListingStatsRow(
                        views: stats.views,
                        favorites: stats.favorites,
                        accent: presentation.accentColor
                    )
                }
            }
            .padding(.bottom, 18)

            if presentation.descriptionText != nil || isLoadingDescription {
                Rectangle()
                    .fill(Color.white.opacity(0.12))
                    .frame(height: 1)
                    .padding(.bottom, 18)
            }

            if let descriptionText = presentation.descriptionText {
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
                            .lineLimit(14)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .frame(maxWidth: .infinity, minHeight: max(160, availableHeight - 260), alignment: .topLeading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(EOSDetailCardButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .descriptionCard)
                .accessibilityLabel("Pełny opis oferty")
            } else if isLoadingDescription {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Opis", systemImage: "text.alignleft")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white.opacity(0.95))
                    ProgressView().tint(.white)
                    Text("Ładowanie opisu…")
                        .font(.system(size: 22, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity, minHeight: max(160, availableHeight - 260), alignment: .topLeading)
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
            Label(presentation.specsPanelTitle, systemImage: presentation.specsPanelIcon)
                .font(.headline.weight(.bold))
                .foregroundStyle(.white.opacity(0.95))
            VStack(spacing: 0) {
                ForEach(presentation.specRows) { row in
                    HStack(alignment: .firstTextBaseline, spacing: 16) {
                        Image(systemName: row.icon)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(presentation.accentColor)
                            .frame(width: 26, alignment: .center)
                        Text(row.label.uppercased())
                            .font(.system(size: 14, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(.white.opacity(0.5))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .frame(width: 168, alignment: .leading)
                        Text(row.value)
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .minimumScaleFactor(0.9)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.vertical, 11)
                    .padding(.horizontal, 4)
                    if row.id != presentation.specRows.last?.id {
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

    private var fullDescriptionScreen: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                Button { mode = .info } label: {
                    Label("Wróć", systemImage: "chevron.left")
                }
                .buttonStyle(EOSDetailChromeButtonStyle())
                .focusEffectDisabled()
                .focused($landing, equals: .descriptionClose)
                .accessibilityLabel("Wróć do szczegółów")
                Text("Opis")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
                transactionCapsule
                Spacer()
                if let trailing = presentation.descriptionHeaderTrailing {
                    Text(trailing)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.55))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 48)
            .padding(.top, 28)
            .padding(.bottom, 12)
            .focusSection()

            if let descriptionText = presentation.descriptionText {
                EOSScreenFitText(text: descriptionText, maxSize: 38, minSize: 14, lineSpacing: 7)
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
}
