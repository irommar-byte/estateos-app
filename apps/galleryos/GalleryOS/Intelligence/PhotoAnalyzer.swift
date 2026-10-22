import CoreImage
import Foundation
import ImageIO
import Vision

/// One look at one photo: scenes, faces (with identity vectors), text, quality and the CLIP vector.
/// Runs off the main actor; every Vision buffer is drained per photo.
enum PhotoAnalyzer {
    private static let context = CIContext(options: [.cacheIntermediates: false, .priorityRequestLow: true])

    struct Result: Sendable {
        var insight: PhotoInsight
        var faces: [FaceDraft]
    }

    static func analyze(id: String, image: CGImage, orientation: CGImagePropertyOrientation, models: IntelligenceModels) async -> Result {
        var insight = PhotoInsight(
            id: id, labels: [], words: "", sharpness: 0, brightness: 0, contrast: 0,
            highlights: 0, shadows: 0, aesthetic: 0, utility: false, eyesClosed: false, faceCount: 0, clip: nil
        )
        var faces: [FaceDraft] = []
        var detected: [VNFaceObservation] = []

        autoreleasepool {
            let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
            let classify = VNClassifyImageRequest()
            let landmarks = VNDetectFaceLandmarksRequest()
            let fastText = VNRecognizeTextRequest()
            fastText.recognitionLevel = .fast
            fastText.usesLanguageCorrection = false
            try? handler.perform([classify, landmarks, fastText])

            insight.labels = (classify.results ?? [])
                .filter { $0.confidence >= 0.2 }
                .prefix(10)
                .map { ($0.identifier, $0.confidence) }

            // Text: a quick pass first; the careful one only when there is something to read.
            let quick = (fastText.results ?? []).filter { $0.confidence >= 0.5 }
            if quick.contains(where: { ($0.topCandidates(1).first?.string.count ?? 0) >= 3 }) {
                let careful = VNRecognizeTextRequest()
                careful.recognitionLevel = .accurate
                let supported = Set((try? careful.supportedRecognitionLanguages()) ?? [])
                let wanted = ["pl-PL", "en-US", "de-DE"].filter { supported.contains($0) }
                if wanted.isEmpty {
                    careful.automaticallyDetectsLanguage = true
                } else {
                    careful.recognitionLanguages = wanted
                }
                careful.usesLanguageCorrection = true
                try? handler.perform([careful])
                let lines = (careful.results ?? []).compactMap { $0.topCandidates(1).first?.string }
                insight.words = String(fold(lines.joined(separator: " ")).prefix(2000))
            }

            let shortest = CGFloat(min(image.width, image.height))
            detected = (landmarks.results ?? []).filter { $0.boundingBox.width * shortest >= 28 }
            if !detected.isEmpty {
                let quality = VNDetectFaceCaptureQualityRequest()
                quality.inputFaceObservations = detected
                try? handler.perform([quality])
                let rated = quality.results ?? []
                insight.faceCount = detected.count
                insight.eyesClosed = detected.contains { face in
                    face.boundingBox.width * face.boundingBox.height > 0.015 && eyesClosed(face)
                }
                faces = detected.map { face in
                    let score = rated.first { overlap($0.boundingBox, face.boundingBox) > 0.6 }?.faceCaptureQuality
                    return FaceDraft(box: face.boundingBox, quality: score ?? 0.3, embedding: nil)
                }
            }
        }

        let tone = measure(image)
        insight.sharpness = tone.sharpness
        insight.brightness = tone.brightness
        insight.contrast = tone.contrast
        insight.highlights = tone.highlights
        insight.shadows = tone.shadows

        if let scores = try? await CalculateImageAestheticsScoresRequest().perform(on: image, orientation: orientation) {
            insight.aesthetic = scores.overallScore
            insight.utility = scores.isUtility
        }

        if models.hasSearch, let vector = autoreleasepool(invoking: { models.imageVector(image, orientation: orientation) }) {
            insight.clip = HalfFloats.pack(vector)
        }

        if models.hasFaces, !detected.isEmpty {
            let upright = uprightImage(image, orientation: orientation)
            for (index, observation) in detected.enumerated() {
                faces[index].embedding = autoreleasepool { () -> [Float]? in
                    guard let aligned = align(observation, in: upright) else { return nil }
                    return models.faceVector(aligned)
                }
            }
        }
        return Result(insight: insight, faces: faces)
    }

