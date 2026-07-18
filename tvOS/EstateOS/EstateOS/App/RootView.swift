import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppModel

    var body: some View {
        Group {
            if app.isBootstrapping {
                ProgressView("Starting EstateOS...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HomeView()
            }
        }
        .background(Color.black.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .fullScreenCover(isPresented: $app.isLoginSheetPresented) {
            LoginView()
                .environmentObject(app)
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
        .alert("Error", isPresented: .constant(app.globalError != nil)) {
            Button("OK") {
                app.globalError = nil
            }
        } message: {
            Text(app.globalError ?? "")
        }
    }
}
