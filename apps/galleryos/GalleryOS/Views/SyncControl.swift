import SwiftUI
import UniformTypeIdentifiers

enum SyncLight: Equatable {
    case off
    case working
    case waiting
    case partial
    case ok
    case error

    /// Pauses the user chose or cannot help (no network, Low Data Mode, a retry) are waiting, not errors.
    /// Red is kept for things that need a decision.
    private static func isSoftPause(_ detail: String) -> Bool {
        Localization.begins(detail, "Czeka na ładowanie", "Czeka na Wi-Fi", "Ponawiam · %@", "Brak sieci", "Oszczędzanie danych") // l10n:skip
    }

    /// A file the person sent by hand ("Wybrany plik…", "Wybrane · zostało 3").
    private static func isPicked(_ detail: String) -> Bool {
        detail == L("Wybrany plik") || detail == L("Wybrany plik jest na serwerze.")
            || Localization.begins(detail, "Wybrane · zostało %@") // l10n:skip
    }

    static func resolve(status: SyncStatus, uploads: Bool, connected: Bool, online: Bool, waiting: Int = 0) -> SyncLight {
        guard connected else { return .off }
        if !uploads {
            if status.busy && (isPicked(status.detail) || status.detail == L("Zatrzymuję kopię zapasową")) {
                return .working
            }
            if status.visible, status.title == L("Wstrzymano") {
                return isSoftPause(status.detail) ? .waiting : .error
            }
            if status.visible, status.title == L("Gotowe"), isPicked(status.detail) { return .ok }
            return .off
        }
        if status.busy { return .working }
        if status.visible, status.partial { return .partial }
        if status.visible, status.title == L("Wstrzymano") {
            return isSoftPause(status.detail) ? .waiting : .error
        }
        if !online { return .error }
        // "Wszystko aktualne" only when nothing is left; at launch the engine has not reported yet.
        return waiting > 0 ? .waiting : .ok
    }

    /// Deeper in the light appearance so text in these colours stays readable on white.
    var color: Color {
        switch self {
        case .off: Color.secondary
        case .working, .waiting, .partial:
            Color.dynamic(light: UIColor(red: 0.85, green: 0.55, blue: 0.0, alpha: 1), dark: UIColor(red: 1.0, green: 0.78, blue: 0.16, alpha: 1))
        case .ok:
            Color.dynamic(light: UIColor(red: 0.12, green: 0.62, blue: 0.29, alpha: 1), dark: UIColor(red: 0.2, green: 0.84, blue: 0.42, alpha: 1))
        case .error: Color(uiColor: .systemRed)
        }
    }

    var headline: String {
        switch self {
        case .off: L("Kopia zapasowa wyłączona")
        case .working: L("Synchronizuję")
        case .waiting: L("Czekam")
        case .partial: L("Zostało kilka zdjęć")
        case .ok: L("Wszystko aktualne")
        case .error: L("Wymaga uwagi")
        }
    }

    var symbol: String {
        switch self {
        case .ok: "checkmark"
        case .partial: "exclamationmark"
        case .error: "exclamationmark"
        case .waiting: "pause.fill"
        case .off: "moon.zzz.fill"
        case .working: "arrow.triangle.2.circlepath"
        }
    }
}

/// Sync state for the navigation bar: a fine ring with a gradient that fills with progress,
/// a small symbol at its heart and, next to it, the one number that matters right now:
/// the percentage while sending, or how many photos are still waiting.
struct SyncGlyph: View {
    let light: SyncLight
    var progress: Double?
    var waiting: Int = 0

    private var ring: Double {
        switch light {
        case .working: return min(1, max(0, progress ?? 0))
        case .ok, .partial, .error: return 1
        case .waiting: return 0
        case .off: return 0
        }
    }

    private var centre: String {
        switch light {
        case .working: return "arrow.up"
        case .ok: return "checkmark"
        case .waiting: return "pause.fill"
        case .partial, .error: return "exclamationmark"
        case .off: return "moon.fill"
        }
    }

    private var label: String? {
        switch light {
        case .working:
            guard let progress else { return nil }
            return "\(Int((progress * 100).rounded()))%"
        case .waiting, .partial:
            return waiting > 0 ? PhotoFormat.grouped(waiting) : nil
        default:
            return nil
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            ZStack {
                JewelDisc(tint: light == .off ? Color.secondary : light.color)
                Circle()
                    .stroke(light.color.opacity(light == .off ? 0.22 : 0.2), lineWidth: 1.6)
                Circle()
                    .trim(from: 0, to: ring)
                    .stroke(
                        AngularGradient(
                            colors: [light.color.opacity(0.45), light.color],
                            center: .center,
                            startAngle: .degrees(0),
                            endAngle: .degrees(360 * max(ring, 0.01))
                        ),
                        style: StrokeStyle(lineWidth: 2, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.smooth(duration: 0.5), value: ring)
                if light == .working, progress == nil {
                    // Starting or between files: a short arc circles calmly instead of a blinking arrow.
                    Circle()
                        .trim(from: 0, to: 0.26)
                        .stroke(light.color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                        .modifier(Revolving(period: 1.15))
                        .transition(.opacity)
                }
                Image(systemName: centre)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(light.color)
                    .contentTransition(.symbolEffect(.replace))
                    // One soft bounce when everything is in place, like the system's own ticks.
                    .symbolEffect(.bounce.down, value: light == .ok)
            }
            .frame(width: 23, height: 23)
            .shadow(color: light == .off ? .clear : light.color.opacity(light == .working ? 0.45 : 0.25), radius: 3)
            if let label {
                Text(label)
                    .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.primary.opacity(0.88))
                    .contentTransition(.numericText(value: progress ?? Double(waiting)))
                    .transition(.opacity.combined(with: .scale(scale: 0.85, anchor: .leading)))
            }
        }
        .animation(GalleryTheme.snappy, value: light)
        .animation(.smooth(duration: 0.35), value: label)
        .padding(.horizontal, 2)
        .frame(minHeight: 28)
        .contentShape(Rectangle())
    }
}

/// Turns a view continuously from the clock, without an implicit animation: nothing around it
/// (the navigation bar) is ever animated along with it.
private struct Revolving: ViewModifier {
    let period: Double

    func body(content: Content) -> some View {
        TimelineView(.animation) { context in
            let turn = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: period) / period
            content.rotationEffect(.degrees(turn * 360))
        }
    }
}

/// Toolbar label. The only part of a screen that redraws on progress ticks.
private struct SyncToolbarLabel: View {
    @EnvironmentObject private var library: PhotoLibrary
    @ObservedObject private var feed = SyncFeed.shared
    @ObservedObject private var servers = SavedServerStore.shared
    @ObservedObject private var link = ServerLink.shared
    @AppStorage("galleryos.sync.enabled") private var uploads = true

    var body: some View {
        let light = SyncLight.resolve(
            status: feed.status,
            uploads: uploads,
            connected: library.destinationConnected,
            online: servers.online != nil,
            waiting: feed.counts.waiting
        )
        HStack(spacing: 7) {
            if library.destinationConnected {
                RouteGlyph(phase: link.phase)
                    .transition(.scale.combined(with: .opacity))
            }
            SyncGlyph(
                light: light,
                progress: feed.status.busy ? feed.status.progress : nil,
                waiting: feed.counts.waiting
            )
        }
        .animation(GalleryTheme.snappy, value: library.destinationConnected)
        .sensoryFeedback(trigger: light) { old, new in
            // Only a real finish clicks. Flipping through "almost done" was clicking on every lap.
            if old == .working, new == .ok { return .success }
            if old != .error, new == .error { return .warning }
            return nil
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L("Synchronizacja: \(light.headline), \(link.route.title)"))
    }
}

/// Toolbar button + droplet-to-panel zoom. Attach to any screen inside a NavigationStack.
struct SyncControl: ViewModifier {
    var hidden = false
    @EnvironmentObject private var library: PhotoLibrary
    @Namespace private var droplet
    @State private var open = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                if !hidden {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                            open = true
                        } label: {
                            SyncToolbarLabel()
                        }
                        .modifier(SyncDropletSource(namespace: droplet))
                    }
                }
            }
            .sheet(isPresented: $open) {
                SyncPanel()
                    .environmentObject(library)
                    .modifier(SyncDropletZoom(namespace: droplet))
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
                    .presentationCornerRadius(34)
            }
    }
}

