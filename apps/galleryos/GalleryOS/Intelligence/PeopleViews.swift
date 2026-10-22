import Photos
import SwiftUI

enum PeopleRoute: Hashable {
    case all
    case person(Int64)
    case unknown
}

extension View {
    /// Where People links lead; attached once at the root of each navigation stack.
    func peopleDestinations() -> some View {
        navigationDestination(for: PeopleRoute.self) { route in
            switch route {
            case .all: PeopleScreen()
            case .person(let id): PersonScreen(personID: id)
            case .unknown: UnknownFacesScreen()
            }
        }
    }
}

// MARK: Avatar

struct FaceAvatar: View {
    let face: FaceRecord?
    var size: CGFloat = 76
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Circle().fill(Color(uiColor: .tertiarySystemFill))
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white.opacity(0.18), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.16), radius: size > 90 ? 10 : 4, y: size > 90 ? 5 : 2)
        .task(id: face?.id) {
            guard let face else { return }
            let side = max(160, size * UIScreen.main.scale)
            let loaded = await PhotoIntelligence.shared.faceImage(face, side: side)
            withAnimation(.easeOut(duration: 0.25)) { image = loaded }
        }
    }
}

// MARK: Shelf on Collections

struct PeopleShelf: View {
    @ObservedObject private var brain = PhotoIntelligence.shared
    @State private var open = true

