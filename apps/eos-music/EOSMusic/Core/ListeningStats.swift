import Foundation
import Combine

/// One listened track for the signed-in user (persisted on device).
struct ListenRecord: Codable, Equatable, Identifiable {
    var id: String { url }
    var url: String
    var title: String
    var artist: String?
    var album: String?
    var thumbnail: String?
    var duration: Double?
    var folderId: String?
    var playCount: Int
    var lastPlayedAt: TimeInterval
    var firstPlayedAt: TimeInterval
    var totalListenSeconds: Double
    var eveningPlayCount: Int
    /// Unix timestamps of qualified plays (trimmed to ~90 days).
    var playTimestamps: [TimeInterval]

    func asTrack() -> MusicTrack {
        MusicTrack(
            folderId: folderId ?? MusicTrack.localOfflineFolderId,
            url: url,
            title: title,
            artist: artist,
            album: album,
            thumbnail: thumbnail,
            duration: duration
        )
    }
}

struct SmartPlaylistEntry: Identifiable, Hashable {
    var id: String { track.url }
    let track: MusicTrack
    let playCount: Int
    let lastPlayedAt: Date?
}

enum SmartPlaylistKind: String, CaseIterable, Identifiable, Hashable {
    case top50
    case onFire
    case recentlyPlayed
    case evening
    case rediscover

    var id: String { rawValue }

    var title: String {
        switch self {
        case .top50: return "Top 50"
        case .onFire: return "Na fali"
        case .recentlyPlayed: return "Ostatnio grane"
        case .evening: return "Wieczorne hity"
        case .rediscover: return "Odkryj ponownie"
        }
    }

    var subtitle: String {
        switch self {
        case .top50: return "Najczęściej słuchane utwory"
        case .onFire: return "Najwięcej odtworzeń z ostatnich 30 dni"
        case .recentlyPlayed: return "To, czego słuchałeś ostatnio"
        case .evening: return "Hity z godzin 18:00–24:00"
        case .rediscover: return "Dawno niesłuchane z Twojej biblioteki"
        }
    }

    var systemImage: String {
        switch self {
        case .top50: return "chart.bar.fill"
        case .onFire: return "flame.fill"
        case .recentlyPlayed: return "clock.fill"
        case .evening: return "moon.stars.fill"
        case .rediscover: return "arrow.counterclockwise"
        }
    }

    var emptyHint: String {
        switch self {
        case .top50: return "Słuchaj muzyki — tu ułożą się Twoje najczęściej grane utwory."
        case .onFire: return "Tu pojawią się utwory, które kręcisz w tym miesiącu."
        case .recentlyPlayed: return "Ostatnio puszczane utwory zbiorą się w tej playliście."
        case .evening: return "Słuchaj wieczorem — tu trafią Twoje nocne hity."
        case .rediscover: return "Tu wrócą utwory, których dawno nie puszczałeś."
        }
    }

    var accent: (r: Double, g: Double, b: Double) {
        switch self {
        case .top50: return (0.95, 0.22, 0.38)
        case .onFire: return (1.00, 0.45, 0.18)
        case .recentlyPlayed: return (0.22, 0.48, 0.98)
        case .evening: return (0.42, 0.28, 0.86)
        case .rediscover: return (0.12, 0.68, 0.62)
        }
    }
}

enum ListeningStatsPolicy {
    static let qualifySeconds: Double = 30
    static let shortTrackFraction: Double = 0.5
    static let eveningHours = 18..<24
    static let onFireDays = 30
    static let rediscoverDays = 45
    static let timestampHorizonDays = 90
    static let maxTimestamps = 400

    static func qualifies(accumulated: Double, duration: Double) -> Bool {
        if accumulated >= qualifySeconds { return true }
        if duration > 0, duration < 60, accumulated >= duration * shortTrackFraction { return true }
        return false
    }

