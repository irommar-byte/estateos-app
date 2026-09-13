import AVFoundation
import PhotosUI
import SwiftUI
import UIKit
import Vision
import VisionKit

enum CardScanMetrics {
    static let aspect: CGFloat = 85.60 / 53.98

    static func size(fitting maxWidth: CGFloat, maxHeight: CGFloat) -> CGSize {
        let width = min(max(maxWidth, 1), max(maxHeight, 1) * aspect)
        return CGSize(width: width, height: width / aspect)
    }
}

enum DocumentScanComposer {
    static func combine(_ pages: [UIImage]) -> UIImage {
        guard let first = pages.first else { return UIImage() }
        if pages.count == 1 { return first }
        let width = pages.map(\.size.width).max() ?? first.size.width
        let scaled = pages.map { page -> (UIImage, CGSize) in
            let scale = width / max(page.size.width, 1)
            return (page, CGSize(width: width, height: page.size.height * scale))
        }
        let height = scaled.reduce(CGFloat(0)) { sum, item in sum + item.1.height }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: max(height, 1)), format: format)
        return renderer.image { _ in
            var y: CGFloat = 0
            for (page, size) in scaled {
                page.draw(in: CGRect(origin: CGPoint(x: 0, y: y), size: size))
                y += size.height
            }
        }
    }
}

enum ScanTorch {
    static var isAvailable: Bool {
        backCamera()?.hasTorch == true
    }

    /// Safe only when nothing else owns the capture session (scanner stopped, or still photo picker).
    static func applyNow(_ on: Bool) {
        guard let device = backCamera(), device.hasTorch else { return }
        do {
            try device.lockForConfiguration()
            defer { device.unlockForConfiguration() }
            if on, device.isTorchModeSupported(.on) {
                let level = min(Float(0.65), AVCaptureDevice.maxAvailableTorchLevel)
                if level > 0 {
                    try? device.setTorchModeOn(level: level)
                } else {
                    device.torchMode = .on
                }
            } else if device.isTorchModeSupported(.off) {
                device.torchMode = .off
            }
        } catch {}
    }

    static func setPickerTorch(_ on: Bool) {
        DispatchQueue.global(qos: .userInitiated).async {
            applyNow(on)
        }
    }

    private static func backCamera() -> AVCaptureDevice? {
        let types: [AVCaptureDevice.DeviceType] = [
            .builtInTripleCamera,
            .builtInDualWideCamera,
            .builtInDualCamera,
            .builtInWideAngleCamera
        ]
        return AVCaptureDevice.DiscoverySession(
            deviceTypes: types,
            mediaType: .video,
            position: .back
        ).devices.first(where: \.hasTorch)
            ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
            ?? AVCaptureDevice.default(for: .video)
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
    @State private var showDocument = false

    var body: some View {
        NavigationStack {
            List {
                if usesDocumentScanner {
                    Section {
                        Button {
                            showDocument = true
                        } label: {
                            Label("Skanuj dokument", systemImage: "doc.viewfinder")
                        }
                    } footer: {
                        Text(scanHint)
                    }
                } else if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    Section {
                        Button {
                            showLive = true
                        } label: {
                            Label("Skanuj kartę", systemImage: "creditcard.viewfinder")
                        }
                    } footer: {
                        Text(scanHint)
                    }
                }

                Section(photoSectionTitle) {
                    if usesDocumentScanner == false {
                        Button {
                            showCamera = true
                        } label: {
                            Label("Zrób zdjęcie", systemImage: "camera")
                        }
                    }
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Wybierz z Zdjęć", systemImage: "photo.on.rectangle")
                    }
                }
            }
            .navigationTitle(scanTitle)
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
                LiveScannerScreen(
                    intent: wallet.scanIntent,
                    onLoyaltyComplete: { draft, photo in
                        showLive = false
                        wallet.finishLoyaltyScan(draft: draft, photo: photo)
                    },
                    onComplete: { draft, photo in
                        showLive = false
                        wallet.applyLiveScan(draft: draft, photo: photo)
                    }
                )
            }
            .fullScreenCover(isPresented: $showDocument) {
                DocumentCameraView(
                    singlePage: wallet.scanIntent == .receipt,
                    onComplete: { image in
                        showDocument = false
                        Task { await wallet.analyze(image: image) }
                    },
                    onCancel: { showDocument = false }
                )
                .ignoresSafeArea()
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

    private var usesDocumentScanner: Bool {
        (wallet.scanIntent == .deposit || wallet.scanIntent == .receipt)
            && VNDocumentCameraViewController.isSupported
    }

    private var scanTitle: String {
        switch wallet.scanIntent {
        case .deposit: return "Skanuj kaucję"
        case .receipt: return "Skanuj paragon"
        case .loyalty: return "Skanuj kartę"
        }
    }

    private var photoSectionTitle: String {
        switch wallet.scanIntent {
        case .deposit: return "Zdjęcie kwitka"
        case .receipt: return "Zdjęcie paragonu"
        case .loyalty: return "Zdjęcie karty"
        }
    }

    private var scanHint: String {
        switch wallet.scanIntent {
        case .deposit:
            return "Zeskanuj cały kwitek — Apple wyprostuje kartkę, a potem aplikacja odczyta sieć, kwotę, datę i kod."
        case .receipt:
            return "Zeskanuj cały paragon lub fakturę jedną stroną. Po pierwszym ujęciu kliknij Zapisz — nie dokładaj drugiego zdjęcia tego samego dokumentu. Potem aplikacja spokojnie odczyta sklep, kwotę, datę i NIP."
        case .loyalty:
            return "Włóż kartę w ramkę, zeskanuj jedną stronę, potem odwróć. Sieć i numer biorą się z obu stron razem."
        }
    }
}

struct ImmediateScanCover: View {
    @EnvironmentObject private var wallet: WalletModel

