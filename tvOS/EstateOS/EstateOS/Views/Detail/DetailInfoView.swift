import SwiftUI
import SceneKit

// MARK: - "Plan i 3D" (2026-10)
//
// Three ways to understand the layout, as tabs:
//   Rzut      — vector plan drawn natively from the LiDAR scan (`floorPlanScanMeta`): rooms with
//               names and areas, walls, doors with swing arcs, windows, furniture, scale, north.
//   Rysunki   — uploaded plan images (`floorPlanUrl` + `floorPlanExtraUrls`) on white paper.
//   Model 3D  — the RoomPlan USDZ (`floorPlan3dUrl`) in SceneKit with real materials, light and
//               soft shadows; it turns slowly; ◀ ▶ rotate, Select changes viewpoint, ⏯ pauses.

struct FloorPlanMedia {
    let title: String
    let scan: FloorPlanScan?
    let images: [URL]
    let model: URL?

    var isEmpty: Bool { (scan?.walls.isEmpty ?? true) && images.isEmpty && model == nil }

    init(title: String, extras: EstateOfferExtras) {
        self.title = title
        scan = (extras.scan?.walls.isEmpty == false) ? extras.scan : nil
        images = ([extras.floorPlanUrl].compactMap { $0 } + extras.floorPlanExtraUrls)
            .compactMap { EOSOfferMedia.imageURL(from: $0) }
        model = extras.floorPlan3dUrl.flatMap { EOSOfferMedia.imageURL(from: $0) }
    }
}

struct FloorPlanScreen: View {
    let media: FloorPlanMedia
    var startWith3D = false

    private enum Tab: Hashable { case plan, drawings, model }

    @State private var tab: Tab = .plan
    @State private var drawingIndex = 0
    @StateObject private var stage = ModelStage()
    @FocusState private var stageFocused: Bool

