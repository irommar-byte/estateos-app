import SwiftUI

struct VideoAspectSheet: View {
    @ObservedObject var engine: VideoPlaybackEngine
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(VideoAspectMode.fitModes) { mode in
                        aspectRow(mode)
                    }
                } header: {
                    Text("Dopasowanie do ekranu")
                } footer: {
                    Text("Automatyczny zachowuje oryginalne proporcje źródła. Wypełnij przycina krawędzie. Rozciągnij ignoruje proporcje.")
                }

                Section("Stałe proporcje") {
                    ForEach(VideoAspectMode.fixedRatios) { mode in
                        aspectRow(mode)
                    }
                }

                if engine.signalInfo.hasVideo {
                    Section("Sygnał źródła") {
                        signalRow("Rozdzielczość", engine.signalInfo.resolution)
                        signalRow("Proporcje źródła", engine.signalInfo.sourceAspect)
                        signalRow("Klatki", engine.signalInfo.frameRate)
                        signalRow("Kodek wideo", engine.signalInfo.videoCodec)
                        signalRow("Kodek audio", engine.signalInfo.audioCodec)
                        signalRow("Kanały", engine.signalInfo.audioChannels)
                        signalRow("Bitrate", engine.signalInfo.bitrate)
                        signalRow("Kontener", engine.signalInfo.container)
                        HStack {
                            Text("HDR")
                            Spacer()
                            if engine.signalInfo.isHDR {
                                Text(engine.signalInfo.hdrLabel)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(.black)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.yellow, in: Capsule())
                            } else {
                                Text("SDR")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Proporcje ekranu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Gotowe") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { engine.refreshSignalInfo() }
    }

    private func aspectRow(_ mode: VideoAspectMode) -> some View {
        Button {
            engine.aspectMode = mode
        } label: {
            HStack(spacing: 12) {
                Image(systemName: mode.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(EOSTheme.accent)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(mode.title)
                        .foregroundStyle(.primary)
                        .font(.body.weight(engine.aspectMode == mode ? .semibold : .regular))
                    Text(mode.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if engine.aspectMode == mode {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(EOSTheme.accent)
                }
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func signalRow(_ title: String, _ value: String) -> some View {
        if !value.isEmpty {
            LabeledContent(title, value: value)
        }
    }
}

/// Compact HUD chips: HDR, resolution, codec, aspect, container.
struct VideoSignalBadgeBar: View {
    let info: VideoSignalInfo
    let aspectTitle: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                if info.isHDR {
                    chip(info.hdrLabel, emphasized: true)
                } else if info.hasVideo {
                    chip("SDR")
                }
                if !info.resolution.isEmpty { chip(info.resolution) }
                if !info.frameRate.isEmpty { chip(info.frameRate) }
                if !info.videoCodec.isEmpty { chip(info.videoCodec) }
                if !info.audioCodec.isEmpty { chip(info.audioCodec) }
                if !info.audioChannels.isEmpty { chip(info.audioChannels) }
                if !info.container.isEmpty { chip(info.container) }
                if !info.bitrate.isEmpty { chip(info.bitrate) }
                chip(aspectTitle)
                chip(info.isLocal ? "Lokalnie" : "Sieć")
            }
            .padding(.horizontal, 2)
        }
    }

    private func chip(_ text: String, emphasized: Bool = false) -> some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(emphasized ? .black : .white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                emphasized ? Color.yellow.opacity(0.95) : Color.white.opacity(0.16),
                in: Capsule()
            )
    }
}
