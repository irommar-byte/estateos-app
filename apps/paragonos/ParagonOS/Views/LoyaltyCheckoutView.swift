import SwiftUI
import UIKit

struct LoyaltyCheckoutView: View {
    let card: LoyaltyCard
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.dismiss) private var dismiss
    @State private var previousBrightness: CGFloat = UIScreen.main.brightness
    @State private var shownSymbology: BarcodeSymbology

    init(card: LoyaltyCard) {
        self.card = card
        _shownSymbology = State(
            initialValue: card.barcodeSymbology == .unknown
                ? BarcodeSymbology.inferred(from: card.barcodePayload)
                : card.barcodeSymbology
        )
    }

    private var program: LoyaltyProgram { card.program }
    private var payload: String { card.barcodePayload }

    private var alternateSymbology: BarcodeSymbology? {
        if shownBase == .qr, BarcodeSymbology.canEncodeCode128(payload) { return .code128 }
        if shownBase != .qr { return .qr }
        return nil
    }

    private var shownBase: BarcodeSymbology {
        card.barcodeSymbology == .unknown
            ? BarcodeSymbology.inferred(from: card.barcodePayload)
            : card.barcodeSymbology
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                HStack(spacing: 10) {
                    LoyaltyLogo(program: program, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.displayName)
                            .font(.headline)
                        if card.holderName.isEmpty == false {
                            Text(card.holderName)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)

                Text("Pokaż kod czytnikowi przy kasie. \(Brand.displayName) nie gwarantuje, że każda kasa przyjmie kod z ekranu.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                if let alternate = alternateSymbology {
                    Picker("Typ kodu", selection: $shownSymbology) {
                        Text(shownBase.title).tag(shownBase)
                        Text(alternate.title).tag(alternate)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 20)
                }

                Spacer(minLength: 8)

                if payload.isEmpty {
                    ContentUnavailableView(
                        "Brak kodu",
                        systemImage: "barcode.viewfinder",
                        description: Text("Wpisz numer karty w szczegółach.")
                    )
                } else if let image = BarcodePresenter.image(
                    payload: payload,
                    symbology: shownSymbology,
                    width: shownSymbology == .qr || shownSymbology == .aztec ? 640 : 900,
                    height: shownSymbology == .qr || shownSymbology == .aztec ? 640 : 240
                ) {
                    Image(uiImage: image)
                        .resizable()
                        .interpolation(.none)
                        .scaledToFit()
                        .padding(.horizontal, 20)
                    Text(payload)
                        .font(.body.monospaced().weight(.medium))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                }

                Spacer()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.white)
            .safeAreaPadding(.top, 8)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Gotowe") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.light)
        .statusBarHidden(true)
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            previousBrightness = UIScreen.main.brightness
            if wallet.settings.boostBrightness {
                UIScreen.main.brightness = 1
            }
            wallet.rememberCheckoutCard(card.id)
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            UIScreen.main.brightness = previousBrightness
        }
    }
}
