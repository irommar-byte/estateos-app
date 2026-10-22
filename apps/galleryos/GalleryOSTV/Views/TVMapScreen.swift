import MapKit
import SwiftUI

extension TVPlace {
    var title: String { name ?? TVFormat.coordinate(latitude, longitude) }
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

/// Photos by place. The list on the left flies the satellite map to the focused place.
/// Play steps onto that place's pin. From there every direction stays on the map and pans to
/// the next place, and Menu returns to the list. Pins stay on their coordinates.
///
/// The map itself stays non-interactive (an interactive MKMapView swallows the remote's swipes).
/// One focus target covers the map, so a swipe can never climb into the tab bar.
struct TVMapScreen: View {
    @EnvironmentObject private var library: TVLibrary
    @EnvironmentObject private var pipeline: TVImagePipeline
    @EnvironmentObject private var placeFeed: TVPlaceFeed
    @Environment(\.tvTabLock) private var tabLock

    @State private var places: [TVPlace] = []
    @State private var loaded = false
    @State private var shownID: String?
    @State private var flight = 0
    @State private var mapLoading = false
    @State private var path: [TVPlace] = []
    @State private var pinMode = false
    /// Place whose pin is selected while the remote is walking the map.
    @State private var pinAnchor: String?
    @FocusState private var focused: String?

    private static let overviewID = "#all"
    /// One focus target for the whole map, so a swipe can never leave for the tab bar.
    private static let pinToken = "#pins"
    private static let pinLimit = 150

    private var pinFocus: TVPlace? {
        guard pinMode, let pinAnchor else { return nil }
        return places.first { $0.id == pinAnchor }
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack(alignment: .topLeading) {
                map
                    .ignoresSafeArea()
                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.88), location: 0),
                        .init(color: .black.opacity(0.62), location: 0.34),
                        .init(color: .clear, location: 0.62)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .ignoresSafeArea()
                .allowsHitTesting(false)
                panel
                pinLayer
                    .ignoresSafeArea()
            }
            .overlay(alignment: .bottomTrailing) {
                if let pinFocus {
                    TVPinCard(place: pinFocus)
                        .padding(.trailing, 70)
                        .padding(.bottom, 60)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .overlay(alignment: .topTrailing) {
                if mapLoading {
                    HStack(spacing: 12) {
                        ProgressView()
                        Text(L("Wczytuję mapę…"))
                            .font(.system(size: 22, weight: .semibold))
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .galleryGlass(in: Capsule())
                    .padding(.trailing, 70)
                    .padding(.top, 20)
                    .transition(.opacity)
                }
            }
            .animation(TVTheme.spring, value: pinFocus?.id)
            .animation(.easeInOut(duration: 0.3), value: mapLoading)
            .onPlayPauseCommand {
                guard path.isEmpty else { return }
                enterPins()
            }
            .onChange(of: focused) { _, value in
                // A direction must not be able to hand focus to the tab bar.
                if pinMode, path.isEmpty, value != Self.pinToken {
                    focused = Self.pinToken
                }
            }
            .onChange(of: pinMode) { _, on in
                tabLock.wrappedValue = on && path.isEmpty
            }
            .onChange(of: path) { _, path in
                tabLock.wrappedValue = pinMode && path.isEmpty
            }
            .onDisappear { tabLock.wrappedValue = false }
            .navigationDestination(for: TVPlace.self) { place in
                TVSectionsGrid(sections: TVSectionMaker.months(place.photos, prefix: place.id)) {
                    TVScreenHeader(
                        title: place.title,
                        subtitle: "\(PhotoFormat.count(place.photos.count)) · \(TVFormat.span(place.photos.last?.created ?? .now, place.photos.first?.created ?? .now))"
                    )
                }
            }
        }
        .task(id: "\(library.photoCount)#\(placeFeed.revision)") {
            let fresh = await library.places()
            guard !Task.isCancelled else { return }
            withAnimation(TVTheme.spring) {
                places = fresh
                loaded = true
            }
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-TVMapFocus"), fresh.count > 2 {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                fly(to: fresh[2].id)
            }
            #endif
        }
        .task(id: focused) {
            // Wait for the remote to settle so a fast swipe through the list is one flight, not ten.
            // The map's own focus token must not refit the camera to the whole world.
            guard let focused, !pinMode, focused != Self.pinToken else { return }
            try? await Task.sleep(nanoseconds: 280_000_000)
            guard !Task.isCancelled, !pinMode else { return }
            fly(to: focused)
        }
    }