    static func playCountLabel(_ count: Int) -> String {
        let n = max(0, count)
        if n == 1 { return "1 odtworzenie" }
        let mod10 = n % 10
        let mod100 = n % 100
        let few = (mod10 >= 2 && mod10 <= 4) && !(mod100 >= 12 && mod100 <= 14)
        if few { return "\(n) odtworzenia" }
        return "\(n) odtworzeń"
    }

    static func compactPlayCount(_ count: Int) -> String {
        "\(max(0, count))×"
    }
}

enum SmartPlaylistBuilder {
    static func entries(
        kind: SmartPlaylistKind,
        records: [ListenRecord],
        library: [MusicTrack],
        now: Date = Date()
    ) -> [SmartPlaylistEntry] {
        let libraryByURL = Dictionary(library.map { ($0.url, $0) }, uniquingKeysWith: { first, _ in first })
        switch kind {
        case .top50:
            return ranked(
                records.filter { $0.playCount > 0 }.sorted {
                    if $0.playCount != $1.playCount { return $0.playCount > $1.playCount }
                    return $0.lastPlayedAt > $1.lastPlayedAt
                },
                libraryByURL: libraryByURL,
                limit: 50
            )
        case .onFire:
            let cutoff = now.timeIntervalSince1970 - Double(ListeningStatsPolicy.onFireDays * 24 * 3600)
            let scored: [(ListenRecord, Int)] = records.compactMap { record in
                let recent = record.playTimestamps.filter { $0 >= cutoff }.count
                guard recent > 0 else { return nil }
                return (record, recent)
            }
            .sorted {
                if $0.1 != $1.1 { return $0.1 > $1.1 }
                return $0.0.lastPlayedAt > $1.0.lastPlayedAt
            }
            return scored.prefix(40).map { pair in
                entry(record: pair.0, playCount: pair.1, libraryByURL: libraryByURL)
            }
        case .recentlyPlayed:
            return ranked(
                records.filter { $0.playCount > 0 }.sorted { $0.lastPlayedAt > $1.lastPlayedAt },
                libraryByURL: libraryByURL,
                limit: 40
            )
        case .evening:
            return ranked(
                records.filter { $0.eveningPlayCount > 0 }.sorted {
                    if $0.eveningPlayCount != $1.eveningPlayCount { return $0.eveningPlayCount > $1.eveningPlayCount }
                    return $0.lastPlayedAt > $1.lastPlayedAt
                },
                libraryByURL: libraryByURL,
                limit: 40,
                playCount: { $0.eveningPlayCount }
            )
        case .rediscover:
            let cutoff = now.timeIntervalSince1970 - Double(ListeningStatsPolicy.rediscoverDays * 24 * 3600)
            let played = Set(records.map(\.url))
            var result: [SmartPlaylistEntry] = []

            let stale = records.filter { record in
                record.playCount > 0 && record.lastPlayedAt < cutoff
            }
            .sorted { $0.lastPlayedAt < $1.lastPlayedAt }
            result.append(contentsOf: ranked(stale, libraryByURL: libraryByURL, limit: 30))

            if result.count < 30 {
                let neverPlayed = library.filter { !played.contains($0.url) }
                for track in neverPlayed.prefix(30 - result.count) {
                    result.append(SmartPlaylistEntry(track: track, playCount: 0, lastPlayedAt: nil))
                }
            }
            return result
        }
    }

    private static func ranked(
        _ records: [ListenRecord],
        libraryByURL: [String: MusicTrack],
        limit: Int,
        playCount: (ListenRecord) -> Int = { $0.playCount }
    ) -> [SmartPlaylistEntry] {
        Array(records.prefix(limit)).map { entry(record: $0, playCount: playCount($0), libraryByURL: libraryByURL) }
    }

    private static func entry(
        record: ListenRecord,
        playCount: Int,
        libraryByURL: [String: MusicTrack]
    ) -> SmartPlaylistEntry {
        let track = libraryByURL[record.url] ?? record.asTrack()
        let last = record.lastPlayedAt > 0 ? Date(timeIntervalSince1970: record.lastPlayedAt) : nil
        return SmartPlaylistEntry(track: track, playCount: playCount, lastPlayedAt: last)
    }
}

