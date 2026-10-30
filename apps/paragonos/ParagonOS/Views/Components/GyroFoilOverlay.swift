import CoreMotion
import QuartzCore
import SwiftUI
import UIKit

protocol GyroLightSurface: AnyObject {
    func apply(light: CGPoint, time: CFTimeInterval)
}

enum GyroFoilMath {
    /// High-gain light vector for snappy metal digit specular (Apple Wallet feel).
    static func light(gravityX: Double, gravityY: Double, roll: Double = 0, pitch: Double = 0, yaw: Double = 0) -> CGPoint {
        let x = gravityX * 1.74 + sin(roll) * 0.28 + sin(yaw) * 0.18
        let y = (-gravityY) * 1.36 + sin(pitch) * 0.32
        return CGPoint(
            x: CGFloat(max(-1, min(1, x))),
            y: CGFloat(max(-1, min(1, y)))
        )
    }
}

final class GyroMotion: NSObject {
    static let shared = GyroMotion()

    private let motion = CMMotionManager()
    private var clients = 0
    private var displayLink: CADisplayLink?
    private var surfaces: [ObjectIdentifier: WeakFoil] = [:]
    private var gx = 0.0
    private var gy = -1.0
    private var roll = 0.0
    private var pitch = 0.0
    private var yaw = 0.0
    private var idleTime: CFTimeInterval = 0
    private var observers: [NSObjectProtocol] = []

    private override init() {
        super.init()
        let center = NotificationCenter.default
        observers = [
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.pauseHardware()
            },
            center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.resumeHardwareIfNeeded()
            },
            center.addObserver(forName: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
                guard let self else { return }
                if UIAccessibility.isReduceMotionEnabled {
                    self.stop()
                    self.broadcast(CGPoint(x: 0.18, y: -0.12))
                } else if self.clients > 0 {
                    self.start()
                }
            }
        ]
    }

    func retain(_ surface: GyroLightSurface) {
        surfaces[ObjectIdentifier(surface)] = WeakFoil(surface)
        clients += 1
        if clients == 1 {
            start()
        } else {
            surface.apply(light: currentLight(), time: idleTime)
        }
    }

    func release(_ surface: GyroLightSurface) {
        surfaces.removeValue(forKey: ObjectIdentifier(surface))
        clients = max(0, clients - 1)
        if clients == 0 {
            stop()
        }
    }

    private func start() {
        purge()
        if UIAccessibility.isReduceMotionEnabled {
            broadcast(CGPoint(x: 0.18, y: -0.12))
            return
        }
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 60.0
            motion.startDeviceMotionUpdates(using: .xArbitraryZVertical)
        }
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stop() {
        displayLink?.invalidate()
        displayLink = nil
        motion.stopDeviceMotionUpdates()
    }

    private func pauseHardware() {
        displayLink?.isPaused = true
        motion.stopDeviceMotionUpdates()
    }

    private func resumeHardwareIfNeeded() {
        guard clients > 0 else { return }
        displayLink?.isPaused = false
        if UIAccessibility.isReduceMotionEnabled == false, motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 60.0
            motion.startDeviceMotionUpdates(using: .xArbitraryZVertical)
        }
    }

    @objc private func tick(_ link: CADisplayLink) {
        idleTime = link.timestamp
        if UIAccessibility.isReduceMotionEnabled {
            let light = CGPoint(x: 0.18, y: -0.12)
            broadcast(light)
            return
        }
        if let data = motion.deviceMotion {
            let nextX = data.gravity.x
            let nextY = data.gravity.y
            let blend = 0.92
            gx += (nextX - gx) * blend
            gy += (nextY - gy) * blend
            roll += (data.attitude.roll - roll) * blend
            pitch += (data.attitude.pitch - pitch) * blend
            yaw += (data.attitude.yaw - yaw) * blend
        }
        broadcast(currentLight())
    }

    private func currentLight() -> CGPoint {
        if motion.isDeviceMotionActive {
            return GyroFoilMath.light(gravityX: gx, gravityY: gy, roll: roll, pitch: pitch, yaw: yaw)
        }
        let wave = sin(idleTime * 1.85)
        return CGPoint(x: CGFloat(wave) * 0.72, y: CGFloat(cos(idleTime * 1.25)) * 0.28)
    }

    private func broadcast(_ light: CGPoint) {
        purge()
        for item in surfaces.values {
            item.surface?.apply(light: light, time: idleTime)
        }
    }

    private func purge() {
        surfaces = surfaces.filter { $0.value.surface != nil }
    }
}

private struct WeakFoil {
    weak var surface: GyroLightSurface?
    init(_ surface: GyroLightSurface) { self.surface = surface }
}