    // MARK: Map

    private var map: some View {
        TVMapView(
            places: Array(places.prefix(Self.pinLimit)),
            focusID: shownID,
            pinFocusID: pinMode ? pinAnchor : nil,
            flight: flight,
            pipeline: pipeline,
            panelWidth: 720,
            onLoading: { mapLoading = $0 }
        )
    }

    /// A single focus target over the map. Per-pin buttons let the focus engine walk off
    /// the top of the screen into the tab bar; this one keeps every swipe on the map.
    private var pinLayer: some View {
        Button {
            if let place = pinFocus {
                path.append(place)
            }
        } label: {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .buttonStyle(TVBareButtonStyle())
        .focusEffectDisabled()
        .focused($focused, equals: Self.pinToken)
        .onMoveCommand { heading in
            guard pinMode else { return }
            step(heading)
        }
        .onExitCommand {
            if pinMode { leavePins() }
        }
        .disabled(!pinMode)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var mappedPlaces: [TVPlace] { Array(places.prefix(Self.pinLimit)) }

    private func enterPins() {
        guard !places.isEmpty else { return }
        if pinMode { return }
        let id: String
        if let focused, focused != Self.overviewID, places.contains(where: { $0.id == focused }) {
            id = focused
        } else {
            id = places[0].id
        }
        pinAnchor = id
        pinMode = true
        tabLock.wrappedValue = true
        focused = Self.pinToken
    }

    private func leavePins() {
        let id = pinAnchor
        pinMode = false
        pinAnchor = nil
        tabLock.wrappedValue = false
        focused = id ?? Self.overviewID
    }

    /// Move to the next real place in that direction. Nothing that way stays put — focus never leaves the map.
    private func step(_ heading: MoveCommandDirection) {
        guard let id = pinAnchor,
              let current = mappedPlaces.first(where: { $0.id == id }),
              let next = Self.place(after: current, heading: heading, in: mappedPlaces) else {
            focused = Self.pinToken
            return
        }
        pinAnchor = next.id
        focused = Self.pinToken
    }

    /// Next place on the ground, in metres. The camera then pans so that pin sits in the open map.
    static func place(after current: TVPlace, heading: MoveCommandDirection, in places: [TVPlace]) -> TVPlace? {
        let axis: (Double, Double)
        switch heading {
        case .up: axis = (0, 1)
        case .down: axis = (0, -1)
        case .left: axis = (-1, 0)
        case .right: axis = (1, 0)
        default: return nil
        }
        let latScale = 111_320.0
        let lonScale = 111_320.0 * cos(current.latitude * .pi / 180)
        var cone: (place: TVPlace, score: Double)?
        var half: (place: TVPlace, score: Double)?
        for place in places where place.id != current.id {
            let east = (place.longitude - current.longitude) * lonScale
            let north = (place.latitude - current.latitude) * latScale
            let forward = east * axis.0 + north * axis.1
            let sideways = abs(east * axis.1 - north * axis.0)
            guard forward > 8 else { continue }
            let loose = hypot(east, north) + sideways * 0.85
            if half == nil || loose < half!.score { half = (place, loose) }
            // Prefer a pin that really lies in that direction. A pin in the corner still counts
            // when nothing sits closer to straight ahead.
            guard forward > sideways * 0.45 else { continue }
            let tight = hypot(east, north) + sideways * 1.6
            if cone == nil || tight < cone!.score { cone = (place, tight) }
        }
        return cone?.place ?? half?.place
    }

    private func fly(to id: String) {
        withAnimation(TVTheme.spring) {
            shownID = id == Self.overviewID ? nil : places.first(where: { $0.id == id })?.id
        }
        flight &+= 1
    }

    // MARK: List

    private var panel: some View {
        VStack(alignment: .leading, spacing: 24) {
            TVScreenHeader(title: L("Mapa"), subtitle: summary)
            if !places.isEmpty {
                Label(L("Naciśnij Play, aby przejść na pinezki. Menu wraca do listy."), systemImage: "play.fill")
                    .font(.system(size: 23, weight: .medium))
                    .foregroundStyle(.secondary)
                    .padding(.top, -12)
            }
            if places.isEmpty {
                if loaded {
                    VStack(alignment: .leading, spacing: 14) {
                        Image(systemName: "map")
                            .font(.system(size: 60))
                            .foregroundStyle(TVTheme.accent)
                        Text(L("Brak zdjęć z lokalizacją"))
                            .font(.title2.weight(.semibold))
                        Text(L("Zdjęcia z włączonymi usługami lokalizacji w Aparacie pojawią się na mapie po synchronizacji."))
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: 560, alignment: .leading)
                    .padding(.top, 30)
                } else {
                    ProgressView().padding(.top, 40)
                }
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 22) {
                        Button {
                            fly(to: Self.overviewID)
                        } label: {
                            TVOverviewRow(count: places.count)
                        }
                        .buttonStyle(.card)
                        .focused($focused, equals: Self.overviewID)
                        ForEach(places) { place in
                            NavigationLink(value: place) {
                                TVPlaceRow(place: place)
                            }
                            .buttonStyle(.card)
                            .focused($focused, equals: place.id)
                        }
                    }
                    .padding(.vertical, 16)
                    .padding(.horizontal, 6)
                }
                .focusSection()
                .disabled(pinMode)
                .opacity(pinMode ? 0.55 : 1)
            }
        }
        .frame(width: 600, alignment: .leading)
        .padding(.leading, TVTheme.margin)
        .padding(.top, 8)
    }

