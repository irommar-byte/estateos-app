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

enum CardScanPhotos {
    static func cropToCardFrame(_ image: UIImage, aspect: CGFloat = CardScanMetrics.aspect) -> UIImage {
        let upright = normalized(image)
        guard let cg = upright.cgImage else { return upright }
        let width = CGFloat(cg.width)
        let height = CGFloat(cg.height)
        guard width > 16, height > 16 else { return upright }
        let imageAspect = width / height
        let box: CGRect
        if imageAspect > aspect {
            let cropWidth = height * aspect
            box = CGRect(x: (width - cropWidth) / 2, y: 0, width: cropWidth, height: height)
        } else {
            let cropHeight = width / aspect
            box = CGRect(x: 0, y: (height - cropHeight) / 2, width: width, height: cropHeight)
        }
        let inset = min(box.width, box.height) * 0.012
        let tight = box.insetBy(dx: inset, dy: inset).integral.intersection(
            CGRect(x: 0, y: 0, width: width, height: height)
        )
        guard tight.width > 16, tight.height > 16, let cut = cg.cropping(to: tight) else { return upright }
        return UIImage(cgImage: cut, scale: 1, orientation: .up)
    }

    static func splitSides(_ image: UIImage) -> [UIImage] {
        let upright = normalized(image)
        guard let cg = upright.cgImage else { return [upright] }
        let width = CGFloat(cg.width)
        let height = CGFloat(cg.height)
        let ratio = height / max(width, 1)
        guard ratio > 1.05, ratio < 1.58 else { return [upright] }
        let half = (height / 2).rounded(.down)
        guard half > 24 else { return [upright] }
        let pages = [
            cg.cropping(to: CGRect(x: 0, y: 0, width: width, height: half)),
            cg.cropping(to: CGRect(x: 0, y: half, width: width, height: height - half))
        ].compactMap { $0 }
        guard pages.count == 2 else { return [upright] }
        return pages.map { UIImage(cgImage: $0, scale: 1, orientation: .up) }
    }

    static func cropCapturedCard(_ image: UIImage) -> UIImage {
        cropToDetectedCard(image) ?? cropToCardFrame(image)
    }