final class GyroFoilView: UIView, GyroLightSurface {
    var intensity: CGFloat = 0.7
    var cornerRadius: CGFloat = 22 {
        didSet {
            layer.cornerRadius = cornerRadius
        }
    }

    private let sheen = CAGradientLayer()
    private let hologram = CAGradientLayer()
    private var attached = false
    private var motionObserver: NSObjectProtocol?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isOpaque = false
        backgroundColor = .clear
        clipsToBounds = true
        layer.cornerCurve = .continuous
        layer.cornerRadius = cornerRadius

        sheen.startPoint = CGPoint(x: 0.15, y: 0)
        sheen.endPoint = CGPoint(x: 0.85, y: 1)
        sheen.locations = [0, 0.22, 0.48, 0.72, 1] as [NSNumber]

        hologram.startPoint = CGPoint(x: 0, y: 0.15)
        hologram.endPoint = CGPoint(x: 1, y: 0.85)
        hologram.locations = [0, 0.22, 0.5, 0.78, 1] as [NSNumber]

        hologram.opacity = 0
        layer.addSublayer(sheen)
        paint(light: CGPoint(x: 0.12, y: -0.08))
        motionObserver = NotificationCenter.default.addObserver(
            forName: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.syncAttachment()
        }
    }

    deinit {
        if let motionObserver {
            NotificationCenter.default.removeObserver(motionObserver)
        }
        if attached {
            GyroMotion.shared.release(self)
        }
    }

    required init?(coder: NSCoder) { nil }

    var isActive: Bool = true {
        didSet { syncAttachment() }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        sheen.frame = bounds.insetBy(dx: -bounds.width * 0.18, dy: -bounds.height * 0.18)
        hologram.frame = bounds
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        syncAttachment()
    }

    private func syncAttachment() {
        let want = window != nil && isActive && UIAccessibility.isReduceMotionEnabled == false
        if want, attached == false {
            attached = true
            GyroMotion.shared.retain(self)
        } else if want == false, attached {
            attached = false
            GyroMotion.shared.release(self)
            paint(light: CGPoint(x: 0.18, y: -0.12))
        }
    }

    func apply(light: CGPoint, time _: CFTimeInterval) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        paint(light: light)
        CATransaction.commit()
    }

    private func paint(light: CGPoint) {
        let nx = light.x
        let ny = light.y
        sheen.startPoint = CGPoint(x: 0.18 + nx * 0.46, y: 0.02 + ny * 0.28)
        sheen.endPoint = CGPoint(x: 0.82 + nx * 0.46, y: 0.98 + ny * 0.22)
        let spark = 0.48 + abs(nx) * 0.32
        let gloss = intensity
        sheen.colors = [
            UIColor.white.withAlphaComponent(0).cgColor,
            UIColor.white.withAlphaComponent(0.03 * gloss).cgColor,
            UIColor.white.withAlphaComponent((0.18 + spark * 0.16) * gloss).cgColor,
            UIColor.white.withAlphaComponent(0.04 * gloss).cgColor,
            UIColor.white.withAlphaComponent(0).cgColor
        ]
    }
}

struct GyroFoilOverlay: UIViewRepresentable {
    var cornerRadius: CGFloat
    var intensity: CGFloat = 0.7
    var isActive: Bool = true

    func makeUIView(context: Context) -> GyroFoilView {
        let view = GyroFoilView()
        view.cornerRadius = cornerRadius
        view.intensity = intensity
        view.isActive = isActive
        return view
    }

    func updateUIView(_ uiView: GyroFoilView, context: Context) {
        uiView.cornerRadius = cornerRadius
        uiView.intensity = intensity
        uiView.isActive = isActive
    }
}

/// GPU metal PAN — gyro moves only the specular streak. Card body stays still.
final class MetalPANView: UIView, GyroLightSurface {
    var text: String = "" {
        didSet { if oldValue != text { rebuild() } }
    }
    var font: UIFont = MetalPANView.roundedMono(22) {
        didSet { if oldValue != font { rebuild() } }
    }
    var gyroActive = false {
        didSet { syncAttachment() }
    }

    private let depth = CALayer()
    private let body = CAGradientLayer()
    private let brush = CAGradientLayer()
    private let rim = CAGradientLayer()
    private let cut = CAGradientLayer()
    private let sheen = CAGradientLayer()
    private let spark = CAGradientLayer()
    private let flare = CAGradientLayer()
    private var attached = false
    private var lastSize: CGSize = .zero