    private var summary: String {
        guard !places.isEmpty else { return "" }
        let located = places.reduce(0) { $0 + $1.photos.count }
        let word = Plural.pick(places.count, L("miejsce"), L("miejsca"), L("miejsc"))
        return "\(PhotoFormat.grouped(places.count)) \(word) · \(PhotoFormat.count(located))"
    }
}

private struct TVOverviewRow: View {
    let count: Int

    var body: some View {
        HStack(spacing: 22) {
            Image(systemName: "globe.europe.africa.fill")
                .font(.system(size: 44))
                .foregroundStyle(TVTheme.accent)
                .frame(width: 128, height: 96)
                .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(L("Wszystkie miejsca"))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                Text(L("Pokaż całą mapę"))
                    .font(.system(size: 23, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(width: 560, alignment: .leading)
    }
}

private struct TVPlaceRow: View {
    let place: TVPlace

    var body: some View {
        HStack(spacing: 22) {
            Color.clear
                .frame(width: 128, height: 96)
                .overlay { TVThumb(hash: place.cover.cloudHash ?? "") }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text(place.title)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(PhotoFormat.count(place.photos.count))
                    .font(.system(size: 23, weight: .medium))
                    .foregroundStyle(.secondary)
                if let newest = place.photos.first?.created, let oldest = place.photos.last?.created {
                    Text(TVFormat.span(oldest, newest))
                        .font(.system(size: 22))
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(width: 560, alignment: .leading)
    }
}

/// Glass card for the pin the remote is on.
private struct TVPinCard: View {
    let place: TVPlace

    var body: some View {
        HStack(spacing: 22) {
            Color.clear
                .frame(width: 150, height: 112)
                .overlay { TVThumb(hash: place.cover.cloudHash ?? "") }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text(place.title)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(PhotoFormat.count(place.photos.count))
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(.secondary)
                Label(L("Naciśnij, aby otworzyć"), systemImage: "hand.tap.fill")
                    .font(.system(size: 23, weight: .medium))
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: 420, alignment: .leading)
        }
        .padding(18)
        .galleryGlass(in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        .id(place.id)
    }
}

/// MapKit view behind the list. Never interactive: SwiftUI owns focus and tells the map which
/// place or pin to show.
struct TVMapView: UIViewRepresentable {
    let places: [TVPlace]
    let focusID: String?
    let pinFocusID: String?
    let flight: Int
    let pipeline: TVImagePipeline
    let panelWidth: CGFloat
    let onLoading: (Bool) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(pipeline: pipeline) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        // `.realistic` elevation hides annotation views on tvOS; flat imagery still tilts with the camera.
        map.preferredConfiguration = MKHybridMapConfiguration(elevationStyle: .flat)
        map.pointOfInterestFilter = .excludingAll
        map.isUserInteractionEnabled = false
        map.delegate = context.coordinator
        map.register(TVPinView.self, forAnnotationViewWithReuseIdentifier: TVPinView.reuse)
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        let coordinator = context.coordinator
        coordinator.onLoading = onLoading
        coordinator.padding = UIEdgeInsets(top: 170, left: panelWidth + 60, bottom: 110, right: 90)
        coordinator.sync(places, on: map)
        // While a pin is selected the list camera must not yank the view back to the whole world.
        if let pinFocusID {
            if coordinator.pinFocus != pinFocusID, let place = places.first(where: { $0.id == pinFocusID }) {
                coordinator.pinFocus = pinFocusID
                coordinator.present(place, on: map)
            }
        } else {
            coordinator.pinFocus = nil
            if coordinator.framedFlight != flight || coordinator.framedFocus != focusID || coordinator.needsFrame {
                let animated = !coordinator.needsFrame
                coordinator.needsFrame = false
                coordinator.framedFlight = flight
                coordinator.framedFocus = focusID
                coordinator.frame(focusID, on: map, animated: animated)
            }
        }
        coordinator.highlight(on: map)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        let pipeline: TVImagePipeline
        var pins: [String: TVPinAnnotation] = [:]
        var places: [TVPlace] = []
        var framedFocus: String?
        var framedFlight = -1
        var needsFrame = true
        var pinFocus: String?
        var padding = UIEdgeInsets.zero
        var onLoading: (Bool) -> Void = { _ in }
        private var hidden = Set<String>()
        private var signature = ""
        private var loadingShown = false
        private var loadingWork: DispatchWorkItem?

        init(pipeline: TVImagePipeline) {
            self.pipeline = pipeline
        }

        func sync(_ places: [TVPlace], on map: MKMapView) {
            self.places = places
            let next = places.map { "\($0.id)#\($0.photos.count)" }.joined(separator: "|")
            guard next != signature else { return }
            let hadNone = pins.isEmpty
            signature = next
            // Only changed places are swapped. Rebuilding every pin on each sync tick made the
            // whole map blink while a library was still arriving.
            var kept: [String: TVPinAnnotation] = [:]
            var added: [TVPinAnnotation] = []
            for place in places {
                if let pin = pins[place.id], pin.place.photos.count == place.photos.count, pin.place.cover.cloudHash == place.cover.cloudHash {
                    kept[place.id] = pin
                } else {
                    let pin = TVPinAnnotation(place: place)
                    kept[place.id] = pin
                    added.append(pin)
                }
            }
            let gone = pins.filter { kept[$0.key] !== $0.value }.map(\.value)
            map.removeAnnotations(gone)
            map.addAnnotations(added)
            pins = kept
            if hadNone { needsFrame = true }
            DispatchQueue.main.async { [weak self, weak map] in
                guard let self, let map else { return }
                self.settlePins(on: map)
            }
        }

        // MARK: Camera

        func frame(_ focus: String?, on map: MKMapView, animated: Bool) {
            arcToken &+= 1
            arcLanding = nil
            guard map.bounds.width > 0 else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self, weak map] in
                    guard let self, let map else { return }
                    self.frame(focus, on: map, animated: false)
                }
                return
            }
            if let focus, let place = places.first(where: { $0.id == focus }) {
                let point = MKMapPoint(place.coordinate)
                let side = MKMapPointsPerMeterAtLatitude(place.latitude) * (place.name == nil ? 22_000 : 34_000)
                let rect = MKMapRect(x: point.x - side / 2, y: point.y - side / 2, width: side, height: side)
                fly(map, to: rect, pitch: 40, animated: animated)
            } else {
                fly(map, to: bounding(places), pitch: 0, animated: animated)
            }
        }

        /// Puts the pin in the open part of the map (right of the list, below the tabs) and
        /// slides there on every step. Zoom changes only to separate a pile, or when the camera
        /// is still the whole-world overview — never because a neighbour was already on screen.
        func present(_ place: TVPlace, on map: MKMapView) {
            guard map.bounds.width > 0 else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self, weak map] in
                    guard let self, let map else { return }
                    self.present(place, on: map)
                }
                return
            }
            let here = MKMapPoint(place.coordinate)
            let scale = MKMapPointsPerMeterAtLatitude(place.latitude)
            let nearest = places.lazy.filter { $0.id != place.id }.map {
                MKMapPoint($0.coordinate).distance(to: here) / scale
            }.min() ?? 4_000
            let openPoints = Double(max(480, map.bounds.width - padding.left - padding.right))
            let wanted = min(16_000, max(700, nearest / 170 * openPoints))
            let visible = map.visibleMapRect.width / scale
            let piled = visible > 0 && nearest / visible * openPoints < 130
            let overview = visible > 40_000 || map.camera.centerCoordinateDistance > 80_000
            let span = (piled || overview || visible <= 0) ? wanted : visible
            arc(to: aimCamera(place, spanMeters: span, on: map), on: map)
        }

        /// Increments on every step, so a fast press cancels the second half of an older flight.
        private var arcToken = 0
        /// Second half of a flight, started when MapKit reports the first half has landed.
        private var arcLanding: (token: Int, camera: MKMapCamera)?
        /// When the rise began; an older animation ending right then must not trigger the landing.
        private var arcStarted: CFTimeInterval = 0

        /// Every step is a small flight: the camera rises to show where it comes from and where
        /// it goes, drifts across, then descends onto the new pin. Both halves use MapKit's own
        /// camera animation, which tvOS runs reliably and which loads tiles on the way.
        private func arc(to target: MKMapCamera, on map: MKMapView) {
            arcToken &+= 1
            let token = arcToken
            let start = map.camera
            let from = MKMapPoint(start.centerCoordinate)
            let to = MKMapPoint(target.centerCoordinate)
            let latitude = (start.centerCoordinate.latitude + target.centerCoordinate.latitude) / 2
            let scale = MKMapPointsPerMeterAtLatitude(latitude)
            let apart = from.distance(to: to) / max(scale, .ulpOfOne)
            let visibleNow = max(map.visibleMapRect.width / scale, 1)
            let groundPerHeight = visibleNow / max(start.centerCoordinateDistance, 1)
            let targetSpan = target.centerCoordinateDistance * groundPerHeight
            let base = max(visibleNow, targetSpan)
            // Always lift noticeably, more for longer trips; never beyond a continent.
            let hopSpan = min(4_000_000, max(base * 2.2, apart * 2.4))
            guard apart > 1 else {
                arcLanding = nil
                map.setCamera(target, animated: true)
                return
            }
            let middle = MKMapPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2).coordinate
            let hop = MKMapCamera(
                lookingAtCenter: middle,
                fromDistance: hopSpan / max(groundPerHeight, .ulpOfOne),
                pitch: 0,
                heading: 0
            )
            arcLanding = (token, target)
            arcStarted = CACurrentMediaTime()
            map.setCamera(hop, animated: true)
            // If MapKit skips the callback (no visible change), still land.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { [weak self, weak map] in
                guard let self, let map else { return }
                self.land(token: token, on: map)
            }
        }

        private func land(token: Int, on map: MKMapView) {
            guard let landing = arcLanding, landing.token == token, arcToken == token else { return }
            arcLanding = nil
            map.setCamera(landing.camera, animated: true)
        }

        /// Looks at a point offset from the place so the pin lands in the middle of the open area,
        /// at a chosen visible width. `mapRectThatFits` would widen the view on every pan.
        private func aimCamera(_ place: TVPlace, spanMeters: Double, on map: MKMapView) -> MKMapCamera {
            let scale = MKMapPointsPerMeterAtLatitude(place.latitude)
            let open = map.bounds.inset(by: padding)
            let ppm = Double(map.bounds.width) / max(spanMeters, 1)
            let dx = open.midX - map.bounds.midX
            let dy = open.midY - map.bounds.midY
            let lat = place.latitude + Double(dy) / ppm / 111_320
            let lon = place.longitude - Double(dx) / ppm / (111_320 * max(0.2, cos(place.latitude * .pi / 180)))
            let visibleNow = max(map.visibleMapRect.width / scale, 1)
            let distance = map.camera.centerCoordinateDistance * (spanMeters / visibleNow)
            return MKMapCamera(
                lookingAtCenter: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                fromDistance: max(400, distance),
                pitch: 0,
                heading: 0
            )
        }

        /// MapKit's own camera animation: it knows the destination, so tiles load during the
        /// flight instead of leaving a grey grid behind.
        private func fly(_ map: MKMapView, to rect: MKMapRect, pitch: CGFloat, animated: Bool) {
            guard !rect.isNull else { return }
            let fitted = map.mapRectThatFits(rect, edgePadding: padding)
            let center = MKMapPoint(x: fitted.midX, y: fitted.midY).coordinate
            let meters = fitted.width / MKMapPointsPerMeterAtLatitude(center.latitude)
            let camera = MKMapCamera(lookingAtCenter: center, fromDistance: meters * 1.12, pitch: pitch, heading: 0)
            map.setCamera(camera, animated: animated)
        }

        private func bounding(_ group: [TVPlace], minimumMeters: Double = 60_000) -> MKMapRect {
            var rect = MKMapRect.null
            for place in group {
                let point = MKMapPoint(place.coordinate)
                rect = rect.union(MKMapRect(x: point.x, y: point.y, width: 1, height: 1))
            }
            guard !rect.isNull, let first = group.first else { return rect }
            let minimum = MKMapPointsPerMeterAtLatitude(first.latitude) * minimumMeters
            if rect.width < minimum || rect.height < minimum {
                rect = rect.insetBy(dx: -(minimum - min(rect.width, minimum)) / 2, dy: -(minimum - min(rect.height, minimum)) / 2)
            }
            return rect
        }

        // MARK: Pins

        /// Pins stay on their coordinates. Only places a few metres apart (the same doorway)
        /// get a small nudge, so a zoomed-out city is never sprayed across the screen.
        func settlePins(on map: MKMapView) {
            guard map.bounds.width > 0 else { return }
            var fans: [String: CGPoint] = [:]
            var claimed = Set<String>()
            for place in places where !claimed.contains(place.id) {
                let here = MKMapPoint(place.coordinate)
                let scale = MKMapPointsPerMeterAtLatitude(place.latitude)
                let group = places.filter { other in
                    MKMapPoint(other.coordinate).distance(to: here) / scale < 40
                }
                for member in group { claimed.insert(member.id) }
                guard group.count > 1 else {
                    fans[place.id] = .zero
                    continue
                }
                let step = min(34, 140 / CGFloat(group.count))
                for (index, member) in group.enumerated() {
                    let spread = CGFloat(index) - CGFloat(group.count - 1) / 2
                    fans[member.id] = CGPoint(x: spread * step, y: 0)
                }
            }
            hidden = []
            for (id, pin) in pins {
                let fan = fans[id] ?? .zero
                pin.fan = fan
                if let view = map.view(for: pin) as? TVPinView {
                    view.applyFan(fan)
                    view.isHidden = false
                }
            }
        }

        func highlight(on map: MKMapView) {
            let lifted = pinFocus ?? framedFocus
            for (id, pin) in pins {
                (map.view(for: pin) as? TVPinView)?.setLifted(id == lifted)
            }
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let pin = annotation as? TVPinAnnotation else { return nil }
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: TVPinView.reuse, for: pin) as? TVPinView
            view?.configure(pin, pipeline: pipeline, lifted: pin.place.id == (pinFocus ?? framedFocus))
            view?.applyFan(pin.fan)
            view?.isHidden = hidden.contains(pin.place.id)
            return view
        }

        func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
            settlePins(on: mapView)
            // The rise has finished: descend onto the pin.
            if let landing = arcLanding, CACurrentMediaTime() - arcStarted > 0.35 {
                DispatchQueue.main.async { [weak self, weak mapView] in
                    guard let self, let mapView else { return }
                    self.land(token: landing.token, on: mapView)
                }
            }
        }

        // MARK: Loading

        func mapViewWillStartRenderingMap(_ mapView: MKMapView) {
            setLoading(true)
        }

        func mapViewDidFinishRenderingMap(_ mapView: MKMapView, fullyRendered: Bool) {
            setLoading(!fullyRendered)
        }

        func mapViewDidFailLoadingMap(_ mapView: MKMapView, withError error: Error) {
            setLoading(false)
        }

        /// Only a slow load is worth a badge; a quick refill stays silent.
        private func setLoading(_ on: Bool) {
            loadingWork?.cancel()
            if on {
                let work = DispatchWorkItem { [weak self] in
                    guard let self, !self.loadingShown else { return }
                    self.loadingShown = true
                    self.onLoading(true)
                }
                loadingWork = work
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8, execute: work)
            } else if loadingShown {
                loadingShown = false
                DispatchQueue.main.async { [onLoading] in onLoading(false) }
            }
        }
    }
}

