import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppModel
    @Namespace private var heroNamespace
    @EnvironmentObject private var heroTransition: HeroTransitionCoordinator
    @State private var splashFinished = false
    @State private var bootstrapTimedOut = false

    private var showHome: Bool {
        splashFinished
    }

    private var showExtendedHold: Bool {
        false
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if showHome {
                HomeView()
                    .transition(.opacity)
            }

            if !splashFinished {
                AppleSplashView {
                    TvLaunchMetrics.recordSplashEnd()
                    splashFinished = true
                    Task { await app.fulfillPendingDeepLink() }
                }
                .environmentObject(app)
                .id("estateos-splash")
                .transition(.opacity)
                .zIndex(2)
            } else if showExtendedHold {
                LivingHoldView()
                    .transition(.opacity)
                    .zIndex(2)
            }
        }
        .animation(.easeOut(duration: 0.35), value: showHome)
        .animation(.easeOut(duration: 0.25), value: splashFinished)
        .preferredColorScheme(.dark)
        .task {
            try? await Task.sleep(nanoseconds: UInt64(SplashAnimationTimeline.bootstrapCapMs * 1_000_000))
            if app.isBootstrapping { bootstrapTimedOut = true; TvLaunchMetrics.recordExtendedHold() }
        }
        .fullScreenCover(isPresented: $app.isLoginSheetPresented) {
            LoginView()
                .environmentObject(app)
        }
        .fullScreenCover(item: $app.selectedOffer) { offer in
            OfferDetailView(
                offer: offer,
                heroNamespace: heroNamespace,
                heroTransitionID: HeroTransitionID.home(offer.id).stringValue
            )
            .environmentObject(app)
            .environmentObject(heroTransition)
        }
        .fullScreenCover(item: $app.selectedCar) { car in
            CarDetailView(
                car: car,
                heroNamespace: heroNamespace,
                heroTransitionID: HeroTransitionID.car(car.id).stringValue
            )
            .environmentObject(app)
            .environmentObject(heroTransition)
        }
        .fullScreenCover(item: $app.immersiveBrowse, onDismiss: app.closeImmersiveBrowse) { context in
            switch context.kind {
            case .homes(let offers):
                TopShelfImmersiveView(offers: offers, startIndex: context.startIndex)
                    .environmentObject(app)
            case .cars(let cars):
                ImmersiveCarBrowseView(cars: cars, startIndex: context.startIndex)
                    .environmentObject(app)
            }
        }
        .alert("Błąd", isPresented: .constant(app.globalError != nil)) {
            Button("OK") {
                app.globalError = nil
            }
        } message: {
            Text(app.globalError ?? "")
        }
    }
}

/// Branded hold when bootstrap exceeds the splash cap (slow network).
private struct LivingHoldView: View {
    private static let gold = SplashAnimationTimeline.gold

    @State private var breathe = false
    @State private var dotPhase = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            Circle()
                .fill(
                    RadialGradient(
                        colors: [Self.gold.opacity(breathe ? 0.22 : 0.1), .clear],
                        center: .center,
                        startRadius: 20,
                        endRadius: 280
                    )
                )
                .frame(width: 560, height: 560)
                .scaleEffect(breathe ? 1.08 : 0.94)

            VStack(spacing: 26) {
                Image("EstateOSLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: 480)
                    .scaleEffect(breathe ? 1.02 : 0.985)
                    .shadow(color: Self.gold.opacity(breathe ? 0.3 : 0.12), radius: 26, y: 6)

                Text("Łączenie z katalogiem…")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white.opacity(0.72))

                HStack(spacing: 10) {
                    ForEach(0..<3) { i in
                        Circle()
                            .fill(Self.gold.opacity(dotPhase == i ? 0.95 : 0.28))
                            .frame(width: 10, height: 10)
                            .scaleEffect(dotPhase == i ? 1.25 : 1)
                    }
                }
                .animation(.easeInOut(duration: 0.32), value: dotPhase)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) {
                breathe = true
            }
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 420_000_000)
                dotPhase = (dotPhase + 1) % 3
            }
        }
    }
}
