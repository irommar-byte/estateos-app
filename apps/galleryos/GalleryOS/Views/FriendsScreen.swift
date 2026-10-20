import SwiftUI
import UIKit

struct FriendsScreen: View {
    @ObservedObject private var account = ShareAccount.shared
    @State private var code = ""
    @State private var issued = ""

    var body: some View {
        Group {
            if account.signedIn {
                signedIn
            } else {
                accountForm
            }
        }
        .navigationTitle("Znajomi")
        .navigationBarTitleDisplayMode(.inline)
        .task { await account.refresh() }
    }

    private var accountForm: some View {
        ScrollView {
            AccountEntryForm()
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    private var signedIn: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(account.profileName)
                        .font(.title2.weight(.semibold))
                    Label("Zalogowano", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.green)
                }
                .padding(.vertical, 4)
            }
            AccountServerSection()
            Section("Zaproszenie") {
                Button("Nowy kod") {
                    Task { issued = (try? await account.inviteCode()) ?? "" }
                }
                if !issued.isEmpty {
                    HStack {
                        Text(issued)
                            .font(.title2.monospaced().bold())
                        Spacer()
                        ShareLink(item: "Kod GalleryOS: \(issued)") {
                            Image(systemName: "square.and.arrow.up")
                        }
                        .accessibilityLabel("Wyślij kod")
                        Button("Kopiuj") {
                            UIPasteboard.general.string = issued
                            account.inviteNote = "Kod skopiowany."
                        }
                    }
                }
                TextField("Kod od znajomego", text: $code)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                Button("Dodaj znajomego") {
                    Task { await account.accept(code: code) }
                }
                if !account.inviteNote.isEmpty {
                    Text(account.inviteNote)
                        .font(.footnote)
                        .foregroundStyle(account.inviteNote.hasPrefix("Dodano") || account.inviteNote == "Kod skopiowany." ? Color.green : Color.red)
                }
            }
            Section("Znajomi") {
                if account.friends.isEmpty {
                    Text("Nikogo jeszcze nie ma. Wyślij kod albo wpisz kod od drugiej osoby.")
                        .foregroundStyle(.secondary)
                }
                ForEach(account.friends) { friend in
                    NavigationLink(value: friend.name) {
                        HStack {
                            Circle()
                                .fill(friend.online ? Color.green : Color.secondary.opacity(0.4))
                                .frame(width: 8, height: 8)
                            Text(friend.name)
                            Spacer()
                            if friend.online {
                                Text("ONLINE").font(.caption.weight(.bold)).foregroundStyle(.green)
                            }
                        }
                    }
                }
            }
            if !account.albums.isEmpty {
                Section("Albumy") {
                    ForEach(account.albums) { album in
                        NavigationLink(value: album.id) {
                            VStack(alignment: .leading) {
                                Text(album.title)
                                Text(album.owner == account.name ? "Twój" : album.owner)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            Section {
                Button("Wyloguj", role: .destructive) { account.signOut() }
            }
        }
        .navigationDestination(for: String.self) { value in
            if let album = account.albums.first(where: { $0.id == value }) {
                SharedAlbumScreen(album: album)
            } else {
                FriendAlbumsScreen(friend: value)
            }
        }
    }
}

private struct AccountServerSection: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var account = ShareAccount.shared
    @ObservedObject private var servers = SavedServerStore.shared
    @ObservedObject private var link = ServerLink.shared
    @AppStorage("galleryos.link.mode") private var linkMode = LinkMode.auto.rawValue

    private var serverKindIsOnTV: Bool {
        let kind = (servers.online ?? servers.servers.first)?.kind ?? ""
        return kind == DestinationKind.server || kind == DestinationKind.webdav
    }

    private var statusLine: String {
        switch link.phase {
        case .connected(.home): return "Sieć domowa · \(link.host)"
        case .connected(.remote): return "Zdalnie · \(link.host)"
        case .connected: return "Połączono"
        case .connecting: return "Łączę…"
        case .offline: return "Brak sieci"
        case .unreachable(let message): return message
        case .idle: return "Brak serwera"
        }
    }

    var body: some View {
        Section("Serwer") {
            if let server = servers.online ?? servers.servers.first {
                LabeledContent("Połączenie", value: server.title)
                HStack(spacing: 8) {
                    RouteGlyph(phase: link.phase)
                    Text(statusLine)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(link.route == .none ? Color.secondary : link.route.tint)
                        .contentTransition(.opacity)
                }
                .animation(GalleryTheme.snappy, value: link.phase)
                let counts = library.syncCounts()
                LabeledContent("Na serwerze", value: "\(counts.sent)")
                LabeledContent("Zostało skopiować", value: "\(counts.waiting)")
                LabeledContent("Tylko na serwerze", value: "\(library.keptOnServer)")
            } else {
                Text("Po zalogowaniu wraca ostatni serwer zapisany na tym iPhonie.")
                    .foregroundStyle(.secondary)
            }
            if account.needsPassword {
                Text("Serwer jest zapisany przy koncie. Wpisz hasło raz na tym iPhonie.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if serverKindIsOnTV {
                AppleTVShareToggle()
            }
            Picker("Dostęp", selection: $linkMode) {
                Text("Automatycznie").tag(LinkMode.auto.rawValue)
                Text("Dom").tag(LinkMode.home.rawValue)
                Text("Zdalnie").tag(LinkMode.remote.rawValue)
            }
            .pickerStyle(.segmented)
            .onChange(of: linkMode) { _, _ in
                UISelectionFeedbackGenerator().selectionChanged()
                ServerLink.shared.reset()
                Task { _ = try? await LibraryEngine.shared.connect() }
            }
            if servers.servers.count > 1 {
                ForEach(servers.servers) { server in
                    Button {
                        Task { await servers.use(server) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(server.title)
                                Text(server.online ? "Aktywne" : "Przełącz")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if server.online {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct FriendAlbumsScreen: View {
    var friend: String
    @ObservedObject private var account = ShareAccount.shared

    var body: some View {
        List(albums) { album in
            NavigationLink(album.title) {
                SharedAlbumScreen(album: album)
            }
        }
        .navigationTitle(friend)
    }

    private var albums: [ShareAlbum] {
        account.albums.filter { $0.owner == friend || $0.members.contains(friend) }
    }
}

struct SharedAlbumScreen: View {
    var album: ShareAlbum
    @ObservedObject private var account = ShareAccount.shared
    @State private var viewer: ShareViewer?

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 2)], spacing: 2) {
                ForEach(album.items) { item in
                    Button {
                        viewer = ShareViewer(item: item)
                    } label: {
                        ShareThumb(hash: item.hash)
                            .frame(height: 110)
                            .clipped()
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationTitle(album.title)
        .fullScreenCover(item: $viewer) { item in
            ShareOriginalView(item: item.item)
        }
    }
}

private struct ShareViewer: Identifiable {
    var item: ShareItem
    var id: String { item.hash }
}

private struct ShareThumb: View {
    var hash: String
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color(uiColor: .secondarySystemFill)
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            }
        }
        .task {
            guard let data = try? await ShareAccount.shared.download(hash: hash, kind: "thumbnail", ext: "jpg") else { return }
            image = UIImage(data: data)
        }
    }
}

private struct ShareOriginalView: View {
    var item: ShareItem
    @Environment(\.dismiss) private var dismiss
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                ProgressView().tint(.white)
            }
        }
        .task {
            let data = try? await ShareAccount.shared.download(hash: item.hash, kind: "original", ext: item.ext)
            image = data.flatMap(UIImage.init(data:))
        }
        .onDisappear { image = nil }
        .overlay(alignment: .topLeading) {
            Button("Zamknij") { dismiss() }
                .padding()
                .foregroundStyle(.white)
        }
    }
}