final class TVPinAnnotation: NSObject, MKAnnotation {
    let place: TVPlace
    /// Screen-space nudge when several places share one point and zoom cannot separate them.
    var fan = CGPoint.zero
    var coordinate: CLLocationCoordinate2D { place.coordinate }
    var title: String? { place.title }

    init(place: TVPlace) {
        self.place = place
    }
}

/// Framed thumbnail with a photo count. The focused place grows and glows in the accent colour.
final class TVPinView: MKAnnotationView {
    static let reuse = "tv-photo-pin"
    static let side: CGFloat = 96

    private let card = UIView()
    private let photo = UIImageView()
    private let badge = UILabel()
    private var currentHash = ""
    private var lifted = false

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        let side = Self.side
        frame = CGRect(x: 0, y: 0, width: side, height: side)
        centerOffset = CGPoint(x: 0, y: -side / 2)
        canShowCallout = false
        collisionMode = .rectangle

        card.frame = bounds
        card.layer.cornerRadius = 20
        card.layer.cornerCurve = .continuous
        card.layer.borderWidth = 4
        card.layer.borderColor = UIColor.white.cgColor
        card.backgroundColor = UIColor(white: 0.2, alpha: 1)
        card.clipsToBounds = true
        addSubview(card)

        photo.frame = card.bounds
        photo.contentMode = .scaleAspectFill
        card.addSubview(photo)

