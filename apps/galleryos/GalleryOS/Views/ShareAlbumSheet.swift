import Photos
import SwiftUI
import UIKit

struct ShareAlbumSheet: View {
    var ids: [String]
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var account = ShareAccount.shared
    @State private var title = ""
    @State private var members = Set<String>()
    @State private var phase = SharePhase.editing
    @State private var sent = 0
    @State private var note = ""
    @FocusState private var titleFocused: Bool

    var body: some View {
        NavigationStack {
            Group {
                if account.signedIn {
                    composer
                } else {
                    ScrollView { AccountEntryForm() }
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle(L("Udostępnij"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Anuluj")) { dismiss() }
                        .disabled(phase == .sending)
                }
            }
            .task { await account.refresh() }
            .onAppear { if title.isEmpty { title = suggestedTitle } }
        }
        .interactiveDismissDisabled(phase == .sending)
    }

    private var composer: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ShareStack(ids: ids)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                VStack(alignment: .leading, spacing: 8) {
                    Text(L("ALBUM"))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    TextField(L("Nazwa albumu"), text: $title)
                        .font(.title3.weight(.semibold))
                        .focused($titleFocused)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .galleryGlass(in: RoundedRectangle(cornerRadius: 18, style: .continuous), interactive: true)
                }
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(L("ZNAJOMI"))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        Spacer()
                        if !account.friends.isEmpty {
                            Button(members.count == account.friends.count ? L("Odznacz") : L("Wszyscy")) {
                                UISelectionFeedbackGenerator().selectionChanged()
                                withAnimation(GalleryTheme.snappy) {
                                    if members.count == account.friends.count {
                                        members.removeAll()
                                    } else {
                                        members = Set(account.friends.map(\.name))
                                    }
                                }
                            }
                            .font(.caption.weight(.semibold))
                        }
                    }
                    if account.friends.isEmpty {
                        Label(L("Najpierw dodaj znajomego kodem w zakładce Znajomi."), systemImage: "person.badge.plus")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .galleryGlass(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 76), spacing: 14)], spacing: 16) {
                            ForEach(account.friends) { friend in
                                FriendChip(friend: friend, selected: members.contains(friend.name)) {
                                    UISelectionFeedbackGenerator().selectionChanged()
                                    withAnimation(.spring(response: 0.32, dampingFraction: 0.68)) {
                                        if members.contains(friend.name) {
                                            members.remove(friend.name)
                                        } else {
                                            members.insert(friend.name)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if !note.isEmpty {
                    Label(note, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
                Button {
                    shareFiles()
                } label: {
                    Label(L("Wyślij jako pliki"), systemImage: "square.and.arrow.up")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .galleryGlassButton()
                .controlSize(.large)
                .disabled(phase == .sending || localIDs.isEmpty)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 120)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            sendBar
        }
    }

    private var sendBar: some View {
        Button {
            titleFocused = false
            Task { await publish() }
        } label: {
            HStack(spacing: 10) {
                switch phase {
                case .editing:
                    Image(systemName: "paperplane.fill")
                    Text(members.isEmpty ? L("Wybierz znajomych") : L("Udostępnij \(PhotoFormat.things(ids.count))"))
                case .sending:
                    ProgressRing(fraction: ids.isEmpty ? 0 : Double(sent) / Double(ids.count))
                        .frame(width: 20, height: 20)
                    Text(L("Wysyłam \(sent) z \(ids.count)"))
                        .monospacedDigit()
                        .contentTransition(.numericText(value: Double(sent)))
                case .done:
                    Image(systemName: "checkmark")
                        .transition(.scale.combined(with: .opacity))
                    Text(L("Udostępniono"))
                }
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .frame(height: 30)
        }
        .galleryGlassButton(prominent: true)
        .controlSize(.large)
        .tint(phase == .done ? LinkRoute.home.tint : GalleryTheme.accent)
        .disabled(phase != .editing || members.isEmpty || title.trimmingCharacters(in: .whitespaces).isEmpty)
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .animation(GalleryTheme.snappy, value: phase)
        .animation(GalleryTheme.snappy, value: sent)
    }

    private var localIDs: [String] {
        ids.filter { library.asset(id: $0) != nil }
    }

    private var suggestedTitle: String {
        let photos = ids.compactMap { library.photo(id: $0) }
        let key = photos.first.map { PhotoGrouping.dayKey($0.created, calendar: .current) }
        if let key, let place = library.placeNames[key], !place.isEmpty { return place }
        guard let first = photos.map(\.created).min() else { return "" }
        return PhotoGrouping.dayTitle(for: first)
    }

    private func shareFiles() {
        guard let presenter = UIApplication.shared.galleryTopController() else { return }
        PhotoSharing.present(ids: localIDs, asset: { library.asset(id: $0) }, from: presenter)
    }

    private func publish() async {
        note = ""
        sent = 0
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        withAnimation(GalleryTheme.snappy) { phase = .sending }
        do {
            var items: [ShareItem] = []
            for id in ids {
                if let item = try await upload(id) { items.append(item) }
                withAnimation(GalleryTheme.snappy) { sent += 1 }
            }
            guard !items.isEmpty else {
                throw LibraryError(message: L("Nie udało się przygotować zdjęć. Sprawdź połączenie z serwerem."))
            }
            try await account.createAlbum(title: title.trimmingCharacters(in: .whitespaces), members: Array(members), items: items)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { phase = .done }
            try? await Task.sleep(for: .seconds(1.1))
            dismiss()
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            note = SyncPause.message(for: error)
            withAnimation(GalleryTheme.snappy) { phase = .editing }
        }
    }

    /// Photos on this iPhone are exported from Photos; server-only photos stream from the library server.
    private func upload(_ id: String) async throws -> ShareItem? {
        if let asset = library.asset(id: id) {
            let exported = try await OriginalExport.export(asset)
            defer {
                exported.resources.forEach { try? FileManager.default.removeItem(at: $0.file) }
                if let thumb = exported.thumb { try? FileManager.default.removeItem(at: thumb) }
            }
            guard let primary = exported.resources.first else { return nil }
            let hash = primary.hash.lowercased()
            if let thumb = exported.thumb {
                try await account.upload(hash: hash, kind: "thumbnail", ext: "jpg", file: thumb)
            }
            try await account.upload(hash: hash, kind: "original", ext: primary.ext, file: primary.file)
            return ShareItem(hash: hash, ext: primary.ext)
        }
        guard id.hasPrefix("cloud:") else { return nil }
        let hash = String(id.dropFirst("cloud:".count)).lowercased()
        await library.prepareCloud(id: id)
        guard let media = library.cloudMedia(id: id),
              let original = library.photo(id: id)?.traits.isVideo == true ? media.video : (media.still ?? media.video) else {
            return nil
        }
        if let preview = library.thumbnail(id: id)?.jpegData(compressionQuality: 0.82) {
            let file = FileManager.default.temporaryDirectory.appendingPathComponent("share-\(hash).jpg")
            try preview.write(to: file, options: .atomic)
            defer { try? FileManager.default.removeItem(at: file) }
            try await account.upload(hash: hash, kind: "thumbnail", ext: "jpg", file: file)
        }
        let ext = original.pathExtension.isEmpty ? "jpg" : original.pathExtension.lowercased()
        try await account.upload(hash: hash, kind: "original", ext: ext, file: original)
        return ShareItem(hash: hash, ext: ext)
    }
}

private enum SharePhase: Equatable {
    case editing, sending, done
}

/// Fanned stack of the chosen photos, like the Photos share header.
private struct ShareStack: View {
    let ids: [String]

    var body: some View {
        let shown = Array(ids.prefix(4))
        ZStack {
            ForEach(Array(shown.enumerated().reversed()), id: \.element) { index, id in
                ShareThumbnail(id: id)
                    .frame(width: 132, height: 132)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white.opacity(0.9), lineWidth: 2))
                    .shadow(color: .black.opacity(0.18), radius: 10, y: 5)
                    .rotationEffect(.degrees(angle(index, of: shown.count)))
                    .offset(x: CGFloat(index - (shown.count - 1) / 2) * 22, y: CGFloat(index) * -2)
            }
            if ids.count > 1 {
                Text("\(ids.count)")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(GalleryTheme.accent, in: Capsule())
                    .overlay(Capsule().stroke(.white, lineWidth: 2))
                    .offset(x: 78, y: -66)
            }
        }
        .frame(height: 170)
    }

    private func angle(_ index: Int, of count: Int) -> Double {
        guard count > 1 else { return 0 }
        return (Double(index) - Double(count - 1) / 2) * 6
    }
}

private struct ShareThumbnail: View {
    let id: String
    @EnvironmentObject private var library: PhotoLibrary
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color(uiColor: .secondarySystemFill)
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            }
        }
        .task(id: id) {
            if let cached = GridImageStore.shared.cached(id) ?? library.thumbnail(id: id) {
                image = cached
                return
            }
            guard let asset = library.asset(id: id) else { return }
            image = await withCheckedContinuation { continuation in
                let options = PHImageRequestOptions()
                options.deliveryMode = .highQualityFormat
                options.resizeMode = .fast
                options.isNetworkAccessAllowed = true
                PHImageManager.default().requestImage(
                    for: asset,
                    targetSize: CGSize(width: 400, height: 400),
                    contentMode: .aspectFill,
                    options: options
                ) { result, _ in
                    continuation.resume(returning: result)
                }
            }
        }
    }
}