private struct SyncDropletSource: ViewModifier {
    var namespace: Namespace.ID
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.matchedTransitionSource(id: "sync.droplet", in: namespace)
        } else {
            content
        }
    }
}

private struct SyncDropletZoom: ViewModifier {
    var namespace: Namespace.ID
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.navigationTransition(.zoom(sourceID: "sync.droplet", in: namespace))
        } else {
            content
        }
    }
}

extension View {
    func syncControl(hidden: Bool = false) -> some View {
        modifier(SyncControl(hidden: hidden))
    }
}

/// Mission control for the library: the live flow between devices, instruments, the file ledger
/// and an assistant that suggests the next step. Every node of the flow opens its own controls.
struct SyncPanel: View {
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var feed = SyncFeed.shared
    @ObservedObject private var servers = SavedServerStore.shared
    @ObservedObject private var repair = GalleryRepair.shared
    @ObservedObject private var disks = SpareDisks.shared
    @ObservedObject private var link = ServerLink.shared
    @ObservedObject private var membership = GalleryMembership.shared
    @StateObject private var telemetry = SyncTelemetry()
    @State private var pickingDisk = false
    @State private var showCatalog = false
    @State private var catalogLabel = ""
    @AppStorage("galleryos.sync.enabled") private var uploads = true
    @AppStorage("galleryos.sync.wifiOnly") private var wifiOnly = false
    @AppStorage("galleryos.sync.chargingOnly") private var chargingOnly = false
    @AppStorage("galleryos.sync.keepUnlocked") private var keepUnlocked = true
    @AppStorage(CloudServerShare.enabledKey) private var tvShare = true
    @AppStorage("galleryos.link.mode") private var linkMode = LinkMode.auto.rawValue
    @AppStorage(GalleryOwner.nameKey) private var ownerName = ""
    @AppStorage(TrashRetention.key) private var trashDays = 30
    @State private var trashBytes: Int64 = 0
    @State private var freeSpace: String?
    @State private var ledger = LibraryLedger()
    @State private var showGuide = false
    @State private var showPlace = false
    @State private var showPlans = false
    @State private var showAppleTV = false
    @State private var node: ConsoleNode?
    @State private var confirmRemoveSynced = false
    @State private var removeResult = ""

    @State private var steadyLight: SyncLight?

    private var status: SyncStatus { feed.status }

    /// What the console shows: the engine's light, held steady for a moment so a short
    /// "ready" between two files does not make the whole header blink.
    private var light: SyncLight { steadyLight ?? liveLight }

    private var liveLight: SyncLight {
        SyncLight.resolve(
            status: status,
            uploads: uploads,
            connected: library.destinationConnected,
            online: servers.online != nil,
            waiting: feed.counts.waiting
        )
    }