enum ListeningStatsMerger {
    static func merge(_ local: ListenRecord, _ remote: ListenRecord) -> ListenRecord {
        let newer = local.lastPlayedAt >= remote.lastPlayedAt ? local : remote
        let timestamps = trimTimestamps(local.playTimestamps + remote.playTimestamps)
        let lastPlayed = max(local.lastPlayedAt, remote.lastPlayedAt)
        let firstPlayed = min(
            local.firstPlayedAt > 0 ? local.firstPlayedAt : local.lastPlayedAt,
            remote.firstPlayedAt > 0 ? remote.firstPlayedAt : remote.lastPlayedAt
        )
        let evening = timestamps.filter { ListeningStatsPolicy.eveningHours.contains(Calendar.current.component(.hour, from: Date(timeIntervalSince1970: $0))) }.count
        return ListenRecord(
            url: local.url,
            title: newer.title,
            artist: newer.artist ?? local.artist ?? remote.artist,
            album: newer.album ?? local.album ?? remote.album,
            thumbnail: newer.thumbnail ?? local.thumbnail ?? remote.thumbnail,
            duration: newer.duration ?? local.duration ?? remote.duration,
            folderId: newer.folderId ?? local.folderId ?? remote.folderId,
            playCount: max(local.playCount, remote.playCount, timestamps.count),
            lastPlayedAt: lastPlayed,
            firstPlayedAt: firstPlayed > 0 ? firstPlayed : lastPlayed,
            totalListenSeconds: max(local.totalListenSeconds, remote.totalListenSeconds),
            eveningPlayCount: evening,
            playTimestamps: timestamps
        )
    }

    static func mergeMaps(local: [String: ListenRecord], remote: [String: ListenRecord]) -> [String: ListenRecord] {
        var merged = local
        for (url, remoteRecord) in remote {
            if let localRecord = merged[url] {
                merged[url] = merge(localRecord, remoteRecord)
            } else {
                merged[url] = remoteRecord
            }
        }
        return merged
    }

    private static func trimTimestamps(_ stamps: [TimeInterval]) -> [TimeInterval] {
        let now = Date().timeIntervalSince1970
        let horizon = now - Double(ListeningStatsPolicy.timestampHorizonDays * 24 * 3600)
        var seen = Set<TimeInterval>()
        let filtered = stamps
            .filter { $0 >= horizon }
            .sorted()
            .filter { seen.insert($0).inserted }
        return Array(filtered.suffix(ListeningStatsPolicy.maxTimestamps))
    }
}

struct ListeningStatsResponse: Codable {
    let updatedAt: Double?
    let records: [ListenRecord]
}

@MainActor
final class ListeningStatsStore: ObservableObject {
    static let shared = ListeningStatsStore()

    @Published private(set) var records: [String: ListenRecord] = [:]
    private var userLogin: String?
    private var pushTask: Task<Void, Never>?
    private var syncTask: Task<Void, Never>?
    var apiProvider: (() -> MusicAPIClient?)?

    func activate(userLogin: String?) {
        let next = userLogin?.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = (next?.isEmpty == false) ? next : nil
        if key == self.userLogin { return }
        pushTask?.cancel()
        syncTask?.cancel()
        persist()
        self.userLogin = key
        records = Self.load(login: key)
    }

    func syncWithServer() async {
        guard userLogin != nil, let api = apiProvider?(), api.isAuthenticated else { return }
        if let existing = syncTask, !existing.isCancelled {
            await existing.value
            return
        }
        let task = Task { @MainActor in
            await self.performSync(using: api)
        }
        syncTask = task
        await task.value
    }