    static func fold(_ text: String) -> String {
        text.lowercased().folding(options: .diacriticInsensitive, locale: Locale(identifier: "pl_PL"))
    }

    // MARK: Faces

    /// Eye opening as height over width of the eye contour, in face coordinates.
    private static func eyesClosed(_ face: VNFaceObservation) -> Bool {
        guard let landmarks = face.landmarks,
              let left = landmarks.leftEye?.normalizedPoints, let right = landmarks.rightEye?.normalizedPoints,
              left.count >= 6, right.count >= 6 else { return false }
        func opening(_ points: [CGPoint]) -> CGFloat {
            let xs = points.map(\.x)
            let ys = points.map(\.y)
            let width = (xs.max() ?? 0) - (xs.min() ?? 0)
            guard width > 0 else { return 1 }
            return ((ys.max() ?? 0) - (ys.min() ?? 0)) / width
        }
        return opening(left) < 0.16 && opening(right) < 0.16
    }

    private static func uprightImage(_ image: CGImage, orientation: CGImagePropertyOrientation) -> CIImage {
        let oriented = CIImage(cgImage: image).oriented(orientation)
        return oriented.transformed(by: CGAffineTransform(translationX: -oriented.extent.minX, y: -oriented.extent.minY))
    }

    /// The standard 112 × 112 face template (eyes, nose tip, mouth corners), origin bottom-left.
    private static let template: [CGPoint] = [
        CGPoint(x: 38.2946, y: 112 - 51.6963),
        CGPoint(x: 73.5318, y: 112 - 51.5014),
        CGPoint(x: 56.0252, y: 112 - 71.7366),
        CGPoint(x: 41.5493, y: 112 - 92.3655),
        CGPoint(x: 70.7299, y: 112 - 92.2041),
    ]

    /// Five points → similarity transform onto the template → 112 × 112 crop for SFace.
    private static func align(_ face: VNFaceObservation, in upright: CIImage) -> CGImage? {
        guard let landmarks = face.landmarks,
              let leftEye = landmarks.leftEye, let rightEye = landmarks.rightEye,
              let nose = landmarks.nose, let lips = landmarks.outerLips else { return nil }
        let size = upright.extent.size
        func points(_ region: VNFaceLandmarkRegion2D) -> [CGPoint] { region.pointsInImage(imageSize: size) }
        func centre(_ list: [CGPoint]) -> CGPoint {
            CGPoint(x: list.map(\.x).reduce(0, +) / CGFloat(list.count), y: list.map(\.y).reduce(0, +) / CGFloat(list.count))
        }
        let eyeA = centre(points(leftEye))
        let eyeB = centre(points(rightEye))
        let mouth = points(lips)
        guard !mouth.isEmpty else { return nil }
        let mouthCentre = centre(mouth)
        let eyesMid = CGPoint(x: (eyeA.x + eyeB.x) / 2, y: (eyeA.y + eyeB.y) / 2)
        // "Right" in the face's own frame, so a tilted head still sorts left and right correctly.
        let up = CGPoint(x: eyesMid.x - mouthCentre.x, y: eyesMid.y - mouthCentre.y)
        let right = CGPoint(x: up.y, y: -up.x)
        func along(_ point: CGPoint) -> CGFloat { point.x * right.x + point.y * right.y }
        let eyes = [eyeA, eyeB].sorted { along($0) < along($1) }
        let corners = [mouth.min { along($0) < along($1) }!, mouth.max { along($0) < along($1) }!]
        let nosePoints = points(nose)
        // Nose tip: the nose point furthest from the eyes, towards the mouth.
        let tip = nosePoints.max { distance($0, eyesMid) < distance($1, eyesMid) } ?? centre(nosePoints)
        let source = [eyes[0], eyes[1], tip, corners[0], corners[1]]

        guard let transform = similarity(from: source, to: template) else { return nil }
        let aligned = upright.transformed(by: transform).cropped(to: CGRect(x: 0, y: 0, width: 112, height: 112))
        return context.createCGImage(aligned, from: CGRect(x: 0, y: 0, width: 112, height: 112),
                                     format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
    }

    private static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        hypot(a.x - b.x, a.y - b.y)
    }