    private var settings: DestinationSettings { DestinationSettings.load() }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    console
                    instruments
                    IntelligenceConsole()
                    assistant
                    ledgerCard
                    backupCard
                    accountCard
                    toolsCard
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 30)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(ConsoleBackdrop().ignoresSafeArea())
            .navigationTitle(L("GalleryOS™ Core"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(L("Gotowe")) { dismiss() }
                }
            }
            .task {
                if ownerName.isEmpty, !ShareAccount.shared.profileName.isEmpty {
                    ownerName = ShareAccount.shared.profileName
                }
                trashBytes = LibraryEngine.shared.trashBytes()
                LibraryEngine.shared.publishCounts()
                ledger = LibraryEngine.shared.ledger()
                catalogLabel = LibraryEngine.shared.serverShareName()
                freeSpace = await library.freeSpaceText()
            }
            .task(id: feed.counts.sent) { ledger = LibraryEngine.shared.ledger() }
            .fileImporter(isPresented: $pickingDisk, allowedContentTypes: [.folder]) { result in
                guard case .success(let url) = result else { return }
                guard url.startAccessingSecurityScopedResource() else { return }
                defer { url.stopAccessingSecurityScopedResource() }
                guard let data = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) else { return }
                _ = disks.add(data: data, name: url.lastPathComponent)
            }
            .sheet(item: $node) { item in
                nodeSheet(item)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showCatalog, onDismiss: {
                catalogLabel = LibraryEngine.shared.serverShareName()
            }) {
                ServerCatalogSheet()
                    .environmentObject(library)
            }
            .sheet(isPresented: $showPlace) {
                LibraryPlaceSheet()
                    .environmentObject(library)
            }
            .sheet(isPresented: $showPlans) {
                MembershipGate(closable: true)
            }
            .sheet(isPresented: $showAppleTV) {
                AppleTVPairingSheet()
            }
            .fullScreenCover(isPresented: $showGuide) {
                SetupGuideView()
                    .environmentObject(library)
            }
            .confirmationDialog(L("Usunąć z \(ThisDevice.genitive) zdjęcia, które są już na serwerze?"), isPresented: $confirmRemoveSynced, titleVisibility: .visible) {
                Button(L("Usuń kopie z \(ThisDevice.genitive)"), role: .destructive) {
                    Task { removeResult = await library.removeSyncedCopies() }
                }
                Button(L("Anuluj"), role: .cancel) {}
            } message: {
                Text(L("Najpierw sprawdzę oryginał na serwerze. Kasuję tylko potwierdzone. Na serwerze zostają, a z \(ThisDevice.genitive) trafiają do Ostatnio usuniętych na 30 dni."))
            }
            .alert(L("Zdjęcia"), isPresented: Binding(get: { !removeResult.isEmpty }, set: { if !$0 { removeResult = "" } })) {
                Button(L("Dobrze")) { removeResult = "" }
            } message: {
                Text(removeResult)
            }
            .animation(GalleryTheme.snappy, value: light)
            .task(id: liveLight) {
                let next = liveLight
                guard next != steadyLight else { return }
                // Starting work shows at once; settling back waits until it is really over.
                let delay: Double = next == .working ? 0.3 : 1.6
                if steadyLight != nil { try? await Task.sleep(for: .seconds(delay)) }
                guard !Task.isCancelled else { return }
                steadyLight = next
            }
        }
    }

    // MARK: Console

    private var flowState: FlowState {
        guard library.destinationConnected else { return .offline }
        if let operation = feed.operation {
            switch operation.kind {
            case .checking: return .verifying
            case .deleting: return .deleting
            case .sealing: return .sending
            case .done, .failed: break
            }
        }
        switch link.phase {
        case .connecting: return .searching
        case .unreachable, .offline: return .fault
        case .idle: return .idle
        case .connected:
            if light == .working { return disks.targetID == "server" ? .sending : .writingDisk }
            return .idle
        }
    }

    private var console: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 7) {
                        StatusLED(color: light.color, blinking: light == .working || flowState == .searching)
                        Text(statusCode)
                            .font(.system(size: 12, weight: .semibold))
                            .tracking(0.6)
                            .foregroundStyle(light.color)
                            .contentTransition(.opacity)
                    }
                    Text(headline)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .contentTransition(.opacity)
                }
                Spacer(minLength: 8)
                if light == .working, let progress = status.progress {
                    Text("\(Int((progress * 100).rounded()))%")
                        .font(.system(size: 30, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(light.color)
                        .contentTransition(.numericText(value: progress))
                        .transition(.opacity.combined(with: .scale(scale: 0.8, anchor: .trailing)))
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 16)

            FlowConsole(
                state: flowState,
                route: link.route,
                deviceValue: deviceValue,
                gatewayTitle: gatewayTitle,
                gatewayValue: gatewayValue,
                serverTitle: servers.online?.title ?? servers.servers.first?.title ?? L("Serwer"),
                serverValue: serverValue,
                tvOn: tvShare && library.destinationConnected,
                diskName: disks.disks.first(where: { $0.id == disks.targetID })?.name ?? disks.disks.first?.name,
                diskChosen: disks.targetID != "server",
                rate: telemetry.rate,
                onTap: { item in
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                    node = item
                }
            )
            .frame(height: 248)

            ConsoleProgress(progress: light == .working ? status.progress : (light == .ok ? 1 : nil), tint: light.color)
                .padding(.horizontal, 18)
            // One fixed slot: the backup detail, or a separate job (freeing space) with its own
            // gauge. Swapping them never changes the height of the console.
            ZStack {
                if let operation = feed.operation {
                    OperationStrip(operation: operation)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                } else {
                    Text(detailLine)
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .contentTransition(.opacity)
                        .transition(.opacity)
                }
            }
            .frame(height: 44)
            .padding(.horizontal, 18)
            .padding(.top, 6)
            .padding(.bottom, 10)
            .animation(.easeInOut(duration: 0.3), value: feed.operation)
            .animation(.easeInOut(duration: 0.25), value: detailLine)
        }
        .background(ConsoleSurface(tint: light.color))
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .coreCard(radius: 26)
    }

    private var statusCode: String {
        switch flowState {
        case .sending: return L("TRANSMISJA")
        case .writingDisk: return L("ZAPIS NA PENDRIVE")
        case .verifying: return L("WERYFIKACJA KOPII")
        case .deleting: return L("ZWALNIANIE MIEJSCA")
        case .searching: return L("WYSZUKIWANIE TRASY")
        case .fault: return L("BRAK ŁĄCZNOŚCI")
        case .offline: return L("BRAK SERWERA")
        case .idle: return light == .ok ? L("SYSTEM SPRAWNY") : (uploads ? L("W GOTOWOŚCI") : L("KOPIA WSTRZYMANA"))
        }
    }

    private var headline: String {
        if !library.destinationConnected { return L("Połącz serwer") }
        if !uploads && light == .working { return L("Wysyłam na serwer") }
        return light.headline
    }

    private var detailLine: String {
        if !status.detail.isEmpty, status.visible {
            return status.title.isEmpty ? status.detail : "\(status.title) · \(status.detail)"
        }
        switch light {
        case .off: return library.destinationConnected ? L("Kopia wyłączona. Chmurka przy zdjęciu wysyła tylko ten plik.") : L("Stuknij serwer na schemacie albo uruchom kreator.")
        case .ok: return L("Każde zdjęcie z tego \(ThisDevice.genitive) ma kopię na serwerze.")
        default: return " "
        }
    }

    private var deviceValue: String {
        if let operation = feed.operation, operation.kind == .checking || operation.kind == .deleting {
            return operation.kind == .deleting ? L("usuwam…") : (operation.progress.map { "\(Int(($0 * 100).rounded()))%" } ?? L("sprawdzam"))
        }
        return PhotoFormat.grouped(ledger.deviceTotal)
    }

    private var gatewayTitle: String {
        switch link.route {
        case .home: return L("Dom")
        case .remote: return L("Internet")
        case .none: return flowState == .searching ? L("Szukam") : L("Trasa")
        }
    }

    private var gatewayValue: String {
        let probe = link.route == .remote ? link.remote : link.home
        if let millis = probe.millis { return "\(millis) ms" }
        return link.network.title
    }

    private var serverValue: String {
        if let freeSpace, freeSpace != "—" { return L("\(freeSpace) wolne") }
        if ledger.serverBytes > 0 { return ByteText.amount(ledger.serverBytes) }
        return library.destinationConnected ? "—" : L("dodaj")
    }

    // MARK: Instruments

    private var instruments: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            Instrument(label: L("PRZEPŁYW"), value: telemetry.rateText, unit: telemetry.rateUnit, tint: Color(red: 0.36, green: 0.82, blue: 1.0)) {
                Sparkline(samples: telemetry.samples, tint: Color(red: 0.36, green: 0.82, blue: 1.0))
            }
            Instrument(label: L("OPÓŹNIENIE"), value: latencyText, unit: "ms", tint: link.route == .remote ? LinkRoute.remote.tint : LinkRoute.home.tint) {
                LatencyBars(home: link.home, remote: link.remote, route: link.route)
            }
            Instrument(label: L("NA SERWERZE"), value: PhotoFormat.grouped(ledger.serverTotal), unit: ledger.serverBytes > 0 ? ByteText.amount(ledger.serverBytes) : "", tint: GalleryTheme.accent) {
                FillBar(fraction: ledger.deviceTotal > 0 ? Double(ledger.deviceOnServer) / Double(max(ledger.deviceTotal, 1)) : 0, tint: GalleryTheme.accent, caption: L("\(ThisDevice.name): \(PhotoFormat.grouped(ledger.deviceOnServer)) z \(PhotoFormat.grouped(ledger.deviceTotal))"))
            }
            Instrument(label: L("W KOLEJCE"), value: PhotoFormat.grouped(feed.counts.waiting), unit: L("plików"), tint: SyncLight.waiting.color) {
                let sent = (UserDefaults.standard.object(forKey: "galleryos.bytes-sent") as? NSNumber)?.int64Value ?? 0
                Text(L("wysłano \(ByteText.amount(sent))"))
                    .font(.system(size: 12, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var latencyText: String {
        let probe = link.route == .remote ? link.remote : link.home
        if let millis = probe.millis ?? link.home.millis ?? link.remote.millis { return "\(millis)" }
        return "—"
    }

    // MARK: Assistant

    private struct Step: Identifiable {
        let id: String
        let symbol: String
        let tint: Color
        let title: String
        let detail: String
        let action: String
        let run: () -> Void
    }

    private var steps: [Step] {
        var list: [Step] = []
        let current = settings
        if !library.destinationConnected {
            list.append(Step(id: "connect", symbol: "externaldrive.badge.plus", tint: GalleryTheme.accent,
                             title: L("Połącz bibliotekę z serwerem"),
                             detail: L("Kreator znajdzie NAS w domu i przeprowadzi przez logowanie."),
                             action: L("Zacznij"), run: { showGuide = true }))
            return list
        }
        if case .unreachable(let message) = link.phase {
            list.append(Step(id: "fault", symbol: "exclamationmark.triangle.fill", tint: SyncLight.error.color,
                             title: L("Serwer nie odpowiada"), detail: message,
                             action: L("Sprawdź"), run: { Task { await link.probeAll() } }))
        }
        let trashedByOthers = LibraryEngine.shared.trashedByOthers()
        if !trashedByOthers.isEmpty {
            list.append(Step(id: "others-trash", symbol: "trash.circle.fill", tint: SyncLight.error.color,
                             title: L("Ktoś przeniósł do kosza Twoje zdjęcia: \(PhotoFormat.grouped(trashedByOthers.count))"),
                             detail: L("Są w Kolekcjach → Ostatnio usunięte. Usunąć je na zawsze możesz tylko Ty."),
                             action: L("Przywróć"), run: {
                                 library.restoreFromTrash(ids: trashedByOthers)
                                 ledger = LibraryEngine.shared.ledger()
                             }))
        }
        if ledger.devicePostponed > 0 {
            list.append(Step(id: "postponed", symbol: "arrow.clockwise.circle.fill", tint: SyncLight.waiting.color,
                             title: L("\(PhotoFormat.count(ledger.devicePostponed)) nie doszło"),
                             detail: L("Trzy próby się nie udały. Spróbuję jeszcze raz teraz."),
                             action: L("Ponów"), run: {
                                 LibraryEngine.shared.retryPostponed()
                                 ledger = LibraryEngine.shared.ledger()
                             }))
        }
        if !uploads {
            list.append(Step(id: "backup", symbol: "icloud.slash", tint: .orange,
                             title: L("Kopia zapasowa jest wyłączona"),
                             detail: L("Nowe zdjęcia nie trafiają same na serwer."),
                             action: L("Włącz"), run: {
                                 uploads = true
                                 LibraryEngine.shared.setUploadsEnabled(true)
                             }))
        }
        if current.kind == DestinationKind.webdav, current.localHost.isEmpty, link.network.isLocal {
            list.append(Step(id: "home", symbol: "house.and.flag.fill", tint: LinkRoute.home.tint,
                             title: L("Szybsza droga w domu"),
                             detail: L("Znajdę serwer w tej sieci, żeby kopia szła bez internetu."),
                             action: link.learning ? L("Szukam…") : L("Wykryj"), run: { link.learnHomeIfNeeded(force: true) }))
        }
        let remote = current.remoteHost.isEmpty ? (GalleryNetwork.isLocalHost(current.host) ? "" : current.host) : current.remoteHost
        if remote.isEmpty {
            list.append(Step(id: "remote", symbol: "globe", tint: LinkRoute.remote.tint,
                             title: L("Kopia także poza domem"),
                             detail: L("Ustaw adres DDNS serwera, a zdjęcia z wakacji trafią na NAS od razu."),
                             action: L("Ustaw"), run: { showGuide = true }))
        }
        if feed.sources.cloudOriginals > 0, link.network == .cellular {
            list.append(Step(id: "icloud", symbol: "icloud.and.arrow.down", tint: .blue,
                             title: L("\(PhotoFormat.count(feed.sources.cloudOriginals)) czeka na Wi-Fi"),
                             detail: L("Duże oryginały z iCloud pobiorę, gdy telefon złapie Wi-Fi."),
                             action: L("Dobrze"), run: {}))
        }
        if !membership.unlocked || !GalleryAccess.isLifetime {
            if GalleryAccess.showsTrialLine {
                list.append(Step(id: "plan", symbol: "crown.fill", tint: .yellow,
                                 title: GalleryAccess.statusLine,
                                 detail: L("Jeden zakup na stałe i spokój: iPhone, iPad i Apple TV."),
                                 action: L("Plany"), run: { showPlans = true }))
            }
        }
        return list
    }

    private var assistant: some View {
        ConsoleCard(title: L("ASYSTENT"), trailing: steps.isEmpty ? L("WSZYSTKO USTAWIONE") : L("\(steps.count) DO ZROBIENIA")) {
            VStack(spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    if index > 0 { Divider().padding(.leading, 46) }
                    HStack(spacing: 12) {
                        Image(systemName: step.symbol)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(step.tint)
                            .frame(width: 34, height: 34)
                            .background(step.tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .symbolEffect(.pulse, options: .repeating.speed(0.5), isActive: index == 0)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.title).font(.subheadline.weight(.semibold))
                            Text(step.detail).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 6)
                        Button(step.action) {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            step.run()
                        }
                        .font(.caption.weight(.bold))
                        .buttonStyle(.borderedProminent)
                        .tint(step.tint.opacity(0.85))
                        .controlSize(.small)
                    }
                    .padding(.vertical, 9)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
                if !steps.isEmpty { Divider().padding(.vertical, 2) }
                Button {
                    showGuide = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "wand.and.sparkles")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(
                                LinearGradient(colors: [Color(red: 0.55, green: 0.42, blue: 1.0), GalleryTheme.accent], startPoint: .topLeading, endPoint: .bottomTrailing),
                                in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                            )
                        VStack(alignment: .leading, spacing: 2) {
                            Text(L("Kreator połączenia")).font(.subheadline.weight(.semibold))
                            Text(L("Krok po kroku: serwer, dom, dostęp zdalny, Apple TV.")).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 6)
                        Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 9)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .animation(GalleryTheme.snappy, value: steps.map(\.id))
        }
    }

    // MARK: Ledger

    private var ledgerCard: some View {
        ConsoleCard(title: L("BILANS PLIKÓW"), trailing: L("GDZIE SĄ ZDJĘCIA")) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 7) {
                    LedgerHead(symbol: ThisDevice.symbol, title: ThisDevice.name, value: ledger.deviceTotal)
                    LedgerRow(title: L("na serwerze"), value: ledger.deviceOnServer, tint: SyncLight.ok.color)
                    LedgerRow(title: L("duplikaty (pominięte)"), value: ledger.deviceDuplicates, tint: .orange)
                    LedgerRow(title: L("czeka"), value: ledger.deviceWaiting, tint: SyncLight.waiting.color)
                    LedgerRow(title: L("nie doszło"), value: ledger.devicePostponed, tint: SyncLight.error.color)
                    LedgerRow(title: L("poza kolejką"), value: ledger.deviceOutside, tint: .secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Rectangle().fill(Color.primary.opacity(0.1)).frame(width: 1)
                VStack(alignment: .leading, spacing: 7) {
                    LedgerHead(symbol: "server.rack", title: L("Serwer"), value: ledger.serverTotal)
                    LedgerRow(title: L("z tego \(ThisDevice.genitive)"), value: ledger.serverFromHere, tint: GalleryTheme.accent)
                    LedgerRow(title: L("z innych urządzeń"), value: ledger.serverElsewhere, tint: .purple)
                    LedgerRow(title: library.hideScreenshots ? L("zrzuty (schowane)") : L("zrzuty ekranu"), value: ledger.serverScreenshots, tint: .secondary)
                    LedgerRow(title: L("Ukryte"), value: ledger.serverHidden, tint: .secondary)
                    LedgerRow(title: L("w koszu"), value: ledger.serverTrash, tint: .secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(ledgerNote)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
        }
    }

    private var ledgerNote: String {
        var parts: [String] = []
        parts.append(L("Widok „Serwer” pokazuje \(PhotoFormat.grouped(library.serverCounts.total))"))
        var minus: [String] = []
        if library.hideScreenshots, ledger.serverScreenshots > 0 { minus.append(L("\(PhotoFormat.grouped(ledger.serverScreenshots)) schowanych zrzutów")) }
        if ledger.serverFilmCopies > 0 { minus.append(L("\(PhotoFormat.grouped(ledger.serverFilmCopies)) drugich kopii tych samych filmów")) }
        if !minus.isEmpty { parts.append(L("czyli wszystko bez ") + minus.joined(separator: L(" i "))) }
        var line = parts.joined(separator: " – ") + "."
        if ledger.deviceDuplicates > 0 {
            line += L(" Duplikaty z \(ThisDevice.genitive) mają na serwerze jedną kopię.")
        }
        return line
    }

    // MARK: Backup and tools

    private var backupCard: some View {
        ConsoleCard(title: L("KOPIA ZAPASOWA"), trailing: uploads ? L("WŁĄCZONA") : L("WYŁĄCZONA")) {
            Toggle(isOn: Binding(
                get: { uploads },
                set: { value in
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                    withAnimation(GalleryTheme.snappy) {
                        uploads = value
                        LibraryEngine.shared.setUploadsEnabled(value)
                    }
                }
            )) {
                PanelLabel(L("Nowe zdjęcia same na serwer"), symbol: "icloud.and.arrow.up", tint: GalleryTheme.accent)
            }
            .tint(GalleryTheme.accent)
            Button { node = .device } label: {
                HStack(spacing: 8) {
                    ConditionChip(symbol: "wifi", text: wifiOnly ? L("tylko Wi-Fi") : L("każda sieć"), on: wifiOnly)
                    ConditionChip(symbol: "bolt.fill", text: chargingOnly ? L("przy ładowaniu") : L("zawsze"), on: chargingOnly)
                    ConditionChip(symbol: "lock.open.fill", text: keepUnlocked ? L("ekran włączony") : L("ekran gaśnie"), on: keepUnlocked)
                    Spacer(minLength: 0)
                    Image(systemName: "slider.horizontal.3").font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!uploads)
            .opacity(uploads ? 1 : 0.45)
        }
    }

    /// Your name next to the photos you send, and how long your deleted photos wait on the server.
    private var accountCard: some View {
        ConsoleCard(title: L("KONTO I KOSZ"), trailing: nil) {
            HStack(spacing: 12) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(Color.blue.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                TextField(L("Twoje imię przy zdjęciach"), text: $ownerName)
                    .textContentType(.name)
                    .submitLabel(.done)
            }
            Text(L("Inni użytkownicy tego serwera zobaczą je w informacjach o zdjęciach, które wyślesz."))
                .font(.caption)
                .foregroundStyle(.secondary)
            Divider().padding(.leading, 40)
            HStack {
                PanelLabel(L("Ostatnio usunięte na serwerze"), symbol: "trash.fill", tint: .red)
                Spacer(minLength: 8)
                Picker(L("Ostatnio usunięte na serwerze"), selection: $trashDays) {
                    Text(L("30 dni")).tag(30)
                    Text(L("90 dni")).tag(90)
                    Text(L("1 rok")).tag(365)
                    Text(L("Bez limitu")).tag(0)
                }
                .labelsHidden()
                .pickerStyle(.menu)
            }
            Text(trashNote)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var trashNote: String {
        let size = trashBytes > 0 ? L("Twoje usunięte zdjęcia zajmują \(ByteText.amount(trashBytes)). ") : ""
        if trashDays == 0 { return size + L("Czekają, aż usuniesz je ręcznie.") }
        return size + L("Po tym czasie znikają z dysku na zawsze.")
    }

    private var toolsCard: some View {
        ConsoleCard(title: L("NARZĘDZIA"), trailing: nil) {
            Button {
                UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                repair.start(library: library)
            } label: {
                ToolRow(title: repair.line ?? L("Sprawdź puste kadry"), symbol: "viewfinder", tint: .orange)
            }
            .buttonStyle(.plain)
            .disabled(repair.running)
            Divider().padding(.leading, 40)
            Button { showPlans = true } label: {
                ToolRow(title: L("Plan GalleryOS"), symbol: "crown.fill", tint: .yellow, detail: GalleryAccess.statusLine)
            }
            .buttonStyle(.plain)
            if library.destinationConnected {
                Divider().padding(.leading, 40)
                Button { confirmRemoveSynced = true } label: {
                    ToolRow(title: L("Zwolnij miejsce na \(ThisDevice.locative)"), symbol: ThisDevice.slashSymbol, tint: .red)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Node sheets

    @ViewBuilder
    private func nodeSheet(_ item: ConsoleNode) -> some View {
        NavigationStack {
            Form {
                switch item {
                case .device:
                    Section {
                        LabeledContent(L("Wszystkie pliki"), value: PhotoFormat.grouped(ledger.deviceTotal))
                        LabeledContent(L("Na serwerze"), value: PhotoFormat.grouped(ledger.deviceOnServer))
                        LabeledContent(L("Czeka"), value: PhotoFormat.grouped(ledger.deviceWaiting))
                        if ledger.devicePostponed > 0 {
                            LabeledContent(L("Nie doszło"), value: PhotoFormat.grouped(ledger.devicePostponed))
                        }
                    }
                    Section {
                        Toggle(L("Kopia zapasowa"), isOn: Binding(get: { uploads }, set: { value in
                            uploads = value
                            LibraryEngine.shared.setUploadsEnabled(value)
                        }))
                        Toggle(L("Tylko Wi-Fi"), isOn: $wifiOnly)
                        Toggle(L("Tylko podczas ładowania"), isOn: $chargingOnly)
                        Toggle(L("Ekran włączony do 100%"), isOn: Binding(get: { keepUnlocked }, set: { value in
                            keepUnlocked = value
                            LibraryEngine.shared.refreshHold()
                        }))
                    } header: {
                        Text(L("Kiedy wysyłać"))
                    }
                    .onChange(of: wifiOnly) { _, _ in LibraryEngine.shared.kick() }
                    .onChange(of: chargingOnly) { _, _ in LibraryEngine.shared.kick() }
                    if library.destinationConnected {
                        Section {
                            Button(L("Zwolnij miejsce na \(ThisDevice.locative)"), role: .destructive) {
                                node = nil
                                confirmRemoveSynced = true
                            }
                        }
                    }
                case .gateway:
                    Section {
                        RouteStrip()
                            .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
                        Picker(L("Trasa"), selection: Binding(
                            get: { linkMode },
                            set: { value in
                                UISelectionFeedbackGenerator().selectionChanged()
                                linkMode = value
                                ServerLink.shared.reset()
                                Task { _ = try? await LibraryEngine.shared.connect() }
                            }
                        )) {
                            Text(L("Automatycznie")).tag(LinkMode.auto.rawValue)
                            Text(L("Dom")).tag(LinkMode.home.rawValue)
                            Text(L("Zdalnie")).tag(LinkMode.remote.rawValue)
                        }
                        .pickerStyle(.segmented)
                    } footer: {
                        Text(L("Automatycznie: w domu sieć lokalna, poza domem internet (DDNS). Sieć: \(link.network.title)."))
                    }
                    Section {
                        Button(L("Sprawdź obie drogi"), systemImage: "bolt.horizontal") { Task { await link.probeAll() } }
                        if settings.kind == DestinationKind.webdav {
                            if settings.localHost.isEmpty {
                                Button(L("Wykryj serwer w domu"), systemImage: "dot.radiowaves.left.and.right") { link.learnHomeIfNeeded(force: true) }
                                    .disabled(!link.network.isLocal || link.learning)
                            } else {
                                Button(L("Zapomnij sieć domową"), systemImage: "house.slash", role: .destructive) { link.forgetHome() }
                            }
                        }
                    }
                case .server:
                    Section {
                        LabeledContent(L("Adres"), value: link.host.isEmpty ? (servers.online?.title ?? "—") : link.host)
                        LabeledContent(L("Wolne miejsce"), value: (freeSpace == nil || freeSpace == "—") ? L("serwer nie podaje") : (freeSpace ?? ""))
                        LabeledContent(L("GalleryOS zajmuje"), value: ByteText.amount(ledger.serverBytes))
                        LabeledContent(L("Pliki"), value: PhotoFormat.grouped(ledger.serverTotal))
                        Button {
                            node = nil
                            showCatalog = true
                        } label: {
                            LabeledContent(L("Folder na serwerze"), value: catalogLabel)
                        }
                    }
                    Section {
                        Button(L("Zmień serwer…"), systemImage: "externaldrive.badge.plus") {
                            node = nil
                            showPlace = true
                        }
                        Button(L("Kreator połączenia"), systemImage: "wand.and.sparkles") {
                            node = nil
                            showGuide = true
                        }
                    }
                case .tv:
                    Section {
                        AppleTVShareToggle()
                    } footer: {
                        Text(L("Apple TV z tym samym Apple ID łączy się samo. Wystarczy otworzyć GalleryOS na telewizorze."))
                    }
                    Section {
                        Button(L("Paruj kodem z telewizora"), systemImage: "qrcode") {
                            node = nil
                            showAppleTV = true
                        }
                    }
                case .disk:
                    Section {
                        Button {
                            disks.selectServer()
                        } label: {
                            HStack {
                                Label(L("Serwer"), systemImage: "server.rack")
                                Spacer()
                                if disks.targetID == "server" { Image(systemName: "checkmark").foregroundStyle(GalleryTheme.accent) }
                            }
                        }
                        ForEach(disks.disks) { disk in
                            Button {
                                disks.select(disk.id)
                            } label: {
                                HStack {
                                    Label(disk.name, systemImage: "mediastick")
                                    Spacer()
                                    if disks.targetID == disk.id { Image(systemName: "checkmark").foregroundStyle(.orange) }
                                }
                            }
                        }
                        Button(L("Dodaj pendrive lub dysk…"), systemImage: "plus") {
                            node = nil
                            pickingDisk = true
                        }
                    } header: {
                        Text(L("Kopia trafia na"))
                    } footer: {
                        Text(L("Pendrive lub dysk podłączony do \(ThisDevice.genitive) zapisuje te same oryginały co serwer."))
                    }
                }
            }
            .navigationTitle(item.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(L("Gotowe")) { node = nil }
                }
            }
        }
    }
}

// MARK: - Console pieces

enum ConsoleNode: String, Identifiable {
    case device, gateway, server, tv, disk
    var id: String { rawValue }

    var title: String {
        switch self {
        case .device: return ThisDevice.name
        case .gateway: return L("Trasa do serwera")
        case .server: return L("Serwer")
        case .tv: return L("Apple TV")
        case .disk: return L("Miejsce kopii")
        }
    }
}

enum FlowState: Equatable {
    case idle, sending, writingDisk, searching, fault, offline, verifying, deleting
}

/// A separate job with its own small gauge, under the backup status.
private struct OperationStrip: View {
    let operation: SyncOperation

    private var tint: Color {
        switch operation.kind {
        case .checking: return Color(red: 0.36, green: 0.82, blue: 1.0)
        case .deleting: return Color(red: 1.0, green: 0.45, blue: 0.4)
        case .sealing: return .green
        case .done: return SyncLight.ok.color
        case .failed: return SyncLight.error.color
        }
    }

    private var symbol: String {
        switch operation.kind {
        case .checking: return "checklist"
        case .deleting: return "trash"
        case .sealing: return "lock.rotation"
        case .done: return "checkmark.circle.fill"
        case .failed: return "exclamationmark.triangle.fill"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(0.14), in: Circle())
                .symbolEffect(.pulse, options: .repeating, isActive: operation.kind == .checking || operation.kind == .deleting)
                .contentTransition(.symbolEffect(.replace))
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(operation.title)
                        .font(.system(size: 12, weight: .semibold))
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(operation.detail)
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .contentTransition(.numericText())
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.primary.opacity(0.08))
                        if let progress = operation.progress {
                            Capsule()
                                .fill(tint)
                                .frame(width: proxy.size.width * CGFloat(min(max(progress, 0), 1)))
                                .animation(.smooth(duration: 0.35), value: progress)
                        } else {
                            // Indeterminate: a short bar slides while iOS works.
                            TimelineView(.animation) { context in
                                let t = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.4) / 1.4
                                Capsule()
                                    .fill(tint)
                                    .frame(width: proxy.size.width * 0.25)
                                    .offset(x: CGFloat(t) * proxy.size.width * 1.25 - proxy.size.width * 0.25)
                            }
                            .clipShape(Capsule())
                        }
                    }
                }
                .frame(height: 3)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(tint.opacity(0.08)))
    }
}

/// The grouped background of Settings: light grey by day, black at night.
private struct ConsoleBackdrop: View {
    var body: some View {
        Color(uiColor: .systemGroupedBackground)
    }
}

/// The flow card: the system's card colour with a soft glow of the current state behind the nodes.
private struct ConsoleSurface: View {
    let tint: Color
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            Color(uiColor: .secondarySystemGroupedBackground)
            RadialGradient(
                colors: [tint.opacity(scheme == .dark ? 0.16 : 0.08), .clear],
                center: UnitPoint(x: 0.5, y: 0.42),
                startRadius: 8,
                endRadius: 280
            )
            .animation(.easeInOut(duration: 0.6), value: tint)
        }
    }
}

/// One card style for the whole Core screen, in light and dark: the system card colour, a
/// hairline edge and, by day, a shadow so faint it only separates the card from the background.
struct CoreCard: ViewModifier {
    var radius: CGFloat = 22
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Color.primary.opacity(scheme == .dark ? 0.08 : 0.05), lineWidth: 0.75)
            )
            .shadow(color: .black.opacity(scheme == .dark ? 0 : 0.05), radius: 12, y: 4)
    }
}

