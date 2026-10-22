import AVKit
import SwiftUI
import UniformTypeIdentifiers

// MARK: The stick itself

/// A pendrive drawn like a product shot: an anodised body, a polished USB-C plug and a status
/// light that wakes up when it is plugged in.
struct DriveArt: View {
    var lit: Bool
    var busy = false
    var size: CGFloat = 120
    @Environment(\.coreMotion) private var motion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: !(lit && motion))) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let pulse = lit ? (busy ? 0.5 + 0.5 * sin(t * 7) : 0.65 + 0.35 * sin(t * 2.2)) : 0
            ZStack {
                // Plug.
                RoundedRectangle(cornerRadius: size * 0.04, style: .continuous)
                    .fill(LinearGradient(colors: [Color(white: 0.96), Color(white: 0.62), Color(white: 0.9)], startPoint: .top, endPoint: .bottom))
                    .frame(width: size * 0.2, height: size * 0.11)
                    .overlay(RoundedRectangle(cornerRadius: size * 0.02).fill(Color(white: 0.25)).frame(width: size * 0.13, height: size * 0.035))
                    .offset(x: size * 0.5)
                // Body.
                RoundedRectangle(cornerRadius: size * 0.09, style: .continuous)
                    .fill(LinearGradient(colors: [Color(red: 0.98, green: 0.62, blue: 0.24), Color(red: 0.78, green: 0.36, blue: 0.08)],
                                         startPoint: .top, endPoint: .bottom))
                    .overlay(
                        RoundedRectangle(cornerRadius: size * 0.09, style: .continuous)
                            .strokeBorder(LinearGradient(colors: [.white.opacity(0.6), .black.opacity(0.25)], startPoint: .top, endPoint: .bottom), lineWidth: 1)
                    )
                    .overlay(alignment: .top) {
                        // The anodised sheen along the top.
                        Capsule()
                            .fill(.white.opacity(0.35))
                            .frame(width: size * 0.62, height: size * 0.025)
                            .padding(.top, size * 0.035)
                    }
                    .frame(width: size * 0.82, height: size * 0.3)
                    .shadow(color: .black.opacity(0.35), radius: size * 0.06, y: size * 0.04)
                // Status light.
                Circle()
                    .fill(RadialGradient(colors: [.white, Color(red: 0.4, green: 1, blue: 0.6)], center: .center, startRadius: 0, endRadius: size * 0.02))
                    .frame(width: size * 0.04, height: size * 0.04)
                    .opacity(lit ? 0.35 + 0.65 * pulse : 0.15)
                    .shadow(color: Color(red: 0.3, green: 1, blue: 0.5).opacity(lit ? 0.9 * pulse : 0), radius: size * 0.05)
                    .offset(x: size * 0.28, y: -size * 0.06)
                Text("GalleryOS") // l10n:skip
                    .font(.system(size: size * 0.07, weight: .heavy, design: .rounded))
                    .tracking(size * 0.004)
                    .foregroundStyle(.white.opacity(0.85))
                    .offset(x: -size * 0.06, y: size * 0.03)
            }
            .frame(width: size * 1.25, height: size * 0.45)
        }
        .accessibilityHidden(true)
    }
}

/// Space on a pendrive as a thin gauge: what the library will take, inside what is free.
private struct SpaceGauge: View {
    let space: DriveSpace
    let needed: Int64

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { proxy in
                let used = CGFloat(Double(space.total - space.free) / Double(max(space.total, 1)))
                let library = CGFloat(Double(needed) / Double(max(space.total, 1)))
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule().fill(Color.secondary.opacity(0.5)).frame(width: proxy.size.width * min(used, 1))
                    Capsule()
                        .fill(LinearGradient(colors: [.orange.opacity(0.7), .orange], startPoint: .leading, endPoint: .trailing))
                        .frame(width: proxy.size.width * min(library, max(0, 1 - used)))
                        .offset(x: proxy.size.width * min(used, 1))
                }
            }
            .frame(height: 8)
            HStack {
                Text(L("Biblioteka: \(ByteText.amount(needed))"))
                Spacer()
                Text(L("Wolne: \(ByteText.amount(space.free)) z \(ByteText.amount(space.total))"))
            }
            .font(.caption)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }
    }
}

