import SwiftData
import SwiftUI

struct LoyaltyScanReviewView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @State private var draft: LoyaltyDraft
    @State private var photo: UIImage?
    @State private var saveError: String?
    @State private var showPicker: Bool

    init() {
        _draft = State(initialValue: .blank())
        _photo = State(initialValue: nil)
        _showPicker = State(initialValue: false)
    }

    var body: some View {
        NavigationStack {
            Form {
                if let saveError {
                    Section {
                        Text(saveError)
                            .foregroundStyle(.red)
                    }
                }
                if let message = wallet.scanError {
                    Section {
                        Text(message)
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    Button {
                        showPicker = true
                    } label: {
                        HStack(spacing: 14) {
                            LoyaltyLogo(program: draft.program, size: 52)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(draft.programName.isEmpty ? "Wybierz sklep" : draft.programName)
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(.primary)
                                Text(draft.needsProgramPick
                                     ? "Sieć nie została rozpoznana — wybierz z bazy."
                                     : "Rozpoznano z karty. Możesz zmienić sklep.")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 4)
                    }
                } header: {
                    Text("Program")
                }

                Section("Kod") {
                    TextField("Numer karty lub treść kodu", text: $draft.barcodePayload, axis: .vertical)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.body.monospaced())
                    Picker("Typ kodu", selection: $draft.barcodeSymbology) {
                        ForEach(BarcodeSymbology.allCases.filter { $0 != .unknown }, id: \.self) { item in
                            Text(item.title).tag(item)
                        }
                    }
                    if draft.barcodePayload.isEmpty == false,
                       let image = BarcodePresenter.image(payload: draft.barcodePayload, symbology: draft.barcodeSymbology) {
                        Image(uiImage: image)
                            .resizable()
                            .interpolation(.none)
                            .scaledToFit()
                            .frame(maxHeight: draft.barcodeSymbology == .qr ? 160 : 88)
                            .padding(.vertical, 6)
                    }
                }

                Section("Właściciel") {
                    TextField("Imię na karcie (opcjonalnie)", text: $draft.holderName)
                        .textInputAutocapitalization(.words)
                    TextField("Notatka", text: $draft.note, axis: .vertical)
                        .lineLimit(2...4)
                }

                if let photo {
                    Section("Zdjęcie karty") {
                        Image(uiImage: photo)
                            .resizable()
                            .scaledToFit()
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
            .navigationTitle("Nowa karta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") {
                        wallet.loyaltyDraft = nil
                        wallet.scanPhoto = nil
                        wallet.showScanner = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Zapisz") { save() }
                        .disabled(draft.canSave == false)
                }
            }
            .onAppear {
                if let existing = wallet.loyaltyDraft {
                    draft = existing
                    showPicker = existing.needsProgramPick
                }
                photo = wallet.scanPhoto
            }
            .sheet(isPresented: $showPicker) {
                LoyaltyProgramPicker { program in
                    draft.programID = program.id
                    draft.programName = program.name
                    if draft.barcodeSymbology == .unknown {
                        draft.barcodeSymbology = BarcodeSymbology.inferred(
                            from: draft.barcodePayload,
                            preferred: program.preferredBarcode
                        )
                    }
                    draft.needsProgramPick = false
                }
            }
        }
        .interactiveDismissDisabled()
    }

    private func save() {
        do {
            _ = try wallet.saveLoyalty(draft: draft, photo: photo, context: context)
        } catch {
            saveError = error.localizedDescription
        }
    }
}