extension View {
    func coreCard(radius: CGFloat = 22) -> some View {
        modifier(CoreCard(radius: radius))
    }
}

extension Color {
    /// A colour with its own value for the light and the dark appearance.
    static func dynamic(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in traits.userInterfaceStyle == .dark ? dark : light })
    }
}

private struct StatusLED: View {
    let color: Color
    let blinking: Bool
    @State private var dim = false

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 7, height: 7)
            .shadow(color: color.opacity(0.9), radius: 4)
            .opacity(blinking && dim ? 0.25 : 1)
            .onAppear { animate() }
            .onChange(of: blinking) { _, _ in animate() }
    }

    private func animate() {
        dim = false
        guard blinking else { return }
        withAnimation(.easeInOut(duration: 0.55).repeatForever(autoreverses: true)) { dim = true }
    }
}

/// Device ─ gateway ─ server, with a USB stick under the device and Apple TV under the server.
/// Packets travel the real direction of the data; each node opens its own controls.
private struct FlowConsole: View {
    let state: FlowState
    let route: LinkRoute
    let deviceValue: String
    let gatewayTitle: String
    let gatewayValue: String
    let serverTitle: String
    let serverValue: String
    let tvOn: Bool
    let diskName: String?
    let diskChosen: Bool
    let rate: Double
    let onTap: (ConsoleNode) -> Void

