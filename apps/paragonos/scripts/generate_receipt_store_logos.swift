#!/usr/bin/env swift
import AppKit
import Foundation

let out = URL(fileURLWithPath: CommandLine.arguments[1])

func cropOpaque(_ image: NSImage) -> NSImage {
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return image }
    let width = rep.pixelsWide
    let height = rep.pixelsHigh
    var minX = width, minY = height, maxX = 0, maxY = 0
    for y in 0..<height {
        for x in 0..<width {
            guard let color = rep.colorAt(x: x, y: y), color.alphaComponent > 0.08 else { continue }
            minX = min(minX, x)
            minY = min(minY, y)
            maxX = max(maxX, x)
            maxY = max(maxY, y)
        }
    }
    guard maxX > minX, maxY > minY else { return image }
    let pad = Int(max(8, Double(max(maxX - minX, maxY - minY)) * 0.08))
    minX = max(0, minX - pad)
    minY = max(0, minY - pad)
    maxX = min(width - 1, maxX + pad)
    maxY = min(height - 1, maxY + pad)
    let rect = NSRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
    guard let cropped = rep.cgImage?.cropping(to: rect) else { return image }
    return NSImage(cgImage: cropped, size: NSSize(width: rect.width / 2, height: rect.height / 2))
}

func writePNG(_ image: NSImage, name: String) {
    let trimmed = cropOpaque(image)
    guard let tiff = trimmed.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let data = rep.representation(using: .png, properties: [:]) else { return }
    let url = out.appendingPathComponent("\(name).png")
    try? data.write(to: url)
    print("wrote \(url.lastPathComponent) \(data.count) bytes \(Int(trimmed.size.width))x\(Int(trimmed.size.height))")
}

func wordmark(
    _ text: String,
    color: NSColor,
    font: NSFont,
    tracking: CGFloat = -1.2
) -> NSImage {
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .kern: tracking
    ]
    let box = (text as NSString).size(withAttributes: attrs)
    let padX = box.height * 0.28
    let padY = box.height * 0.42
    let size = NSSize(width: ceil(box.width + padX * 2), height: ceil(box.height + padY * 2))
    let image = NSImage(size: size)
    image.lockFocus()
    NSColor.clear.setFill()
    NSRect(origin: .zero, size: size).fill()
    (text as NSString).draw(
        at: NSPoint(x: padX, y: padY * 0.55),
        withAttributes: attrs
    )
    image.unlockFocus()
    return image
}

func xkomLogo() -> NSImage {
    let size = NSSize(width: 980, height: 280)
    let image = NSImage(size: size)
    image.lockFocus()
    NSColor.clear.setFill()
    NSRect(origin: .zero, size: size).fill()
    let ink = NSColor(white: 0.07, alpha: 1)
    let bar = NSSize(width: 168, height: 36)
    func barPath(angle: CGFloat, center: NSPoint) -> NSBezierPath {
        let path = NSBezierPath(roundedRect: NSRect(x: -bar.width / 2, y: -bar.height / 2, width: bar.width, height: bar.height), xRadius: 10, yRadius: 10)
        var transform = AffineTransform()
        transform.translate(x: center.x, y: center.y)
        transform.rotate(byDegrees: angle)
        path.transform(using: transform)
        return path
    }
    let xCenter = NSPoint(x: 168, y: 140)
    ink.setFill()
    barPath(angle: 38, center: xCenter).fill()
    barPath(angle: -38, center: xCenter).fill()
    let font = NSFont.systemFont(ofSize: 132, weight: .heavy)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: ink,
        .kern: -3.2
    ]
    ("kom" as NSString).draw(at: NSPoint(x: 278, y: 72), withAttributes: attrs)
    image.unlockFocus()
    return image
}

let futura = NSFont(name: "Futura-Bold", size: 128)
    ?? NSFont.systemFont(ofSize: 128, weight: .heavy)
let avenir = NSFont(name: "AvenirNext-Bold", size: 118)
    ?? NSFont.systemFont(ofSize: 118, weight: .bold)
let serif = NSFont(name: "TimesNewRomanPS-BoldMT", size: 132)
    ?? NSFont.systemFont(ofSize: 132, weight: .semibold)

writePNG(xkomLogo(), name: "xkom")
writePNG(
    wordmark("Action", color: NSColor(calibratedRed: 1, green: 0.416, blue: 0, alpha: 1), font: futura, tracking: -1.4),
    name: "action"
)
writePNG(
    wordmark("dyson", color: NSColor(calibratedRed: 0.29, green: 0.09, blue: 0.45, alpha: 1), font: serif, tracking: -2.4),
    name: "dyson"
)
writePNG(
    wordmark("HOUSE", color: NSColor(white: 0.08, alpha: 1), font: avenir, tracking: 6.4),
    name: "house"
)