    var body: some View {
        Group {
            if wallet.scanIntent == .loyalty,
               DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                LiveScannerScreen(
                    intent: .loyalty,
                    onLoyaltyComplete: { draft, photo in
                        wallet.finishLoyaltyScan(draft: draft, photo: photo)
                    }
                )
            } else if (wallet.scanIntent == .deposit || wallet.scanIntent == .receipt),
                      VNDocumentCameraViewController.isSupported {
                DocumentCameraView(
                    singlePage: wallet.scanIntent == .receipt,
                    onComplete: { image in
                        Task { await wallet.analyze(image: image) }
                    },
                    onCancel: { wallet.showScanner = false }
                )
                .ignoresSafeArea()
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
    var onLoyaltyComplete: ((LoyaltyDraft, UIImage?) -> Void)? = nil
    var onComplete: (VoucherDraft, UIImage?) -> Void = { _, _ in }
    @Environment(\.dismiss) private var dismiss
    @StateObject private var hud = LiveScanHUD()
    @State private var torchOn = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Color.black.ignoresSafeArea()
                if intent == .loyalty {
                    loyaltyScanner
                } else {
                    LiveDataScanner(hud: hud, intent: intent, torchOn: torchOn, onComplete: onComplete)
                        .ignoresSafeArea()
                    scannerHUD
                        .padding(.horizontal, 16)
                        .padding(.bottom, 28)
                }
            }
            .overlay(alignment: .topTrailing) {
                if ScanTorch.isAvailable {
                    ScanTorchButton(isOn: $torchOn)
                        .padding(.top, 52)
                        .padding(.trailing, 16)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") {
                        torchOn = false
                        dismiss()
                    }
                }
            }
            .onDisappear {
                torchOn = false
            }
        }
    }

    private var loyaltyScanner: some View {
        GeometryReader { geo in
            let card = CardScanMetrics.size(
                fitting: geo.size.width - 40,
                maxHeight: geo.size.height * 0.42
            )
            VStack(spacing: 22) {
                Spacer(minLength: 12)
                Text(hud.cardSide == 1 ? "Strona 1 z 2 — włóż kartę" : "Strona 2 z 2 — odwróć kartę")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.92))
                ZStack {
                    LiveDataScanner(
                        hud: hud,
                        intent: intent,
                        torchOn: torchOn,
                        cardWindow: true,
                        onLoyaltyComplete: onLoyaltyComplete,
                        onComplete: onComplete
                    )
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.92), lineWidth: 2.2)
                }
                .frame(width: card.width, height: card.height)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.45), radius: 18, y: 8)
                scannerHUD
                Spacer(minLength: 8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 20)
        }
    }

    private var scannerHUD: some View {
        VStack(spacing: 14) {
            HStack(spacing: 10) {
                if intent == .receipt {
                    scanChip("Sklep", done: hud.hasRetailer)
                    scanChip("Kwota", done: hud.hasAmount)
                    scanChip("Data", done: hud.hasDate)
                    scanChip("NIP", done: hud.hasCode)
                } else if intent == .loyalty {
                    scanChip("Przód", done: hud.cardSide > 1)
                    scanChip("Tył", done: hud.cardSide > 1 && hud.isCapturing)
                    scanChip("Sklep", done: hud.hasRetailer)
                    scanChip("Kod", done: hud.hasCode)
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
            } else if intent == .loyalty {
                Button(hud.cardSide == 1 ? "Odczytaj tę stronę" : "Odczytaj drugą stronę") {
                    hud.requestCapture = true
                }
                .buttonStyle(.borderedProminent)
                .tint(ParagonTheme.osGreen)
                .foregroundStyle(.black)
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
    @Published var cardSide = 1
    var lockedRetailer = false
    var lockedCode = false

    func caption(for intent: ScanIntent) -> String {
        if isExpired { return "Ten kwitek jest już przeterminowany." }
        if intent == .loyalty {
            if isCapturing {
                return cardSide == 1 ? "Zapisuję pierwszą stronę…" : "Składam obie strony…"
            }
            if cardSide == 1 {
                return "Najpierw jedna strona — logo, nazwa sklepu albo kod."
            }
            return "Odwróć kartę. Druga strona uzupełni sklep albo numer."
        }
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
    var torchOn: Bool
    var cardWindow: Bool = false
    var onLoyaltyComplete: ((LoyaltyDraft, UIImage?) -> Void)? = nil
    var onComplete: (VoucherDraft, UIImage?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(hud: hud, intent: intent, onLoyaltyComplete: onLoyaltyComplete, onComplete: onComplete)
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
        context.coordinator.onLoyaltyComplete = onLoyaltyComplete
        context.coordinator.onComplete = onComplete
        context.coordinator.syncTorch(torchOn, on: uiViewController)
        if context.coordinator.didFinish == false,
           hud.isCapturing == false,
           context.coordinator.torchBusy == false,
           uiViewController.isScanning == false {
            try? uiViewController.startScanning()
        }
        if hud.requestCapture {
            hud.requestCapture = false
            context.coordinator.captureNow()
        }
        if cardWindow {
            uiViewController.view.clipsToBounds = true
            uiViewController.view.layer.cornerRadius = 16
            let bounds = uiViewController.view.bounds
            if bounds.width > 16, bounds.height > 16 {
                uiViewController.regionOfInterest = bounds.insetBy(dx: 6, dy: 6)
            }
        }
    }

    static func dismantleUIViewController(_ uiViewController: DataScannerViewController, coordinator: Coordinator) {
        coordinator.cancel()
        uiViewController.stopScanning()
        ScanTorch.applyNow(false)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var hud: LiveScanHUD
        var intent: ScanIntent
        var onLoyaltyComplete: ((LoyaltyDraft, UIImage?) -> Void)?
        var onComplete: (VoucherDraft, UIImage?) -> Void
        weak var scanner: DataScannerViewController?
        private var lines = Set<String>()
        private var barcodes: [DetectedBarcode] = []
        private var consumed = false
        private var startedAt = Date()
        private var readySince: Date?
        private var watchTask: Task<Void, Never>?
        private var appliedTorch = false
        var torchBusy = false
        private var firstSide: (image: UIImage?, lines: [String], barcodes: [DetectedBarcode])?

        init(
            hud: LiveScanHUD,
            intent: ScanIntent,
            onLoyaltyComplete: ((LoyaltyDraft, UIImage?) -> Void)?,
            onComplete: @escaping (VoucherDraft, UIImage?) -> Void
        ) {
            self.hud = hud
            self.intent = intent
            self.onLoyaltyComplete = onLoyaltyComplete
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

        func syncTorch(_ on: Bool, on scanner: DataScannerViewController) {
            guard appliedTorch != on, torchBusy == false else { return }
            appliedTorch = on
            torchBusy = true
            let resume = scanner.isScanning && consumed == false && hud.isCapturing == false
            if scanner.isScanning {
                scanner.stopScanning()
            }
            DispatchQueue.main.async { [weak self, weak scanner] in
                guard let self, let scanner else { return }
                ScanTorch.applyNow(on)
                if resume, self.consumed == false, self.hud.isCapturing == false {
                    try? scanner.startScanning()
                }
                self.torchBusy = false
            }
        }

        var didFinish: Bool { consumed }

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
                            barcodes.append(
                                DetectedBarcode(
                                    payload: payload,
                                    symbology: BarcodeSymbology.fromLive(barcode)
                                )
                            )
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
            if intent == .loyalty {
                let draft = LoyaltyParser.parse(lines: Array(lines), barcodes: barcodes)
                hud.hasRetailer = hud.lockedRetailer || draft.needsProgramPick == false
                hud.hasAmount = false
                hud.hasDate = false
                hud.hasCode = hud.lockedCode || draft.barcodePayload.isEmpty == false
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
            let complete: Bool
            switch intent {
            case .receipt:
                complete = parseReceipt().scanIsComplete
            case .loyalty:
                complete = loyaltySideLooksReady()
            case .deposit:
                complete = parseLive().scanIsComplete
            }
            if complete {
                if readySince == nil { readySince = Date() }
                let minHold = intent == .loyalty && firstSide != nil ? 2.4 : 1.4
                if let readySince, Date().timeIntervalSince(readySince) >= 0.85, Date().timeIntervalSince(startedAt) >= minHold {
                    captureNow()
                }
            } else {
                readySince = nil
            }
        }

        private func evaluateTimeout() {
            guard consumed == false else { return }
            considerReady()
            let timeout = intent == .loyalty && firstSide != nil ? 14.0 : 10.0
            if Date().timeIntervalSince(startedAt) >= timeout, barcodes.isEmpty == false || lines.count >= 3 {
                captureNow()
            }
        }

        private func loyaltySideLooksReady() -> Bool {
            let draft = LoyaltyParser.parse(lines: Array(lines), barcodes: barcodes)
            let hasCode = draft.barcodePayload.isEmpty == false
            let hasBrand = draft.needsProgramPick == false
            if firstSide == nil {
                return hasCode || hasBrand || lines.count >= 4
            }
            let previous = Set((firstSide?.barcodes ?? []).map(\.payload))
            let newCode = barcodes.contains { previous.contains($0.payload) == false }
            let newBrand = hasBrand && hud.lockedRetailer == false
            return newCode || newBrand || lines.count >= 4
        }

        func captureNow() {
            guard consumed == false else { return }
            consumed = true
            watchTask?.cancel()
            hud.isCapturing = true
            Task { @MainActor in
                var photo: UIImage?
                if let scanner {
                    if let image = try? await scanner.capturePhoto() {
                        photo = image
                    }
                    scanner.stopScanning()
                }
                if intent == .loyalty {
                    await finishLoyaltySide(photo: photo)
                    return
                }
                let live = parseLive()
                var draft = live
                if let photo, let result = try? await ScanService.analyze(image: photo) {
                    draft = VoucherParser.mergeLive(live, photo: result.draft)
                }
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                ScanTorch.applyNow(false)
                onComplete(draft, photo)
            }
        }

        private func finishLoyaltySide(photo: UIImage?) async {
            var sideLines = Array(lines)
            var sideBarcodes = barcodes
            if let photo, let recognized = try? await ScanService.recognize(image: photo) {
                sideLines = mergeUnique(sideLines, recognized.lines)
                sideBarcodes = mergeBarcodes(sideBarcodes, recognized.barcodes)
            }
            if firstSide == nil {
                firstSide = (photo, sideLines, sideBarcodes)
                let first = LoyaltyParser.parse(lines: sideLines, barcodes: sideBarcodes)
                hud.lockedRetailer = first.needsProgramPick == false
                hud.lockedCode = first.barcodePayload.isEmpty == false
                hud.hasRetailer = hud.lockedRetailer
                hud.hasCode = hud.lockedCode
                resumeSecondSide()
                return
            }
            let combinedLines = (firstSide?.lines ?? []) + sideLines
            let combinedBarcodes = (firstSide?.barcodes ?? []) + sideBarcodes
            let draft = LoyaltyParser.parse(lines: combinedLines, barcodes: combinedBarcodes)
            let pages = [firstSide?.image, photo].compactMap { $0 }
            let combinedPhoto: UIImage?
            if pages.count >= 2 {
                combinedPhoto = DocumentScanComposer.combine(pages)
            } else {
                combinedPhoto = pages.first
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            ScanTorch.applyNow(false)
            if let onLoyaltyComplete {
                onLoyaltyComplete(draft, combinedPhoto)
            } else {
                onComplete(
                    VoucherParser.parse(lines: combinedLines, barcodes: combinedBarcodes),
                    combinedPhoto
                )
            }
        }

        private func resumeSecondSide() {
            consumed = false
            lines = []
            barcodes = []
            readySince = nil
            startedAt = Date()
            hud.cardSide = 2
            hud.isCapturing = false
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            startWatching()
            if let scanner, scanner.isScanning == false {
                try? scanner.startScanning()
            }
        }

        private func mergeUnique(_ left: [String], _ right: [String]) -> [String] {
            var seen = Set(left.map(LoyaltyCatalog.fold))
            var result = left
            for line in right {
                let key = LoyaltyCatalog.fold(line)
                if key.isEmpty || seen.contains(key) { continue }
                seen.insert(key)
                result.append(line)
            }
            return result
        }

        private func mergeBarcodes(_ left: [DetectedBarcode], _ right: [DetectedBarcode]) -> [DetectedBarcode] {
            var seen = Set(left.map(\.payload))
            var result = left
            for barcode in right where seen.contains(barcode.payload) == false {
                seen.insert(barcode.payload)
                result.append(barcode)
            }
            return result
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
                    ScanTorch.setPickerTorch(false)
                    onImage(image)
                },
                onCancel: {
                    ScanTorch.setPickerTorch(false)
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
            ScanTorch.setPickerTorch(on)
        }
        .onDisappear {
            ScanTorch.setPickerTorch(false)
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

struct DocumentCameraView: UIViewControllerRepresentable {
    var singlePage: Bool = false
    var onComplete: (UIImage) -> Void
    var onCancel: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(singlePage: singlePage, onComplete: onComplete, onCancel: onCancel)
    }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        var singlePage: Bool
        var onComplete: (UIImage) -> Void
        var onCancel: () -> Void

        init(singlePage: Bool, onComplete: @escaping (UIImage) -> Void, onCancel: @escaping () -> Void) {
            self.singlePage = singlePage
            self.onComplete = onComplete
            self.onCancel = onCancel
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            guard scan.pageCount > 0 else {
                onCancel()
                return
            }
            if singlePage {
                onComplete(scan.imageOfPage(at: 0))
                return
            }
            var pages: [UIImage] = []
            pages.reserveCapacity(scan.pageCount)
            for index in 0..<scan.pageCount {
                pages.append(scan.imageOfPage(at: index))
            }
            onComplete(DocumentScanComposer.combine(pages))
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            onCancel()
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            onCancel()
        }
    }
}

extension BarcodeSymbology {
    static func fromLive(_ barcode: RecognizedItem.Barcode) -> BarcodeSymbology {
        let mirror = Mirror(reflecting: barcode)
        for child in mirror.children {
            if let observation = child.value as? VNBarcodeObservation {
                return ScanService.map(observation.symbology)
            }
            for nested in Mirror(reflecting: child.value).children {
                if let observation = nested.value as? VNBarcodeObservation {
                    return ScanService.map(observation.symbology)
                }
            }
        }
        let bounds = barcode.bounds
        let width = hypot(bounds.topRight.x - bounds.topLeft.x, bounds.topRight.y - bounds.topLeft.y)
        let height = hypot(bounds.bottomLeft.x - bounds.topLeft.x, bounds.bottomLeft.y - bounds.topLeft.y)
        let shortest = max(min(width, height), 0.0001)
        let aspect = max(width, height) / shortest
        if aspect < 1.45 {
            return .qr
        }
        return inferred(from: barcode.payloadStringValue ?? "")
    }
}

