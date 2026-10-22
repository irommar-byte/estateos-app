import BackgroundTasks
import Photos
import SwiftUI
import UIKit

/// A person as the screens show them.
struct PersonSummary: Identifiable, Hashable {
    let id: Int64
    var name: String
    var count: Int
    var coverFace: FaceRecord?
    var favorite: Bool
    var hidden: Bool

    var title: String { name.isEmpty ? L("Dodaj imię") : name }
    var hasName: Bool { !name.isEmpty }
}

/// GalleryOS's on-device "brain": looks at every photo once (scenes, faces, text, quality,
/// CLIP vector), keeps the results in a small database and groups faces into people.
/// Nothing is sent anywhere. Work pauses while the app is in the background, when the phone is hot
/// and slows down while the first big copy to the server runs; overnight, on the charger, it continues.
@MainActor
final class PhotoIntelligence: ObservableObject {
    static let shared = PhotoIntelligence()
    static let taskIdentifier = "pl.galleryos.app.intelligence"

    @Published private(set) var people: [PersonSummary] = []
    @Published private(set) var hiddenPeople: [PersonSummary] = []
    @Published private(set) var analyzedCount = 0
    @Published private(set) var totalCount = 0
    @Published private(set) var running = false
    /// Why the analysis waits right now, in plain words (nil while it works).
    @Published private(set) var pauseReason: String?
    /// Bumped whenever results change, so screens can refresh what they derive from them.
    @Published private(set) var revision = 0
    /// Server photos whose preview is still on its way; the analysis comes back for them by itself.
    @Published private(set) var waitingForPreviews = 0
    /// Photos with no picture at all this launch (a preview the server cannot give yet).
    @Published private(set) var skippedForNow = 0

    private let database = InsightDatabase.shared
    private let models = IntelligenceModels.shared
    private weak var library: PhotoLibrary?
    private var worker: Task<Void, Never>?
    private var versions: [String: Int] = [:]
    private(set) var insights: [String: PhotoInsight] = [:]
    private var facesByPhoto: [String: [FaceRecord]] = [:]
    private var photosByPerson: [Int64: [String]] = [:]
    private var records: [Int64: PersonRecord] = [:]
    private var foreground = true
    private var backgroundTask: BGProcessingTask?
    private let faceCache: NSCache<NSNumber, UIImage> = {
        let cache = NSCache<NSNumber, UIImage>()
        cache.countLimit = 400
        return cache
    }()

    var peopleAvailable: Bool { models.hasFaces }
    var searchAvailable: Bool { models.hasSearch }