    private var routeTint: Color {
        switch state {
        case .fault: return SyncLight.error.color
        case .offline: return .secondary
        case .searching: return LinkRoute.none.tint
        default: return route == .none ? GalleryTheme.accent : route.tint
        }
    }

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height
            let device = CGPoint(x: w * 0.14, y: h * 0.36)
            let gateway = CGPoint(x: w * 0.5, y: h * 0.36)
            let server = CGPoint(x: w * 0.86, y: h * 0.36)
            let disk = CGPoint(x: w * 0.14, y: h * 0.82)
            let tv = CGPoint(x: w * 0.86, y: h * 0.82)
            ZStack {
                TimelineView(.animation(minimumInterval: 1 / 60, paused: state == .offline)) { context in
                    let time = context.date.timeIntervalSinceReferenceDate
                    Canvas { canvas, _ in
                        drawLink(canvas, from: device, to: gateway, tint: routeTint, solid: state != .offline && state != .fault)
                        drawLink(canvas, from: gateway, to: server, tint: routeTint, solid: state == .idle || state == .sending || state == .verifying || state == .deleting)
                        drawLink(canvas, from: device, to: disk, tint: .orange, solid: diskChosen)
                        drawLink(canvas, from: server, to: tv, tint: .secondary, solid: tvOn)
                        switch state {
                        case .sending:
                            // Faster flow at a higher measured rate; never frozen while a file is open.
                            let speed = 0.42 + min(rate / 8_000_000, 1) * 0.6
                            for index in 0..<4 {
                                let f = (time * speed + Double(index) / 4).truncatingRemainder(dividingBy: 1)
                                drawPacket(canvas, at: along([device, gateway, server], f), tint: routeTint, size: 5.5)
                            }
                        case .writingDisk:
                            for index in 0..<3 {
                                let f = (time * 0.7 + Double(index) / 3).truncatingRemainder(dividingBy: 1)
                                drawPacket(canvas, at: along([device, disk], f), tint: .orange, size: 5)
                            }
                        case .searching:
                            // A scout pulse runs out and back looking for a road.
                            let f = abs(sin(time * 1.6))
                            drawPacket(canvas, at: along([device, gateway], f), tint: routeTint, size: 4.5)
                        case .idle:
                            // Heartbeat: one quiet packet every few seconds proves the link is alive.
                            let f = (time / 3.2).truncatingRemainder(dividingBy: 1)
                            if f < 0.55 {
                                drawPacket(canvas, at: along([device, gateway, server], f / 0.55), tint: routeTint.opacity(0.75), size: 3.5)
                            }
                            if tvOn {
                                let g = (time / 4.5 + 0.3).truncatingRemainder(dividingBy: 1)
                                if g < 0.5 { drawPacket(canvas, at: along([server, tv], g / 0.5), tint: .secondary, size: 3) }
                            }
                        case .verifying:
                            // Confirmations come back from the server to the device.
                            for index in 0..<3 {
                                let f = (time * 0.55 + Double(index) / 3).truncatingRemainder(dividingBy: 1)
                                drawPacket(canvas, at: along([server, gateway, device], f), tint: Color(red: 0.36, green: 0.82, blue: 1.0), size: 4.5)
                            }
                        case .deleting, .fault, .offline:
                            break
                        }
                    }
                }
                ConsoleNodeView(symbol: state == .deleting ? "trash" : ThisDevice.symbol, title: ThisDevice.name, value: deviceValue, tint: state == .deleting ? Color(uiColor: .systemRed) : .primary, active: state != .offline, busy: state == .sending || state == .writingDisk || state == .deleting || state == .verifying)
                    .onTapGesture { onTap(.device) }
                    .position(device)
                ConsoleNodeView(symbol: gatewaySymbol, title: gatewayTitle, value: gatewayValue, tint: routeTint, active: state != .offline, busy: state == .searching, spinning: state == .searching)
                    .onTapGesture { onTap(.gateway) }
                    .position(gateway)
                ConsoleNodeView(symbol: "server.rack", title: serverTitle, value: serverValue, tint: state == .offline ? .secondary : GalleryTheme.accent, active: state == .idle || state == .sending || state == .verifying || state == .deleting, busy: state == .sending || state == .verifying)
                    .onTapGesture { onTap(.server) }
                    .position(server)
                ConsoleNodeView(symbol: "mediastick", title: diskName ?? L("Pendrive"), value: diskName == nil ? L("dodaj") : (diskChosen ? L("aktywny") : L("gotowy")), tint: .orange, active: diskChosen, busy: state == .writingDisk, small: true)
                    .onTapGesture { onTap(.disk) }
                    .position(disk)
                ConsoleNodeView(symbol: "appletv.fill", title: L("Apple TV"), value: tvOn ? L("połączone") : L("wyłączone"), tint: .primary, active: tvOn, busy: false, small: true)
                    .onTapGesture { onTap(.tv) }
                    .position(tv)
            }
        }
        .animation(GalleryTheme.snappy, value: state)
    }

    private var gatewaySymbol: String {
        switch state {
        case .searching: return "dot.radiowaves.left.and.right"
        case .fault: return "exclamationmark.triangle.fill"
        case .offline: return "point.3.connected.trianglepath.dotted"
        default: return route == .remote ? "globe.europe.africa.fill" : (route == .home ? "house.fill" : "point.3.connected.trianglepath.dotted")
        }
    }

    private func along(_ points: [CGPoint], _ fraction: Double) -> CGPoint {
        guard points.count > 1 else { return points.first ?? .zero }
        let segments = Double(points.count - 1)
        let scaled = min(max(fraction, 0), 0.9999) * segments
        let index = Int(scaled)
        let local = CGFloat(scaled - Double(index))
        let a = points[index], b = points[index + 1]
        return CGPoint(x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local)
    }

    private func drawLink(_ canvas: GraphicsContext, from a: CGPoint, to b: CGPoint, tint: Color, solid: Bool) {
        var path = Path()
        path.move(to: a)
        path.addLine(to: b)
        if solid {
            canvas.stroke(path, with: .color(tint.opacity(0.18)), style: StrokeStyle(lineWidth: 7, lineCap: .round))
            canvas.stroke(path, with: .linearGradient(Gradient(colors: [tint.opacity(0.35), tint.opacity(0.85), tint.opacity(0.35)]), startPoint: a, endPoint: b), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
        } else {
            canvas.stroke(path, with: .color(Color.primary.opacity(0.2)), style: StrokeStyle(lineWidth: 1.2, lineCap: .round, dash: [3, 6]))
        }
    }

    private func drawPacket(_ canvas: GraphicsContext, at point: CGPoint, tint: Color, size: CGFloat) {
        for (scale, opacity) in [(3.2, 0.12), (2.0, 0.28), (1.0, 1.0)] {
            let r = size * scale / 2
            canvas.fill(Path(ellipseIn: CGRect(x: point.x - r, y: point.y - r, width: r * 2, height: r * 2)), with: .color(tint.opacity(opacity)))
        }
        let core = size * 0.35
        canvas.fill(Path(ellipseIn: CGRect(x: point.x - core, y: point.y - core, width: core * 2, height: core * 2)), with: .color(.white))
    }
}

