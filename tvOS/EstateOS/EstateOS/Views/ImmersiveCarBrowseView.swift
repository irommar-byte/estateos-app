import SwiftUI

struct ImmersiveCarBrowseView: View {
    @EnvironmentObject private var app: AppModel
    @Environment(\.dismiss) private var dismiss

    let cars: [CarListing]
    @State private var selectedIndex: Int
    @State private var slideDirection: HorizontalDirection = .none
    @FocusState private var focused: Bool

    enum HorizontalDirection {
        case none, forward, back
    }

    init(cars: [CarListing], startIndex: Int) {
        self.cars = cars
        _selectedIndex = State(initialValue: min(max(0, startIndex), max(0, cars.count - 1)))
    }

    private var current: CarListing {
        cars[selectedIndex]
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ImmersiveCarBackdrop(car: current)
                .id(current.id)
                .transition(backdropTransition)
                .ignoresSafeArea()

            LinearGradient(
                colors: [
                    .black.opacity(0.12),
                    .clear,
                    .black.opacity(0.32),
                    .black.opacity(0.94),
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
                Text("\(selectedIndex + 1) / \(cars.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                if current.featured {
                    Text("PROMO")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .tracking(1.1)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Capsule(style: .continuous).fill(Color.white.opacity(0.14)))
                }
            }

            ImmersiveAdaptiveTitleShared(text: current.displayHeadline, maxSize: 56, minSize: 28)
                .foregroundStyle(.white)
                .id("car-title-\(current.id)")

            VStack(alignment: .leading, spacing: 10) {
                Text(current.displayPrice)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(EOSPalette.car)
                Text(current.displaySpecs)
                    .font(.system(size: 22, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.86))
                EOSCountryLocationLabel(
                    locationLine: current.city,
                    country: current.resolvedCountry,
                    font: .system(size: 20, weight: .medium, design: .rounded),
                    foreground: .white.opacity(0.78)
                )
            }
            .id("car-meta-\(current.id)")

            HStack(spacing: 18) {
                Button("POKAŻ") {
                    app.openCarDetail(current)
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: EOSPalette.car))
                .focusEffectDisabled()

                Button {
                    app.toggleFavoriteCar(current)
                } label: {
                    Label(
                        app.isFavoriteCar(current.id) ? "W ulubionych" : "Ulubione",
                        systemImage: app.isFavoriteCar(current.id) ? "heart.fill" : "heart"
                    )
                }
                .buttonStyle(EOSDetailActionButtonStyle(accent: app.isFavoriteCar(current.id) ? .pink : .cyan))
                .focusEffectDisabled()

                Spacer()

                Text("← → auta  ·  ↓ zamknij")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.45))
            }
        }
        .padding(40)
        .eosGlass(cornerRadius: 34, opacity: 0.48)
        .animation(.spring(response: 0.52, dampingFraction: 0.84), value: selectedIndex)
    }

    private var backdropTransition: AnyTransition {
        switch slideDirection {
        case .forward, .back:
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
            guard selectedIndex < cars.count - 1 else { return }
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

private struct ImmersiveCarBackdrop: View {
    let car: CarListing

    var body: some View {
        GeometryReader { proxy in
            Group {
                EOSCachedRemoteImage(url: EOSOfferMedia.imageURL(from: car.imageUrl), contentMode: .fill) {
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
                    colors: [Color(white: 0.12), EOSPalette.car.opacity(0.12), Color(white: 0.05)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
    }
}

/// Shared adaptive title used by car immersive (homes keep private copy in TopShelfImmersiveView).
struct ImmersiveAdaptiveTitleShared: View {
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
