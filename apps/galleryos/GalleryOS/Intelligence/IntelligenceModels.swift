import CoreImage
import CoreML
import Foundation
import Vision

/// The three on-device models (prepared once by scripts/build_intelligence_models.sh) and the
/// CLIP tokenizer. Every model ends in an L2-normalised "embedding", so matching is a dot product.
/// When the models are not in the build, GalleryOS still reads scenes, text and quality with
/// Apple Vision; only people and sentence search wait for them.
final class IntelligenceModels: @unchecked Sendable {
    static let shared = IntelligenceModels()

    static var folder: URL? {
        Bundle.main.resourceURL?.appendingPathComponent("Models", isDirectory: true)
    }

    private let lock = NSLock()
    private var faceModel: MLModel?
    private var imageModel: MLModel?
    private var textModel: MLModel?
    private var tokenizerStore: CLIPTokenizer?
    private var tried: Set<String> = []

    var hasFaces: Bool { exists("GalleryFace") }
    var hasSearch: Bool { exists("GalleryCLIPImage") && exists("GalleryCLIPText") }

    private func exists(_ name: String) -> Bool {
        guard let url = Self.folder?.appendingPathComponent("\(name).mlmodelc") else { return false }
        return FileManager.default.fileExists(atPath: url.path)
    }

    private func load(_ name: String, units: MLComputeUnits) -> MLModel? {
        lock.lock()
        defer { lock.unlock() }
        switch name {
        case "GalleryFace": if let faceModel { return faceModel }
        case "GalleryCLIPImage": if let imageModel { return imageModel }
        default: if let textModel { return textModel }
        }
        guard !tried.contains(name), let url = Self.folder?.appendingPathComponent("\(name).mlmodelc") else { return nil }
        tried.insert(name)
        let configuration = MLModelConfiguration()
        configuration.computeUnits = units
        guard let model = try? MLModel(contentsOf: url, configuration: configuration) else { return nil }
        switch name {
        case "GalleryFace": faceModel = model
        case "GalleryCLIPImage": imageModel = model
        default: textModel = model
        }
        return model
    }

    // Neural Engine and CPU only: the GPU is off-limits the moment the app leaves the screen,
    // and a prediction caught in that moment could stall the analysis.
    var face: MLModel? { load("GalleryFace", units: .cpuAndNeuralEngine) }
    var image: MLModel? { load("GalleryCLIPImage", units: .cpuAndNeuralEngine) }
    var text: MLModel? { load("GalleryCLIPText", units: .cpuAndNeuralEngine) }

    var tokenizer: CLIPTokenizer? {
        lock.lock()
        defer { lock.unlock() }
        if let tokenizerStore { return tokenizerStore }
        guard let folder = Self.folder else { return nil }
        tokenizerStore = CLIPTokenizer(folder: folder)
        return tokenizerStore
    }

    /// Frees ~200 MB of model memory when the app goes to the background.
    func unload() {
        lock.lock()
        faceModel = nil
        imageModel = nil
        textModel = nil
        tried.removeAll()
        lock.unlock()
    }

    // MARK: Inference

    func faceVector(_ aligned: CGImage) -> [Float]? {
        guard let model = face,
              let constraint = model.modelDescription.inputDescriptionsByName["image"]?.imageConstraint,
              let value = try? MLFeatureValue(cgImage: aligned, constraint: constraint, options: nil),
              let input = try? MLDictionaryFeatureProvider(dictionary: ["image": value]),
              let output = try? model.prediction(from: input),
              let array = output.featureValue(for: "embedding")?.multiArrayValue else { return nil }
        return Self.floats(array)
    }

    /// CLIP's own preprocessing: shorter side to 224, centred square crop.
    func imageVector(_ image: CGImage, orientation: CGImagePropertyOrientation) -> [Float]? {
        guard let model = self.image,
              let constraint = model.modelDescription.inputDescriptionsByName["image"]?.imageConstraint else { return nil }
        let options: [MLFeatureValue.ImageOption: Any] = [.cropAndScale: VNImageCropAndScaleOption.centerCrop.rawValue]
        // HDR and 16-bit photos sometimes refuse the direct path; a plain 8-bit sRGB copy always works.
        let direct = try? MLFeatureValue(cgImage: image, orientation: orientation, constraint: constraint, options: options)
        guard let value = direct ?? Self.square(image, orientation: orientation, side: 224).flatMap({
                  try? MLFeatureValue(cgImage: $0, constraint: constraint, options: nil)
              }),
              let input = try? MLDictionaryFeatureProvider(dictionary: ["image": value]),
              let output = try? model.prediction(from: input),
              let array = output.featureValue(for: "embedding")?.multiArrayValue else { return nil }
        return Self.floats(array)
    }

    private static let renderer = CIContext(options: [.cacheIntermediates: false])

