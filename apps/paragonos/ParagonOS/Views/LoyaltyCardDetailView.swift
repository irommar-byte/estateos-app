import SwiftData
import SwiftUI
import UIKit
import PhotosUI

struct LoyaltyCardDetailView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Bindable var card: LoyaltyCard
    @State private var showCheckout = false
    @State private var confirmDelete = false
    @State private var photoTarget: CardPhotoTarget?
    @State private var saveError: String?

    var body: some View {
        List {
            Section {
                LoyaltyCardPass(card: card, showsBarcode: true)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
            }

            Section {
                Button {
                    showCheckout = true
                } label: {
                    Label("Pokaż przy kasie", systemImage: "barcode.viewfinder")
                }
            }

            Section("Apple Wallet") {
                AddToWalletButton(card: card) {
                    card.addedToAppleWallet = true
                    try? wallet.persistLoyalty(card, context: context)
                }
            }

            Section("Szczegóły") {
                if let saveError {
                    Text(saveError)
                        .foregroundStyle(.red)
                }
                LabeledContent("Program", value: card.displayName)
                TextField("Właściciel", text: $card.holderName)
                    .textInputAutocapitalization(.words)
                    .onChange(of: card.holderName) { _, _ in persist() }
                TextField("Numer karty", text: $card.barcodePayload, axis: .vertical)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.body.monospaced())
                    .onChange(of: card.barcodePayload) { _, _ in persist() }
                Picker("Typ", selection: barcodeTypeBinding) {
                    ForEach(BarcodeSymbology.userSelectable, id: \.self) { item in
                        Text(item.title).tag(item)
                    }
                }
                TextField("Notatka", text: $card.note, axis: .vertical)
                    .lineLimit(2...4)
                    .onChange(of: card.note) { _, _ in persist() }
                if card.scannedByName.isEmpty == false {
                    LabeledContent("Dodał", value: card.scannedByName)
                }
            }

            if wallet.family.familyWalletID != nil {
                Section("Rodzina") {
                    if card.familyShareID == nil {
                        Button("Udostępnij rodzinie") {
                            Task { await wallet.shareLoyaltyWithFamily(card, context: context) }
                        }
                    } else {
                        Label("Udostępniona rodzinie", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(ParagonTheme.osGreen)
                        Button("Przestań udostępniać", role: .destructive) {
                            Task { await wallet.stopSharingLoyalty(card, context: context) }
                        }
                    }
                }
            }

            Section {
                if let data = card.photoData, let image = UIImage(data: data) {
                    LoyaltyCardPhotoStrip(image: image, title: card.displayName)
                        .listRowInsets(EdgeInsets(top: 14, leading: 16, bottom: 8, trailing: 16))
                        .listRowBackground(Color.clear)
                }
                photoActions
            } header: {
                Text("Zdjęcia karty")
            } footer: {
                Text("Tylko kadr z ramki — przód i tył, jeśli obie strony były skanowane.")
            }

            Section {
                Button("Usuń kartę", role: .destructive) {
                    confirmDelete = true
                }
            }
        }
        .navigationTitle(card.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showCheckout) {
            LoyaltyCheckoutView(card: card)
                .environmentObject(wallet)
        }
        .sheet(item: $photoTarget) { target in
            CardPhotoCaptureSheet { image in
                applyPhoto(image, target: target)
            }
        }
        .confirmationDialog("Usunąć kartę?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Usuń", role: .destructive) {
                try? wallet.deleteLoyalty(card, context: context)
                dismiss()
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text("Karta zniknie z tego iPhone’a. Jeśli była udostępniona, zniknie też u rodziny.")
        }
    }

    @ViewBuilder
    private var photoActions: some View {
        let sides = card.photoData.flatMap(UIImage.init(data:)).map(CardScanPhotos.splitSides) ?? []
        Button("Zrób przód ponownie") { photoTarget = .front }
        if sides.count >= 2 {
            Button("Zrób tył ponownie") { photoTarget = .back }
        } else {
            Button("Dodaj tył") { photoTarget = .back }
        }
    }

    private func applyPhoto(_ image: UIImage, target: CardPhotoTarget) {
        let current = card.photoData.flatMap(UIImage.init(data:))
        let combined: UIImage
        if let current {
            combined = CardScanPhotos.replacingSide(target == .front ? 0 : 1, in: current, with: image)
        } else {
            combined = CardScanPhotos.cropCapturedCard(image)
        }
        card.photoData = ScanService.compressLoyaltyPhoto(combined)
        persist()
    }

    private func persist() {
        do {
            try wallet.persistLoyalty(card, context: context)
            saveError = nil
        } catch {
            saveError = error.localizedDescription
        }
    }

    private var barcodeTypeBinding: Binding<BarcodeSymbology> {
        Binding(
            get: {
                card.barcodeSymbology == .unknown
                    ? BarcodeSymbology.inferred(from: card.barcodePayload)
                    : card.barcodeSymbology
            },
            set: { next in
                card.barcodeSymbology = next
                persist()
            }
        )
    }
}

