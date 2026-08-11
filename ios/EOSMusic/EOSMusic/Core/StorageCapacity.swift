import Foundation
import SwiftUI

struct StorageSnapshot: Equatable {
    let usedBytes: Int64
    let totalBytes: Int64

    var freeBytes: Int64 { max(0, totalBytes - usedBytes) }

    var usedFraction: Double {
        guard totalBytes > 0 else { return 0 }
        return min(1, max(0, Double(usedBytes) / Double(totalBytes)))
    }

    var freeFraction: Double { 1 - usedFraction }

    enum Level: Equatable {
        case comfortable
        case warning
        case critical
    }

    var level: Level {
        switch freeFraction {
        case 0.50...: return .comfortable
        case 0.15..<0.50: return .warning
        default: return .critical
        }
    }

    var levelColor: Color {
        switch level {
        case .comfortable:
            return Color(red: 0.20, green: 0.78, blue: 0.35)
        case .warning:
            return Color(red: 1.0, green: 0.76, blue: 0.03)
        case .critical:
            return Color(red: 1.0, green: 0.27, blue: 0.23)
        }
    }

    var freeLabel: String {
        "\(ByteCountFormatter.string(fromByteCount: freeBytes, countStyle: .file)) wolne"
    }
}

enum StorageCapacityReader {
    static func deviceVolume(for url: URL = AppDocuments.root) -> StorageSnapshot? {
        guard let values = try? url.resourceValues(forKeys: [
            .volumeTotalCapacityKey,
            .volumeAvailableCapacityForImportantUsageKey,
        ]),
              let total = values.volumeTotalCapacity,
              let available = values.volumeAvailableCapacityForImportantUsage,
              total > 0 else {
            return nil
        }
        let used = Int64(total) - Int64(max(0, available))
        return StorageSnapshot(usedBytes: used, totalBytes: Int64(total))
    }

    static func serverDisk(
        libraryBytes: Int,
        diskTotalBytes: Int?,
        diskFreeBytes: Int?
    ) -> StorageSnapshot? {
        guard let total = diskTotalBytes, total > 0 else {
            // Brak danych z API — nie pokazuj wymyślonego limitu.
            return nil
        }
        let free = max(0, diskFreeBytes ?? (total - libraryBytes))
        let used = max(0, total - free)
        return StorageSnapshot(usedBytes: Int64(used), totalBytes: Int64(total))
    }

    /// Pasek biblioteki serwerowej gdy znamy tylko rozmiar biblioteki (bez dysku VPS).
    static func serverLibraryOnly(libraryBytes: Int) -> StorageSnapshot? {
        guard libraryBytes > 0 else { return nil }
        return StorageSnapshot(usedBytes: Int64(libraryBytes), totalBytes: Int64(libraryBytes))
    }
}

struct StorageCapacityBar: View {
    let snapshot: StorageSnapshot
    var showsLegend = false
    /// Gdy true, pasek pokazuje tylko zajętą bibliotekę (bez % wolnego dysku).
    var libraryOnly = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            PremiumGroovedMeter(fraction: snapshot.usedFraction, tint: snapshot.levelColor)

            HStack {
                if libraryOnly {
                    Text("\(ByteCountFormatter.string(fromByteCount: snapshot.usedBytes, countStyle: .file)) na serwerze")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                } else {
                    Text(snapshot.freeLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(snapshot.levelColor)
                    Spacer()
                    Text("\(ByteCountFormatter.string(fromByteCount: snapshot.usedBytes, countStyle: .file)) zajęte")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if showsLegend {
                Text("Zielony = sporo wolnego · żółty = mało · czerwony = krytycznie mało")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(libraryOnly ? "Rozmiar biblioteki serwerowej" : "Pozostałe miejsce")
        .accessibilityValue(
            libraryOnly
                ? ByteCountFormatter.string(fromByteCount: snapshot.usedBytes, countStyle: .file)
                : snapshot.freeLabel
        )
    }
}

/// Premium recessed meter — grooved track + glossy fill (Apple hardware style).
struct PremiumGroovedMeter: View {
    let fraction: Double
    var tint: Color = Color(red: 0.20, green: 0.78, blue: 0.35)
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { geo in
            let fillW = max(height, geo.size.width * min(1, max(0, fraction)))
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.black.opacity(0.22),
                                Color(uiColor: .tertiarySystemFill),
                                Color.white.opacity(0.08)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        Capsule(style: .continuous)
                            .stroke(Color.black.opacity(0.18), lineWidth: 0.8)
                            .blur(radius: 0.3)
                    }
                    .shadow(color: .black.opacity(0.12), radius: 1, y: 1)

                Capsule(style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                tint.opacity(0.55),
                                tint,
                                tint.opacity(0.88)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: fillW)
                    .overlay(alignment: .top) {
                        Capsule(style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.45), Color.white.opacity(0.05)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(height: max(2, height * 0.38))
                            .padding(.horizontal, 2)
                            .padding(.top, 1)
                    }
                    .shadow(color: tint.opacity(0.35), radius: 3, y: 1)
            }
        }
        .frame(height: height)
    }
}

/// Vertical VU / EQ channel with grooved housing.
struct PremiumGroovedChannel: View {
    let level: Double
    let peak: Double
    var isPlaying: Bool = true
    var cornerRadius: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            let clamped = CGFloat(min(1, max(0, level)))
            let peakLevel = CGFloat(min(1, max(clamped, peak)))
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.black.opacity(0.42),
                                Color.black.opacity(0.28),
                                Color.white.opacity(0.04)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay {
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(Color.black.opacity(0.35), lineWidth: 1)
                    }
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)

                VStack(spacing: 0) {
                    ForEach(0..<5, id: \.self) { tick in
                        Spacer(minLength: 0)
                        Rectangle()
                            .fill(Color.white.opacity(tick == 4 ? 0.12 : 0.05))
                            .frame(height: 0.5)
                    }
                }
                .padding(.vertical, 4)

                RoundedRectangle(cornerRadius: cornerRadius - 1, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.2, green: 0.78, blue: 0.35),
                                Color(red: 1.0, green: 0.76, blue: 0.03),
                                Color(red: 1.0, green: 0.27, blue: 0.23)
                            ],
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .frame(height: max(4, geo.size.height * clamped))
                    .opacity(isPlaying ? 1 : 0.35)
                    .overlay(alignment: .top) {
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .fill(Color.white.opacity(0.35))
                            .frame(height: max(2, geo.size.height * 0.12))
                            .padding(.horizontal, 3)
                            .padding(.top, 2)
                    }
                    .animation(.easeOut(duration: 0.07), value: clamped)

                Rectangle()
                    .fill(Color.white.opacity(0.92))
                    .frame(height: 2)
                    .offset(y: -(geo.size.height * peakLevel - 1))
                    .opacity(peakLevel > 0.04 ? 1 : 0)
            }
        }
    }
}