        badge.font = .systemFont(ofSize: 18, weight: .bold)
        badge.textColor = .white
        badge.textAlignment = .center
        badge.backgroundColor = UIColor.black.withAlphaComponent(0.78)
        badge.layer.cornerRadius = 15
        badge.layer.masksToBounds = true
        addSubview(badge)

        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.5
        layer.shadowRadius = 10
        layer.shadowOffset = CGSize(width: 0, height: 4)
    }

    required init?(coder: NSCoder) { nil }

    func configure(_ pin: TVPinAnnotation, pipeline: TVImagePipeline, lifted: Bool) {
        annotation = pin
        // Overlaps are resolved by the coordinator, so MapKit must never hide a pin on its own.
        displayPriority = .required
        badge.text = PhotoFormat.grouped(pin.place.photos.count)
        let width = max(34, badge.intrinsicContentSize.width + 18)
        badge.frame = CGRect(x: Self.side - width + 12, y: -12, width: width, height: 30)
        let hash = pin.place.cover.cloudHash ?? ""
        currentHash = hash
        photo.image = pipeline.cachedThumbnail(hash: hash)
        if photo.image == nil, !hash.isEmpty {
            Task { @MainActor [weak self] in
                let image = await pipeline.thumbnail(hash: hash)
                guard let self, self.currentHash == hash else { return }
                UIView.transition(with: self.photo, duration: 0.3, options: .transitionCrossDissolve) {
                    self.photo.image = image
                }
            }
        }
        self.lifted = !lifted
        setLifted(lifted, animated: false)
        applyFan((annotation as? TVPinAnnotation)?.fan ?? .zero)
    }

    func applyFan(_ fan: CGPoint) {
        centerOffset = CGPoint(x: fan.x, y: -Self.side / 2 + fan.y)
    }

    func setLifted(_ on: Bool, animated: Bool = true) {
        guard on != lifted else { return }
        lifted = on
        let accent = UIColor(red: 0.29, green: 0.56, blue: 1.0, alpha: 1)
        let changes = {
            self.transform = on
                ? CGAffineTransform(translationX: 0, y: -Self.side * 0.22).scaledBy(x: 1.45, y: 1.45)
                : .identity
            self.card.layer.borderColor = (on ? accent : .white).cgColor
            self.badge.backgroundColor = on ? accent : UIColor.black.withAlphaComponent(0.78)
            self.layer.shadowColor = (on ? accent : .black).cgColor
            self.layer.shadowOpacity = on ? 0.85 : 0.5
            self.layer.shadowRadius = on ? 24 : 10
        }
        zPriority = on ? .max : .defaultUnselected
        if animated {
            UIView.animate(withDuration: 0.55, delay: 0, usingSpringWithDamping: 0.68, initialSpringVelocity: 0.4, options: [.beginFromCurrentState], animations: changes)
        } else {
            changes()
        }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        currentHash = ""
        photo.image = nil
    }
}
