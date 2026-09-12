import AVFoundation
import PhotosUI
import SwiftUI
import UIKit
import VisionKit

enum ScanTorch {
    static var isAvailable: Bool {
        guard let device = AVCaptureDevice.default(for: .video) else { return false }
        return device.hasTorch && device.isTorchAvailable
    }

    static func setEnabled(_ on: Bool) {
        guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else { return }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }
            if on, device.isTorchModeSupported(.on) {
                try device.setTorchModeOn(level: 0.85)
            } else {
                device.torchMode = .off
            }
        } catch {}
    }
}

struct ScanTorchButton: View {
    @Binding var isOn: Bool

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            isOn.toggle()
        } label: {
            Image(systemName: isOn ? "flashlight.on.fill" : "flashlight.off.fill")
                .font(.title3.weight(.semibold))
                .foregroundStyle(isOn ? .black : .white)
                .frame(width: 48, height: 48)
                .background(isOn ? ParagonTheme.osGreen : Color.white.opacity(0.18), in: Circle())
                .overlay {
                    Circle().strokeBorder(.white.opacity(0.28), lineWidth: 0.8)
                }
        }
        .accessibilityLabel(isOn ? "Wyłącz latarkę" : "Włącz latarkę")
    }
}

struct ScannerHost: View {
    @EnvironmentObject private var wallet: WalletModel
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var showLive = false

    var body: some View {
        NavigationStack {
            List {
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    Section {
                        Button {
                            showLive = true
                        } label: {
                            Label("Skanuj na żywo", systemImage: "viewfinder")
                        }
                    } footer: {
                        Text(wallet.scanIntent == .receipt
                             ? "Trzymaj paragon lub fakturę w kadrze, aż aplikacja zbierze sklep, kwotę, datę i NIP."
                             : "Trzymaj kwitek w kadrze, aż aplikacja zbierze sieć, kwotę, datę i kod. Sama zamknie skaner, gdy wszystko będzie kompletne.")
                    }
                }

                Section(wallet.scanIntent == .receipt ? "Zdjęcie paragonu" : "Zdjęcie kwitka") {
                    Button {
                        showCamera = true
                    } label: {
                        Label("Zrób zdjęcie", systemImage: "camera")
                    }
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Wybierz z Zdjęć", systemImage: "photo.on.rectangle")
                    }
                }
            }
            .navigationTitle(wallet.scanIntent == .receipt ? "Skanuj paragon" : "Skanuj kaucję")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zamknij") { wallet.showScanner = false }
                }
            }
            .overlay {
                if wallet.isAnalyzing {
                    ProgressView("Odczytywanie…")
                        .padding()
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
            .fullScreenCover(isPresented: $showLive) {
                LiveScannerScreen(intent: wallet.scanIntent) { draft, photo in
                    showLive = false
                    wallet.applyLiveScan(draft: draft, photo: photo)
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraCaptureView(
                    onImage: { image in
                        showCamera = false
                        Task { await wallet.analyze(image: image) }
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
                        await wallet.analyze(image: image)
                    }
                }
            }
        }
    }
}

struct ImmediateScanCover: View {
    @EnvironmentObject private var wallet: WalletModel

    var body: some View {
        Group {
            if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                LiveScannerScreen(intent: wallet.scanIntent) { draft, photo in
                    wallet.applyLiveScan(draft: draft, photo: photo)
                }
            } else {
                CameraCaptureView(
                    onImage: { image in
                        Task { await wallet.analyze(image: image) }
                    },
                    onCancel: { wallet.showScanner = false }
                )
                .ignoresSafeArea()
            }
        }
        .overlay {
            if wallet.isAnalyzing {
                ProgressView("Odczytywanie…")
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }
}

struct LiveScannerScreen: View {
    var intent: ScanIntent = .deposit
    var onComplete: (VoucherDraft, UIImage?) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var hud = LiveScanHUD()

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                LiveDataScanner(hud: hud, intent: intent, onComplete: onComplete)
                    .ignoresSafeArea()