    private var tabs: [Tab] {
        var t: [Tab] = []
        if media.scan != nil { t.append(.plan) }
        if !media.images.isEmpty { t.append(.drawings) }
        if media.model != nil { t.append(.model) }
        return t
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.06, green: 0.07, blue: 0.09), Color(red: 0.02, green: 0.02, blue: 0.03)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 28) {
                header
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            tab = startWith3D && media.model != nil ? .model : (tabs.first ?? .plan)
        }
        .onPlayPauseCommand { if tab == .model { stage.toggleAutoRotate() } }
    }

    // MARK: Header with tabs

    private var header: some View {
        HStack(alignment: .center, spacing: 28) {
            VStack(alignment: .leading, spacing: 4) {
                Text("PLAN I 3D")
                    .font(.system(size: 18, weight: .bold))
                    .tracking(2.4)
                    .foregroundStyle(.white.opacity(0.6))
                Text(media.title)
                    .font(.system(size: 34, weight: .bold))
                    .lineLimit(1)
                    .frame(maxWidth: 900, alignment: .leading)
            }
            Spacer(minLength: 0)
            HStack(spacing: 16) {
                ForEach(tabs, id: \.self) { t in
                    Button { withAnimation(.easeInOut(duration: 0.3)) { tab = t } } label: {
                        Label(title(t), systemImage: icon(t))
                    }
                    .buttonStyle(PlanTabStyle(selected: tab == t))
                }
            }
            .focusSection()
        }
        .foregroundStyle(.white)
    }

    private func title(_ t: Tab) -> String {
        switch t {
        case .plan: return "Rzut"
        case .drawings: return media.images.count > 1 ? "Rysunki · \(media.images.count)" : "Rysunek"
        case .model: return "Model 3D"
        }
    }

    private func icon(_ t: Tab) -> String {
        switch t {
        case .plan: return "square.split.bottomrightquarter"
        case .drawings: return "doc.richtext"
        case .model: return "cube.transparent"
        }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .plan:
            if let scan = media.scan {
                HStack(alignment: .top, spacing: 36) {
                    VectorFloorPlan(scan: scan)
                        .padding(40)
                        .background(
                            RoundedRectangle(cornerRadius: 36, style: .continuous)
                                .fill(Color.white.opacity(0.035))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 36, style: .continuous)
                                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
                        )
                    PlanFactsPanel(scan: scan)
                        .frame(width: 440)
                }
                .transition(.opacity)
            }
        case .drawings:
            drawings
                .transition(.opacity)
        case .model:
            if let url = media.model {
                modelView(url)
                    .transition(.opacity)
            }
        }
    }

    private var drawings: some View {
        let url = media.images[min(drawingIndex, media.images.count - 1)]
        return ZStack(alignment: .bottom) {
            EOSCachedRemoteImage(url: url, contentMode: .fit, size: .screen) {
                ProgressView()
            }
            .padding(40)
            .background(
                RoundedRectangle(cornerRadius: 32, style: .continuous)
                    .fill(Color(red: 0.98, green: 0.97, blue: 0.95))
                    .shadow(color: .black.opacity(0.5), radius: 40, y: 20)
            )
            .padding(.horizontal, 160)
            .padding(.bottom, media.images.count > 1 ? 70 : 0)
            .id(url)
            .transition(.opacity)

            if media.images.count > 1 {
                Text("\(drawingIndex + 1) / \(media.images.count)   ·   ◀ ▶ kolejny rysunek")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }

            stageButton {}
                .onMoveCommand { move in
                    guard media.images.count > 1 else { return }
                    withAnimation(.easeInOut(duration: 0.35)) {
                        if move == .right { drawingIndex = (drawingIndex + 1) % media.images.count }
                        if move == .left { drawingIndex = (drawingIndex - 1 + media.images.count) % media.images.count }
                    }
                }
        }
    }

    private func modelView(_ url: URL) -> some View {
        ZStack(alignment: .bottom) {
            switch stage.state {
            case .loading:
                VStack(spacing: 18) {
                    ProgressView()
                    Text("Przygotowuję model 3D…")
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed:
                VStack(spacing: 14) {
                    Image(systemName: "cube.transparent")
                        .font(.system(size: 60, weight: .light))
                    Text("Nie udało się wczytać modelu 3D.")
                        .font(.system(size: 26, weight: .semibold))
                    Text("Sprawdź połączenie i spróbuj ponownie.")
                        .foregroundStyle(.white.opacity(0.6))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .ready:
                SceneView(
                    scene: stage.scene,
                    pointOfView: stage.camera,
                    options: [],
                    antialiasingMode: .multisampling4X
                )
                .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
                HStack(spacing: 30) {
                    Label("obróć", systemImage: "arrow.left.and.right")
                    Label(stage.viewName, systemImage: "camera.viewfinder")
                    Label(stage.autoRotate ? "zatrzymaj obrót" : "obracaj", systemImage: "playpause")
                }
                .font(.system(size: 19, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))
                .padding(.bottom, 24)
            }

            // ◀ ▶ rotate · Select: next viewpoint · ⏯ turntable. ▲ goes back to the tabs.
            stageButton { stage.nextView() }
                .onMoveCommand { move in
                    switch move {
                    case .left: stage.rotate(by: -.pi / 6)
                    case .right: stage.rotate(by: .pi / 6)
                    default: break
                    }
                }
        }
        .task(id: url) { await stage.load(url) }
    }

    /// Invisible full-area target that owns the remote inside a tab.
    private func stageButton(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(PlanStageStyle())
        .focused($stageFocused)
    }
}

// MARK: - Vector floor plan

/// Architectural rendering of the LiDAR scan: graphite paper, white walls, room names and areas.
struct VectorFloorPlan: View {
    let scan: FloorPlanScan

    private static let roomTints: [Color] = [
        Color(red: 0.36, green: 0.84, blue: 0.62), Color(red: 0.48, green: 0.72, blue: 1.0),
        Color(red: 0.98, green: 0.80, blue: 0.42), Color(red: 0.70, green: 0.62, blue: 1.0),
        Color(red: 1.0, green: 0.58, blue: 0.40), Color(red: 1.0, green: 0.45, blue: 0.58),
    ]

    var body: some View {
        Canvas { context, size in
            guard let b = scan.resolvedBounds else { return }
            let pad: CGFloat = 30
            let w = b.maxX - b.minX, h = b.maxZ - b.minZ
            guard w > 0.1, h > 0.1 else { return }
            let scale = min((size.width - pad * 2) / w, (size.height - pad * 2) / h)
            let ox = (size.width - w * scale) / 2, oz = (size.height - h * scale) / 2
            func p(_ x: Double, _ z: Double) -> CGPoint {
                CGPoint(x: ox + (x - b.minX) * scale, y: oz + (z - b.minZ) * scale)
            }

            // Fine grid (50 cm), very faint.
            var grid = Path()
            let step = 0.5 * scale
            if step > 6 {
                var x = ox; while x <= ox + w * scale { grid.move(to: CGPoint(x: x, y: oz)); grid.addLine(to: CGPoint(x: x, y: oz + h * scale)); x += step }
                var y = oz; while y <= oz + h * scale { grid.move(to: CGPoint(x: ox, y: y)); grid.addLine(to: CGPoint(x: ox + w * scale, y: y)); y += step }
                context.stroke(grid, with: .color(.white.opacity(0.035)), lineWidth: 1)
            }

            // Rooms.
            for (i, section) in scan.sections.enumerated() {
                guard let poly = section.floorPolygon, poly.count > 2 else { continue }
                var path = Path()
                path.move(to: p(poly[0].x, poly[0].z))
                for pt in poly.dropFirst() { path.addLine(to: p(pt.x, pt.z)) }
                path.closeSubpath()
                let tint = Self.roomTints[i % Self.roomTints.count]
                context.fill(path, with: .color(tint.opacity(0.10)))
            }

            // Furniture — faint outlines.
            for object in scan.objects {
                guard let ow = object.widthM, let od = object.depthM, ow > 0, od > 0 else { continue }
                let rect = CGRect(x: -ow * scale / 2, y: -od * scale / 2, width: ow * scale, height: od * scale)
                var t = CGAffineTransform(translationX: p(object.centerX, object.centerZ).x, y: p(object.centerX, object.centerZ).y)
                t = t.rotated(by: CGFloat((object.rotationDeg ?? 0) * .pi / 180))
                let path = Path(roundedRect: rect, cornerRadius: min(rect.width, rect.height) * 0.12).applying(t)
                context.stroke(path, with: .color(.white.opacity(0.22)), lineWidth: 1.5)
            }

            // Walls.
            let wallWidth = max(6, min(14, 0.14 * scale))
            var walls = Path()
            for wall in scan.walls {
                walls.move(to: p(wall.x1, wall.z1))
                walls.addLine(to: p(wall.x2, wall.z2))
            }
            context.stroke(walls, with: .color(Color(white: 0.96)), style: StrokeStyle(lineWidth: wallWidth, lineCap: .square))

            // Openings: cut the wall, then draw the symbol.
            let paper = Color(red: 0.045, green: 0.05, blue: 0.065)
            for opening in scan.openings {
                let a = p(opening.x1, opening.z1), c = p(opening.x2, opening.z2)
                var cut = Path(); cut.move(to: a); cut.addLine(to: c)
                context.stroke(cut, with: .color(paper), style: StrokeStyle(lineWidth: wallWidth + 2, lineCap: .butt))
                switch opening.kind {
                case "door":
                    let dx = c.x - a.x, dy = c.y - a.y
                    let len = hypot(dx, dy)
                    guard len > 1 else { continue }
                    // Leaf perpendicular to the wall from `a`, and the swing arc.
                    let leafEnd = CGPoint(x: a.x - dy, y: a.y + dx)
                    var leaf = Path(); leaf.move(to: a); leaf.addLine(to: leafEnd)
                    context.stroke(leaf, with: .color(.white.opacity(0.8)), lineWidth: 2)
                    let start = atan2(dy, dx), end = start + .pi / 2
                    var arc = Path()
                    arc.addArc(center: a, radius: len, startAngle: .radians(start), endAngle: .radians(end), clockwise: false)
                    context.stroke(arc, with: .color(.white.opacity(0.45)), style: StrokeStyle(lineWidth: 1.5, dash: [5, 5]))
                case "window":
                    let dx = c.x - a.x, dy = c.y - a.y
                    let len = max(hypot(dx, dy), 1)
                    let nx = -dy / len * wallWidth * 0.32, ny = dx / len * wallWidth * 0.32
                    for k in [-1.0, 0, 1.0] {
                        var line = Path()
                        line.move(to: CGPoint(x: a.x + nx * k, y: a.y + ny * k))
                        line.addLine(to: CGPoint(x: c.x + nx * k, y: c.y + ny * k))
                        context.stroke(line, with: .color(Color(red: 0.55, green: 0.80, blue: 1.0).opacity(0.9)), lineWidth: 1.5)
                    }
                default:
                    break
                }
            }

            // Room names and areas.
            for section in scan.sections {
                let center = p(section.centerX, section.centerZ)
                let name = (section.label ?? "").trimmingCharacters(in: .whitespaces)
                let area = section.areaSqM.map { String(format: "%.1f m²", $0).replacingOccurrences(of: ".", with: ",") }
                if !name.isEmpty {
                    context.draw(
                        Text(name).font(.system(size: 22, weight: .semibold)).foregroundStyle(.white),
                        at: CGPoint(x: center.x, y: center.y - (area == nil ? 0 : 14))
                    )
                }
                if let area {
                    context.draw(
                        Text(area).font(.system(size: 19, weight: .medium)).foregroundStyle(.white.opacity(0.65)),
                        at: CGPoint(x: center.x, y: center.y + (name.isEmpty ? 0 : 14))
                    )
                }
            }

            // Scale bar (1 m or 2 m).
            let meters: Double = scale > 80 ? 1 : 2
            let barY = size.height - 8
            var bar = Path()
            bar.move(to: CGPoint(x: 8, y: barY)); bar.addLine(to: CGPoint(x: 8 + meters * scale, y: barY))
            bar.move(to: CGPoint(x: 8, y: barY - 8)); bar.addLine(to: CGPoint(x: 8, y: barY + 2))
            bar.move(to: CGPoint(x: 8 + meters * scale, y: barY - 8)); bar.addLine(to: CGPoint(x: 8 + meters * scale, y: barY + 2))
            context.stroke(bar, with: .color(.white.opacity(0.7)), lineWidth: 2)
            context.draw(
                Text("\(Int(meters)) m").font(.system(size: 17, weight: .semibold)).foregroundStyle(.white.opacity(0.7)),
                at: CGPoint(x: 8 + meters * scale + 26, y: barY - 4)
            )

            // North arrow.
            if let north = scan.northRotationDegrees {
                let c = CGPoint(x: size.width - 40, y: 44)
                var arrow = Path()
                arrow.move(to: CGPoint(x: 0, y: -22)); arrow.addLine(to: CGPoint(x: 9, y: 10))
                arrow.addLine(to: CGPoint(x: 0, y: 4)); arrow.addLine(to: CGPoint(x: -9, y: 10)); arrow.closeSubpath()
                let t = CGAffineTransform(translationX: c.x, y: c.y).rotated(by: CGFloat(-north * .pi / 180))
                context.fill(arrow.applying(t), with: .color(.white.opacity(0.85)))
                context.draw(Text("N").font(.system(size: 16, weight: .bold)).foregroundStyle(.white.opacity(0.85)),
                             at: CGPoint(x: c.x, y: c.y + 30))
            }
        }
        .accessibilityLabel("Rzut mieszkania ze skanera, \(scan.sections.count) pomieszczeń")
    }
}

/// Side panel: totals and the room list.
private struct PlanFactsPanel: View {
    let scan: FloorPlanScan

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 28) {
                fact(scan.totalAreaSqM.map { String(format: "%.1f m²", $0).replacingOccurrences(of: ".", with: ",") } ?? "—", "Powierzchnia")
                fact("\(max(scan.sections.count, 1))", "Pomieszczenia")
            }
            if let ceiling = scan.ceilingHeightM, ceiling > 0 {
                fact(String(format: "%.2f m", ceiling).replacingOccurrences(of: ".", with: ","), "Wysokość")
            }
            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)
            ForEach(Array(scan.sections.enumerated()), id: \.offset) { _, section in
                HStack {
                    Text((section.label ?? "Pomieszczenie").trimmingCharacters(in: .whitespaces))
                        .font(.system(size: 22, weight: .medium))
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    if let a = section.areaSqM {
                        Text(String(format: "%.1f m²", a).replacingOccurrences(of: ".", with: ","))
                            .font(.system(size: 22, weight: .semibold).monospacedDigit())
                    }
                }
            }
            Spacer(minLength: 0)
            Label("Rzut z pomiaru LiDAR", systemImage: "sensor.tag.radiowaves.forward")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
        }
        .foregroundStyle(.white)
        .padding(32)
        .frame(maxHeight: .infinity, alignment: .top)
        .eosGlassPanel(cornerRadius: 36)
    }

    private func fact(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.system(size: 34, weight: .semibold))
            Text(label.uppercased()).font(.system(size: 15, weight: .semibold)).tracking(1.4).opacity(0.6)
        }
    }
}