private struct ConsoleNodeView: View {
    let symbol: String
    let title: String
    let value: String
    let tint: Color
    let active: Bool
    let busy: Bool
    var spinning = false
    var small = false
    @State private var breathe = false
    @Environment(\.colorScheme) private var scheme

    private var disc: LinearGradient {
        scheme == .dark
            ? LinearGradient(colors: [Color(white: 0.2), Color(white: 0.08)], startPoint: .top, endPoint: .bottom)
            : LinearGradient(colors: [.white, Color(white: 0.94)], startPoint: .top, endPoint: .bottom)
    }

    private var size: CGFloat { small ? 44 : 58 }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(tint.opacity(active ? 0.16 : 0.05))
                    .scaleEffect(busy && breathe ? 1.28 : 1)
                    .opacity(busy && breathe ? 0 : 1)
                Circle()
                    .fill(disc)
                    .shadow(color: .black.opacity(scheme == .dark ? 0 : 0.1), radius: 3, y: 1)
                    .padding(4)
                Circle()
                    .strokeBorder(
                        AngularGradient(colors: [tint.opacity(active ? 0.9 : 0.25), tint.opacity(0.1), tint.opacity(active ? 0.9 : 0.25)], center: .center),
                        lineWidth: 1.4
                    )
                    .padding(4)
                    .rotationEffect(.degrees(spinning && breathe ? 360 : 0))
                Image(systemName: symbol)
                    .font(.system(size: small ? 15 : 19, weight: .semibold))
                    .foregroundStyle(active ? tint : .secondary)
                    .contentTransition(.symbolEffect(.replace))
                    .symbolEffect(.variableColor.iterative, options: .repeating, isActive: spinning)
                if busy {
                    Circle()
                        .fill(tint)
                        .frame(width: 5, height: 5)
                        .shadow(color: tint, radius: 3)
                        .opacity(breathe ? 1 : 0.2)
                        .offset(x: size * 0.3, y: -size * 0.3)
                }
            }
            .frame(width: size, height: size)
            VStack(spacing: 1) {
                Text(title)
                    .font(.system(size: small ? 10.5 : 11.5, weight: .semibold))
                    .lineLimit(1)
                    .frame(maxWidth: 110)
                Text(value)
                    .font(.system(size: 11, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(active ? tint.opacity(0.9) : .secondary)
                    .lineLimit(1)
                    .contentTransition(.numericText())
            }
        }
        .contentShape(Rectangle())
        .onAppear { animate() }
        .onChange(of: busy) { _, _ in animate() }
        .onChange(of: spinning) { _, _ in animate() }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    private func animate() {
        breathe = false
        guard busy || spinning else { return }
        withAnimation(.easeOut(duration: spinning ? 1.6 : 1.3).repeatForever(autoreverses: false)) { breathe = true }
    }
}