    static func roundedMono(_ size: CGFloat) -> UIFont {
        let base = UIFont.monospacedDigitSystemFont(ofSize: size, weight: .semibold)
        if let rounded = base.fontDescriptor.withDesign(.rounded) {
            return UIFont(descriptor: rounded, size: size)
        }
        return base
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isOpaque = false
        backgroundColor = .clear
        body.startPoint = CGPoint(x: 0.5, y: 0)
        body.endPoint = CGPoint(x: 0.5, y: 1)
        body.colors = [
            UIColor(red: 0.90, green: 0.89, blue: 0.84, alpha: 1).cgColor,
            UIColor(red: 0.99, green: 0.98, blue: 0.94, alpha: 1).cgColor,
            UIColor(red: 0.46, green: 0.45, blue: 0.42, alpha: 1).cgColor,
            UIColor(red: 0.96, green: 0.94, blue: 0.88, alpha: 1).cgColor,
            UIColor(red: 0.62, green: 0.60, blue: 0.54, alpha: 1).cgColor
        ]
        body.locations = [0, 0.18, 0.46, 0.72, 1] as [NSNumber]

        brush.startPoint = CGPoint(x: 0, y: 0.12)
        brush.endPoint = CGPoint(x: 1, y: 0.88)
        brush.colors = [
            UIColor.white.withAlphaComponent(0).cgColor,
            UIColor.white.withAlphaComponent(0.28).cgColor,
            UIColor.black.withAlphaComponent(0.22).cgColor,
            UIColor.white.withAlphaComponent(0.20).cgColor,
            UIColor.black.withAlphaComponent(0.16).cgColor,
            UIColor.white.withAlphaComponent(0).cgColor
        ]
        brush.locations = [0, 0.14, 0.32, 0.54, 0.76, 1] as [NSNumber]

        rim.startPoint = CGPoint(x: 0.5, y: 0)
        rim.endPoint = CGPoint(x: 0.5, y: 0.42)
        rim.colors = [
            UIColor.white.withAlphaComponent(0.98).cgColor,
            UIColor.white.withAlphaComponent(0).cgColor
        ]

        cut.startPoint = CGPoint(x: 0.5, y: 0.55)
        cut.endPoint = CGPoint(x: 0.5, y: 1.0)
        cut.colors = [
            UIColor.clear.cgColor,
            UIColor.black.withAlphaComponent(0.38).cgColor
        ]

        sheen.startPoint = CGPoint(x: 0.05, y: 0.12)
        sheen.endPoint = CGPoint(x: 0.48, y: 0.88)
        sheen.locations = [0, 0.40, 0.46, 0.49, 0.52, 0.58, 1] as [NSNumber]
        sheen.compositingFilter = "plusLighter"

        spark.startPoint = CGPoint(x: 0.2, y: 0)
        spark.endPoint = CGPoint(x: 0.7, y: 1)
        spark.locations = [0, 0.44, 0.49, 0.54, 1] as [NSNumber]
        spark.compositingFilter = "plusLighter"

        flare.startPoint = CGPoint(x: 0, y: 0.35)
        flare.endPoint = CGPoint(x: 1, y: 0.65)
        flare.locations = [0, 0.46, 0.50, 0.54, 1] as [NSNumber]
        flare.compositingFilter = "plusLighter"

        layer.addSublayer(depth)
        layer.addSublayer(body)
        layer.addSublayer(brush)
        layer.addSublayer(cut)
        layer.addSublayer(rim)
        layer.addSublayer(sheen)
        layer.addSublayer(spark)
        layer.addSublayer(flare)
        paint(light: CGPoint(x: 0.18, y: -0.12))
    }

    required init?(coder: NSCoder) { nil }

    deinit {
        if attached { GyroMotion.shared.release(self) }
    }

    override var intrinsicContentSize: CGSize {
        let size = (text as NSString).size(withAttributes: [.font: font, .kern: 0.85])
        return CGSize(width: ceil(size.width) + 2, height: ceil(size.height) + 4)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        if bounds.size != lastSize {
            lastSize = bounds.size
            rebuildMasks()
        }
        body.frame = bounds
        brush.frame = bounds
        rim.frame = bounds
        cut.frame = bounds
        sheen.frame = bounds
        spark.frame = bounds
        flare.frame = bounds
        depth.frame = bounds.offsetBy(dx: 0, dy: 1.35)
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        syncAttachment()
    }

