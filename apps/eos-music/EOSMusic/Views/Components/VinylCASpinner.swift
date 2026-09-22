import QuartzCore
import SwiftUI
import UIKit

/// Compositor-only vinyl rotation. Pause/resume via `layer.speed` so SwiftUI
/// pulse invalidation cannot reset the angle.
struct VinylCASpin<Content: View>: UIViewRepresentable {
    var isSpinning: Bool
    var secondsPerRevolution: Double = PlayerVisualMetrics.vinylSecondsPerRevolution
    let content: Content

    init(
        isSpinning: Bool,
        secondsPerRevolution: Double = PlayerVisualMetrics.vinylSecondsPerRevolution,
        @ViewBuilder content: () -> Content
    ) {
        self.isSpinning = isSpinning
        self.secondsPerRevolution = secondsPerRevolution
        self.content = content()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(content: content)
    }

    func makeUIView(context: Context) -> VinylSpinContainerView {
        let view = VinylSpinContainerView()
        let hosted = context.coordinator.hosting.view!
        hosted.backgroundColor = .clear
        hosted.isOpaque = false
        view.embed(hosted)
        view.setSpinning(isSpinning, duration: max(4, secondsPerRevolution))
        return view
    }

    func updateUIView(_ uiView: VinylSpinContainerView, context: Context) {
        context.coordinator.hosting.rootView = content
        uiView.setSpinning(isSpinning, duration: max(4, secondsPerRevolution))
    }

    final class Coordinator {
        let hosting: UIHostingController<Content>

        init(content: Content) {
            hosting = UIHostingController(rootView: content)
            hosting.view.backgroundColor = .clear
            hosting.view.isOpaque = false
            hosting.safeAreaRegions = []
        }
    }
}

final class VinylSpinContainerView: UIView {
    private let spinView = UIView()
    private let spinKey = "eos.vinyl.zspin"
    private var lastSpinning: Bool?

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        backgroundColor = .clear
        spinView.backgroundColor = .clear
        spinView.isUserInteractionEnabled = false
        addSubview(spinView)
    }

    required init?(coder: NSCoder) {
        nil
    }

    func embed(_ child: UIView) {
        guard child.superview !== spinView else { return }
        child.translatesAutoresizingMaskIntoConstraints = false
        spinView.addSubview(child)
        NSLayoutConstraint.activate([
            child.leadingAnchor.constraint(equalTo: spinView.leadingAnchor),
            child.trailingAnchor.constraint(equalTo: spinView.trailingAnchor),
            child.topAnchor.constraint(equalTo: spinView.topAnchor),
            child.bottomAnchor.constraint(equalTo: spinView.bottomAnchor)
        ])
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        spinView.bounds = bounds
        spinView.center = CGPoint(x: bounds.midX, y: bounds.midY)
    }

    func setSpinning(_ spinning: Bool, duration: Double) {
        installAnimationIfNeeded(duration: duration)
        guard lastSpinning != spinning else { return }
        lastSpinning = spinning
        if spinning {
            resume()
        } else {
            pause()
        }
    }

    private func installAnimationIfNeeded(duration: Double) {
        let layer = spinView.layer
        if layer.animation(forKey: spinKey) == nil {
            let anim = CABasicAnimation(keyPath: "transform.rotation.z")
            anim.fromValue = 0
            anim.toValue = Double.pi * 2
            anim.duration = duration
            anim.repeatCount = .infinity
            anim.isRemovedOnCompletion = false
            anim.fillMode = .forwards
            layer.add(anim, forKey: spinKey)
        } else if let current = layer.animation(forKey: spinKey) as? CABasicAnimation,
                  abs(current.duration - duration) > 0.05 {
            layer.removeAnimation(forKey: spinKey)
            lastSpinning = nil
            installAnimationIfNeeded(duration: duration)
        }
    }

    private func pause() {
        let layer = spinView.layer
        let paused = layer.convertTime(CACurrentMediaTime(), from: nil)
        layer.speed = 0
        layer.timeOffset = paused
    }

    private func resume() {
        let layer = spinView.layer
        let paused = layer.timeOffset
        layer.speed = 1
        layer.timeOffset = 0
        layer.beginTime = 0
        let timeSincePause = layer.convertTime(CACurrentMediaTime(), from: nil) - paused
        layer.beginTime = timeSincePause
    }
}
