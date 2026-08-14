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
                    Text("Dopasowanie")
                } footer: {
                    Text("Automatyczny i Dopasuj zachowują oryginalny obraz. Wypełnij przycina krawędzie. Rozciągnij ignoruje proporcje.")
                }

                Section("Stałe proporcje") {
                    ForEach(VideoAspectMode.fixedRatios) { mode in
                        aspectRow(mode)
                    }
                }

                if engine.signalInfo.hasVideo {
                    Section("Sygnał") {
                        signalRow("Rozdzielczość", engine.signalInfo.resolution)
                        signalRow("Proporcje", engine.signalInfo.sourceAspect)
                        signalRow("Klatki", engine.signalInfo.frameRate)
                        signalRow("Wideo", engine.signalInfo.videoCodecShort.isEmpty ? engine.signalInfo.videoCodec : engine.signalInfo.videoCodecShort)
                        signalRow("Audio", engine.signalInfo.audioCodecShort.isEmpty ? engine.signalInfo.audioCodec : engine.signalInfo.audioCodecShort)
                        signalRow("Kanały", engine.signalInfo.audioChannels)
                        signalRow("Bitrate", engine.signalInfo.bitrate)
                        signalRow("Kontener", engine.signalInfo.container)

                        HStack {
                            Text("Zakres dynamiki")
                            Spacer()
                            if engine.signalInfo.isHDR {
                                Text(engine.signalInfo.hdrLabel)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.black)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 4)
                                    .background(Color.yellow, in: Capsule())
                            } else {
                                Text("SDR")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Wyświetlanie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gotowe") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            engine.refreshSignalInfo()
            engine.applyAspect(force: true)
        }
    }

    private func aspectRow(_ mode: VideoAspectMode) -> some View {
        let selected = engine.aspectMode == mode
        return Button {
            UISelectionFeedbackGenerator().selectionChanged()
            engine.aspectMode = mode
        } label: {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: mode.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(selected ? Color.accentColor : .secondary)
                    .frame(width: 28, alignment: .center)
                    .symbolRenderingMode(.hierarchical)

                VStack(alignment: .leading, spacing: 2) {
                    Text(mode.title)
                        .font(.body.weight(selected ? .semibold : .regular))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(mode.subtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if selected {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }
            }
            .contentShape(Rectangle())
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @ViewBuilder
    private func signalRow(_ title: String, _ value: String) -> some View {
        if !value.isEmpty {
            LabeledContent(title) {
                Text(value)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.trailing)
            }
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
                    chip(info.hdrLabel, style: .hdr)
                } else if info.hasVideo {
                    chip("SDR", style: .muted)
                }
                if !info.resolution.isEmpty { chip(info.resolution) }
                if !info.frameRate.isEmpty { chip(info.frameRate) }
                if !info.videoCodecShort.isEmpty {
                    chip(info.videoCodecShort)
                } else if !info.videoCodec.isEmpty {
                    chip(info.videoCodec)
                }
                if !info.audioCodecShort.isEmpty { chip(info.audioCodecShort) }
                if !info.audioChannels.isEmpty { chip(info.audioChannels) }
                if !info.container.isEmpty { chip(info.container) }
                if !info.bitrate.isEmpty { chip(info.bitrate) }
                chip(aspectTitle, style: .accent)
            }
            .padding(.horizontal, 2)
        }
    }

    private enum ChipStyle {
        case standard, hdr, accent, muted
    }

    private func chip(_ text: String, style: ChipStyle = .standard) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(foreground(style))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(background(style), in: Capsule())
    }

    private func foreground(_ style: ChipStyle) -> Color {
        switch style {
        case .hdr: return .black
        case .accent, .standard, .muted: return .white
        }
    }

    private func background(_ style: ChipStyle) -> Color {
        switch style {
        case .hdr: return Color.yellow.opacity(0.95)
        case .accent: return Color.white.opacity(0.28)
        case .muted: return Color.white.opacity(0.12)
        case .standard: return Color.white.opacity(0.18)
        }
    }
}