                VStack(spacing: 14) {
                    HStack(spacing: 10) {
                        if intent == .receipt {
                            scanChip("Sklep", done: hud.hasRetailer)
                            scanChip("Kwota", done: hud.hasAmount)
                            scanChip("Data", done: hud.hasDate)
                            scanChip("NIP", done: hud.hasCode)
                        } else {
                            scanChip("Sieć", done: hud.hasRetailer)
                            scanChip("Kwota", done: hud.hasAmount)
                            scanChip("Data", done: hud.hasDate)
                            scanChip("Kod", done: hud.hasCode)
                        }
                    }
                    if hud.isExpired {
                        Label("Przeterminowany", systemImage: "exclamationmark.triangle.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.orange)
                    }
                    Text(hud.caption(for: intent))
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.white)
                        .shadow(radius: 6)
                        .multilineTextAlignment(.center)
                    if hud.isCapturing {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Button("Odczytaj ten kadr") {
                            hud.requestCapture = true
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(ParagonTheme.osGreen)
                        .foregroundStyle(.black)
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity)
                .background(.black.opacity(0.45), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .padding(.horizontal, 16)
                .padding(.bottom, 28)
            }
            .overlay(alignment: .topTrailing) {
                if ScanTorch.isAvailable {
                    ScanTorchButton(isOn: $hud.torchOn)
                        .padding(.top, 52)
                        .padding(.trailing, 16)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") {
                        ScanTorch.setEnabled(false)
                        hud.torchOn = false
                        dismiss()
                    }
                }
            }
            .onChange(of: hud.torchOn) { _, on in
                ScanTorch.setEnabled(on)
            }
            .onDisappear {
                ScanTorch.setEnabled(false)
                hud.torchOn = false
            }
        }
    }

    private func scanChip(_ title: String, done: Bool) -> some View {
        Label(title, systemImage: done ? "checkmark.circle.fill" : "circle")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())
            .foregroundStyle(done ? ParagonTheme.osGreen : .white)
    }
}

@MainActor
final class LiveScanHUD: ObservableObject {
    @Published var hasRetailer = false
    @Published var hasAmount = false
    @Published var hasDate = false
    @Published var hasCode = false
    @Published var isCapturing = false
    @Published var requestCapture = false
    @Published var isExpired = false
    @Published var torchOn = false

    func caption(for intent: ScanIntent) -> String {
        if isExpired { return "Ten kwitek jest już przeterminowany." }
        if isCapturing { return "Dokładny odczyt zdjęcia…" }
        if intent == .receipt {
            if hasRetailer && hasAmount && hasDate { return "Komplet — jeszcze chwila, żeby potwierdzić kadr." }
            if hasRetailer && hasAmount { return "Szukam daty zakupu." }
            if hasAmount { return "Kwota jest. Prowadź aparat po nazwie sklepu." }
            return "Skieruj aparat na cały paragon — sklep, kwota, data i NIP."
        }
        if hasAmount && hasDate && hasCode { return "Komplet — jeszcze chwila, żeby potwierdzić kadr." }
        if hasCode && hasAmount { return "Szukam daty wystawienia na dole kwitka." }
        if hasCode { return "Kod jest. Prowadź aparat po kwocie i dacie." }
        return "Skieruj aparat na cały kwitek — kod, kwota i data."
    }
}