private struct FriendChip: View {
    let friend: ShareFriend
    let selected: Bool
    let action: () -> Void

    private var initials: String {
        let parts = friend.name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }

    private var hue: Double {
        Double(friend.name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) % 360 }) / 360
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack(alignment: .bottomTrailing) {
                    Circle()
                        .fill(LinearGradient(
                            colors: [Color(hue: hue, saturation: 0.45, brightness: 0.95), Color(hue: hue, saturation: 0.65, brightness: 0.75)],
                            startPoint: .top,
                            endPoint: .bottom
                        ))
                        .frame(width: 60, height: 60)
                        .overlay(Text(initials).font(.title3.weight(.semibold)).foregroundStyle(.white))
                        .overlay(Circle().stroke(GalleryTheme.accent, lineWidth: selected ? 3 : 0).padding(-4))
                        .scaleEffect(selected ? 0.92 : 1)
                    if selected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 20, weight: .semibold))
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(.white, GalleryTheme.accent)
                            .background(Circle().fill(.white).padding(2))
                            .offset(x: 4, y: 4)
                            .transition(.scale(scale: 0.2).combined(with: .opacity))
                    }
                    if friend.online && !selected {
                        Circle()
                            .fill(LinkRoute.home.tint)
                            .frame(width: 13, height: 13)
                            .overlay(Circle().stroke(Color(uiColor: .systemGroupedBackground), lineWidth: 2.5))
                    }
                }
                Text(friend.name)
                    .font(.caption)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct ProgressRing: View {
    let fraction: Double

    var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.3), lineWidth: 3)
            Circle()
                .trim(from: 0, to: max(0.04, fraction))
                .stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(GalleryTheme.snappy, value: fraction)
        }
    }
}