// MARK: Wizard

/// Setting up a pendrive, one calm step at a time: what it will do, choosing it, checking it,
/// deciding its role, and the first copy with a live gauge.
struct DriveWizard: View {
    private enum Step: Int { case intro, check, role, copy }

    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = DriveCenter.shared
    @Environment(\.dismiss) private var dismiss
    @State private var step = Step.intro
    @State private var picking = false
    @State private var inspection: DriveInspection?
    @State private var bookmark: Data?
    @State private var inspecting = false
    @State private var problem: String?
    @State private var mirror = true
    @State private var autoCopy = true
    @State private var driveID: String?
    @State private var needed: Int64 = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemGroupedBackground).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 22) {
                        progressDots
                        Group {
                            switch step {
                            case .intro: intro
                            case .check: check
                            case .role: role
                            case .copy: copying
                            }
                        }
                        .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                                removal: .move(edge: .leading).combined(with: .opacity)))
                    }
                    .padding(20)
                }
            }
            .navigationTitle(L("Pendrive"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(step == .copy ? L("Gotowe") : L("Anuluj")) { dismiss() }
                }
            }
            .fileImporter(isPresented: $picking, allowedContentTypes: [.folder]) { result in
                guard case .success(let url) = result else { return }
                Task { await choose(url) }
            }
        }
        .presentationDragIndicator(.visible)
        .task { needed = center.librarySize() }
    }

    private var progressDots: some View {
        HStack(spacing: 6) {
            ForEach(0..<4, id: \.self) { index in
                Capsule()
                    .fill(index <= step.rawValue ? Color.orange : Color.primary.opacity(0.12))
                    .frame(width: index == step.rawValue ? 22 : 8, height: 6)
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: step)
    }

    // Step 1: what it does.
    private var intro: some View {
        VStack(spacing: 22) {
            DriveArt(lit: true, size: 170)
                .padding(.top, 8)
            VStack(spacing: 8) {
                Text(L("Pendrive jako przenośny serwer"))
                    .font(.title2.weight(.bold))
                    .multilineTextAlignment(.center)
                Text(L("GalleryOS zapisze na nim wierną kopię biblioteki z serwera, w tym samym formacie. To Twój serwer w kieszeni."))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            VStack(spacing: 0) {
                benefit("externaldrive.fill.badge.checkmark", L("Pełna kopia biblioteki"), L("Oryginały co do bajtu, podglądy i katalog, zaszyfrowane tak jak na serwerze."))
                Divider().padding(.leading, 54)
                benefit("photo.on.rectangle.angled", L("Biblioteka USB"), L("Przeglądaj zdjęcia z pendrive’a bez internetu i bez serwera."))
                Divider().padding(.leading, 54)
                benefit("bolt.badge.automatic", L("Pamięta pendrive"), L("Po podłączeniu sam go rozpozna i dociągnie nowe zdjęcia."))
            }
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(uiColor: .secondarySystemGroupedBackground)))
            Label(L("Podłącz pendrive do \(ThisDevice.genitive) (USB-C albo przejściówka). Najlepiej sformatowany jako exFAT lub APFS."), systemImage: "cable.connector")
                .font(.footnote)
                .foregroundStyle(.secondary)
            primaryButton(L("Wskaż pendrive"), symbol: "folder.badge.plus") { picking = true }
        }
    }

    // Step 2: what is on it.
    private var check: some View {
        VStack(spacing: 20) {
            DriveArt(lit: inspection?.writable == true, size: 140)
            if inspecting {
                ProgressView(L("Sprawdzam pendrive…"))
                    .padding(.vertical, 30)
            } else if let inspection {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(inspection.name).font(.title3.weight(.bold))
                            Text(inspection.space?.format ?? L("Format nieznany"))
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        PilotLight(color: inspection.writable ? Color(red: 0.3, green: 0.92, blue: 0.48) : .red, lit: true, breathing: true, size: 10)
                    }
                    if let space = inspection.space {
                        SpaceGauge(space: space, needed: needed)
                    }
                    if inspection.existingPhotos > 0 {
                        Label(L("Jest już na nim biblioteka GalleryOS: \(PhotoFormat.grouped(inspection.existingPhotos)) zdjęć. Dopiszę tylko to, czego brakuje."), systemImage: "checkmark.seal.fill")
                            .font(.footnote)
                            .foregroundStyle(.green)
                    }
                    ForEach(warnings(inspection), id: \.self) { warning in
                        Label(warning, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
                .padding(18)
                .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(uiColor: .secondarySystemGroupedBackground)))
                if inspection.writable {
                    primaryButton(L("Dalej"), symbol: "arrow.right") { go(.role) }
                } else {
                    primaryButton(L("Wskaż inny folder"), symbol: "folder") { picking = true }
                }
            }
            if let problem {
                Label(problem, systemImage: "xmark.octagon.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    // Step 3: its role.
    private var role: some View {
        VStack(spacing: 20) {
            VStack(spacing: 6) {
                Text(L("Co ma robić ten pendrive?"))
                    .font(.title2.weight(.bold))
                Text(L("Możesz to zmienić w każdej chwili, stukając pendrive w GalleryOS™ Core."))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            VStack(spacing: 0) {
                Toggle(isOn: $mirror) {
                    roleLabel("externaldrive.fill", L("Kopia całej biblioteki"), L("Wszystko, co jest na serwerze, także zdjęcia z innych urządzeń."))
                }
                .padding(16)
                Divider().padding(.leading, 54)
                Toggle(isOn: $autoCopy) {
                    roleLabel("bolt.horizontal.circle.fill", L("Sam po podłączeniu"), L("Gdy tylko go podłączysz, dociągnie nowe zdjęcia bez pytania."))
                }
                .padding(16)
                .disabled(!mirror)
            }
            .tint(.orange)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(uiColor: .secondarySystemGroupedBackground)))
            primaryButton(mirror ? L("Zapisz i zrób kopię") : L("Zapisz pendrive"), symbol: mirror ? "arrow.down.to.line.compact" : "checkmark") {
                save()
            }
        }
    }

    // Step 4: the first copy.
    private var copying: some View {
        VStack(spacing: 22) {
            CopyDial(job: center.job, size: 190)
                .padding(.top, 10)
            VStack(spacing: 6) {
                Text(center.job?.stage ?? L("Pendrive zapisany"))
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .contentTransition(.opacity)
                if let job = center.job {
                    Text(L("\(PhotoFormat.grouped(job.done)) z \(PhotoFormat.grouped(job.total)) zdjęć · zapisano \(ByteText.amount(job.copiedBytes))"))
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .contentTransition(.numericText())
                    if let failure = job.failure {
                        Label(failure, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            }
            if center.copying {
                Text(L("Możesz zamknąć to okno. Kopia trwa, dopóki GalleryOS jest otwarte."))
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
            if let driveID, let drive = center.drives.first(where: { $0.id == driveID }), center.job?.finished == true || !mirror {
                NavigationLink {
                    DriveLibraryScreen(drive: drive)
                } label: {
                    Label(L("Otwórz bibliotekę USB"), systemImage: "photo.on.rectangle.angled")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 16))
                .tint(.orange)
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: center.job)
    }

    // MARK: Actions

    private func choose(_ url: URL) async {
        problem = nil
        go(.check)
        inspecting = true
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) else {
            problem = L("iOS nie pozwolił zapamiętać tego folderu. Wybierz go jeszcze raz.")
            inspecting = false
            return
        }
        bookmark = data
        let found = await center.inspect(url)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
            inspection = found
            inspecting = false
        }
        UINotificationFeedbackGenerator().notificationOccurred(found.writable ? .success : .error)
    }

    private func save() {
        guard let bookmark, let inspection else { return }
        let id = center.add(bookmark: bookmark, name: inspection.name, mirror: mirror, autoCopy: mirror && autoCopy)
        driveID = id
        go(.copy)
        if mirror { center.copy(id) }
    }

    private func go(_ next: Step) {
        withAnimation(.spring(response: 0.5, dampingFraction: 0.86)) { step = next }
    }

    private func warnings(_ inspection: DriveInspection) -> [String] {
        var list: [String] = []
        if !inspection.writable {
            list.append(L("Nie mogę tu zapisywać. Pendrive może być zablokowany albo tylko do odczytu."))
        }
        if let format = inspection.space?.format?.lowercased(), format.contains("fat"), !format.contains("exfat") {
            list.append(L("FAT32 nie przyjmie plików większych niż 4 GB (długie filmy). Lepszy będzie exFAT."))
        }
        if let space = inspection.space, space.free < needed {
            list.append(L("Zmieści się część biblioteki. Reszta dojdzie na większym pendrivie."))
        }
        return list
    }

    // MARK: Pieces

    private func benefit(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.orange)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
    }

    private func roleLabel(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.orange)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func primaryButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 16))
        .tint(.orange)
    }
}

