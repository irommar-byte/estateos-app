import PassKit
import SwiftUI
import UIKit

struct AddToWalletButton: View {
    let card: LoyaltyCard
    var onAdded: () -> Void = {}
    @Environment(\.colorScheme) private var colorScheme
    @State private var pass: PKPass?
    @State private var isPreparing = false
    @State private var alertMessage: String?
    @State private var logo: UIImage?

    var body: some View {
        VStack(alignment: .center, spacing: 10) {
            if PKAddPassesViewController.canAddPasses() {
                ZStack {
                    NativeAddPassButton(
                        style: colorScheme == .dark ? .blackOutline : .black,
                        isEnabled: isPreparing == false
                    ) {
                        Task { await add() }
                    }
                    .opacity(isPreparing ? 0.35 : 1)
                    if isPreparing {
                        ProgressView()
                    }
                }
                .frame(maxWidth: .infinity)
                .accessibilityLabel("Dodaj do Apple Wallet")
            } else {
                Text("Ten iPhone nie może teraz dodać kart do Apple Wallet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text("Karta w Wallet ma ten sam kod co w aplikacji. Przy kasie możesz też użyć „Pokaż przy kasie”.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .sheet(item: $pass) { item in
            AddPassSheet(pass: item) { added in
                pass = nil
                if added {
                    onAdded()
                }
            }
        }
        .alert("Apple Wallet", isPresented: alertPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage ?? "")
        }
        .task {
            logo = await LoyaltyLogoStore.shared.image(for: card.program)
        }
    }

    private var alertPresented: Binding<Bool> {
        Binding(
            get: { alertMessage != nil },
            set: { if $0 == false { alertMessage = nil } }
        )
    }

    private func add() async {
        guard PKAddPassesViewController.canAddPasses() else {
            alertMessage = "Ten iPhone nie może teraz dodać kart do Apple Wallet."
            return
        }
        isPreparing = true
        defer { isPreparing = false }
        do {
            let built = try WalletPassBuilder.addablePass(for: card, logo: logo)
            alertMessage = nil
            pass = built
        } catch {
            alertMessage = error.localizedDescription
        }
    }
}

private struct NativeAddPassButton: UIViewRepresentable {
    var style: PKAddPassButtonStyle
    var isEnabled: Bool
    var action: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(action: action)
    }

    func makeUIView(context: Context) -> PKAddPassButton {
        let button = PKAddPassButton(addPassButtonStyle: style)
        button.addTarget(context.coordinator, action: #selector(Coordinator.tap), for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: PKAddPassButton, context: Context) {
        context.coordinator.action = action
        uiView.isEnabled = isEnabled
        uiView.addPassButtonStyle = style
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: PKAddPassButton, context: Context) -> CGSize? {
        uiView.intrinsicContentSize
    }

    final class Coordinator: NSObject {
        var action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func tap() { action() }
    }
}

extension PKPass: Identifiable {
    public var id: String { serialNumber }
}

private struct AddPassSheet: UIViewControllerRepresentable {
    let pass: PKPass
    var onFinished: (Bool) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onFinished: onFinished)
    }

    func makeUIViewController(context: Context) -> UIViewController {
        guard let controller = PKAddPassesViewController(pass: pass) else {
            return UIViewController()
        }
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    final class Coordinator: NSObject, PKAddPassesViewControllerDelegate {
        var onFinished: (Bool) -> Void

        init(onFinished: @escaping (Bool) -> Void) {
            self.onFinished = onFinished
        }

        func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
            onFinished(true)
            controller.dismiss(animated: true)
        }
    }
}