private struct ConsoleProgress: View {
    let progress: Double?
    let tint: Color

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.08))
                Capsule()
                    .fill(LinearGradient(colors: [tint.opacity(0.5), tint], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(0, proxy.size.width * CGFloat(progress ?? 0)))
                    .shadow(color: tint.opacity(0.4), radius: 3)
                    .animation(.smooth(duration: 0.5), value: progress)
            }
        }
        .frame(height: 4)
        .opacity(progress == nil ? 0.4 : 1)
    }
}

/// Bytes per second from the engine's sent counter, smoothed, with a short history.
@MainActor
final class SyncTelemetry: ObservableObject {
    @Published private(set) var rate: Double = 0
    @Published private(set) var samples: [Double] = Array(repeating: 0, count: 36)
    private var last: Int64?
    private var timer: Timer?

    init() {
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    deinit { timer?.invalidate() }

    private func tick() {
        let now = (UserDefaults.standard.object(forKey: "galleryos.bytes-sent") as? NSNumber)?.int64Value ?? 0
        defer { last = now }
        guard let last else { return }
        let delta = Double(max(0, now - last))
        rate = rate * 0.6 + delta * 0.4
        samples.removeFirst()
        samples.append(rate)
    }

    var rateText: String {
        if rate >= 1_000_000 { return String(format: "%.1f", rate / 1_000_000) }
        if rate >= 1_000 { return String(format: "%.0f", rate / 1_000) }
        return "0"
    }

    var rateUnit: String { rate >= 1_000_000 ? "MB/s" : "KB/s" }
}

private struct ConsoleCard<Content: View>: View {
    let title: String
    let trailing: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(.secondary)
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.system(size: 11, weight: .medium))
                        .tracking(0.4)
                        .foregroundStyle(.tertiary)
                        .contentTransition(.opacity)
                }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .coreCard()
    }
}

private struct Instrument<Graph: View>: View {
    let label: String
    let value: String
    let unit: String
    let tint: Color
    @ViewBuilder var graph: Graph

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Circle().fill(tint).frame(width: 5, height: 5).shadow(color: tint, radius: 2)
                Text(label)
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.4)
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 26, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                Text(unit)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            graph
                .frame(height: 22)
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .coreCard(radius: 18)
        .animation(.smooth(duration: 0.4), value: value)
    }
}

private struct Sparkline: View {
    let samples: [Double]
    let tint: Color