enum CardPhotoTarget: String, Identifiable {
    case front
    case back
    var id: String { rawValue }
}

struct CardPhotoCaptureSheet: View {
    var onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var showCamera = false
    @State private var pickerItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            List {
                Button {
                    showCamera = true
                } label: {
                    Label("Zrób zdjęcie", systemImage: "camera")
                }
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label("Wybierz z biblioteki", systemImage: "photo.on.rectangle")
                }
            }
            .navigationTitle("Zdjęcie karty")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraCaptureView(
                    onImage: { image in
                        showCamera = false
                        onImage(CardScanPhotos.cropToCardFrame(image))
                        dismiss()
                    },
                    onCancel: { showCamera = false }
                )
                .ignoresSafeArea()
            }
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        await MainActor.run {
                            onImage(CardScanPhotos.cropToCardFrame(image))
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

struct LoyaltyCardPhotoStrip: View {
    let image: UIImage
    var title: String = "Karta"
    @State private var showViewer = false
    @State private var page = 0

    private var sides: [UIImage] { CardScanPhotos.splitSides(image) }

    var body: some View {
        let labels = sides.count == 2 ? ["Przód", "Tył"] : ["Karta"]
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                ForEach(Array(sides.enumerated()), id: \.offset) { index, side in
                    Button {
                        page = index
                        showViewer = true
                    } label: {
                        cardThumb(side, caption: labels[index])
                    }
                    .buttonStyle(.plain)
                }
            }
            Label(
                sides.count == 2 ? "Dotknij karty, żeby zobaczyć przód albo tył." : "Dotknij karty, żeby powiększyć.",
                systemImage: "arrow.up.left.and.arrow.down.right"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .fullScreenCover(isPresented: $showViewer) {
            LoyaltyCardPhotoViewer(sides: sides, labels: labels, title: title, page: $page)
        }
    }

    private func cardThumb(_ photo: UIImage, caption: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Color.clear
                .aspectRatio(CardScanMetrics.aspect, contentMode: .fit)
                .overlay {
                    Image(uiImage: photo)
                        .resizable()
                        .scaledToFill()
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.55),
                                    Color.white.opacity(0.08),
                                    Color.black.opacity(0.18)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.9
                        )
                }
                .shadow(color: .black.opacity(0.22), radius: 14, y: 6)
            Text(caption)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityLabel(caption)
        .accessibilityAddTraits(.isButton)
    }
}

private struct LoyaltyCardPhotoViewer: View {
    let sides: [UIImage]
    let labels: [String]
    let title: String
    @Binding var page: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(white: 0.12), Color.black],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                TabView(selection: $page) {
                    ForEach(Array(sides.enumerated()), id: \.offset) { index, side in
                        VStack(spacing: 22) {
                            Spacer(minLength: 12)
                            Color.clear
                                .aspectRatio(CardScanMetrics.aspect, contentMode: .fit)
                                .overlay {
                                    Image(uiImage: side)
                                        .resizable()
                                        .scaledToFill()
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                                        .strokeBorder(Color.white.opacity(0.16), lineWidth: 1)
                                }
                                .shadow(color: .black.opacity(0.55), radius: 28, y: 16)
                                .padding(.horizontal, 22)
                            VStack(spacing: 4) {
                                Text(labels[index])
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(.white)
                                if sides.count > 1 {
                                    Text("Przesuń, żeby zobaczyć \(index == 0 ? "tył" : "przód").")
                                        .font(.footnote)
                                        .foregroundStyle(.white.opacity(0.55))
                                }
                            }
                            Spacer(minLength: 12)
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: sides.count > 1 ? .always : .never))
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zamknij") { dismiss() }
                }
            }
        }
    }
}