    static func cropToDetectedCard(_ image: UIImage) -> UIImage? {
        let upright = normalized(image)
        guard let cg = upright.cgImage else { return nil }
        let width = cg.width
        let height = cg.height
        guard width > 32, height > 32 else { return nil }
        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = VNAspectRatio(1.28)
        request.maximumAspectRatio = VNAspectRatio(1.92)
        request.minimumSize = 0.28
        request.maximumObservations = 6
        request.quadratureTolerance = 22
        let handler = VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:])
        try? handler.perform([request])
        guard let best = (request.results ?? []).max(by: {
            $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height
        }) else { return nil }
        let box = best.boundingBox
        let rect = CGRect(
            x: box.minX * CGFloat(width),
            y: (1 - box.maxY) * CGFloat(height),
            width: box.width * CGFloat(width),
            height: box.height * CGFloat(height)
        ).insetBy(dx: -8, dy: -8).integral.intersection(
            CGRect(x: 0, y: 0, width: width, height: height)
        )
        guard rect.width > 24, rect.height > 16, let cut = cg.cropping(to: rect) else { return nil }
        let plastic = UIImage(cgImage: cut, scale: 1, orientation: .up)
        return cropToCardFrame(plastic)
    }

    static func replacingSide(_ index: Int, in image: UIImage, with side: UIImage) -> UIImage {
        let cropped = cropCapturedCard(side)
        var sides = splitSides(image)
        if sides.isEmpty { return cropped }
        if index <= 0 {
            sides[0] = cropped
        } else if sides.count >= 2 {
            sides[1] = cropped
        } else {
            sides.append(cropped)
        }
        return sides.count == 1 ? sides[0] : DocumentScanComposer.combine(sides)
    }

    /// Camera stills often have a rotated `cgImage`. Crop and split in the pixels the user actually saw.
    static func normalized(_ image: UIImage) -> UIImage {
        let size = image.size
        guard size.width > 1, size.height > 1 else { return image }
        if image.imageOrientation == .up,
           abs(image.scale - 1) < 0.01,
           let cg = image.cgImage,
           cg.width == Int(size.width.rounded()),
           cg.height == Int(size.height.rounded()) {
            return image
        }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
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

    var body: some View {
        ImmediateScanCover()
            .environmentObject(wallet)
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
                maxHeight: geo.size.height * 0.38
            )
            VStack(spacing: 14) {
                Text(hud.cardSide == 1 ? "Strona 1 z 2 — włóż kartę" : "Strona 2 z 2 — odwróć kartę, albo pomiń tył")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.92))
                    .padding(.top, 8)
                scannerHUD
                Spacer(minLength: 0)
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
                        .strokeBorder(
                            hud.hasFullCard ? ParagonTheme.osGreen : Color.white.opacity(0.92),
                            lineWidth: 2.2
                        )
                }
                .frame(width: card.width, height: card.height)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.45), radius: 18, y: 8)
                .padding(.bottom, 12)
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
                    scanChip("Cała karta", done: hud.hasFullCard)
                    scanChip("Sklep", done: hud.hasRetailer)
                    scanChip("Kod", done: hud.hasCode)
                } else {
                    scanChip("Sieć", done: hud.hasRetailer)
                    scanChip("Kwota", done: hud.hasAmount)
                    scanChip("Data", done: hud.hasDate)
                    scanChip("Kod", done: hud.hasCode)
                }
            }
            if intent == .loyalty {
                HStack(spacing: 10) {
                    scanChip("Przód", done: hud.cardSide > 1 || hud.capturedBack)
                    scanChip("Tył", done: hud.capturedBack)
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
                Button(hud.cardSide == 1 ? "Wystarczy ta strona" : "Pomiń tył") {
                    if hud.cardSide == 1 {
                        hud.requestFinishSingle = true
                    } else {
                        hud.requestSkipSecond = true
                    }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
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
    @Published var requestFinishSingle = false
    @Published var requestSkipSecond = false
    @Published var isExpired = false
    @Published var cardSide = 1
    @Published var capturedBack = false
    @Published var hasFullCard = false
    var lockedRetailer = false
    var lockedCode = false

    func caption(for intent: ScanIntent) -> String {
        if isExpired { return "Ten kwitek jest już przeterminowany." }
        if intent == .loyalty {
            if isCapturing {
                return cardSide == 1 ? "Zapisuję pierwszą stronę…" : "Składam obie strony…"
            }
            if hasFullCard == false {
                return "Włóż całą kartę w ramkę. Zdjęcie zrobi się samo, gdy widać plastik i sklep albo kod."
            }
            if hasRetailer == false && hasCode == false {
                return "Karta jest w ramce. Szukam nazwy sklepu albo kodu."
            }
            if cardSide == 1 {
                return "Trzymaj nieruchomo — zapiszę tę stronę. Tył możesz pominąć."
            }
            return "Trzymaj nieruchomo tył karty — albo pomiń, jeśli nie potrzebujesz zdjęcia."
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
                .text(languages: ["pl-PL", "en-US", "uk-UA"])
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
        if hud.requestFinishSingle {
            hud.requestFinishSingle = false
            context.coordinator.captureNow(finishAfterThisSide: true)
        }
        if hud.requestSkipSecond {
            hud.requestSkipSecond = false
            context.coordinator.skipSecondSide()
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
        private var finishAfterThisSide = false
        private var itemBoxes: [CGRect] = []

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
            var boxes: [CGRect] = []
            for item in items {
                let box = boundsRect(item)
                if box.isNull == false, box.width > 1, box.height > 1 {
                    boxes.append(box)
                }
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
            itemBoxes = boxes
            publish()
            considerReady()
        }

        private func boundsRect(_ item: RecognizedItem) -> CGRect {
            let bounds: RecognizedItem.Bounds
            switch item {
            case .barcode(let barcode):
                bounds = barcode.bounds
            case .text(let text):
                bounds = text.bounds
            default:
                return .null
            }
            let xs = [bounds.topLeft.x, bounds.topRight.x, bounds.bottomLeft.x, bounds.bottomRight.x]
            let ys = [bounds.topLeft.y, bounds.topRight.y, bounds.bottomLeft.y, bounds.bottomRight.y]
            guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else {
                return .null
            }
            return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
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
            if intent == .loyalty {
                updateLoyaltyFill()
            }
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
                let minHold = intent == .loyalty && firstSide != nil ? 2.2 : 1.4
                let stable = intent == .loyalty ? 0.7 : 0.85
                if let readySince, Date().timeIntervalSince(readySince) >= stable, Date().timeIntervalSince(startedAt) >= minHold {
                    captureNow()
                }
            } else {
                readySince = nil
            }
        }

        private func evaluateTimeout() {
            guard consumed == false else { return }
            considerReady()
            if intent == .loyalty {
                if firstSide != nil, Date().timeIntervalSince(startedAt) >= 14.0 {
                    skipSecondSide()
                }
                return
            }
            let timeout = 10.0
            if Date().timeIntervalSince(startedAt) >= timeout, barcodes.isEmpty == false || lines.count >= 3 {
                captureNow()
            }
        }

        private func updateLoyaltyFill() {
            let roi = scanner?.regionOfInterest ?? scanner?.view.bounds ?? .zero
            let metrics = CardScanGate.metrics(boxes: itemBoxes, roi: roi)
            hud.hasFullCard = CardScanGate.fillsFrame(
                coverage: metrics.coverage,
                spreadX: metrics.spreadX,
                spreadY: metrics.spreadY,
                boxCount: itemBoxes.count
            )
        }

        private func loyaltySideLooksReady() -> Bool {
            if firstSide != nil, Date().timeIntervalSince(startedAt) < 1.2 {
                return false
            }
            let draft = LoyaltyParser.parse(lines: Array(lines), barcodes: barcodes)
            let hasCode = hud.lockedCode || draft.barcodePayload.isEmpty == false
            let hasBrand = hud.lockedRetailer || draft.needsProgramPick == false
            let previous = Set((firstSide?.barcodes ?? []).map(\.payload))
            let newCode = barcodes.contains { previous.contains($0.payload) == false }
            let newBrand = draft.needsProgramPick == false && hud.lockedRetailer == false
            let roi = scanner?.regionOfInterest ?? scanner?.view.bounds ?? .zero
            let metrics = CardScanGate.metrics(boxes: itemBoxes, roi: roi)
            return CardScanGate.isReady(
                CardScanGate.Observation(
                    hasBrand: hasBrand,
                    hasCode: hasCode,
                    isSecondSide: firstSide != nil,
                    hasNewCode: newCode,
                    hasNewBrand: newBrand,
                    coverage: metrics.coverage,
                    spreadX: metrics.spreadX,
                    spreadY: metrics.spreadY,
                    boxCount: itemBoxes.count
                )
            )
        }

        func captureNow(finishAfterThisSide: Bool = false) {
            guard consumed == false else { return }
            consumed = true
            watchTask?.cancel()
            self.finishAfterThisSide = finishAfterThisSide
            hud.isCapturing = true
            Task { @MainActor in
                var photo: UIImage?
                if let scanner {
                    if let image = try? await scanner.capturePhoto() {
                        photo = intent == .loyalty
                            ? CardScanPhotos.cropCapturedCard(image)
                            : image
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

        func skipSecondSide() {
            guard consumed == false else { return }
            if firstSide == nil {
                captureNow(finishAfterThisSide: true)
                return
            }
            consumed = true
            watchTask?.cancel()
            hud.isCapturing = true
            Task { @MainActor in
                scanner?.stopScanning()
                completeLoyalty(
                    lines: firstSide?.lines ?? [],
                    barcodes: firstSide?.barcodes ?? [],
                    photo: firstSide?.image,
                    includeBack: false
                )
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
                if finishAfterThisSide {
                    completeLoyalty(lines: sideLines, barcodes: sideBarcodes, photo: photo, includeBack: false)
                    return
                }
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
            let pages = [firstSide?.image, photo].compactMap { $0 }
            completeLoyalty(
                lines: combinedLines,
                barcodes: combinedBarcodes,
                photo: pages.count >= 2 ? DocumentScanComposer.combine(pages) : pages.first,
                includeBack: pages.count >= 2
            )
        }

        private func completeLoyalty(
            lines: [String],
            barcodes: [DetectedBarcode],
            photo: UIImage?,
            includeBack: Bool
        ) {
            let draft = LoyaltyParser.parse(lines: lines, barcodes: barcodes)
            hud.capturedBack = includeBack
            hud.hasRetailer = draft.needsProgramPick == false
            hud.hasCode = draft.barcodePayload.isEmpty == false
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            ScanTorch.applyNow(false)
            if let onLoyaltyComplete {
                onLoyaltyComplete(draft, photo)
            } else {
                onComplete(VoucherParser.parse(lines: lines, barcodes: barcodes), photo)
            }
        }

        private func resumeSecondSide() {
            consumed = false
            lines = []
            barcodes = []
            itemBoxes = []
            readySince = nil
            startedAt = Date()
            hud.cardSide = 2
            hud.isCapturing = false
            hud.hasFullCard = false
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
        let payload = barcode.payloadStringValue ?? ""
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
        if isLinearCardNumber(payload) {
            return inferred(from: payload)
        }
        let bounds = barcode.bounds
        let width = hypot(bounds.topRight.x - bounds.topLeft.x, bounds.topRight.y - bounds.topLeft.y)
        let height = hypot(bounds.bottomLeft.x - bounds.topLeft.x, bounds.bottomLeft.y - bounds.topLeft.y)
        let shortest = max(min(width, height), 0.0001)
        let aspect = max(width, height) / shortest
        if aspect < 1.35, looksLikeQRPayload(payload) {
            return .qr
        }
        return inferred(from: payload)
    }
}

