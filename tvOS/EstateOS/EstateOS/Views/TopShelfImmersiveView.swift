import SwiftUI

struct TopShelfImmersiveView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let offers: [EstateOffer]
    @State private var selectedIndex: Int
    @State private var slideDirection: HorizontalDirection = .none
    @FocusState private var focused: Bool

    enum HorizontalDirection {
        case none, forward, back
    }

    init(offers: [EstateOffer], startIndex: Int) {
        self.offers = offers
        _selectedIndex = State(initialValue: min(max(0, startIndex), max(0, offers.count - 1)))
    }

    private var currentOffer: EstateOffer {
        offers[selectedIndex]
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ImmersiveOfferBackdrop(offer: currentOffer)
                .id(currentOffer.id)
                .transition(backdropTransition)
                .ignoresSafeArea()

            LinearGradient(
                colors: [
                    .black.opacity(0.15),
                    .clear,
                    .black.opacity(0.35),
                    .black.opacity(0.92),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack {
                Spacer()

                glassPanel
                    .padding(.horizontal, 64)
                    .padding(.bottom, 56)
            }
        }
        .focusable()
        .focused($focused)
        .onAppear { focused = true }
        .onMoveCommand(perform: handleMove)
        .onExitCommand { dismiss() }
    }

    private var glassPanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                Text("\(selectedIndex + 1) / \(offers.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                transactionBadge
            }

            ImmersiveAdaptiveTitle(text: currentOffer.title, maxSize: 56, minSize: 28)
                .foregroundStyle(.white)
                .id("title-\(currentOffer.id)")

            ImmersiveMetaRow(offer: currentOffer)
                .id("meta-\(currentOffer.id)")

            HStack(spacing: 18) {
                Button("POKAŻ") {
                    app.openDetail(currentOffer)
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.home))
                .focusEffectDisabled()

                if let area = currentOffer.area {
                    Label("\(Int(area)) m²", systemImage: "square.split.bottomrightquarter")
                        .font(.title3.weight(.medium))
                        .foregroundStyle(.white.opacity(0.82))
                }

                Spacer()

                Text("← → oferty  ·  ↓ zamknij")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.45))
            }
        }
        .padding(40)
        .eosGlass(cornerRadius: 34, opacity: 0.48)
        .animation(.spring(response: 0.52, dampingFraction: 0.84), value: selectedIndex)
    }

    private var transactionBadge: some View {
        Text(currentOffer.transactionLabel.uppercased())
            .font(.system(size: 14, weight: .heavy, design: .rounded))
            .tracking(1.1)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                Capsule(style: .continuous)
                    .fill(currentOffer.transactionType?.uppercased() == "RENT"
                          ? Color(red: 0.45, green: 0.55, blue: 0.72).opacity(0.38)
                          : EOSPalette.home.opacity(0.34))
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(Color.white.opacity(0.22), lineWidth: 1)
            )
    }

    private var backdropTransition: AnyTransition {
        switch slideDirection {
        case .forward:
            return .asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 1.04)),
                removal: .opacity
            )
        case .back:
            return .asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 1.04)),
                removal: .opacity
            )
        case .none:
            return .opacity
        }
    }

    private func handleMove(_ direction: MoveCommandDirection) {
        switch direction {
        case .left:
            guard selectedIndex > 0 else { return }
            slideDirection = .back
            withAnimation(.spring(response: 0.58, dampingFraction: 0.86)) {
                selectedIndex -= 1
            }
        case .right:
            guard selectedIndex < offers.count - 1 else { return }
            slideDirection = .forward
            withAnimation(.spring(response: 0.58, dampingFraction: 0.86)) {
                selectedIndex += 1
            }
        case .down:
            dismiss()
        default:
            break
        }
    }
}

private struct ImmersiveOfferBackdrop: View {
    let offer: EstateOffer

    var body: some View {
        GeometryReader { proxy in
            Group {
                EOSCachedRemoteImage(url: EOSOfferMedia.primaryImageURL(for: offer), contentMode: .fill) {
                    placeholder
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .clipped()
            }
        }
    }

    private var placeholder: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [Color(white: 0.14), Color(white: 0.06)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }
}

private struct ImmersiveAdaptiveTitle: View {
    let text: String
    var maxSize: CGFloat = 52
    var minSize: CGFloat = 24

    private var sizes: [CGFloat] {
        stride(from: maxSize, through: minSize, by: -2).map { $0 }
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            ForEach(sizes, id: \.self) { size in
                Text(text)
                    .font(.system(size: size, weight: .bold, design: .rounded))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ImmersiveMetaRow: View {
    let offer: EstateOffer

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                Text(EOSFormat.pricePLN(offer.price))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(EOSPalette.home)

                if offer.pricePerSqm != nil {
                    Text(offer.displayPricePerSqm)
                        .font(.system(size: 22, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.9))
                }
            }

            EOSCountryLocationLabel(
                locationLine: offer.displayLocation,
                country: offer.resolvedCountry,
                font: .system(size: 20, weight: .medium, design: .rounded),
                foreground: .white.opacity(0.78)
            )
        }
    }
}