    /// Least-squares rotation + uniform scale + shift (Umeyama in 2-D).
    private static func similarity(from source: [CGPoint], to target: [CGPoint]) -> CGAffineTransform? {
        let count = CGFloat(source.count)
        let sourceMean = CGPoint(x: source.map(\.x).reduce(0, +) / count, y: source.map(\.y).reduce(0, +) / count)
        let targetMean = CGPoint(x: target.map(\.x).reduce(0, +) / count, y: target.map(\.y).reduce(0, +) / count)
        var dot: CGFloat = 0
        var cross: CGFloat = 0
        var norm: CGFloat = 0
        for (s, t) in zip(source, target) {
            let sx = s.x - sourceMean.x, sy = s.y - sourceMean.y
            let tx = t.x - targetMean.x, ty = t.y - targetMean.y
            dot += sx * tx + sy * ty
            cross += sx * ty - sy * tx
            norm += sx * sx + sy * sy
        }
        guard norm > 0 else { return nil }
        let a = dot / norm
        let b = cross / norm
        let shiftX = targetMean.x - (a * sourceMean.x - b * sourceMean.y)
        let shiftY = targetMean.y - (b * sourceMean.x + a * sourceMean.y)
        return CGAffineTransform(a: a, b: b, c: -b, d: a, tx: shiftX, ty: shiftY)
    }

    private static func overlap(_ a: CGRect, _ b: CGRect) -> CGFloat {
        let inter = a.intersection(b)
        guard !inter.isNull else { return 0 }
        let union = a.width * a.height + b.width * b.height - inter.width * inter.height
        return union > 0 ? inter.width * inter.height / union : 0
    }

    // MARK: Tone and sharpness

    private struct Tone {
        var sharpness: Float = 0
        var brightness: Float = 0
        var contrast: Float = 0
        var highlights: Float = 0
        var shadows: Float = 0
    }

    /// Grey 384 px copy: mean and spread of light, clipped ends, and Laplacian variance for blur.
    private static func measure(_ image: CGImage) -> Tone {
        let longest = max(image.width, image.height)
        guard longest > 0 else { return Tone() }
        let scale = min(1, 384 / CGFloat(longest))
        let width = max(8, Int(CGFloat(image.width) * scale))
        let height = max(8, Int(CGFloat(image.height) * scale))
        var pixels = [UInt8](repeating: 0, count: width * height)
        let drawn: Bool = pixels.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(
                data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
                space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
            ) else { return false }
            context.interpolationQuality = .medium
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn else { return Tone() }
        var tone = Tone()
        var sum = 0.0, squares = 0.0
        var bright = 0, dark = 0
        for value in pixels {
            let v = Double(value)
            sum += v
            squares += v * v
            if value >= 250 { bright += 1 }
            if value <= 6 { dark += 1 }
        }
        let count = Double(pixels.count)
        let mean = sum / count
        tone.brightness = Float(mean / 255)
        tone.contrast = Float(max(0, squares / count - mean * mean).squareRoot() / 255)
        tone.highlights = Float(Double(bright) / count)
        tone.shadows = Float(Double(dark) / count)

        var lapSum = 0.0, lapSquares = 0.0, lapCount = 0.0
        pixels.withUnsafeBufferPointer { p in
            for y in 1..<(height - 1) {
                let row = y * width
                for x in 1..<(width - 1) {
                    let index = row + x
                    let value = Double(p[index - 1]) + Double(p[index + 1]) + Double(p[index - width]) + Double(p[index + width])
                        - 4 * Double(p[index])
                    lapSum += value
                    lapSquares += value * value
                    lapCount += 1
                }
            }
        }
        if lapCount > 0 {
            let lapMean = lapSum / lapCount
            tone.sharpness = Float(max(0, lapSquares / lapCount - lapMean * lapMean))
        }
        return tone
    }
}