    private init() {
        guard database.isOpen else { return }
        // Tens of thousands of rows: read off the main thread so launch stays smooth.
        let database = self.database
        Task { [weak self] in
            let stored = await Task.detached(priority: .userInitiated) {
                (database.analyzed(), database.insights())
            }.value
            guard let self else { return }
            self.versions = stored.0
            self.insights = Dictionary(stored.1.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
            self.analyzedCount = stored.0.count
            self.loaded = true
            self.startWatchdog()
            self.reloadPeople()
            self.publishLabels()
            self.resume()
        }
        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.foreground = false
                self.lastProgress = Date()
                if self.backgroundTask == nil {
                    self.models.unload()
                    Self.scheduleOvernight()
                }
            }
        }
        NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                self?.foreground = true
                self?.lastProgress = Date()
                self?.resume()
            }
        }
    }

    // MARK: Scheduling

    /// Called after every library load: anything new or changed gets analysed, newest first.
    func schedule(_ library: PhotoLibrary) {
        self.library = library
        // The server catalogue arrives in many small steps; one look after they settle.
        pendingSchedule?.cancel()
        pendingSchedule = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            self?.resume()
        }
    }

    private var pendingSchedule: Task<Void, Never>?

    private var loaded = false
    /// Photos whose picture vector failed are tried once more per launch (the image path has a fallback now).
    private var retried = Set<String>()
    /// How many passes found no picture for a photo. After three it waits for the next launch.
    private var previewMisses: [String: Int] = [:]
    /// Photos that just had no picture: left out until their retry, so a new pass for fresh
    /// photos does not spin on them.
    private var cooling = Set<String>()
    private var retryTask: Task<Void, Never>?

    private func missingVector(_ id: String) -> Bool {
        guard models.hasSearch, let insight = insights[id], insight.clip == nil, !retried.contains(id) else { return false }
        retried.insert(id)
        return true
    }

    private func resume(retrying: Bool = false) {
        guard database.isOpen, loaded, let library, worker == nil else { return }
        if retrying { cooling.removeAll() }
        let photos = library.allPhotos
        let present = Set(photos.map(\.id))
        let gone = versions.keys.filter { !present.contains($0) && !$0.hasPrefix("cloud:") }
        if !gone.isEmpty, !library.isLoading, photos.count > 0 {
            database.forget(photos: Array(gone))
            for id in gone {
                versions.removeValue(forKey: id)
                insights.removeValue(forKey: id)
            }
        }
        let version = InsightDatabase.currentVersion
        let pending = photos.reversed().filter { photo in
            !cooling.contains(photo.id)
                && (versions[photo.id] != version || missingVector(photo.id)) && !library.isConcealed(photo.id)
        }.map(\.id)
        totalCount = photos.count
        analyzedCount = max(0, photos.count - pending.count)
        guard !pending.isEmpty else {
            if needsClustering { recluster() }
            return
        }
        running = true
        let token = UUID()
        workerToken = token
        lastProgress = Date()
        worker = Task { [weak self] in
            await self?.work(pending)
            // A worker replaced by the watchdog must not clear its successor.
            guard let self, self.workerToken == token else { return }
            self.worker = nil
            self.running = false
            self.recluster()
            if let task = self.backgroundTask {
                self.backgroundTask = nil
                task.setTaskCompleted(success: true)
            }
            // Photos that arrived while this pass ran (new shots, server photos) are next.
            Task { [weak self] in
                try? await Task.sleep(for: .seconds(3))
                self?.resume()
            }
        }
    }

    private var needsClustering = true
    private var workerToken = UUID()
    /// When the analysis last moved on (a photo done, or a deliberate pause).
    private var lastProgress = Date()
    private var watchdog: Task<Void, Never>?
    /// The photo being looked at right now; if the watchdog has to step in, this one waits for the next launch.
    private var currentID: String?

    /// Self-healing: if the analysis has not moved for two minutes while it should be working,
    /// the stuck step is abandoned and the queue starts again from the next photo, exactly what
    /// a relaunch of the app used to fix.
    private func startWatchdog() {
        guard watchdog == nil else { return }
        watchdog = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                guard let self else { return }
                guard self.worker != nil, self.foreground || self.backgroundTask != nil,
                      self.pauseReason == nil,
                      Date().timeIntervalSince(self.lastProgress) > 120 else { continue }
                if let stuck = self.currentID {
                    self.versions[stuck] = InsightDatabase.currentVersion
                }
                self.worker?.cancel()
                self.worker = nil
                self.running = false
                self.workerToken = UUID()
                self.resume()
            }
        }
    }

    private func work(_ ids: [String]) async {
        var sinceCluster = 0
        var sincePublish = 0
        var missing: [String] = []
        defer { settleMissing(missing) }
        for (index, id) in ids.enumerated() {
            if Task.isCancelled { return }
            // Server previews are fetched ahead in small batches, so the next photos are ready
            // when their turn comes instead of each one waiting for its own download.
            if index % 16 == 0 { prefetchPreviews(ids, from: index) }
            while !(await mayWork()) {
                if Task.isCancelled { return }
                // A deliberate pause (background, heat) is not a hang.
                lastProgress = Date()
                try? await Task.sleep(for: .seconds(20))
            }
            if Task.isCancelled { return }
            lastProgress = Date()
            currentID = id
            guard let source = await image(for: id) else {
                // No picture yet (a server preview still on its way): this photo comes back later.
                missing.append(id)
                lastProgress = Date()
                continue
            }
            previewMisses[id] = nil
            let models = self.models
            // One unusual file must never stop the whole library: after 45 s it is skipped for now.
            let analyzed: PhotoAnalyzer.Result? = await withCheckedContinuation { continuation in
                let gate = ResultGate()
                Task.detached(priority: .utility) {
                    let value = await PhotoAnalyzer.analyze(id: id, image: source.image, orientation: source.orientation, models: models)
                    gate.resume(continuation, value)
                }
                Task.detached {
                    try? await Task.sleep(for: .seconds(45))
                    gate.resume(continuation, nil)
                }
            }
            guard let result = analyzed else {
                versions[id] = InsightDatabase.currentVersion
                continue
            }
            let database = self.database
            let version = InsightDatabase.currentVersion
            await Task.detached(priority: .utility) {
                database.save(result.insight, faces: result.faces, version: version)
            }.value
            versions[id] = version
            insights[id] = result.insight
            analyzedCount += 1
            if !result.faces.isEmpty {
                sinceCluster += 1
                needsClustering = true
            }
            sincePublish += 1
            if sincePublish >= 24 {
                sincePublish = 0
                publishLabels()
                revision += 1
                refreshProgress()
            }
            if sinceCluster >= 150 {
                sinceCluster = 0
                // Grouping runs beside the analysis, never in its way.
                Task { [weak self] in await self?.clusterNow() }
            }
        }
        publishLabels()
    }

    private func prefetchPreviews(_ ids: [String], from index: Int) {
        let upcoming = ids[index..<min(ids.count, index + 40)].filter { $0.hasPrefix("cloud:") }
        guard !upcoming.isEmpty else { return }
        LibraryEngine.shared.prefetchThumbs(Array(upcoming))
    }

    /// Photos that had no picture in this pass are tried again in a minute (their previews are
    /// usually downloaded by then). After three empty passes they wait for the next launch, so the
    /// percentage never hangs below 100 because of a few files the server cannot show.
    private func settleMissing(_ missing: [String]) {
        var waiting = 0
        for id in missing {
            let tries = (previewMisses[id] ?? 0) + 1
            previewMisses[id] = tries
            if tries >= 3 {
                // Only in memory: the next launch tries this photo again.
                versions[id] = InsightDatabase.currentVersion
            } else {
                waiting += 1
                cooling.insert(id)
            }
        }
        waitingForPreviews = waiting
        skippedForNow = previewMisses.values.filter { $0 >= 3 }.count
        retryTask?.cancel()
        guard waiting > 0 else { return }
        retryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(50))
            guard !Task.isCancelled else { return }
            if self?.worker == nil {
                self?.resume(retrying: true)
            } else {
                // A pass is running: the waiting photos join the next one.
                self?.cooling.removeAll()
            }
        }
    }

    /// Never while the app is closed (unless iOS gave a charging-time task), never when hot,
    /// and slowly during the first big copy, which needs the phone more.
    private func mayWork() async -> Bool {
        guard foreground || backgroundTask != nil else { return false }
        let thermal = ProcessInfo.processInfo.thermalState
        if thermal == .serious || thermal == .critical {
            pauseReason = L("Przerwa: \(ThisDevice.name) jest ciepły. Wrócę, gdy ostygnie.")
            return false
        }
        pauseReason = nil
        // A warm phone gets breathing room between photos instead of a hard stop later.
        if thermal == .fair { try? await Task.sleep(for: .milliseconds(400)) }
        // During the first big copy to the server: gently, one photo every second and a half.
        if LibraryEngine.shared.stillCopying(), backgroundTask == nil {
            try? await Task.sleep(for: .milliseconds(1500))
        } else if ProcessInfo.processInfo.isLowPowerModeEnabled {
            try? await Task.sleep(for: .milliseconds(600))
        }
        return true
    }

    private struct Source: @unchecked Sendable {
        let image: CGImage
        let orientation: CGImagePropertyOrientation
    }

    private func image(for id: String) async -> Source? {
        if let asset = library?.asset(id: id) {
            guard let picture = await Self.request(asset, side: 768), let cg = picture.cgImage else { return nil }
            return Source(image: cg, orientation: CGImagePropertyOrientation(picture.imageOrientation))
        }
        if let thumb = LibraryEngine.shared.thumbnail(id: id), let cg = thumb.cgImage {
            return Source(image: cg, orientation: CGImagePropertyOrientation(thumb.imageOrientation))
        }
        // A photo that lives only on the server: its preview comes from there. Before, such a
        // photo was skipped in silence and the whole analysis stood still (at 81 % on a library
        // with a quarter of its photos only on the NAS) until the next launch.
        guard id.hasPrefix("cloud:"), let preview = await Self.serverPreview(id), let cg = preview.cgImage else { return nil }
        return Source(image: cg, orientation: CGImagePropertyOrientation(preview.imageOrientation))
    }

    /// The server preview, or nil after 30 seconds: one slow file never holds up the queue.
    private static func serverPreview(_ id: String) async -> UIImage? {
        await withCheckedContinuation { continuation in
            let gate = ImageGate()
            Task { @MainActor in
                let image = await LibraryEngine.shared.cloudThumb(id: id)
                gate.resume(continuation, image)
            }
            Task.detached {
                try? await Task.sleep(for: .seconds(30))
                gate.resume(continuation, nil)
            }
        }
    }

    /// The best copy already on the device. Downloading thousands of iCloud originals just to
    /// look at them would cost the user data and battery.
    /// Photos sometimes answers only with a quick low-quality frame and never with the final one
    /// (iCloud originals while the network is off). Waiting for it stopped the whole analysis, so
    /// after a few seconds the best frame received so far is used.
    nonisolated static func request(_ asset: PHAsset, side: CGFloat, timeout: TimeInterval = 8) async -> UIImage? {
        await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            options.isNetworkAccessAllowed = false
            options.isSynchronous = false
            let gate = ImageGate()
            let manager = PHImageManager.default()
            let requestID = manager.requestImage(
                for: asset, targetSize: CGSize(width: side, height: side), contentMode: .aspectFit, options: options
            ) { image, info in
                if (info?[PHImageResultIsDegradedKey] as? Bool) == true {
                    gate.keep(image)
                    return
                }
                gate.resume(continuation, image ?? gate.kept)
            }
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + timeout) {
                guard !gate.finished else { return }
                manager.cancelImageRequest(requestID)
                gate.resume(continuation, gate.kept)
            }
        }
    }

    // MARK: People

    private func recluster() {
        guard needsClustering, models.hasFaces else { return }
        Task { await clusterNow() }
    }

    @Published private(set) var clustering = false

    private func clusterNow() async {
        guard !clustering, models.hasFaces else { return }
        clustering = true
        needsClustering = false
        let database = self.database
        await Task.detached(priority: .utility) {
            let faces = database.faces()
            let people = database.people()
            let plan = FaceClustering.plan(faces: faces, people: people, rejections: database.rejections())
            for merge in plan.merges {
                database.merge(merge.from, into: merge.into)
            }
            database.assign(Dictionary(uniqueKeysWithValues: plan.evict.map { ($0, Int64?.none) }))
            database.assign(plan.assign.mapValues { Optional($0) })
            for group in plan.groups {
                let person = database.createPerson()
                database.assign(Dictionary(uniqueKeysWithValues: group.map { ($0, Optional(person)) }))
            }
        }.value
        clustering = false
        reloadPeople()
    }

    func reloadPeople() {
        let faces = database.faces(withEmbeddings: false)
        var byPhoto: [String: [FaceRecord]] = [:]
        var byPerson: [Int64: [FaceRecord]] = [:]
        for face in faces {
            byPhoto[face.photo, default: []].append(face)
            if let person = face.person { byPerson[person, default: []].append(face) }
        }
        facesByPhoto = byPhoto
        let known = database.people()
        records = Dictionary(uniqueKeysWithValues: known.map { ($0.id, $0) })
        var photos: [Int64: [String]] = [:]
        var visible: [PersonSummary] = []
        var hidden: [PersonSummary] = []
        let concealed: (String) -> Bool = { [weak library] id in library?.isConcealed(id) ?? false }
        for person in known {
            let members = byPerson[person.id] ?? []
            let ids = Array(Set(members.map(\.photo))).filter { !concealed($0) }
            photos[person.id] = ids
            guard !ids.isEmpty else { continue }
            // Cover: a clear, large face, preferably alone in its photo (no one else in the circle).
            func coverScore(_ face: FaceRecord) -> Float {
                let alone: Float = (byPhoto[face.photo]?.count ?? 1) == 1 ? 1.6 : 1
                return face.quality * Float(face.box.width) * alone
            }
            let cover = person.cover.flatMap { id in members.first { $0.id == id } }
                ?? members.max { coverScore($0) < coverScore($1) }
            let summary = PersonSummary(
                id: person.id, name: person.name, count: ids.count, coverFace: cover,
                favorite: person.favorite, hidden: person.hidden
            )
            if person.hidden {
                hidden.append(summary)
            } else if person.favorite || !person.name.isEmpty || ids.count >= FaceClustering.minimumGroup {
                visible.append(summary)
            }
        }
        photosByPerson = photos
        visible.sort { lhs, rhs in
            if lhs.favorite != rhs.favorite { return lhs.favorite }
            if lhs.hasName != rhs.hasName { return lhs.hasName }
            return lhs.count > rhs.count
        }
        people = visible
        hiddenPeople = hidden.sorted { $0.count > $1.count }
        revision += 1
        refreshProgress()
    }

    func photos(of person: Int64) -> [String] {
        photosByPerson[person] ?? []
    }

    func faces(of person: Int64) -> [FaceRecord] {
        let ids = Set(photos(of: person))
        return ids.flatMap { facesByPhoto[$0] ?? [] }.filter { $0.person == person }
            .sorted { $0.quality > $1.quality }
    }

    func person(_ id: Int64) -> PersonSummary? {
        people.first { $0.id == id } ?? hiddenPeople.first { $0.id == id }
    }

    func people(in photo: String) -> [PersonSummary] {
        let ids = Set((facesByPhoto[photo] ?? []).compactMap(\.person))
        return people.filter { ids.contains($0.id) }
    }

    /// For the Core console: how far each smart process has come.
    struct Progress: Equatable {
        var total = 0
        var analyzed = 0
        var labeled = 0
        var withText = 0
        var vectors = 0
        var faces = 0
        /// Faces clear enough to recognise, and how many of them already belong to a person.
        var recognisable = 0
        var placed = 0
        var people = 0
    }

    @Published private(set) var progress = Progress()

    private func refreshProgress() {
        var next = Progress()
        next.total = max(totalCount, insights.count)
        next.analyzed = insights.count
        for insight in insights.values {
            if !insight.labels.isEmpty { next.labeled += 1 }
            if !insight.words.isEmpty { next.withText += 1 }
            if insight.clip != nil { next.vectors += 1 }
            next.faces += insight.faceCount
        }
        next.people = people.count
        for faces in facesByPhoto.values {
            for face in faces where face.quality >= FaceClustering.minimumQuality {
                next.recognisable += 1
                if face.person != nil { next.placed += 1 }
            }
        }
        if next != progress { progress = next }
    }

    /// For the search screen: what the index holds right now.
    var searchStats: (analyzed: Int, vectors: Int, labeled: Int) {
        var vectors = 0
        var labeled = 0
        for insight in insights.values {
            if insight.clip != nil { vectors += 1 }
            if !insight.labels.isEmpty { labeled += 1 }
        }
        return (insights.count, vectors, labeled)
    }

    /// Names for the info sheet: people from an imported library first, then recognised ones.
    func names(for photo: PhotoRef, library: PhotoLibrary) -> [String] {
        var seen = Set<String>()
        let all = library.people(for: photo) + people(in: photo.id).filter(\.hasName).map(\.name)
        return all.filter { seen.insert($0.lowercased()).inserted }
    }

    /// Named people whose name contains the words, e.g. "ania" finds "Ania Kowalska".
    func people(matching text: String) -> [PersonSummary] {
        let wanted = PhotoAnalyzer.fold(text).split(separator: " ").map(String.init).filter { $0.count >= 2 }
        guard !wanted.isEmpty else { return [] }
        return people.filter { person in
            guard person.hasName else { return false }
            let name = PhotoAnalyzer.fold(person.name)
            return wanted.contains { word in name.split(separator: " ").contains { $0.hasPrefix(word) } }
        }
    }

    func rename(_ id: Int64, to name: String) {
        guard var record = records[id] else { return }
        record.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        database.update(record)
        reloadPeople()
    }

    func setFavorite(_ id: Int64, _ favorite: Bool) {
        guard var record = records[id] else { return }
        record.favorite = favorite
        database.update(record)
        reloadPeople()
    }

    func setHidden(_ id: Int64, _ hidden: Bool) {
        guard var record = records[id] else { return }
        record.hidden = hidden
        if hidden { record.favorite = false }
        database.update(record)
        reloadPeople()
    }

    func setCover(_ id: Int64, face: Int64) {
        guard var record = records[id] else { return }
        record.cover = face
        database.update(record)
        reloadPeople()
    }

    /// Several people are one: everything goes to the first one with a name (or the biggest).
    func merge(_ ids: [Int64]) {
        let chosen = ids.compactMap { person($0) }
        guard chosen.count > 1 else { return }
        let target = chosen.first { $0.hasName && $0.favorite } ?? chosen.first { $0.hasName }
            ?? chosen.max { $0.count < $1.count }!
        for other in chosen where other.id != target.id {
            database.merge(other.id, into: target.id)
        }
        // The merged faces are now confirmed: they pull new photos in more reliably.
        reloadPeople()
        needsClustering = true
        recluster()
    }

    /// "This is not this person": the faces leave and never come back here automatically.
    func remove(faces: [Int64], from person: Int64) {
        database.reject(faces: faces, person: person)
        for face in faces { faceCache.removeObject(forKey: NSNumber(value: face)) }
        reloadPeople()
    }

    /// Faces of one person with identity vectors (for the smart review).
    func reviewFaces(of person: Int64) async -> [FaceRecord] {
        let database = self.database
        let faces = await Task.detached(priority: .userInitiated) { database.faces(person: person) }.value
        let visible = Set(photos(of: person))
        return faces.filter { visible.contains($0.photo) || visible.isEmpty }
    }

    /// The faces taken out of a person usually belong to someone else, together: when they look
    /// alike they become that someone at once, and the next grouping pulls in the rest of their photos.
    func split(_ removed: [FaceRecord], from person: Int64) {
        let ids = removed.map(\.id)
        database.reject(faces: ids, person: person)
        for face in ids { faceCache.removeObject(forKey: NSNumber(value: face)) }
        let vectors = removed.compactMap { face in face.embedding.map { (face, $0) } }
        if vectors.count >= 2 {
            var sum = [Float](repeating: 0, count: 128)
            for (_, vector) in vectors { for index in 0..<128 { sum[index] += vector[index] } }
            let centre = FaceClustering.normalized(sum)
            var photos = Set<String>()
            var together: [Int64] = []
            for (face, vector) in vectors.sorted(by: { FaceClustering.dot($0.1, centre) > FaceClustering.dot($1.1, centre) })
            where FaceClustering.dot(vector, centre) >= 0.45 && !photos.contains(face.photo) {
                photos.insert(face.photo)
                together.append(face.id)
            }
            if together.count >= 2 {
                let newcomer = database.createPerson()
                database.assign(Dictionary(uniqueKeysWithValues: together.map { ($0, Optional(newcomer)) }))
            }
        }
        reloadPeople()
        needsClustering = true
        recluster()
    }

    /// The user agrees with every face of this person: they anchor future matching.
    func confirmAll(_ person: Int64) {
        let ids = faces(of: person).map(\.id)
        database.assign(Dictionary(uniqueKeysWithValues: ids.map { ($0, Optional(person)) }), confirmed: true)
        reloadPeople()
    }

    /// Starts everything again (Settings → "Przeanalizuj ponownie").
    func rebuild() {
        worker?.cancel()
        worker = nil
        database.wipe()
        versions.removeAll()
        insights.removeAll()
        previewMisses.removeAll()
        waitingForPreviews = 0
        skippedForNow = 0
        faceCache.removeAllObjects()
        reloadPeople()
        needsClustering = true
        resume()
    }

    private func publishLabels() {
        guard let library else { return }
        var labels: [String: [String]] = [:]
        labels.reserveCapacity(insights.count)
        for (id, insight) in insights where !insight.labels.isEmpty {
            labels[id] = insight.labelNames
        }
        library.adoptLabels(labels)
    }

    // MARK: Face pictures

    /// A square, slightly loose crop around the face, for round avatars.
    func faceImage(_ face: FaceRecord, side: CGFloat = 240) async -> UIImage? {
        let key = NSNumber(value: face.id)
        if let hit = faceCache.object(forKey: key) { return hit }
        var picture: UIImage?
        if let asset = library?.asset(id: face.photo) {
            picture = await Self.request(asset, side: max(900, side * 4))
        } else {
            picture = LibraryEngine.shared.thumbnail(id: face.photo)
        }
        guard let picture else { return nil }
        let cropped = await Task.detached(priority: .userInitiated) {
            Self.crop(picture, box: face.box, side: side)
        }.value
        if let cropped { faceCache.setObject(cropped, forKey: key) }
        return cropped
    }

    nonisolated private static func crop(_ image: UIImage, box: CGRect, side: CGFloat) -> UIImage? {
        // Vision boxes are bottom-left based in the upright picture.
        let size = image.size
        let width = box.width * size.width
        let height = box.height * size.height
        let centre = CGPoint(x: box.midX * size.width, y: (1 - box.midY) * size.height)
        let edge = max(width, height) * 1.5
        var rect = CGRect(x: centre.x - edge / 2, y: centre.y - edge / 2 + height * 0.04, width: edge, height: edge)
        rect = rect.intersection(CGRect(origin: .zero, size: size))
        guard rect.width > 4, rect.height > 4 else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
        return renderer.image { _ in
            let scale = side / min(rect.width, rect.height)
            let drawSize = CGSize(width: size.width * scale, height: size.height * scale)
            image.draw(in: CGRect(x: -rect.minX * scale, y: -rect.minY * scale, width: drawSize.width, height: drawSize.height))
        }
    }

    // MARK: Overnight

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            guard let task = task as? BGProcessingTask else { return }
            Task { @MainActor in
                let brain = PhotoIntelligence.shared
                brain.backgroundTask = task
                task.expirationHandler = {
                    Task { @MainActor in
                        brain.worker?.cancel()
                        brain.worker = nil
                        brain.running = false
                        brain.backgroundTask = nil
                        brain.models.unload()
                        task.setTaskCompleted(success: false)
                        Self.scheduleOvernight()
                    }
                }
                if brain.library == nil || brain.worker != nil {
                    // Woken without a library (the app was not running): finish politely, try later.
                    if brain.worker == nil {
                        brain.backgroundTask = nil
                        task.setTaskCompleted(success: true)
                        Self.scheduleOvernight()
                    }
                    return
                }
                brain.resume()
                if brain.worker == nil {
                    brain.backgroundTask = nil
                    task.setTaskCompleted(success: true)
                }
            }
        }
    }

    /// Asks iOS for time while the phone charges, usually at night.
    static func scheduleOvernight() {
        let request = BGProcessingTaskRequest(identifier: taskIdentifier)
        request.requiresExternalPower = true
        request.requiresNetworkConnectivity = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}

private final class ResultGate: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    func resume(_ continuation: CheckedContinuation<PhotoAnalyzer.Result?, Never>, _ value: PhotoAnalyzer.Result?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(returning: value)
    }
}

private final class ImageGate: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    private var early: UIImage?

    var finished: Bool {
        lock.lock()
        defer { lock.unlock() }
        return done
    }

    var kept: UIImage? {
        lock.lock()
        defer { lock.unlock() }
        return early
    }

    func keep(_ image: UIImage?) {
        guard let image else { return }
        lock.lock()
        early = image
        lock.unlock()
    }

    func resume(_ continuation: CheckedContinuation<UIImage?, Never>, _ image: UIImage?) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(returning: image)
    }
}

extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}