// MARK: - 3D model stage (SceneKit)

@MainActor
final class ModelStage: ObservableObject {
    enum State { case loading, ready, failed }

    @Published private(set) var state: State = .loading
    @Published private(set) var autoRotate = true
    let scene = SCNScene()
    let camera = SCNNode()
    private let turntable = SCNNode()
    private let cameraRig = SCNNode()
    private var elevation: Float = 0.62   // radians above the horizon
    private var radius: Float = 10
    private var loadedURL: URL?

    init() {
        scene.background.contents = UIColor(red: 0.04, green: 0.045, blue: 0.06, alpha: 1)
        scene.rootNode.addChildNode(turntable)
        scene.rootNode.addChildNode(cameraRig)

        let cam = SCNCamera()
        cam.fieldOfView = 38
        cam.wantsHDR = true
        cam.screenSpaceAmbientOcclusionIntensity = 1.2
        cam.screenSpaceAmbientOcclusionRadius = 0.6
        cam.bloomIntensity = 0.15
        cam.zNear = 0.05
        cam.zFar = 200
        camera.camera = cam
        cameraRig.addChildNode(camera)

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 420
        ambient.light?.color = UIColor(white: 0.95, alpha: 1)
        scene.rootNode.addChildNode(ambient)

        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.intensity = 1100
        sun.light?.castsShadow = true
        sun.light?.shadowMode = .deferred
        sun.light?.shadowRadius = 6
        sun.light?.shadowSampleCount = 16
        sun.light?.shadowColor = UIColor(white: 0, alpha: 0.45)
        sun.eulerAngles = SCNVector3(-1.0, 0.6, 0)
        scene.rootNode.addChildNode(sun)
    }