    /// Upright, shorter side scaled to `side`, centre square, 8-bit sRGB.
    private static func square(_ image: CGImage, orientation: CGImagePropertyOrientation, side: CGFloat) -> CGImage? {
        let upright = CIImage(cgImage: image).oriented(orientation)
        let extent = upright.extent
        let scale = side / min(extent.width, extent.height)
        let scaled = upright.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let box = scaled.extent
        let crop = CGRect(x: box.midX - side / 2, y: box.midY - side / 2, width: side, height: side)
        return renderer.createCGImage(scaled, from: crop, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
    }

    func textVector(_ sentence: String) -> [Float]? {
        guard let model = text, let tokenizer else { return nil }
        let ids = tokenizer.tokens(sentence)
        guard let array = try? MLMultiArray(shape: [1, NSNumber(value: CLIPTokenizer.context)], dataType: .int32) else { return nil }
        for (index, id) in ids.enumerated() {
            array[index] = NSNumber(value: id)
        }
        guard let input = try? MLDictionaryFeatureProvider(dictionary: ["tokens": MLFeatureValue(multiArray: array)]),
              let output = try? model.prediction(from: input),
              let result = output.featureValue(for: "embedding")?.multiArrayValue else { return nil }
        return Self.floats(result)
    }

    private static func floats(_ array: MLMultiArray) -> [Float] {
        let count = array.count
        var result = [Float](repeating: 0, count: count)
        switch array.dataType {
        case .float32:
            let pointer = array.dataPointer.bindMemory(to: Float.self, capacity: count)
            for index in 0..<count { result[index] = pointer[index] }
        case .double:
            let pointer = array.dataPointer.bindMemory(to: Double.self, capacity: count)
            for index in 0..<count { result[index] = Float(pointer[index]) }
        default:
            // Float16 outputs: NSNumber bridging works on every architecture.
            for index in 0..<count { result[index] = array[index].floatValue }
        }
        var norm: Float = 0
        for value in result { norm += value * value }
        norm = norm.squareRoot()
        if norm > 0 { for index in result.indices { result[index] /= norm } }
        return result
    }
}

/// OpenAI CLIP byte-pair tokenizer (lower case, 77 tokens with start and end markers).
final class CLIPTokenizer: @unchecked Sendable {
    static let context = 77
    private static let start: Int32 = 49406
    private static let end: Int32 = 49407

    private let vocab: [String: Int32]
    private let ranks: [String: Int]
    private let bytes: [Character]
    private let pattern: NSRegularExpression
    private var cache: [String: [Int32]] = [:]
    private let lock = NSLock()

    init?(folder: URL) {
        guard let vocabData = try? Data(contentsOf: folder.appendingPathComponent("clip-vocab.json")),
              let vocab = try? JSONDecoder().decode([String: Int32].self, from: vocabData),
              let merges = try? String(contentsOf: folder.appendingPathComponent("clip-merges.txt"), encoding: .utf8),
              let pattern = try? NSRegularExpression(
                pattern: "<\\|startoftext\\|>|<\\|endoftext\\|>|'s|'t|'re|'ve|'m|'ll|'d|[\\p{L}]+|[\\p{N}]|[^\\s\\p{L}\\p{N}]+",
                options: [.caseInsensitive]
              ) else { return nil }
        self.vocab = vocab
        var ranks: [String: Int] = [:]
        for (index, line) in merges.split(separator: "\n").dropFirst().enumerated() where !line.isEmpty {
            ranks[String(line)] = index
        }
        self.ranks = ranks
        self.pattern = pattern
        // GPT-2 byte → printable character table.
        var visible: [Int] = Array(33...126) + Array(161...172) + Array(174...255)
        var mapped = visible
        var extra = 0
        for byte in 0..<256 where !visible.contains(byte) {
            visible.append(byte)
            mapped.append(256 + extra)
            extra += 1
        }
        var table = [Character](repeating: " ", count: 256)
        for (byte, scalar) in zip(visible, mapped) {
            table[byte] = Character(UnicodeScalar(UInt32(scalar))!)
        }
        bytes = table
    }

    func tokens(_ sentence: String) -> [Int32] {
        let clean = sentence.lowercased()
            .components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        var ids: [Int32] = [Self.start]
        let range = NSRange(clean.startIndex..., in: clean)
        for match in pattern.matches(in: clean, range: range) {
            guard let swiftRange = Range(match.range, in: clean) else { continue }
            let word = String(String(clean[swiftRange]).utf8.map { bytes[Int($0)] })
            ids.append(contentsOf: encode(word))
            if ids.count >= Self.context - 1 { break }
        }
        ids = Array(ids.prefix(Self.context - 1))
        ids.append(Self.end)
        while ids.count < Self.context { ids.append(0) }
        return ids
    }

    private func encode(_ word: String) -> [Int32] {
        lock.lock()
        if let hit = cache[word] {
            lock.unlock()
            return hit
        }
        lock.unlock()
        var parts = word.map { String($0) }
        guard !parts.isEmpty else { return [] }
        parts[parts.count - 1] += "</w>"
        while parts.count > 1 {
            var best: (rank: Int, index: Int)?
            for index in 0..<(parts.count - 1) {
                if let rank = ranks[parts[index] + " " + parts[index + 1]], rank < (best?.rank ?? .max) {
                    best = (rank, index)
                }
            }
            guard let best else { break }
            let first = parts[best.index]
            let second = parts[best.index + 1]
            var merged: [String] = []
            var index = 0
            while index < parts.count {
                if index < parts.count - 1, parts[index] == first, parts[index + 1] == second {
                    merged.append(first + second)
                    index += 2
                } else {
                    merged.append(parts[index])
                    index += 1
                }
            }
            parts = merged
        }
        let result = parts.compactMap { vocab[$0] }
        lock.lock()
        if cache.count > 4000 { cache.removeAll() }
        cache[word] = result
        lock.unlock()
        return result
    }
}
