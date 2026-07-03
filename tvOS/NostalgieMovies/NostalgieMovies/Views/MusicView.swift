import SwiftUI

private enum MusicFocus: Hashable {
    case query
    case searchButton
    case newFolder
    case folder(String)
    case sort(MusicSort)
}

struct MusicView: View {
    @EnvironmentObject private var app: AppModel
    let navigationTab: HomeTabView.Tab
    var focusedTab: FocusState<HomeTabView.Tab?>.Binding
    @Binding var requestContentFocus: Bool

    @State private var query = ""
    @State private var sort: MusicSort = .relevance
    @State private var results: [SearchResultItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedTrack: MusicSelection?
    @State private var activeFolder: MusicFolder?
    @State private var showCreateFolder = false
    @State private var newFolderName = ""
    @State private var createError: String?
    @FocusState private var localFocus: MusicFocus?

    private let columns = [GridItem(.adaptive(minimum: 280, maximum: 320), spacing: 36)]

    var body: some View {
        Group {
            if let folder = activeFolder {
                MusicFolderView(
                    folder: folder,
                    navigationTab: navigationTab,
                    focusedTab: focusedTab,
                    onBack: { activeFolder = nil }
                )
            } else {
                mainContent
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { await app.refreshMusicLibrary() }
        .onChange(of: requestContentFocus) { _, requested in
            guard requested else { return }
            localFocus = .query
            requestContentFocus = false
        }
        .fullScreenCover(item: $selectedTrack) { track in
            MusicDetailView(selection: track, folders: app.musicFolders) {
                Task { await app.refreshMusicLibrary() }
            }
            .environmentObject(app)
        }
        .fullScreenCover(isPresented: $showCreateFolder) {
            MusicFolderCreateSheet(
                name: $newFolderName,
                onCancel: {
                    showCreateFolder = false
                    newFolderName = ""
                    createError = nil
                },
                onCreate: {
                    Task { await createFolder() }
                }
            )
            .environmentObject(app)
        }
    }

    private var mainContent: some View {
        ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    Color.clear.frame(height: 1).id("musicTop")

                    ScreenTitle(
                        title: "Muzyka",
                        subtitle: "Apple Music · wyszukaj, zapisz w folderze, pobierz MP3 z okładką"
                    )

                    folderSection
                    searchSection

                    if isLoading {
                        ProgressView("Szukam w Apple Music…")
                    } else if let errorMessage {
                        EmptyStateView(icon: "exclamationmark.magnifyingglass", title: "Błąd", message: errorMessage)
                    } else if !results.isEmpty {
                        resultsHeader
                        LazyVGrid(columns: columns, spacing: 36) {
                            ForEach(results) { item in
                                MusicTrackCard(
                                    title: item.title,
                                    subtitle: [item.uploader, item.album].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                                    thumbnailURL: item.thumbnail.flatMap(URL.init(string:)),
                                    duration: item.duration,
                                    quality: item.quality,
                                    layout: .grid
                                ) {
                                    selectedTrack = MusicSelection(from: item)
                                }
                            }
                        }
                    } else if !query.trimmingCharacters(in: .whitespaces).isEmpty {
                        EmptyStateView(
                            icon: "music.note",
                            title: "Brak wyników",
                            message: "Spróbuj innej frazy — tytuł i wykonawca razem dają najlepsze trafienia."
                        )
                    }
                }
                .padding(.bottom, 80)
            }
            .onChange(of: localFocus) { _, focus in
                guard focus != nil else { return }
                withAnimation(.easeOut(duration: 0.25)) {
                    scrollProxy.scrollTo("musicTop", anchor: .top)
                }
            }
        }
    }

    private var folderSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Playlisty i foldery")
                    .font(.title3.weight(.semibold))
                Spacer()
                if let createError {
                    Text(createError)
                        .font(.callout)
                        .foregroundStyle(NostalgieTheme.accent)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 18) {
                    Button {
                        newFolderName = ""
                        createError = nil
                        showCreateFolder = true
                    } label: {
                        VStack(spacing: 12) {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 42))
                            Text("Nowy folder")
                                .font(.headline)
                        }
                        .frame(width: 220, height: 220)
                        .glassPanel(cornerRadius: 18)
                    }
                    .buttonStyle(MediaCardButtonStyle())
                    .focused($localFocus, equals: .newFolder)

                    ForEach(app.musicFolders) { folder in
                        MusicFolderCard(folder: folder) {
                            activeFolder = folder
                        }
                        .focused($localFocus, equals: .folder(folder.id))
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 20) {
                HStack(spacing: 14) {
                    Image(systemName: "music.note")
                        .foregroundStyle(.secondary)
                    TextField("Tytuł, wykonawca…", text: $query)
                        .textFieldStyle(.plain)
                        .font(.title3)
                        .onSubmit { Task { await runSearch() } }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 18)
                .background(localFocus == .query ? NostalgieTheme.cardFocused : NostalgieTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: NostalgieTheme.cardCornerRadius, style: .continuous)
                        .stroke(localFocus == .query ? Color.white.opacity(0.9) : Color.white.opacity(0.08), lineWidth: localFocus == .query ? 3 : 1)
                }
                .focused($localFocus, equals: .query)
                .onMoveCommand { direction in
                    if direction == .up { focusedTab.wrappedValue = navigationTab }
                }

                Button { Task { await runSearch() } } label: {
                    Label("Szukaj", systemImage: "arrow.right.circle.fill")
                }
                .buttonStyle(FocusCardButtonStyle())
                .focused($localFocus, equals: .searchButton)
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
            }
            .frame(maxWidth: 980)

            HStack(spacing: 12) {
                Text("Sortowanie")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                ForEach(MusicSort.allCases) { option in
                    Button {
                        sort = option
                        Task { await runSearch() }
                    } label: {
                        Text(option.label)
                    }
                    .buttonStyle(ChipButtonStyle(isSelected: sort == option))
                    .focused($localFocus, equals: .sort(option))
                }
            }
        }
    }

    private var resultsHeader: some View {
        Text("\(results.count) wyników · Apple Music")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.secondary)
    }

    private func runSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await app.api.searchAppleMusic(query: trimmed, sort: sort)
            results = response.results
        } catch {
            results = []
            errorMessage = error.localizedDescription
        }
    }

    private func createFolder() async {
        let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            _ = try await app.createMusicFolder(name: name)
            showCreateFolder = false
            newFolderName = ""
            createError = nil
        } catch {
            createError = error.localizedDescription
        }
    }
}