    func load(_ url: URL) async {
        guard loadedURL != url else { return }
        loadedURL = url
        state = .loading
        do {
            let local = try await Self.download(url)
            let model = try SCNScene(url: local, options: [.checkConsistency: false])
            let container = SCNNode()
            for child in model.rootNode.childNodes { container.addChildNode(child) }
            Self.dress(container)

            // Centre on the floor and frame the camera to the model's size.
            let (minV, maxV) = container.boundingBox
            let size = SCNVector3(maxV.x - minV.x, maxV.y - minV.y, maxV.z - minV.z)
            container.position = SCNVector3(-(minV.x + maxV.x) / 2, -minV.y, -(minV.z + maxV.z) / 2)
            turntable.childNodes.forEach { $0.removeFromParentNode() }
            turntable.addChildNode(container)
            turntable.addChildNode(Self.floorDisc(radius: max(size.x, size.z) * 0.9))
            radius = max(size.x, size.z) * 1.55 + 2
            modelHeight = size.y
            viewIndex = 0
            elevation = Self.views[0].elevation
            placeCamera(lookAtHeight: size.y * 0.35, animated: false)
            startAutoRotate()
            state = .ready
        } catch {
            state = .failed
        }
    }

    func toggleAutoRotate() {
        autoRotate ? stopAutoRotate() : startAutoRotate()
    }