    var body: some View {
        if brain.peopleAvailable {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Button {
                        withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { open.toggle() }
                    } label: {
                        HStack(spacing: 8) {
                            Text(L("Osoby"))
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.primary)
                            Image(systemName: "chevron.right")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(.blue)
                                .rotationEffect(.degrees(open ? 90 : 0))
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    if !brain.people.isEmpty {
                        NavigationLink(value: PeopleRoute.all) {
                            Text(L("Wszystkie")).font(.body)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                if open {
                    content
                        .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if brain.people.isEmpty {
            PeopleProgressCard()
                .padding(.horizontal, 16)
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 16) {
                    ForEach(brain.people.prefix(16)) { person in
                        NavigationLink(value: PeopleRoute.person(person.id)) {
                            VStack(spacing: 8) {
                                FaceAvatar(face: person.coverFace, size: 82)
                                Text(person.hasName ? person.name : " ")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                    .frame(width: 90)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    if brain.unknownCount > 0 {
                        NavigationLink(value: PeopleRoute.unknown) {
                            VStack(spacing: 8) {
                                UnknownStack(size: 82)
                                Text(L("Nieznane"))
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(GalleryTheme.accent)
                                    .lineLimit(1)
                                    .frame(width: 90)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }
}

/// Shown until the first people appear: what is happening, in plain words.
struct PeopleProgressCard: View {
    @ObservedObject private var brain = PhotoIntelligence.shared

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(GalleryTheme.accent.opacity(0.14))
                Image(systemName: "person.2.crop.square.stack")
                    .font(.title3)
                    .foregroundStyle(GalleryTheme.accent)
                    .symbolEffect(.pulse, isActive: brain.running)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text(brain.running ? L("Poznaję osoby na zdjęciach") : L("Osoby pojawią się tutaj"))
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                if brain.totalCount > 0, brain.running {
                    ProgressView(value: Double(brain.analyzedCount), total: Double(max(brain.totalCount, 1)))
                        .tint(GalleryTheme.accent)
                        .padding(.top, 2)
                }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(uiColor: .secondarySystemBackground)))
    }

    private var detail: String {
        if let reason = brain.pauseReason { return reason }
        if brain.running {
            return L("Przejrzano \(brain.analyzedCount) z \(brain.totalCount) zdjęć. Wszystko dzieje się na tym urządzeniu.")
        }
        return L("Gdy GalleryOS przejrzy bibliotekę, zgrupuje twarze tych samych osób. Nic nie opuszcza urządzenia.")
    }
}

// MARK: All people

struct PeopleScreen: View {
    @ObservedObject private var brain = PhotoIntelligence.shared
    @State private var selecting = false
    @State private var selection: Set<Int64> = []
    @State private var naming: PersonSummary?
    @State private var draft = ""
    @State private var showHidden = false

    private let columns = [GridItem(.adaptive(minimum: 104, maximum: 140), spacing: 18)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                if brain.unknownCount > 0 {
                    NavigationLink(value: PeopleRoute.unknown) {
                        HStack(spacing: 14) {
                            UnknownStack(size: 56)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(L("Nieznane osoby"))
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text(L("\(PhotoFormat.grouped(brain.unknownCount)) twarzy czeka. Przypisz je albo załóż nowe osoby."))
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 8)
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(uiColor: .secondarySystemBackground)))
                    }
                    .buttonStyle(.plain)
                }
                let favorites = brain.people.filter(\.favorite)
                if !favorites.isEmpty {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 20)], spacing: 22) {
                        ForEach(favorites) { person in cell(person, size: 140) }
                    }
                }
                let others = brain.people.filter { !$0.favorite }
                if !others.isEmpty {
                    LazyVGrid(columns: columns, spacing: 22) {
                        ForEach(others) { person in cell(person, size: 96) }
                    }
                }
                if brain.people.isEmpty {
                    PeopleProgressCard()
                }
                if showHidden, !brain.hiddenPeople.isEmpty {
                    Text(L("Ukryte osoby"))
                        .font(.title3.weight(.bold))
                    LazyVGrid(columns: columns, spacing: 22) {
                        ForEach(brain.hiddenPeople) { person in cell(person, size: 84).opacity(0.7) }
                    }
                }
                footer
            }
            .padding(16)
        }
        .navigationTitle(L("Osoby"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if selecting {
                    Button(L("Gotowe")) {
                        selecting = false
                        selection.removeAll()
                    }
                    .fontWeight(.semibold)
                } else {
                    Menu {
                        Button(L("Wybierz"), systemImage: "checkmark.circle") { selecting = true }
                        if !brain.hiddenPeople.isEmpty {
                            Button(showHidden ? L("Schowaj ukryte osoby") : L("Pokaż ukryte osoby"), systemImage: "eye") {
                                withAnimation { showHidden.toggle() }
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            if selecting {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button(L("Połącz")) {
                        brain.merge(Array(selection))
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        selection.removeAll()
                        selecting = false
                    }
                    .disabled(selection.count < 2)
                    Spacer()
                    Text(selection.isEmpty ? L("Zaznacz te same osoby") : L("Wybrano: \(selection.count)"))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button(L("Ukryj")) {
                        for id in selection { brain.setHidden(id, true) }
                        selection.removeAll()
                        selecting = false
                    }
                    .disabled(selection.isEmpty)
                }
            }
        }
        .alert(L("Imię"), isPresented: Binding(get: { naming != nil }, set: { if !$0 { naming = nil } })) {
            TextField(L("Imię i nazwisko"), text: $draft)
                .textInputAutocapitalization(.words)
            Button(L("Zachowaj")) {
                if let naming { brain.rename(naming.id, to: draft) }
            }
            Button(L("Anuluj"), role: .cancel) {}
        }
    }

    @ViewBuilder
    private func cell(_ person: PersonSummary, size: CGFloat) -> some View {
        let chosen = selection.contains(person.id)
        let label = VStack(spacing: 8) {
            FaceAvatar(face: person.coverFace, size: size)
                .overlay(alignment: .bottomTrailing) {
                    if selecting {
                        Image(systemName: chosen ? "checkmark.circle.fill" : "circle")
                            .font(.title2)
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(.white, chosen ? GalleryTheme.accent : Color.black.opacity(0.35))
                            .background(Circle().fill(chosen ? Color.white : Color.clear).padding(3))
                    } else if person.favorite {
                        Image(systemName: "heart.fill")
                            .font(.caption)
                            .foregroundStyle(.white)
                            .padding(6)
                            .background(Circle().fill(.pink))
                    }
                }
                .scaleEffect(chosen ? 0.92 : 1)
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: chosen)
            Text(person.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(person.hasName ? Color.primary : GalleryTheme.accent)
                .lineLimit(1)
            Text(PhotoCountWord.text(person.count))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        Group {
            if selecting {
                Button {
                    if chosen { selection.remove(person.id) } else { selection.insert(person.id) }
                    UISelectionFeedbackGenerator().selectionChanged()
                } label: { label }
            } else {
                NavigationLink(value: PeopleRoute.person(person.id)) { label }
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(person.hasName ? L("Zmień imię") : L("Dodaj imię"), systemImage: "pencil") {
                draft = person.name
                naming = person
            }
            Button(person.favorite ? L("Usuń z ulubionych") : L("Ulubiona osoba"), systemImage: person.favorite ? "heart.slash" : "heart") {
                brain.setFavorite(person.id, !person.favorite)
            }
            Button(L("Połącz z innymi…"), systemImage: "person.2") {
                selection = [person.id]
                selecting = true
            }
            Button(person.hidden ? L("Pokaż osobę") : L("Ukryj osobę"), systemImage: person.hidden ? "eye" : "eye.slash") {
                brain.setHidden(person.id, !person.hidden)
            }
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let reason = brain.pauseReason {
                Label(reason, systemImage: "thermometer.medium")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            } else if brain.running {
                Label(L("Przeglądam bibliotekę: \(brain.analyzedCount) z \(brain.totalCount)"), systemImage: "sparkles")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Text(L("Rozpoznawanie twarzy działa tylko na tym urządzeniu. Imiona i grupy osób nie trafiają do żadnej chmury ani na serwer."))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.top, 8)
    }
}

// MARK: Faces nobody is named for yet

/// Three faces fanned out: the doorway to the unknown people.
struct UnknownStack: View {
    let size: CGFloat
    @ObservedObject private var brain = PhotoIntelligence.shared
    @State private var faces: [FaceRecord] = []

    var body: some View {
        ZStack {
            Circle().fill(Color(uiColor: .tertiarySystemFill))
            ForEach(Array(faces.prefix(3).enumerated()), id: \.element.id) { index, face in
                FaceAvatar(face: face, size: size * 0.56)
                    .overlay(Circle().strokeBorder(Color(uiColor: .systemBackground), lineWidth: 2))
                    .offset(Self.offset(index, size: size))
            }
            if faces.isEmpty {
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .font(.system(size: size * 0.38))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .task(id: brain.revision) { faces = Array(brain.unknownFaces().prefix(3)) }
    }

    private static func offset(_ index: Int, size: CGFloat) -> CGSize {
        let r = size * 0.2
        switch index {
        case 0: return CGSize(width: -r * 0.8, height: -r * 0.55)
        case 1: return CGSize(width: r * 0.8, height: -r * 0.3)
        default: return CGSize(width: 0, height: r * 0.8)
        }
    }
}

/// Every clear face that is nobody yet. Choose several (the same person, or strangers) and give
/// them to someone you know, make a new person of them, or put them away.
struct UnknownFacesScreen: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var brain = PhotoIntelligence.shared
    @State private var faces: [FaceRecord] = []
    @State private var chosen: Set<Int64> = []
    @State private var picking = false
    @State private var naming = false
    @State private var draft = ""
    @State private var viewer: ViewerRequest?

    private let columns = [GridItem(.adaptive(minimum: 82, maximum: 110), spacing: 14)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text(L("Zaznacz twarze tej samej osoby i przypisz je komuś albo załóż nową osobę. Przytrzymaj twarz, żeby zobaczyć całe zdjęcie."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(faces) { face in
                        let on = chosen.contains(face.id)
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                if on { chosen.remove(face.id) } else { chosen.insert(face.id) }
                            }
                            UISelectionFeedbackGenerator().selectionChanged()
                        } label: {
                            FaceAvatar(face: face, size: 82)
                                .overlay {
                                    Circle().strokeBorder(on ? GalleryTheme.accent : Color.clear, lineWidth: 3)
                                }
                                .overlay(alignment: .bottomTrailing) {
                                    Image(systemName: on ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .symbolRenderingMode(.palette)
                                        .foregroundStyle(.white, on ? GalleryTheme.accent : Color.black.opacity(0.3))
                                        .background(Circle().fill(on ? Color.white : Color.clear).padding(3))
                                }
                                .scaleEffect(on ? 0.9 : 1)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(L("Pokaż zdjęcie"), systemImage: "photo") { open(face) }
                        } preview: {
                            FacePhotoPreview(id: library.currentID(for: face.photo) ?? face.photo)
                        }
                    }
                }
                if faces.isEmpty {
                    ContentUnavailableView(L("Wszyscy rozpoznani"), systemImage: "person.crop.circle.badge.checkmark",
                                           description: Text(L("Każda wyraźna twarz należy już do jakiejś osoby.")))
                        .padding(.top, 40)
                }
            }
            .padding(16)
        }
        .navigationTitle(L("Nieznane osoby"))
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if !chosen.isEmpty {
                    Button(L("Odznacz")) { chosen.removeAll() }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !chosen.isEmpty {
                actions
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.86), value: chosen.isEmpty)
        .task(id: brain.revision) { reload() }
        .onChange(of: library.generation) { _, _ in reload() }
        .sheet(isPresented: $picking) {
            PersonPickerSheet(excluding: -1) { person in
                brain.assign(faces: Array(chosen), to: person)
                withAnimation { chosen.removeAll() }
            }
        }
        .alert(L("Nowa osoba"), isPresented: $naming) {
            TextField(L("Imię i nazwisko"), text: $draft)
                .textInputAutocapitalization(.words)
            Button(L("Utwórz")) {
                if brain.newPerson(named: draft, faces: Array(chosen)) != nil {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    withAnimation { chosen.removeAll() }
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        } message: {
            Text(L("Zaznaczone twarze (\(chosen.count)) staną się tą osobą."))
        }
        .fullScreenCover(item: $viewer) { request in
            PhotoViewerHost(request: request)
                .environmentObject(library)
                .presentationBackground(.clear)
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            Text(L("Wybrano twarzy: \(chosen.count)"))
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button {
                    picking = true
                } label: {
                    Label(L("Przypisz do osoby"), systemImage: "person.crop.circle.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(brain.people.isEmpty)
                Button {
                    draft = ""
                    naming = true
                } label: {
                    Label(L("Nowa osoba"), systemImage: "person.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .controlSize(.large)
            Button(L("To przypadkowe osoby – schowaj")) {
                brain.hideFaces(Array(chosen))
                withAnimation { chosen.removeAll() }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(16)
        .background(.bar)
    }

    private func reload() {
        let next = brain.unknownFaces()
        faces = next
        chosen.formIntersection(Set(next.map(\.id)))
    }

    private func open(_ face: FaceRecord) {
        let id = library.currentID(for: face.photo) ?? face.photo
        viewer = ViewerRequest(ids: [id], index: 0, origin: .zero, image: nil)
    }
}

/// The whole photo behind a face, for the long-press preview.
private struct FacePhotoPreview: View {
    let id: String
    @EnvironmentObject private var library: PhotoLibrary
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color(uiColor: .secondarySystemBackground)
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                ProgressView()
            }
        }
        .frame(width: 320, height: 320)
        .task(id: id) {
            if let asset = library.asset(id: id) {
                image = await PhotoIntelligence.request(asset, side: 900)
            } else {
                image = await library.sharpPreview(id: id, side: 1280) ?? library.thumbnail(id: id)
            }
        }
    }
}

enum PhotoCountWord {
    static func text(_ count: Int) -> String {
        let number = PhotoFormat.grouped(count)
        return Plural.pick(count, L("\(number) zdjęcie"), L("\(number) zdjęcia"), L("\(number) zdjęć"))
    }
}

// MARK: One person

struct PersonScreen: View {
    let personID: Int64
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var brain = PhotoIntelligence.shared
    @State private var model = GridModel.empty
    @State private var viewer: ViewerRequest?
    @State private var naming = false
    @State private var draft = ""
    @State private var reviewing = false
    @State private var choosingCover = false
    @State private var merging = false

    private var person: PersonSummary? { brain.person(personID) }

    var body: some View {
        Group {
            if let person {
                PhotoGrid(
                    model: model,
                    generation: library.generation &+ brain.revision,
                    zoom: .all,
                    selection: [],
                    selecting: false,
                    placeNames: library.placeNames,
                    synced: { library.isUploaded($0) },
                    anchor: nil,
                    asset: { library.asset(id: $0) },
                    thumb: { library.thumbnail(id: $0) },
                    loadThumb: { await LibraryEngine.shared.cloudThumb(id: $0) },
                    onOpen: { request in
                        let ids = model.all.map(\.id)
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) {
                            viewer = ViewerRequest(ids: ids, index: ids.firstIndex(of: request.id) ?? 0,
                                                   origin: request.frame, image: request.image, source: request.source)
                        }
                    },
                    onSelect: { _ in },
                    onFavorite: { id in
                        let current = library.photo(id: id)?.isFavorite ?? false
                        library.setFavorite(!current, ids: [id])
                    },
                    onConceal: { library.setConcealed(true, ids: [$0]) },
                    onZoom: { _, _ in },
                    onVisiblePlaces: { _ in },
                    sharp: { id, side in await library.sharpPreview(id: id, side: side) }
                )
                .safeAreaInset(edge: .top, spacing: 0) { header(person) }
                .ignoresSafeArea(edges: .bottom)
            } else {
                ContentUnavailableView(L("Tej osoby już nie ma"), systemImage: "person.crop.circle.badge.questionmark",
                                       description: Text(L("Mogła zostać połączona z inną osobą.")))
            }
        }
        .navigationTitle(person?.hasName == true ? person!.name : "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let person {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(person.hasName ? L("Zmień imię") : L("Dodaj imię"), systemImage: "pencil") {
                            draft = person.name
                            naming = true
                        }
                        Button(person.favorite ? L("Usuń z ulubionych") : L("Ulubiona osoba"), systemImage: person.favorite ? "heart.slash" : "heart") {
                            brain.setFavorite(person.id, !person.favorite)
                        }
                        Button(L("Wybierz zdjęcie główne"), systemImage: "person.crop.circle") { choosingCover = true }
                        Button(L("Przejrzyj twarze"), systemImage: "person.crop.rectangle.stack") { reviewing = true }
                        Button(L("Połącz z inną osobą…"), systemImage: "person.2") { merging = true }
                        Divider()
                        Button(person.hidden ? L("Pokaż osobę") : L("Ukryj osobę"), systemImage: person.hidden ? "eye" : "eye.slash") {
                            brain.setHidden(person.id, !person.hidden)
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .task(id: brain.revision) { rebuild() }
        .onChange(of: library.generation) { _, _ in rebuild() }
        .alert(L("Imię"), isPresented: $naming) {
            TextField(L("Imię i nazwisko"), text: $draft)
                .textInputAutocapitalization(.words)
            Button(L("Zachowaj")) { brain.rename(personID, to: draft) }
            Button(L("Anuluj"), role: .cancel) {}
        }
        .sheet(isPresented: $reviewing) {
            FaceReviewSheet(personID: personID, mode: .review)
        }
        .sheet(isPresented: $choosingCover) {
            FaceReviewSheet(personID: personID, mode: .cover)
        }
        .sheet(isPresented: $merging) {
            PersonPickerSheet(excluding: personID) { other in
                brain.merge([personID, other])
            }
        }
        .fullScreenCover(item: $viewer) { request in
            PhotoViewerHost(request: request)
                .environmentObject(library)
                .presentationBackground(.clear)
        }
    }

    private func header(_ person: PersonSummary) -> some View {
        HStack(spacing: 16) {
            FaceAvatar(face: person.coverFace, size: 74)
            VStack(alignment: .leading, spacing: 4) {
                Button {
                    draft = person.name
                    naming = true
                } label: {
                    Text(person.title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(person.hasName ? Color.primary : GalleryTheme.accent)
                }
                .buttonStyle(.plain)
                Text(PhotoCountWord.text(person.count))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if person.favorite {
                Image(systemName: "heart.fill").foregroundStyle(.pink)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.bar)
    }

    private func rebuild() {
        // The person's photos under the ids the library knows them by now (see `currentID`).
        model = GridModel(photos: brain.photos(of: personID).compactMap { library.photo(id: $0) })
    }
}

// MARK: Faces of one person

struct FaceReviewSheet: View {
    enum Mode { case review, cover }
    let personID: Int64
    let mode: Mode
    @ObservedObject private var brain = PhotoIntelligence.shared
    @Environment(\.dismiss) private var dismiss
    @State private var faces: [FaceRecord] = []
    /// Tapped by the user as "not this person".
    @State private var marked: Set<Int64> = []
    /// Tapped back by the user: these stay, whatever the suggestions say.
    @State private var kept: Set<Int64> = []
    /// Found by GalleryOS from what the user marked: they look like the marked faces, not like this person.
    @State private var suggested: Set<Int64> = []
    /// Faces far from this person's average, shown first and ringed, before anything is marked.
    @State private var doubtful: Set<Int64> = []

    private var removing: Set<Int64> { marked.union(suggested) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text(mode == .review
                         ? L("Stuknij twarze, które nie należą do tej osoby. Podobne do nich zaznaczę sam — na pomarańczowo. Stuknij taką, jeśli jednak pasuje.")
                         : L("Wybierz twarz, która ma być zdjęciem głównym."))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if mode == .review, !suggested.isEmpty {
                        Label(L("Zaznaczyłem \(suggested.count) podobnych"), systemImage: "sparkles")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.orange)
                            .transition(.opacity)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .animation(.smooth, value: suggested)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 12)], spacing: 12) {
                    ForEach(faces) { face in
                        Button { tap(face) } label: { tile(face) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .navigationTitle(mode == .review ? L("Twarze") : L("Zdjęcie główne"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Zamknij")) { dismiss() }
                }
                if mode == .review {
                    ToolbarItem(placement: .confirmationAction) {
                        if removing.isEmpty {
                            Button(L("Wszystkie się zgadzają")) {
                                brain.confirmAll(personID)
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                                dismiss()
                            }
                        } else {
                            Button(L("Usuń (\(removing.count))"), role: .destructive) {
                                brain.split(faces.filter { removing.contains($0.id) }, from: personID)
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                                dismiss()
                            }
                            .fontWeight(.semibold)
                        }
                    }
                }
            }
            .task { await load() }
        }
        .presentationDetents([.medium, .large])
    }

    private func tile(_ face: FaceRecord) -> some View {
        FaceAvatar(face: face, size: 84)
            .overlay {
                if marked.contains(face.id) || suggested.contains(face.id) {
                    ZStack {
                        Circle().fill(.black.opacity(0.45))
                        Image(systemName: "xmark")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(.white)
                    }
                    .transition(.opacity.combined(with: .scale(scale: 0.8)))
                }
            }
            .overlay {
                if suggested.contains(face.id) {
                    Circle().strokeBorder(Color.orange, lineWidth: 3)
                } else if doubtful.contains(face.id), !marked.contains(face.id), !kept.contains(face.id) {
                    Circle().strokeBorder(Color.yellow.opacity(0.85), style: StrokeStyle(lineWidth: 2, dash: [5, 4]))
                }
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.75), value: removing.contains(face.id))
    }

    private func tap(_ face: FaceRecord) {
        if mode == .cover {
            brain.setCover(personID, face: face.id)
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            dismiss()
            return
        }
        if marked.contains(face.id) {
            marked.remove(face.id)
        } else if suggested.contains(face.id) {
            // "No, this one is right": it stays and teaches the next suggestions.
            kept.insert(face.id)
        } else {
            marked.insert(face.id)
            kept.remove(face.id)
        }
        UISelectionFeedbackGenerator().selectionChanged()
        withAnimation(.smooth(duration: 0.35)) { suggested = suggestions() }
    }

    private func load() async {
        let loaded = await brain.reviewFaces(of: personID)
        guard !loaded.isEmpty else {
            faces = brain.faces(of: personID)
            return
        }
        // The least convincing faces first, so mistakes are at the top.
        let centre = Self.centre(of: loaded)
        let ranked = loaded.sorted { closeness($0, to: centre) < closeness($1, to: centre) }
        guard mode == .review else {
            // For the cover, the clearest likeness first.
            faces = ranked.reversed()
            return
        }
        faces = ranked
        doubtful = Set(ranked.filter { $0.embedding != nil && closeness($0, to: centre) < 0.42 && !$0.confirmed }.map(\.id))
    }

    /// Faces that look more like the ones the user rejected than like the faces that remain.
    private func suggestions() -> Set<Int64> {
        let rejected = faces.filter { marked.contains($0.id) }.compactMap(\.embedding)
        guard !rejected.isEmpty else { return [] }
        var result = Set<Int64>()
        // Two rounds: what is suggested in the first no longer pulls the person's average.
        for _ in 0..<2 {
            let staying = faces.filter { !marked.contains($0.id) && !result.contains($0.id) }
            let centre = Self.centre(of: staying)
            let negatives = rejected + faces.filter { result.contains($0.id) }.compactMap(\.embedding)
            for face in staying where !kept.contains(face.id) && !face.confirmed {
                guard let vector = face.embedding else { continue }
                let toPerson = FaceClustering.dot(vector, centre)
                let toRejected = negatives.map { FaceClustering.dot(vector, $0) }.max() ?? -1
                if toRejected >= 0.40, toRejected > toPerson + 0.02 {
                    result.insert(face.id)
                }
            }
        }
        return result
    }

    private func closeness(_ face: FaceRecord, to centre: [Float]) -> Float {
        guard let vector = face.embedding, !centre.isEmpty else { return 1 }
        return FaceClustering.dot(vector, centre)
    }

    private static func centre(of faces: [FaceRecord]) -> [Float] {
        var sum = [Float](repeating: 0, count: 128)
        var any = false
        for face in faces {
            guard let vector = face.embedding, vector.count == 128 else { continue }
            let weight: Float = face.confirmed ? 2 : 1
            for index in 0..<128 { sum[index] += vector[index] * weight }
            any = true
        }
        return any ? FaceClustering.normalized(sum) : []
    }
}

/// "Which person is this the same as?"
struct PersonPickerSheet: View {
    let excluding: Int64
    let onPick: (Int64) -> Void
    @ObservedObject private var brain = PhotoIntelligence.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 16)], spacing: 18) {
                    ForEach(brain.people.filter { $0.id != excluding }) { person in
                        Button {
                            onPick(person.id)
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                            dismiss()
                        } label: {
                            VStack(spacing: 6) {
                                FaceAvatar(face: person.coverFace, size: 84)
                                Text(person.hasName ? person.name : PhotoCountWord.text(person.count))
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .navigationTitle(L("To ta sama osoba co…"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Anuluj")) { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
