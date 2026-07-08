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
        .sheet(isPresented: $app.isLoginSheetPresented) {
            LoginView()
                .environmentObject(app)
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