struct LiveDataScanner: UIViewControllerRepresentable {
    @ObservedObject var hud: LiveScanHUD
    var intent: ScanIntent
    var onComplete: (VoucherDraft, UIImage?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(hud: hud, intent: intent, onComplete: onComplete)
    }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let controller = DataScannerViewController(
            recognizedDataTypes: [
                .barcode(),
                .text(languages: ["pl-PL", "en-US"])
            ],
            qualityLevel: .accurate,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        controller.delegate = context.coordinator
        context.coordinator.scanner = controller
        try? controller.startScanning()
        context.coordinator.startWatching()
        return controller
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {
        context.coordinator.hud = hud
        context.coordinator.intent = intent
        if hud.requestCapture {
            hud.requestCapture = false
            context.coordinator.captureNow()
        }
    }

    static func dismantleUIViewController(_ uiViewController: DataScannerViewController, coordinator: Coordinator) {
        coordinator.cancel()
        ScanTorch.setEnabled(false)
        uiViewController.stopScanning()
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var hud: LiveScanHUD
        var intent: ScanIntent
        var onComplete: (VoucherDraft, UIImage?) -> Void
        weak var scanner: DataScannerViewController?
        private var lines = Set<String>()
        private var barcodes: [DetectedBarcode] = []
        private var consumed = false
        private var startedAt = Date()
        private var readySince: Date?
        private var watchTask: Task<Void, Never>?

        init(hud: LiveScanHUD, intent: ScanIntent, onComplete: @escaping (VoucherDraft, UIImage?) -> Void) {
            self.hud = hud
            self.intent = intent
            self.onComplete = onComplete
        }

        func startWatching() {
            startedAt = Date()
            watchTask = Task { @MainActor [weak self] in
                while let self, Task.isCancelled == false, self.consumed == false {
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    self.evaluateTimeout()
                }
            }
        }

        func cancel() {
            watchTask?.cancel()
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didAdd addedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            ingest(allItems)
        }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didUpdate updatedItems: [RecognizedItem],
            allItems: [RecognizedItem]
        ) {
            ingest(allItems)
        }

        private func ingest(_ items: [RecognizedItem]) {
            guard consumed == false else { return }
            for item in items {
                switch item {
                case .barcode(let barcode):
                    if let payload = barcode.payloadStringValue, payload.isEmpty == false {
                        if barcodes.contains(where: { $0.payload == payload }) == false {
                            barcodes.append(DetectedBarcode(payload: payload, symbology: .code128))
                        }
                    }
                case .text(let text):
                    let value = text.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
                    if value.isEmpty == false {
                        lines.insert(value)
                    }
                default:
                    break
                }
            }
            publish()
            considerReady()
        }

        private func parseLive() -> VoucherDraft {
            VoucherParser.parse(lines: Array(lines), barcodes: barcodes)
        }

        private func parseReceipt() -> ReceiptDraft {
            ReceiptParser.parse(lines: Array(lines), barcodes: barcodes)
        }

        private func publish() {
            if intent == .receipt {
                let draft = parseReceipt()
                hud.hasRetailer = draft.merchantName.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
                hud.hasAmount = draft.amount > 0
                hud.hasDate = draft.issuedWasPrinted
                hud.hasCode = draft.merchantNIP.isEmpty == false
                hud.isExpired = false
                return
            }
            let draft = parseLive()
            hud.hasRetailer = draft.retailerID != "unknown"
            hud.hasAmount = draft.amount > 0
            hud.hasDate = draft.issuedWasPrinted
            hud.hasCode = draft.barcodePayload.isEmpty == false
            hud.isExpired = draft.isExpired()
        }

        private func considerReady() {
            let complete = intent == .receipt ? parseReceipt().scanIsComplete : parseLive().scanIsComplete
            if complete {
                if readySince == nil { readySince = Date() }
                if let readySince, Date().timeIntervalSince(readySince) >= 0.85, Date().timeIntervalSince(startedAt) >= 1.4 {
                    captureNow()
                }
            } else {
                readySince = nil
            }
        }

        private func evaluateTimeout() {
            guard consumed == false else { return }
            considerReady()
            if Date().timeIntervalSince(startedAt) >= 12, barcodes.isEmpty == false || lines.count >= 4 {
                captureNow()
            }
        }

        func captureNow() {
            guard consumed == false else { return }
            consumed = true
            watchTask?.cancel()
            hud.isCapturing = true
            Task { @MainActor in
                let live = parseLive()
                var photo: UIImage?
                if let scanner {
                    if let image = try? await scanner.capturePhoto() {
                        photo = image
                    }
                    scanner.stopScanning()
                }
                var draft = live
                if let photo, let result = try? await ScanService.analyze(image: photo) {
                    draft = VoucherParser.mergeLive(live, photo: result.draft)
                }
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                ScanTorch.setEnabled(false)
                onComplete(draft, photo)
            }
        }
    }
}

struct CameraCaptureView: View {
    var onImage: (UIImage) -> Void
    var onCancel: () -> Void
    @State private var torchOn = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            CameraPicker(
                onImage: { image in
                    ScanTorch.setEnabled(false)
                    onImage(image)
                },
                onCancel: {
                    ScanTorch.setEnabled(false)
                    onCancel()
                }
            )
            .ignoresSafeArea()
            if ScanTorch.isAvailable {
                ScanTorchButton(isOn: $torchOn)
                    .padding(.top, 56)
                    .padding(.trailing, 18)
            }
        }
        .onChange(of: torchOn) { _, on in
            ScanTorch.setEnabled(on)
        }
        .onDisappear {
            ScanTorch.setEnabled(false)
        }
    }
}

struct CameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    var onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage, onCancel: onCancel) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        var onImage: (UIImage) -> Void
        var onCancel: () -> Void
        init(onImage: @escaping (UIImage) -> Void, onCancel: @escaping () -> Void) {
            self.onImage = onImage
            self.onCancel = onCancel
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCancel()
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                onImage(image)
            } else {
                onCancel()
            }
        }
    }
}