    private func performSync(using api: MusicAPIClient) async {
        do {
            let remote = try await api.fetchListeningStats()
            let remoteMap = Dictionary(uniqueKeysWithValues: remote.records.map { ($0.url, $0) })
            let merged = ListeningStatsMerger.mergeMaps(local: records, remote: remoteMap)
            records = merged
            persist()
            let pushed = try await api.syncListeningStats(records: Array(merged.values))
            let pushedMap = Dictionary(uniqueKeysWithValues: pushed.records.map { ($0.url, $0) })
            records = ListeningStatsMerger.mergeMaps(local: records, remote: pushedMap)
            persist()
        } catch {
            EOSPerfLog.download.error("listening stats sync failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func scheduleServerPush() {
        guard userLogin != nil, let api = apiProvider?(), api.isAuthenticated else { return }
        pushTask?.cancel()
        pushTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            await self.pushToServer(using: api)
        }
    }

    private func pushToServer(using api: MusicAPIClient) async {
        guard !records.isEmpty else { return }
        do {
            let response = try await api.syncListeningStats(records: Array(records.values))
            let remoteMap = Dictionary(uniqueKeysWithValues: response.records.map { ($0.url, $0) })
            records = ListeningStatsMerger.mergeMaps(local: records, remote: remoteMap)
            persist()
        } catch {
            EOSPerfLog.download.error("listening stats push failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    var allRecords: [ListenRecord] {
        Array(records.values)
    }

    func entries(for kind: SmartPlaylistKind, library: [MusicTrack]) -> [SmartPlaylistEntry] {
        SmartPlaylistBuilder.entries(kind: kind, records: allRecords, library: library)
    }

    func playCount(for url: String) -> Int {
        records[url]?.playCount ?? 0
    }

    func recordPlay(track: MusicPlaybackTrack, listenedSeconds: Double, at date: Date = Date()) {
        guard userLogin != nil, !track.url.isEmpty else { return }
        let now = date.timeIntervalSince1970
        let hour = Calendar.current.component(.hour, from: date)
        var record = records[track.url] ?? ListenRecord(
            url: track.url,
            title: track.title,
            artist: track.artist,
            album: track.album,
            thumbnail: track.thumbnail,
            duration: track.duration,
            folderId: track.folderId,
            playCount: 0,
            lastPlayedAt: now,
            firstPlayedAt: now,
            totalListenSeconds: 0,
            eveningPlayCount: 0,
            playTimestamps: []
        )
        record.title = track.title
        if let artist = track.artist, !artist.isEmpty { record.artist = artist }
        if let album = track.album, !album.isEmpty { record.album = album }
        if let thumb = track.thumbnail, !thumb.isEmpty { record.thumbnail = thumb }
        if let duration = track.duration { record.duration = duration }
        if let folderId = track.folderId { record.folderId = folderId }
        record.playCount += 1
        record.lastPlayedAt = now
        record.totalListenSeconds += max(0, listenedSeconds)
        if ListeningStatsPolicy.eveningHours.contains(hour) {
            record.eveningPlayCount += 1
        }
        record.playTimestamps.append(now)
        let horizon = now - Double(ListeningStatsPolicy.timestampHorizonDays * 24 * 3600)
        record.playTimestamps = Array(record.playTimestamps.filter { $0 >= horizon }.suffix(ListeningStatsPolicy.maxTimestamps))
        records[track.url] = record
        persist()
        scheduleServerPush()
    }

    private func persist() {
        guard let login = userLogin else { return }
        let envelope = Envelope(login: login, records: Array(records.values))
        guard let data = try? JSONEncoder().encode(envelope) else { return }
        try? data.write(to: Self.fileURL(login: login), options: [.atomic])
    }

    private static func load(login: String?) -> [String: ListenRecord] {
        guard let login else { return [:] }
        guard let data = try? Data(contentsOf: fileURL(login: login)),
              let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else {
            return [:]
        }
        return Dictionary(uniqueKeysWithValues: envelope.records.map { ($0.url, $0) })
    }

    private static func fileURL(login: String) -> URL {
        let safe = login
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        return AppDocuments.root.appendingPathComponent("listening-stats-\(safe).json", isDirectory: false)
    }

    private struct Envelope: Codable {
        let login: String
        let records: [ListenRecord]
    }
}
