import SwiftUI

struct MediaDownloadOptionsSheet: View {
    let title: String
    let info: VideoInfoResponse
    var itemCount: Int = 1
    var totalDuration: Double?
    var itemsSubtitle: String?
    let onStart: (MediaDownloadFormat, MediaQualityOption, OnlineMovieDownloadDestination) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedFormat: MediaDownloadFormat
    @State private var selectedQualityID: String
    @State private var destination: OnlineMovieDownloadDestination = .server

    init(
        title: String,
        info: VideoInfoResponse,
        itemCount: Int = 1,
        totalDuration: Double? = nil,
        itemsSubtitle: String? = nil,
        onStart: @escaping (MediaDownloadFormat, MediaQualityOption, OnlineMovieDownloadDestination) -> Void
    ) {
        self.title = title
        self.info = info
        self.itemCount = max(itemCount, 1)
        self.totalDuration = totalDuration
        self.itemsSubtitle = itemsSubtitle
        self.onStart = onStart
        let defaults = info.defaultDownloadSelection()
        _selectedFormat = State(initialValue: defaults.format)
        _selectedQualityID = State(initialValue: defaults.quality.id)
    }

    private var qualityOptions: [MediaQualityOption] {
        let options = info.qualityOptions(for: selectedFormat)
        return options.isEmpty ? MediaQualityOption.defaultStreamTiers(duration: info.duration) : options
    }

    private var effectiveTotalDuration: Double {
        if let totalDuration, totalDuration > 0 { return totalDuration }
        if let duration = info.duration, duration > 0 { return duration * Double(itemCount) }
        return 45 * 60 * Double(itemCount)
    }

    private var selectedQuality: MediaQualityOption? {
        qualityOptions.first(where: { $0.id == selectedQualityID }) ?? qualityOptions.first
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(title)
                        .font(EOSTypography.headline)
                    if let itemsSubtitle {
                        Text(itemsSubtitle)
                            .font(EOSTypography.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Gdzie zapisać") {
                    Picker("Cel", selection: $destination) {
                        Text("Serwer EOS (MOVIES/)").tag(OnlineMovieDownloadDestination.server)
                        Text("Serwer + iPhone").tag(OnlineMovieDownloadDestination.serverAndPhone)
                    }
                    .pickerStyle(.inline)
                }

                Section("Format") {
                    ForEach(info.availableDownloadFormats) { format in
                        Button {
                            selectedFormat = format
                            let opts = info.qualityOptions(for: format)
                            if let match = opts.first(where: { $0.id == selectedQualityID }) ?? opts.first {
                                selectedQualityID = match.id
                            }
                        } label: {
                            HStack {
                                Text(format.label)
                                Spacer()
                                if selectedFormat == format {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }

                Section(selectedFormat.kind == "audio" ? "Jakość audio" : "Rozdzielczość") {
                    ForEach(qualityOptions) { option in
                        Button {
                            selectedQualityID = option.id
                        } label: {
                            MediaQualityOptionRow(option: option, isSelected: option.id == selectedQualityID)
                        }
                        .foregroundStyle(.primary)
                    }
                }

                if let quality = selectedQuality {
                    Section("Szacowany rozmiar") {
                        HStack {
                            Image(systemName: "internaldrive")
                                .foregroundStyle(EOSTheme.accent)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(quality.totalEstimateLabel(itemCount: itemCount, totalDuration: effectiveTotalDuration))
                                    .font(EOSTypography.subheadline.weight(.semibold))
                                Text("\(itemCount) × \(quality.label) · \(selectedFormat.label)")
                                    .font(EOSTypography.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Pobieranie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start") {
                        guard let quality = selectedQuality else { return }
                        onStart(selectedFormat, quality, destination)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

struct MediaQualityOptionRow: View {
    let option: MediaQualityOption
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(option.label)
                    .font(EOSTypography.subheadline.weight(.semibold))
                if let detail = option.detail, !detail.isEmpty {
                    Text(detail)
                        .font(EOSTypography.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(option.displaySizeLabel)
                .font(EOSTypography.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(EOSTheme.accent)
            }
        }
        .padding(.vertical, 4)
    }
}
