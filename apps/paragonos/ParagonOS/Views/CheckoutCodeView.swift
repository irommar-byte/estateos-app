import SwiftData
import SwiftUI
import UIKit

struct CheckoutCodeView: View {
    let ticket: Ticket
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab: CheckoutTab
    @State private var previousBrightness: CGFloat = UIScreen.main.brightness
    @State private var confirmUsedOnExit = false
    @State private var codeImage: UIImage?
    @State private var didBoostBrightness = false

    private var policy: RetailerPolicy { RetailerCatalog.policy(id: ticket.retailerID) }
    private var payload: String { ticket.displayBarcode }
    private var isActive: Bool { ticket.resolvedStatus() == .active }

    init(ticket: Ticket) {
        self.ticket = ticket
        _tab = State(initialValue: ticket.displayBarcode.isEmpty ? .photo : .code)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Picker("Widok", selection: $tab) {
                    Text("Kod").tag(CheckoutTab.code)
                    Text("Zdjęcie").tag(CheckoutTab.photo)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                Text(policy.checkoutHint)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Group {
                    switch tab {
                    case .code:
                        codePane
                    case .photo:
                        photoPane
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                if isActive {
                    Button {
                        markUsedAndClose()
                    } label: {
                        Text("Kasa przyjęła kupon")
                            .font(.headline)
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                ParagonTheme.osGreen,
                                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                            )
                    }
                    .buttonStyle(ParagonPressStyle())
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
                }
            }
            .background(tab == .code ? Color.white : Color(.systemBackground))
            .navigationTitle(policy.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Gotowe") { finishCheckout() }
                }
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        RetailerLogo(retailerID: ticket.retailerID, size: 22)
                        Text(MoneyFormat.string(ticket.amount))
                            .font(.headline)
                    }
                }
            }
            .confirmationDialog(
                "Czy kasa przyjęła kupon?",
                isPresented: $confirmUsedOnExit,
                titleVisibility: .visible
            ) {
                Button("Tak, wykorzystany") {
                    markUsedAndClose()
                }
                Button("Nie, zostaw aktywny") {
                    dismiss()
                }
            } message: {
                Text("Po skanie przy kasie oznacz kwitek jako wykorzystany, żeby nie leżał w portfelu.")
            }
        }
        .onAppear {
            if codeImage == nil {
                codeImage = BarcodePresenter.image(
                    payload: payload,
                    symbology: ticket.barcodeSymbology == .unknown ? .code128 : ticket.barcodeSymbology
                )
            }
            boostScreen()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background || phase == .inactive {
                restoreScreen()
            }
        }
        .onDisappear {
            restoreScreen()
        }
        .statusBarHidden(true)
    }

    @ViewBuilder
    private var codePane: some View {
        if payload.isEmpty {
            ContentUnavailableView(
                "Brak kodu",
                systemImage: "barcode.viewfinder",
                description: Text("Pokaż zdjęcie kwitka albo papier przy kasie.")
            )
        } else {
            VStack(spacing: 16) {
                VoucherPassCard(ticket: ticket, foilActive: false)
                    .padding(.horizontal, 16)
                if let image = codeImage {
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.none)
                        .scaledToFit()
                        .padding(.horizontal, 16)
                        .background(Color.white)
                }
                Text(payload)
                    .font(.title3.monospaced().weight(.semibold))
                    .foregroundStyle(.black)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                if policy.requiresPurchaseAtLeastAmount {
                    Text("Zakupy nie mogą być niższe niż kwota kuponu.")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.black)
                }
            }
        }
    }

    @ViewBuilder
    private var photoPane: some View {
        if let data = ticket.photoData, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .padding()
        } else {
            ContentUnavailableView(
                "Brak zdjęcia",
                systemImage: "photo",
                description: Text("Ten kwitek ma tylko kod. Spróbuj zakładki Kod.")
            )
        }
    }

    private func boostScreen() {
        UIApplication.shared.isIdleTimerDisabled = true
        if didBoostBrightness == false {
            previousBrightness = UIScreen.main.brightness
            if wallet.settings.boostBrightness {
                UIScreen.main.brightness = 1
                didBoostBrightness = true
            }
        }
    }

    private func restoreScreen() {
        UIApplication.shared.isIdleTimerDisabled = false
        if didBoostBrightness {
            UIScreen.main.brightness = previousBrightness
            didBoostBrightness = false
        }
    }

    private func finishCheckout() {
        if isActive {
            confirmUsedOnExit = true
        } else {
            dismiss()
        }
    }

    private func markUsedAndClose() {
        try? wallet.markRedeemed(ticket, context: context)
        dismiss()
    }
}

private enum CheckoutTab {
    case code
    case photo
}