    func apply(light: CGPoint, time _: CFTimeInterval) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        paint(light: light)
        CATransaction.commit()
    }

    private func rebuild() {
        invalidateIntrinsicContentSize()
        lastSize = .zero
        setNeedsLayout()
    }

    private func rebuildMasks() {
        guard bounds.width > 1, bounds.height > 1 else { return }
        let maskImage = textImage()
        func masked() -> CALayer {
            let mask = CALayer()
            mask.contents = maskImage
            mask.frame = bounds
            mask.contentsScale = traitCollection.displayScale
            return mask
        }
        body.mask = masked()
        brush.mask = masked()
        rim.mask = masked()
        cut.mask = masked()
        sheen.mask = masked()
        spark.mask = masked()
        flare.mask = masked()
        depth.contents = textImage(color: UIColor.black.withAlphaComponent(0.62))
        depth.contentsScale = traitCollection.displayScale
        depth.contentsGravity = .center
    }

    private func textImage(color: UIColor = .white) -> CGImage? {
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = traitCollection.displayScale
        let image = UIGraphicsImageRenderer(size: bounds.size, format: format).image { _ in
            let attrs: [NSAttributedString.Key: Any] = [
                .font: font,
                .foregroundColor: color,
                .kern: 0.85
            ]
            let textSize = (text as NSString).size(withAttributes: attrs)
            let origin = CGPoint(x: 0, y: max(0, (bounds.height - textSize.height) / 2))
            (text as NSString).draw(at: origin, withAttributes: attrs)
        }
        return image.cgImage
    }

    private func paint(light: CGPoint) {
        let nx = light.x
        let ny = light.y
        brush.startPoint = CGPoint(x: 0.02 + nx * 0.16, y: 0.0 + ny * 0.10)
        brush.endPoint = CGPoint(x: 0.98 + nx * 0.16, y: 1.0 + ny * 0.08)

        sheen.startPoint = CGPoint(x: -0.35 + nx * 1.18, y: 0.02 + ny * 0.38)
        sheen.endPoint = CGPoint(x: 0.18 + nx * 1.18, y: 0.98 + ny * 0.22)
        let hot = 0.82 + abs(nx) * 0.18
        sheen.colors = [
            UIColor.clear.cgColor,
            UIColor.white.withAlphaComponent(0.02).cgColor,
            UIColor.white.withAlphaComponent(0.28 + hot * 0.18).cgColor,
            UIColor.white.withAlphaComponent(1.0).cgColor,
            UIColor(red: 0.78, green: 0.93, blue: 1.0, alpha: 0.85).cgColor,
            UIColor.white.withAlphaComponent(0.08).cgColor,
            UIColor.clear.cgColor
        ]

        spark.startPoint = CGPoint(x: 0.08 + nx * 0.80, y: -0.12 + ny * 0.28)
        spark.endPoint = CGPoint(x: 0.52 + nx * 0.80, y: 1.12 + ny * 0.18)
        spark.colors = [
            UIColor.clear.cgColor,
            UIColor(red: 1.0, green: 0.92, blue: 0.72, alpha: 0.0).cgColor,
            UIColor(red: 1.0, green: 0.97, blue: 0.88, alpha: 0.72).cgColor,
            UIColor.white.withAlphaComponent(0.22).cgColor,
            UIColor.clear.cgColor
        ]

        flare.startPoint = CGPoint(x: -0.2 + nx * 0.9, y: 0.28 + ny * 0.12)
        flare.endPoint = CGPoint(x: 0.9 + nx * 0.9, y: 0.72 + ny * 0.10)
        flare.colors = [
            UIColor.clear.cgColor,
            UIColor.white.withAlphaComponent(0.0).cgColor,
            UIColor.white.withAlphaComponent(0.55).cgColor,
            UIColor.white.withAlphaComponent(0.0).cgColor,
            UIColor.clear.cgColor
        ]
    }

    private func syncAttachment() {
        let want = window != nil && gyroActive && UIAccessibility.isReduceMotionEnabled == false
        if want, attached == false {
            attached = true
            GyroMotion.shared.retain(self)
        } else if want == false, attached {
            attached = false
            GyroMotion.shared.release(self)
            paint(light: CGPoint(x: 0.18, y: -0.12))
        }
    }
}

struct MetalPANLabel: UIViewRepresentable {
    var text: String
    var fontSize: CGFloat
    var gyroActive: Bool

    func makeUIView(context: Context) -> MetalPANView {
        let view = MetalPANView()
        view.setContentHuggingPriority(.required, for: .vertical)
        view.setContentCompressionResistancePriority(.required, for: .vertical)
        view.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return view
    }

    func updateUIView(_ uiView: MetalPANView, context: Context) {
        uiView.font = MetalPANView.roundedMono(fontSize)
        uiView.text = text
        uiView.gyroActive = gyroActive
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: MetalPANView, context: Context) -> CGSize {
        // Take exactly the width offered and never ask for the text's full width:
        // a long number must shrink inside the card, not stretch the card past the screen.
        var size = uiView.intrinsicContentSize
        if let width = proposal.width, width.isFinite, width > 0 {
            size.width = width
        } else {
            size.width = 0
        }
        return size
    }
}