/// The copy as a precision dial: a ring that fills with light, ticks around it, and a check that
/// draws itself when the copy is done.
struct CopyDial: View {
    let job: DriveJob?
    var size: CGFloat = 180
    @Environment(\.coreMotion) private var motion

    var body: some View {
        let fraction = job?.fraction ?? 0
        let done = job?.finished == true
        TimelineView(.animation(minimumInterval: 1 / 60, paused: done || job == nil || !motion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            ZStack {
                // Ticks.
                ForEach(0..<60, id: \.self) { tick in
                    let on = Double(tick) / 60 < fraction
                    Capsule()
                        .fill(on ? Color.orange : Color.primary.opacity(0.12))
                        .frame(width: 2, height: tick % 5 == 0 ? 9 : 5)
                        .offset(y: -size / 2 + 6)
                        .rotationEffect(.degrees(Double(tick) * 6))
                }
                Circle()
                    .stroke(Color.primary.opacity(0.08), lineWidth: 10)
                    .padding(22)
                Circle()
                    .trim(from: 0, to: done ? 1 : fraction)
                    .stroke(AngularGradient(colors: [.orange.opacity(0.5), .orange, Color(red: 1, green: 0.85, blue: 0.5)], center: .center),
                            style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(22)
                    .shadow(color: .orange.opacity(0.5), radius: 8)
                if !done, job != nil {
                    // A spark riding the end of the ring.
                    Circle()
                        .fill(.white)
                        .frame(width: 6, height: 6)
                        .shadow(color: .orange, radius: 6)
                        .offset(y: -(size / 2 - 22))
                        .rotationEffect(.degrees(fraction * 360))
                        .opacity(0.6 + 0.4 * sin(t * 6))
                }
                if done {
                    Image(systemName: "checkmark")
                        .font(.system(size: size * 0.24, weight: .bold))
                        .foregroundStyle(.orange)
                        .transition(.scale.combined(with: .opacity))
                } else {
                    VStack(spacing: 2) {
                        Text("\(Int((fraction * 100).rounded(.down)))%")
                            .font(.system(size: size * 0.2, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                            .contentTransition(.numericText(value: fraction))
                        Text(L("na pendrive"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(width: size, height: size)
        }
        .animation(.spring(response: 0.6, dampingFraction: 0.85), value: fraction)
        .animation(.spring(response: 0.5, dampingFraction: 0.7), value: done)
    }
}

// MARK: Hub

/// A pendrive that is already known: its state, its copy, its library and its settings.
struct DriveHub: View {
    var onAddAnother: () -> Void = {}
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var center = DriveCenter.shared
    @Environment(\.dismiss) private var dismiss
    @State private var chosenID: String?
    @State private var confirmForget = false

    private var drive: SpareDisk? {
        center.drives.first { $0.id == chosenID } ?? center.current
    }

    var body: some View {
        NavigationStack {
            List {
                if let drive {
                    let present = center.present.contains(drive.id)
                    let profile = center.profile(drive.id)
                    Section {
                        VStack(spacing: 14) {
                            DriveArt(lit: present, busy: center.copying, size: 150)
                            VStack(spacing: 4) {
                                Text(drive.name).font(.title3.weight(.bold))
                                HStack(spacing: 6) {
                                    PilotLight(color: present ? Color(red: 0.3, green: 0.92, blue: 0.48) : .orange, lit: present, breathing: center.copying, size: 7)
                                        .frame(width: 18, height: 18)
                                    Text(present ? L("Podłączony") : L("Odłączony – podłącz, żeby kopiować i przeglądać"))
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let space = center.spaces[drive.id], present {
                                SpaceGauge(space: space, needed: center.librarySize())
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    }
                    Section {
                        if let job = center.job, job.driveID == drive.id {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(job.stage).font(.subheadline.weight(.semibold))
                                    Spacer()
                                    Text("\(Int((job.fraction * 100).rounded(.down)))%")
                                        .font(.subheadline.weight(.semibold))
                                        .monospacedDigit()
                                        .foregroundStyle(.orange)
                                        .contentTransition(.numericText(value: job.fraction))
                                }
                                ProgressView(value: job.fraction).tint(.orange)
                                Text(L("\(PhotoFormat.grouped(job.done)) z \(PhotoFormat.grouped(job.total)) zdjęć · zapisano \(ByteText.amount(job.copiedBytes))"))
                                    .font(.caption)
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                                if let failure = job.failure {
                                    Text(failure).font(.caption).foregroundStyle(.orange)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        if center.copying {
                            Button(L("Zatrzymaj kopię"), systemImage: "stop.circle", role: .destructive) { center.cancel() }
                        } else {
                            Button {
                                center.copy(drive.id)
                            } label: {
                                Label(L("Uaktualnij kopię teraz"), systemImage: "arrow.down.to.line.compact")
                            }
                            .disabled(!present || !LibraryEngine.shared.serverReady)
                        }
                        NavigationLink {
                            DriveLibraryScreen(drive: drive)
                        } label: {
                            Label(L("Otwórz bibliotekę USB"), systemImage: "photo.on.rectangle.angled")
                        }
                        .disabled(!present)
                    } header: {
                        Text(L("Kopia"))
                    } footer: {
                        if let last = profile.lastCopy {
                            Text(L("Ostatnia kopia: \(last.formatted(date: .abbreviated, time: .shortened)) · \(PhotoFormat.grouped(profile.photos)) zdjęć · \(ByteText.amount(profile.bytes))"))
                        } else {
                            Text(L("Ten pendrive nie ma jeszcze kopii."))
                        }
                    }
                    Section {
                        Toggle(L("Kopia całej biblioteki"), isOn: Binding(
                            get: { center.profile(drive.id).mirror },
                            set: { value in
                                var next = center.profile(drive.id)
                                next.mirror = value
                                if !value { next.autoCopy = false }
                                center.update(next)
                            }
                        ))
                        Toggle(L("Sam po podłączeniu"), isOn: Binding(
                            get: { center.profile(drive.id).autoCopy },
                            set: { value in
                                var next = center.profile(drive.id)
                                next.autoCopy = value
                                center.update(next)
                            }
                        ))
                        .disabled(!profile.mirror)
                    } header: {
                        Text(L("Zachowanie"))
                    }
                    .tint(.orange)
                    if center.drives.count > 1 {
                        Section(L("Pendrive’y")) {
                            ForEach(center.drives) { item in
                                Button {
                                    withAnimation { chosenID = item.id }
                                } label: {
                                    HStack {
                                        Label(item.name, systemImage: "mediastick")
                                        Spacer()
                                        if item.id == drive.id { Image(systemName: "checkmark").foregroundStyle(.orange) }
                                    }
                                }
                            }
                        }
                    }
                    Section {
                        Button(L("Dodaj inny pendrive"), systemImage: "plus") { onAddAnother() }
                        Button(L("Zapomnij ten pendrive"), systemImage: "trash", role: .destructive) { confirmForget = true }
                    } footer: {
                        Text(L("Zapomnienie nie kasuje niczego na pendrivie. Kopia zostaje i można ją dodać z powrotem."))
                    }
                }
            }
            .navigationTitle(L("Pendrive"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(L("Gotowe")) { dismiss() }
                }
            }
            .confirmationDialog(L("Zapomnieć ten pendrive?"), isPresented: $confirmForget, titleVisibility: .visible) {
                Button(L("Zapomnij"), role: .destructive) {
                    if let drive { center.forget(drive.id) }
                    if center.drives.isEmpty { dismiss() }
                }
                Button(L("Anuluj"), role: .cancel) {}
            }
            .animation(.spring(response: 0.45, dampingFraction: 0.86), value: center.present)
        }
        .task { center.check() }
    }
}

// MARK: The library on the pendrive

/// The pendrive opened as a library: the same grid as the server, read straight from the stick.
struct DriveLibraryScreen: View {
    let drive: SpareDisk
    @StateObject private var session: DriveSession
    @State private var viewer: DriveViewerRequest?

    init(drive: SpareDisk) {
        self.drive = drive
        _session = StateObject(wrappedValue: DriveSession(drive: drive))
    }

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 2)]

    var body: some View {
        Group {
            if session.loading {
                ProgressView(L("Otwieram pendrive…"))
            } else if let failure = session.failure {
                ContentUnavailableView(L("Pendrive niedostępny"), systemImage: "mediastick", description: Text(failure))
            } else if session.assets.isEmpty {
                ContentUnavailableView(L("Pusto"), systemImage: "photo.on.rectangle",
                                       description: Text(L("Na tym pendrivie nie ma jeszcze biblioteki. Zrób kopię w GalleryOS™ Core.")))
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 2) {
                        ForEach(Array(session.assets.enumerated()), id: \.element.hash) { index, asset in
                            DriveTile(asset: asset, session: session)
                                .onTapGesture { viewer = DriveViewerRequest(start: index) }
                        }
                    }
                }
                .safeAreaInset(edge: .top) {
                    HStack(spacing: 8) {
                        Image(systemName: "mediastick").foregroundStyle(.orange)
                        Text(L("\(drive.name) · \(PhotoFormat.grouped(session.assets.count)) zdjęć"))
                            .font(.footnote.weight(.semibold))
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.bar)
                }
            }
        }
        .navigationTitle(L("Biblioteka USB"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await session.open() }
        .onDisappear { Task { await session.close() } }
        .fullScreenCover(item: $viewer) { request in
            DriveViewer(session: session, start: request.start)
        }
    }
}

private struct DriveViewerRequest: Identifiable {
    let id = UUID()
    let start: Int
}

private struct DriveTile: View {
    let asset: LibraryAsset
    @ObservedObject var session: DriveSession
    @State private var image: UIImage?

    var body: some View {
        Color(uiColor: .secondarySystemFill)
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                if let image {
                    Image(uiImage: image).resizable().scaledToFill().transition(.opacity)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if LibraryRules.isFilm(asset) {
                    Image(systemName: "play.fill")
                        .font(.caption2)
                        .foregroundStyle(.white)
                        .shadow(radius: 2)
                        .padding(5)
                }
            }
            .clipped()
            .contentShape(Rectangle())
            .task(id: asset.hash) {
                let loaded = await session.thumbnail(asset)
                withAnimation(.easeOut(duration: 0.2)) { image = loaded }
            }
    }
}

/// Photos and films from the pendrive, one at a time, swipe for the next.
private struct DriveViewer: View {
    @ObservedObject var session: DriveSession
    @Environment(\.dismiss) private var dismiss
    @State private var page: Int

    init(session: DriveSession, start: Int) {
        self.session = session
        _page = State(initialValue: start)
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            TabView(selection: $page) {
                ForEach(Array(session.assets.enumerated()), id: \.element.hash) { index, asset in
                    DrivePage(asset: asset, session: session, current: index == page)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 40, height: 40)
                        .galleryGlass(in: Circle())
                }
                .buttonStyle(.plain)
                Spacer()
                if session.assets.indices.contains(page) {
                    Text(session.assets[page].created.formatted(date: .abbreviated, time: .shortened))
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .galleryGlass(in: Capsule())
                }
                Spacer()
                Color.clear.frame(width: 40, height: 40)
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        }
        .preferredColorScheme(.dark)
    }
}

private struct DrivePage: View {
    let asset: LibraryAsset
    @ObservedObject var session: DriveSession
    let current: Bool
    @State private var image: UIImage?
    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            if LibraryRules.isFilm(asset) {
                if let player {
                    VideoPlayer(player: player)
                } else {
                    ProgressView().tint(.white)
                }
            } else {
                ZoomablePicture(image: image)
                    .overlay { if image == nil { ProgressView().tint(.white) } }
            }
        }
        .task(id: asset.hash) {
            if LibraryRules.isFilm(asset) {
                if let url = await session.film(asset) { player = AVPlayer(url: url) }
            } else {
                image = await session.thumbnail(asset)
                if let full = await session.picture(asset) { image = full }
            }
        }
        .onChange(of: current) { _, value in
            if !value { player?.pause() }
        }
    }
}