    func rotate(by angle: Float) {
        stopAutoRotate()
        let action = SCNAction.rotateBy(x: 0, y: CGFloat(angle), z: 0, duration: 0.6)
        action.timingMode = .easeInEaseOut
        turntable.runAction(action)
    }

    /// Viewpoints Select cycles through: architectural model, plan from above, eye level.
    private static let views: [(name: String, elevation: Float, height: Float)] = [
        ("widok makiety", 0.62, 0.35),
        ("widok z góry", 1.48, 0.0),
        ("na wysokości oczu", 0.16, 0.55),
    ]
    @Published private(set) var viewIndex = 0
    private var modelHeight: Float = 2.5

    var viewName: String { "Select · " + Self.views[(viewIndex + 1) % Self.views.count].name }

    func nextView() {
        viewIndex = (viewIndex + 1) % Self.views.count
        let v = Self.views[viewIndex]
        elevation = v.elevation
        placeCamera(lookAtHeight: modelHeight * v.height, animated: true)
    }

    private func startAutoRotate() {
        autoRotate = true
        turntable.removeAction(forKey: "spin")
        turntable.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 48)), forKey: "spin")
    }

    private func stopAutoRotate() {
        autoRotate = false
        turntable.removeAction(forKey: "spin")
    }

    private func placeCamera(lookAtHeight: Float, animated: Bool) {
        let target = SCNVector3(0, lookAtHeight, 0)
        let pos = SCNVector3(0, sin(elevation) * radius + lookAtHeight, cos(elevation) * radius)
        SCNTransaction.begin()
        SCNTransaction.animationDuration = animated ? 0.9 : 0
        SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        camera.position = pos
        camera.look(at: target)
        SCNTransaction.commit()
    }

    /// RoomPlan exports flat grey boxes — give them architectural-model materials by node name.
    private static func dress(_ root: SCNNode) {
        func material(_ color: UIColor, roughness: CGFloat, transparency: CGFloat = 1) -> SCNMaterial {
            let m = SCNMaterial()
            m.lightingModel = .physicallyBased
            m.diffuse.contents = color
            m.roughness.contents = roughness
            m.metalness.contents = 0.0
            m.transparency = transparency
            m.isDoubleSided = true
            return m
        }
        let wall = material(UIColor(red: 0.93, green: 0.91, blue: 0.88, alpha: 1), roughness: 0.9)
        let floor = material(UIColor(red: 0.55, green: 0.42, blue: 0.31, alpha: 1), roughness: 0.65)
        let door = material(UIColor(red: 0.74, green: 0.64, blue: 0.52, alpha: 1), roughness: 0.6)
        let window = material(UIColor(red: 0.62, green: 0.82, blue: 1.0, alpha: 1), roughness: 0.1, transparency: 0.35)
        let furniture = material(UIColor(red: 0.62, green: 0.66, blue: 0.72, alpha: 1), roughness: 0.75)

        root.enumerateHierarchy { node, _ in
            guard let geometry = node.geometry else { return }
            let name = (node.name ?? "").lowercased()
            let chosen: SCNMaterial
            if name.contains("window") { chosen = window }
            else if name.contains("door") || name.contains("opening") { chosen = door }
            else if name.contains("floor") { chosen = floor }
            else if name.contains("wall") { chosen = wall }
            else { chosen = furniture }
            geometry.materials = [chosen]
            node.castsShadow = !name.contains("window")
        }
    }

    private static func floorDisc(radius: Float) -> SCNNode {
        let disc = SCNCylinder(radius: CGFloat(radius), height: 0.02)
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = UIColor(white: 0.12, alpha: 1)
        m.roughness.contents = 0.95
        disc.materials = [m]
        let node = SCNNode(geometry: disc)
        node.position = SCNVector3(0, -0.012, 0)
        return node
    }

    private static func download(_ url: URL) async throws -> URL {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // Stable name across launches (hashValue is seeded per process).
        var hash: UInt64 = 5381
        for byte in url.absoluteString.utf8 { hash = (hash &* 33) ^ UInt64(byte) }
        let name = String(hash, radix: 36) + ".usdz"
        let target = dir.appendingPathComponent(name)
        if FileManager.default.fileExists(atPath: target.path) { return target }
        let (temp, response) = try await EOSImageCache.session.download(from: url)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.moveItem(at: temp, to: target)
        return target
    }
}

// MARK: - Styles

private struct PlanTabStyle: ButtonStyle {
    var selected: Bool
    @Environment(\.isFocused) private var isFocused

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 22, weight: .semibold))
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .foregroundStyle(isFocused ? Color.black : .white)
            .background(
                Capsule().fill(isFocused ? Color.white : (selected ? Color.white.opacity(0.2) : Color.white.opacity(0.06)))
            )
            .overlay(Capsule().strokeBorder(Color.white.opacity(selected && !isFocused ? 0.4 : 0), lineWidth: 1.5))
            .scaleEffect(isFocused ? 1.06 : 1)
            .animation(EOSMotion.focus, value: isFocused)
    }
}

private struct PlanStageStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.contentShape(Rectangle())
    }
}