    var body: some View {
        Canvas { context, size in
            let peak = max(samples.max() ?? 0, 1)
            var line = Path()
            for (index, sample) in samples.enumerated() {
                let x = size.width * CGFloat(index) / CGFloat(max(samples.count - 1, 1))
                let y = size.height - size.height * CGFloat(sample / peak) * 0.9 - 1
                if index == 0 { line.move(to: CGPoint(x: x, y: y)) } else { line.addLine(to: CGPoint(x: x, y: y)) }
            }
            var area = line
            area.addLine(to: CGPoint(x: size.width, y: size.height))
            area.addLine(to: CGPoint(x: 0, y: size.height))
            area.closeSubpath()
            context.fill(area, with: .linearGradient(Gradient(colors: [tint.opacity(0.3), tint.opacity(0)]), startPoint: .zero, endPoint: CGPoint(x: 0, y: size.height)))
            context.stroke(line, with: .color(tint), style: StrokeStyle(lineWidth: 1.4, lineCap: .round, lineJoin: .round))
        }
        .animation(.linear(duration: 1), value: samples)
    }
}

private struct LatencyBars: View {
    let home: LinkProbe
    let remote: LinkProbe
    let route: LinkRoute

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            bar(L("DOM"), probe: home, tint: LinkRoute.home.tint, active: route == .home)
            bar("NET", probe: remote, tint: LinkRoute.remote.tint, active: route == .remote)
        }
    }

    private func bar(_ label: String, probe: LinkProbe, tint: Color, active: Bool) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(active ? tint : .secondary)
                .frame(width: 24, alignment: .leading)
            GeometryReader { proxy in
                let millis = Double(probe.millis ?? 0)
                let fraction = probe.reachable == false ? 1 : min(millis / 600, 1)
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule()
                        .fill(probe.reachable == false ? SyncLight.error.color : tint.opacity(active ? 1 : 0.5))
                        .frame(width: max(3, proxy.size.width * CGFloat(probe.millis == nil && probe.reachable != false ? 0 : fraction)))
                        .animation(.smooth(duration: 0.6), value: millis)
                }
            }
            .frame(height: 4)
        }
    }
}

private struct FillBar: View {
    let fraction: Double
    let tint: Color
    let caption: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule()
                        .fill(LinearGradient(colors: [tint.opacity(0.6), tint], startPoint: .leading, endPoint: .trailing))
                        .frame(width: proxy.size.width * CGFloat(min(max(fraction, 0), 1)))
                        .animation(.smooth(duration: 0.6), value: fraction)
                }
            }
            .frame(height: 4)
            Text(caption)
                .font(.system(size: 11, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

private struct LedgerHead: View {
    let symbol: String
    let title: String
    let value: Int

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: symbol).font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
            Text(title).font(.subheadline.weight(.semibold)).lineLimit(1)
            Spacer(minLength: 4)
            Text(PhotoFormat.grouped(value))
                .font(.system(.subheadline, design: .rounded).weight(.bold))
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .padding(.bottom, 2)
    }
}

private struct LedgerRow: View {
    let title: String
    let value: Int
    let tint: Color

    var body: some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 1.5).fill(tint).frame(width: 3, height: 11)
            Text(title).font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.85)
            Spacer(minLength: 4)
            Text(PhotoFormat.grouped(value))
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(value == 0 ? Color.secondary.opacity(0.6) : Color.primary)
                .contentTransition(.numericText())
        }
    }
}

private struct ConditionChip: View {
    let symbol: String
    let text: String
    let on: Bool

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: symbol).font(.system(size: 9, weight: .bold))
            Text(text).font(.system(size: 10.5, weight: .semibold)).lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .foregroundStyle(on ? GalleryTheme.accent : Color.secondary)
        .background(Capsule().fill(on ? GalleryTheme.accent.opacity(0.15) : Color.primary.opacity(0.06)))
    }
}

private struct ToolRow: View {
    let title: String
    let symbol: String
    let tint: Color
    var detail: String? = nil

    var body: some View {
        HStack {
            PanelLabel(title, symbol: symbol, tint: tint)
            Spacer(minLength: 8)
            if let detail {
                Text(detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }
}

private struct PanelCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .galleryGlass(in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct PanelLabel: View {
    let title: String
    let symbol: String
    let tint: Color

    init(_ title: String, symbol: String, tint: Color) {
        self.title = title
        self.symbol = symbol
        self.tint = tint
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(title)
                .multilineTextAlignment(.leading)
                .lineLimit(3)
        }
    }
}

private struct SourceLine: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 22)
            Text(title)
                .font(.subheadline)
            Spacer(minLength: 8)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct StatTile: View {
    let value: String
    let label: String
    let symbol: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(tint)
            Text(value)
                .font(.system(.title3, design: .rounded).weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .galleryGlass(in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

struct ServerCatalogSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var share = ""
    @State private var shares: [String] = []
    @State private var path: [String] = []
    @State private var entries: [WebEntry] = []
    @State private var note = ""
    @State private var busy = false
    /// Moving the library to another share is a big step; it waits for a yes.
    @State private var pendingShare: String?

    private var folder: String { path.joined(separator: "/") }

    var body: some View {
        NavigationStack {
            List {
                Section(L("Udział na serwerze")) {
                    if shares.isEmpty, busy {
                        ProgressView()
                    }
                    ForEach(shares, id: \.self) { item in
                        Button {
                            if item.caseInsensitiveCompare(share) == .orderedSame {
                                choose(item)
                            } else {
                                pendingShare = item
                            }
                        } label: {
                            HStack {
                                Label(item, systemImage: "externaldrive.fill")
                                Spacer()
                                if item.caseInsensitiveCompare(share) == .orderedSame {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(GalleryTheme.accent)
                                }
                            }
                        }
                        .disabled(busy)
                    }
                }
                Section(folder.isEmpty ? share : folder) {
                    if path.isEmpty == false {
                        Button {
                            path.removeLast()
                            Task { await loadFolder() }
                        } label: {
                            Label(L("W górę"), systemImage: "arrow.up")
                        }
                    }
                    if !note.isEmpty {
                        // Errors show even when the folder still lists files from before.
                        Label(note, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                            .font(.subheadline)
                    } else if entries.isEmpty, !busy {
                        Text(L("Ten folder jest pusty."))
                            .foregroundStyle(.secondary)
                    }
                    ForEach(entries) { entry in
                        if entry.isDirectory {
                            Button {
                                path.append(entry.name)
                                Task { await loadFolder() }
                            } label: {
                                Label(entry.name, systemImage: "folder")
                            }
                        } else {
                            Label(entry.name, systemImage: "doc")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle(share.isEmpty ? L("Katalog") : share)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Zamknij")) { dismiss() }
                }
            }
            .overlay {
                if busy { ProgressView().controlSize(.large) }
            }
            .confirmationDialog(
                L("Przenieść bibliotekę do „\(pendingShare ?? "")”?"),
                isPresented: Binding(get: { pendingShare != nil }, set: { if !$0 { pendingShare = nil } }),
                titleVisibility: .visible
            ) {
                Button(L("Przenieś bibliotekę")) {
                    if let name = pendingShare { choose(name) }
                    pendingShare = nil
                }
                Button(L("Anuluj"), role: .cancel) { pendingShare = nil }
            } message: {
                Text(L("GalleryOS będzie zapisywać i czytać zdjęcia z tego udziału. Pliki w obecnym udziale zostają."))
            }
            .task { await open() }
        }
        .presentationDetents([.medium, .large])
    }

    private func open() async {
        share = LibraryEngine.shared.serverShareName()
        busy = true
        shares = await LibraryEngine.shared.serverShares()
        if shares.isEmpty { shares = [share] }
        await loadFolder()
    }

    private func loadFolder() async {
        busy = true
        note = ""
        let found = await LibraryEngine.shared.serverChildren(folder)
        entries = found
        if found.isEmpty { note = "" }
        busy = false
    }

    private func choose(_ name: String) {
        guard name.caseInsensitiveCompare(share) != .orderedSame else {
            path = []
            Task { await loadFolder() }
            return
        }
        busy = true
        Task {
            if let problem = await LibraryEngine.shared.switchShare(to: name) {
                note = problem
                busy = false
                return
            }
            share = name
            path = []
            shares = await LibraryEngine.shared.serverShares()
            if !shares.contains(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) {
                shares.insert(name, at: 0)
            }
            await loadFolder()
        }
    }
}
