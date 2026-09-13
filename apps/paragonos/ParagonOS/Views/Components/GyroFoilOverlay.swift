import CoreMotion
import QuartzCore
import SwiftUI
import UIKit

enum GyroFoilMath {
    static func light(gravityX: Double, gravityY: Double, roll: Double = 0, pitch: Double = 0) -> CGPoint {
        let x = gravityX * 0.88 + sin(roll) * 0.18
        let y = (-gravityY) * 0.78 + sin(pitch) * 0.22
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
            }
        ]
    }

    func retain(_ surface: GyroFoilView) {
        surfaces[ObjectIdentifier(surface)] = WeakFoil(surface)
        clients += 1
        if clients == 1 {
            start()
        } else {
            surface.apply(light: currentLight(), time: idleTime)
        }
    }

    func release(_ surface: GyroFoilView) {
        surfaces.removeValue(forKey: ObjectIdentifier(surface))
        clients = max(0, clients - 1)
        if clients == 0 {
            stop()
        }
    }

    private func start() {
        purge()
        if UIAccessibility.isReduceMotionEnabled == false, motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 60.0
            motion.startDeviceMotionUpdates(using: .xArbitraryZVertical)
        }
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
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
            let blend = 0.34
            gx += (nextX - gx) * blend
            gy += (nextY - gy) * blend
            roll += (data.attitude.roll - roll) * blend
            pitch += (data.attitude.pitch - pitch) * blend
        }
        broadcast(currentLight())
    }

    private func currentLight() -> CGPoint {
        if motion.isDeviceMotionActive {
            return GyroFoilMath.light(gravityX: gx, gravityY: gy, roll: roll, pitch: pitch)
        }
        let wave = sin(idleTime * 1.15)
        return CGPoint(x: CGFloat(wave) * 0.42, y: CGFloat(cos(idleTime * 0.85)) * 0.18)
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
    weak var surface: GyroFoilView?
    init(_ surface: GyroFoilView) { self.surface = surface }
}

final class GyroFoilView: UIView {
    var intensity: CGFloat = 0.7
    var cornerRadius: CGFloat = 22 {
        didSet {
            layer.cornerRadius = cornerRadius
        }
    }

    private let sheen = CAGradientLayer()
    private let hologram = CAGradientLayer()
    private var attached = false

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
        sheen.locations = [0, 0.28, 0.46, 0.58, 0.78, 1] as [NSNumber]

        hologram.startPoint = CGPoint(x: 0, y: 0.15)
        hologram.endPoint = CGPoint(x: 1, y: 0.85)
        hologram.locations = [0, 0.22, 0.5, 0.78, 1] as [NSNumber]

        layer.addSublayer(hologram)
        layer.addSublayer(sheen)
        paint(light: CGPoint(x: 0.12, y: -0.08))
    }

    required init?(coder: NSCoder) { nil }

    override func layoutSubviews() {
        super.layoutSubviews()
        sheen.frame = bounds.insetBy(dx: -bounds.width * 0.18, dy: -bounds.height * 0.18)
        hologram.frame = bounds
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil, attached == false {
            attached = true
            GyroMotion.shared.retain(self)
        } else if window == nil, attached {
            attached = false
            GyroMotion.shared.release(self)
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
        hologram.startPoint = CGPoint(x: 0.05 + nx * 0.32, y: 0.12 - ny * 0.18)
        hologram.endPoint = CGPoint(x: 0.95 + nx * 0.22, y: 0.88 - ny * 0.12)

        let spark = 0.42 + abs(nx) * 0.28
        let gloss = intensity
        sheen.colors = [
            UIColor.white.withAlphaComponent(0).cgColor,
            UIColor.white.withAlphaComponent(0.04 * gloss).cgColor,
            UIColor.white.withAlphaComponent((0.22 + spark * 0.18) * gloss).cgColor,
            UIColor(red: 0.78, green: 0.96, blue: 1.0, alpha: 0.16 * gloss).cgColor,
            UIColor.white.withAlphaComponent(0.05 * gloss).cgColor,
            UIColor.white.withAlphaComponent(0).cgColor
        ]
        hologram.colors = [
            UIColor(red: 0.55, green: 0.82, blue: 1.0, alpha: 0.07 * gloss).cgColor,
            UIColor.white.withAlphaComponent(0.03 * gloss).cgColor,
            UIColor(red: 1.0, green: 0.78, blue: 0.92, alpha: 0.08 * gloss).cgColor,
            UIColor(red: 1.0, green: 0.92, blue: 0.62, alpha: 0.06 * gloss).cgColor,
            UIColor(red: 0.70, green: 0.90, blue: 1.0, alpha: 0.05 * gloss).cgColor
        ]
    }
}

struct GyroFoilOverlay: UIViewRepresentable {
    var cornerRadius: CGFloat
    var intensity: CGFloat = 0.7

    func makeUIView(context: Context) -> GyroFoilView {
        let view = GyroFoilView()
        view.cornerRadius = cornerRadius
        view.intensity = intensity
        return view
    }

    func updateUIView(_ uiView: GyroFoilView, context: Context) {
        uiView.cornerRadius = cornerRadius
        uiView.intensity = intensity
    }
}
