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
        if selectedFormat.kind == "audio" { return options }
        if options.isEmpty {
            return [MediaQualityOption(id: "best", label: "Najlepsza dostępna", detail: "Jedyna jakość w źródle")]
        }
        return options
    }

    private var showsQualityPicker: Bool {
        if selectedFormat.kind == "audio" { return qualityOptions.count > 1 }
        return MovieDownloadQualityPolicy.offersDistinctVideoQuality(qualityOptions)
    }

    private var effectiveTotalDuration: Double {
        if let totalDuration, totalDuration > 0 { return totalDuration }
        if let duration = info.duration, duration > 0 { return duration * Double(itemCount) }
        return 45 * 60 * Double(itemCount)
    }

    private var selectedQuality: MediaQualityOption? {
        qualityOptions.first(where: { $0.id == selectedQualityID }) ?? qualityOptions.first
    }

    private func sizeLine(for quality: MediaQualityOption) -> String {
        quality.knownSizeLabel(
            itemCount: itemCount,
            singleItemDuration: info.duration ?? 0,
            totalDuration: effectiveTotalDuration
        ) ?? "Rozmiar widać na pasku w trakcie pobierania"
    }

    private func sizeCaption(for quality: MediaQualityOption) -> String {
        if showsQualityPicker {
            return "\(itemCount) × \(quality.label) · \(selectedFormat.label)"
        }
        if itemCount > 1 {
            return "Najlepsza jakość ze źródła · \(itemCount) pozycji"
        }
        return "Najlepsza jakość dostępna w tym źródle"
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
                    ForEach(OnlineMovieDownloadDestination.allCases, id: \.self) { option in
                        Button {
                            destination = option
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: option.systemImage)
                                    .font(.title3)
                                    .foregroundStyle(EOSTheme.accent)
                                    .frame(width: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.label)
                                        .font(EOSTypography.subheadline.weight(.semibold))
                                    Text(option.detail)
                                        .font(EOSTypography.caption)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer(minLength: 0)
                                if destination == option {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(EOSTheme.accent)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
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

                if showsQualityPicker {
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
                }

                if let quality = selectedQuality {
                    Section("Rozmiar") {
                        HStack {
                            Image(systemName: "internaldrive")
                                .foregroundStyle(EOSTheme.accent)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(sizeLine(for: quality))
                                    .font(EOSTypography.subheadline.weight(.semibold))
                                Text(sizeCaption(for: quality))
                                    .font(EOSTypography.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Pobieranie")
            .navigationBarTitleDisplayMode(.inline)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuluj") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Rozpocznij") {
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
