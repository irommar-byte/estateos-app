import CloudKit
import CoreLocation
import ImageIO
import Photos
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// MARK: - Model

/// Someone linked through an iCloud invitation. No GalleryOS account: only Apple IDs.
struct CloudFriend: Identifiable, Hashable {
    let id: String
    let name: String
    /// The small shared zone that links the two people; invitations to albums travel through it.
    let linkZone: CKRecordZone.ID
    /// True when the other person invited me (the zone lives in their iCloud).
    let invitedMe: Bool
    let userRecordID: CKRecord.ID?
    let accepted: Bool
}

struct CloudAlbum: Identifiable, Hashable {
    let id: String
    let title: String
    let zone: CKRecordZone.ID
    let mine: Bool
    let owner: String
    let count: Int
}

struct CloudPhoto: Identifiable {
    let id: CKRecord.ID
    let created: Date
    let thumb: UIImage?
}

struct ShareInvitation: Identifiable {
    let id = UUID()
    let share: CKShare
    let container: CKContainer
    let readWrite: Bool
}

/// Everything shared with friends goes through iCloud (CloudKit):
/// - "Dodaj znajomego" creates a small link zone shared through Messages or Mail.
/// - Each album is its own zone with photos (up to 1.5 MB each) in the sender's iCloud.
/// - An album shared with a friend leaves an invitation in the link zone; the friend's
///   GalleryOS accepts it by itself, no second link needed.
@MainActor
final class CloudShares: ObservableObject {
    static let shared = CloudShares()
    static let containerID = "iCloud.pl.galleryos.app"

    @Published private(set) var friends: [CloudFriend] = []
    @Published private(set) var myAlbums: [CloudAlbum] = []
    @Published private(set) var friendAlbums: [CloudAlbum] = []
    @Published private(set) var available = true
    @Published private(set) var loading = false
    @Published var status = ""

    let container = CKContainer(identifier: containerID)
    private var privateDB: CKDatabase { container.privateCloudDatabase }
    private var sharedDB: CKDatabase { container.sharedCloudDatabase }
    private var me: CKRecord.ID?
    private static let linkPrefix = "GalleryLink-"
    private static let albumPrefix = "GalleryAlbum-"
    private static let handledKey = "galleryos.cloud.handled-invites"

    private var handled: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: Self.handledKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue), forKey: Self.handledKey) }
    }

    // MARK: Refresh

    func refresh() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            guard try await container.accountStatus() == .available else {
                available = false
                status = L("Zaloguj się do iCloud w Ustawieniach, żeby udostępniać albumy znajomym.")
                return
            }
            available = true
            if me == nil { me = try await container.userRecordID() }
            var privateZones = try await privateDB.allRecordZones()
            var sharedZones = try await sharedDB.allRecordZones()
            let links = await readFriends(privateZones: privateZones, sharedZones: sharedZones)
            friends = links
            if await acceptInvites(links) {
                sharedZones = try await sharedDB.allRecordZones()
                privateZones = try await privateDB.allRecordZones()
            }
            myAlbums = await readAlbums(privateZones, database: privateDB, mine: true)
            friendAlbums = await readAlbums(sharedZones, database: sharedDB, mine: false)
            status = ""
        } catch {
            status = Self.message(for: error)
        }
    }

    /// Called when iOS hands over an invitation opened from Messages or Mail.
    func accept(_ metadata: CKShare.Metadata) async {
        do {
            _ = try await container.accept(metadata)
        } catch {
            status = L("Nie udało się przyjąć zaproszenia. Sprawdź, czy jesteś zalogowany do iCloud.")
        }
        await refresh()
    }

    private func readFriends(privateZones: [CKRecordZone], sharedZones: [CKRecordZone]) async -> [CloudFriend] {
        var result: [CloudFriend] = []
        for zone in privateZones where zone.zoneID.zoneName.hasPrefix(Self.linkPrefix) {
            guard let share = try? await zoneShare(zone.zoneID, in: privateDB) else { continue }
            for participant in share.participants where participant.role != .owner {
                let name = Self.name(of: participant.userIdentity)
                result.append(CloudFriend(
                    id: zone.zoneID.zoneName + "|" + (participant.userIdentity.userRecordID?.recordName ?? name),
                    name: name,
                    linkZone: zone.zoneID,
                    invitedMe: false,
                    userRecordID: participant.userIdentity.userRecordID,
                    accepted: participant.acceptanceStatus == CKShare.ParticipantAcceptanceStatus.accepted
                ))
            }
        }
        for zone in sharedZones where zone.zoneID.zoneName.hasPrefix(Self.linkPrefix) {
            guard let share = try? await zoneShare(zone.zoneID, in: sharedDB) else { continue }
            result.append(CloudFriend(
                id: zone.zoneID.zoneName + "|" + zone.zoneID.ownerName,
                name: Self.name(of: share.owner.userIdentity),
                linkZone: zone.zoneID,
                invitedMe: true,
                userRecordID: share.owner.userIdentity.userRecordID,
                accepted: true
            ))
        }
        // The same person can be linked twice (both invited each other); show them once.
        var seen = Set<String>()
        return result
            .sorted { $0.accepted && !$1.accepted }
            .filter { friend in
                let key = friend.userRecordID?.recordName ?? friend.id
                return seen.insert(key).inserted
            }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func readAlbums(_ zones: [CKRecordZone], database: CKDatabase, mine: Bool) async -> [CloudAlbum] {
        var result: [CloudAlbum] = []
        for zone in zones where zone.zoneID.zoneName.hasPrefix(Self.albumPrefix) {
            let info = try? await database.record(for: CKRecord.ID(recordName: "info", zoneID: zone.zoneID))
            let title = info?["title"] as? String ?? L("Album")
            let count = info?["count"] as? Int ?? 0
            var owner = L("Ty")
            if !mine, let share = try? await zoneShare(zone.zoneID, in: database) {
                owner = Self.name(of: share.owner.userIdentity)
            }
            result.append(CloudAlbum(
                id: zone.zoneID.zoneName + "|" + zone.zoneID.ownerName,
                title: title,
                zone: zone.zoneID,
                mine: mine,
                owner: owner,
                count: count
            ))
        }
        return result.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    /// Accepts album invitations friends left in the shared link zones. Returns true when something was accepted.
    private func acceptInvites(_ links: [CloudFriend]) async -> Bool {
        var done = handled
        var acceptedAny = false
        let zones = Set(links.map(\.linkZone))
        for zone in zones {
            let database = zone.ownerName == CKCurrentUserDefaultName ? privateDB : sharedDB
            guard let records = try? await allRecords(in: zone, database: database, keys: nil) else { continue }
            for record in records where record.recordType == "GalleryInvite" {
                let key = record.recordID.recordName
                guard !done.contains(key) else { continue }
                if let sender = record["sender"] as? String, sender == me?.recordName { continue }
                guard let text = record["url"] as? String, let url = URL(string: text) else {
                    done.insert(key)
                    continue
                }
                do {
                    let metadata = try await container.shareMetadata(for: url)
                    if metadata.participantStatus != CKShare.ParticipantAcceptanceStatus.accepted {
                        _ = try await container.accept(metadata)
                        acceptedAny = true
                    }
                    done.insert(key)
                } catch {
                    // Not meant for this Apple ID, or the album was removed: do not try again.
                    done.insert(key)
                }
            }
        }
        handled = done
        return acceptedAny
    }

    // MARK: Friends

    /// A new link zone and its share, ready for the system invitation sheet.
    func inviteFriend() async -> ShareInvitation? {
        do {
            guard try await container.accountStatus() == .available else {
                status = L("Zaloguj się do iCloud w Ustawieniach.")
                return nil
            }
            let zone = CKRecordZone(zoneName: Self.linkPrefix + UUID().uuidString)
            _ = try await privateDB.modifyRecordZones(saving: [zone], deleting: [])
            let share = CKShare(recordZoneID: zone.zoneID)
            share[CKShare.SystemFieldKey.title] = L("Znajomi w GalleryOS") as CKRecordValue
            share.publicPermission = .none
            // The saved copy carries the invitation URL; the local one does not, and Messages
            // waited for it forever.
            let saved = try await privateDB.modifyRecords(saving: [share], deleting: [])
            let stored = (try? saved.saveResults[share.recordID]?.get()) as? CKShare ?? share
            return ShareInvitation(share: stored, container: container, readWrite: true)
        } catch {
            status = Self.message(for: error)
            return nil
        }
    }

    func remove(_ friend: CloudFriend) async {
        do {
            if friend.invitedMe {
                _ = try await sharedDB.deleteRecordZone(withID: friend.linkZone)
            } else {
                _ = try await privateDB.deleteRecordZone(withID: friend.linkZone)
            }
        } catch {
            status = Self.message(for: error)
        }
        await refresh()
    }

    // MARK: Albums

    /// Creates the album in iCloud, uploads the photos and shares it with the chosen friends.
    /// Returns the share so people without GalleryOS friends can still be invited by link.
    func shareAlbum(
        title: String,
        photos: [SharedPhotoSource],
        with chosen: [CloudFriend],
        progress: @escaping @MainActor (Int, Int) -> Void
    ) async throws -> CKShare {
        if me == nil { me = try await container.userRecordID() }
        let zone = CKRecordZone(zoneName: Self.albumPrefix + UUID().uuidString)
        _ = try await privateDB.modifyRecordZones(saving: [zone], deleting: [])
        let info = CKRecord(recordType: "GalleryAlbum", recordID: CKRecord.ID(recordName: "info", zoneID: zone.zoneID))
        info["title"] = title as CKRecordValue
        info["created"] = Date() as CKRecordValue
        info["count"] = photos.count
        _ = try await privateDB.modifyRecords(saving: [info], deleting: [])

        var batch: [CKRecord] = []
        var files: [URL] = []
        var sent = 0
        progress(0, photos.count)
        for source in photos {
            guard let prepared = await SharedPhotoEncoder.prepare(source) else { continue }
            let record = CKRecord(recordType: "GalleryPhoto", recordID: CKRecord.ID(zoneID: zone.zoneID))
            record["asset"] = CKAsset(fileURL: prepared.full)
            record["thumb"] = CKAsset(fileURL: prepared.thumb)
            record["created"] = source.created as CKRecordValue
            if let location = source.location { record["location"] = location }
            batch.append(record)
            files += [prepared.full, prepared.thumb]
            if batch.count >= 8 {
                _ = try await privateDB.modifyRecords(saving: batch, deleting: [])
                sent += batch.count
                batch.removeAll()
                Self.clean(files)
                files.removeAll()
                progress(sent, photos.count)
            }
        }
        if !batch.isEmpty {
            _ = try await privateDB.modifyRecords(saving: batch, deleting: [])
            sent += batch.count
            Self.clean(files)
            progress(sent, photos.count)
        }
        if sent != photos.count {
            info["count"] = sent
            _ = try? await privateDB.modifyRecords(saving: [info], deleting: [], savePolicy: .changedKeys)
        }

        let share = CKShare(recordZoneID: zone.zoneID)
        share[CKShare.SystemFieldKey.title] = title as CKRecordValue
        share.publicPermission = .none
        for friend in chosen {
            guard let id = friend.userRecordID,
                  let participant = try? await container.shareParticipant(forUserRecordID: id) else { continue }
            participant.permission = .readOnly
            share.addParticipant(participant)
        }
        let saved = try await privateDB.modifyRecords(saving: [share], deleting: [])
        let stored = (try? saved.saveResults[share.recordID]?.get()) as? CKShare ?? share
        if let url = stored.url {
            for friend in chosen {
                await leaveInvite(url: url, title: title, in: friend)
            }
        }
        await refresh()
        return stored
    }

    private func leaveInvite(url: URL, title: String, in friend: CloudFriend) async {
        let database = friend.invitedMe ? sharedDB : privateDB
        let invite = CKRecord(recordType: "GalleryInvite", recordID: CKRecord.ID(zoneID: friend.linkZone))
        invite["url"] = url.absoluteString as CKRecordValue
        invite["title"] = title as CKRecordValue
        invite["sender"] = (me?.recordName ?? "") as CKRecordValue
        _ = try? await database.modifyRecords(saving: [invite], deleting: [])
    }

    func photos(in album: CloudAlbum) async throws -> [CloudPhoto] {
        let database = album.mine ? privateDB : sharedDB
        let records = try await allRecords(in: album.zone, database: database, keys: ["thumb", "created"])
        return records
            .filter { $0.recordType == "GalleryPhoto" }
            .map { record in
                let thumb = (record["thumb"] as? CKAsset)?.fileURL.flatMap { UIImage(contentsOfFile: $0.path) }
                return CloudPhoto(id: record.recordID, created: record["created"] as? Date ?? .distantPast, thumb: thumb)
            }
            .sorted { $0.created < $1.created }
    }

    /// The full photo, copied out of the CloudKit cache so it can be shared or saved.
    func fullPhoto(_ photo: CloudPhoto, in album: CloudAlbum) async throws -> URL {
        let database = album.mine ? privateDB : sharedDB
        let record = try await database.record(for: photo.id)
        guard let source = (record["asset"] as? CKAsset)?.fileURL else { throw CKError(.assetFileNotFound) }
        let ext = UTType(filenameExtension: source.pathExtension) == nil ? "heic" : source.pathExtension
        let target = FileManager.default.temporaryDirectory
            .appendingPathComponent("GalleryOS-\(photo.id.recordName)")
            .appendingPathExtension(ext.isEmpty ? "heic" : ext)
        try? FileManager.default.removeItem(at: target)
        try FileManager.default.copyItem(at: source, to: target)
        return target
    }

    func albumShare(_ album: CloudAlbum) async -> ShareInvitation? {
        guard album.mine, let share = try? await zoneShare(album.zone, in: privateDB) else { return nil }
        return ShareInvitation(share: share, container: container, readWrite: false)
    }

    /// Owner: deletes the album from iCloud for everyone. Friend: leaves it.
    func remove(_ album: CloudAlbum) async {
        do {
            if album.mine {
                _ = try await privateDB.deleteRecordZone(withID: album.zone)
            } else {
                _ = try await sharedDB.deleteRecordZone(withID: album.zone)
            }
        } catch {
            status = Self.message(for: error)
        }
        await refresh()
    }

    // MARK: Helpers

    private func zoneShare(_ zone: CKRecordZone.ID, in database: CKDatabase) async throws -> CKShare? {
        try await database.record(for: CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: zone)) as? CKShare
    }

    /// Reads a whole zone through its change feed. Unlike a query, this needs no index in the schema.
    private func allRecords(in zone: CKRecordZone.ID, database: CKDatabase, keys: [CKRecord.FieldKey]?) async throws -> [CKRecord] {
        var token: CKServerChangeToken?
        var records: [CKRecord] = []
        var more = true
        while more {
            let page = try await database.recordZoneChanges(inZoneWith: zone, since: token, desiredKeys: keys, resultsLimit: nil)
            for (_, result) in page.modificationResultsByID {
                if case .success(let modification) = result {
                    records.append(modification.record)
                }
            }
            token = page.changeToken
            more = page.moreComing
        }
        return records
    }

    private static func name(of identity: CKUserIdentity) -> String {
        if let parts = identity.nameComponents {
            let text = PersonNameComponentsFormatter.localizedString(from: parts, style: .default)
            if !text.isEmpty { return text }
        }
        return identity.lookupInfo?.emailAddress ?? identity.lookupInfo?.phoneNumber ?? L("Znajomy")
    }

    private static func clean(_ files: [URL]) {
        for file in files { try? FileManager.default.removeItem(at: file) }
    }

    static func message(for error: Error) -> String {
        guard let error = error as? CKError else { return L("iCloud nie odpowiada. Spróbuj za chwilę.") }
        switch error.code {
        case .notAuthenticated: return L("Zaloguj się do iCloud w Ustawieniach.")
        case .quotaExceeded: return L("Brakuje miejsca w Twoim iCloud.")
        case .networkUnavailable, .networkFailure: return L("Brak połączenia z internetem.")
        case .participantMayNeedVerification: return L("Ta osoba musi najpierw otworzyć zaproszenie.")
        default: return L("iCloud zgłosił błąd. Spróbuj jeszcze raz.")
        }
    }
}

// MARK: - Photo preparation

struct SharedPhotoSource {
    let id: String
    let created: Date
    let location: CLLocation?
    /// Original image bytes from Photos or the server copy.
    let load: @MainActor () async -> Data?
}

/// Keeps quality while staying within 1.5 MB:
/// the original as is when it fits, else full-resolution HEIC at high quality,
/// and only then a slightly smaller size. Date, place and camera data are kept.
enum SharedPhotoEncoder {
    static let limit = 1_500_000

    struct Prepared {
        let full: URL
        let thumb: URL
    }

    static func prepare(_ source: SharedPhotoSource) async -> Prepared? {
        guard let data = await source.load() else { return nil }
        return await Task.detached(priority: .userInitiated) {
            encode(data)
        }.value
    }

    private static func encode(_ data: Data) -> Prepared? {
        guard let image = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let folder = FileManager.default.temporaryDirectory
        let name = UUID().uuidString
        let full: URL
        if data.count <= limit {
            let type = CGImageSourceGetType(image).flatMap { UTType($0 as String) }
            full = folder.appendingPathComponent(name).appendingPathExtension(type?.preferredFilenameExtension ?? "jpg")
            guard (try? data.write(to: full)) != nil else { return nil }
        } else {
            full = folder.appendingPathComponent(name).appendingPathExtension("heic")
            guard let small = fit(image) else { return nil }
            guard (try? small.write(to: full)) != nil else { return nil }
        }
        let thumb = folder.appendingPathComponent(name + "-thumb").appendingPathExtension("jpg")
        guard let preview = thumbnail(image), (try? preview.write(to: thumb)) != nil else { return nil }
        return Prepared(full: full, thumb: thumb)
    }

    private static func fit(_ image: CGImageSource) -> Data? {
        let props = CGImageSourceCopyPropertiesAtIndex(image, 0, nil) as? [CFString: Any]
        let width = props?[kCGImagePropertyPixelWidth] as? Int ?? 4032
        let height = props?[kCGImagePropertyPixelHeight] as? Int ?? 3024
        let longest = max(width, height)
        // Full size first, at falling quality; then 12 MP and a little below.
        let attempts: [(side: Int?, quality: Double)] = [
            (nil, 0.9), (nil, 0.82), (nil, 0.75),
            (4032, 0.85), (4032, 0.78), (3600, 0.8), (3024, 0.82), (2560, 0.8), (2048, 0.75)
        ]
        var last: Data?
        for attempt in attempts {
            if let side = attempt.side, side >= longest { continue }
            guard let data = heic(image, side: attempt.side, quality: attempt.quality, properties: props) else { continue }
            if data.count <= limit { return data }
            last = data
        }
        return last
    }

    private static func heic(_ image: CGImageSource, side: Int?, quality: Double, properties: [CFString: Any]?) -> Data? {
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.heic.identifier as CFString, 1, nil) else { return nil }
        if let side {
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: side
            ]
            guard let scaled = CGImageSourceCreateThumbnailAtIndex(image, 0, options as CFDictionary) else { return nil }
            var metadata = properties ?? [:]
            // The pixels are already upright after the transform.
            metadata[kCGImagePropertyOrientation] = 1
            metadata[kCGImagePropertyPixelWidth] = nil
            metadata[kCGImagePropertyPixelHeight] = nil
            metadata[kCGImageDestinationLossyCompressionQuality] = quality
            CGImageDestinationAddImage(destination, scaled, metadata as CFDictionary)
        } else {
            let options: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: quality]
            CGImageDestinationAddImageFromSource(destination, image, 0, options as CFDictionary)
        }
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }

    private static func thumbnail(_ image: CGImageSource) -> Data? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 420
        ]
        guard let small = CGImageSourceCreateThumbnailAtIndex(image, 0, options as CFDictionary) else { return nil }
        return UIImage(cgImage: small).jpegData(compressionQuality: 0.72)
    }
}

// MARK: - Friends tab

struct FriendsScreen: View {
    @ObservedObject private var cloud = CloudShares.shared
    @State private var invitation: ShareInvitation?
    @State private var inviting = false
    @State private var removingFriend: CloudFriend?
    @State private var removingAlbum: CloudAlbum?

    var body: some View {
        List {
            Section {
                Text(L("Wszystko idzie przez iCloud: zaproś znajomego przez Wiadomości lub Mail, potem udostępniaj mu albumy. Zdjęcia zajmują miejsce w iCloud osoby, która udostępnia, najwyżej 1,5 MB każde."))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if !cloud.available {
                Section {
                    Label(cloud.status, systemImage: "icloud.slash")
                }
            } else {
                friendsSection
                albumsSection(title: L("Moje udostępnione albumy"), albums: cloud.myAlbums,
                              empty: L("W bibliotece stuknij Wybierz, zaznacz zdjęcia i wybierz Udostępnij → Album dla znajomych."))
                albumsSection(title: L("Od znajomych"), albums: cloud.friendAlbums,
                              empty: L("Albumy, które ktoś Ci udostępni, pojawią się tu same."))
                if !cloud.status.isEmpty {
                    Section {
                        Label(cloud.status, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                            .font(.subheadline)
                    }
                }
            }
        }
        .navigationTitle(L("Znajomi"))
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if cloud.loading, cloud.friends.isEmpty, cloud.myAlbums.isEmpty, cloud.friendAlbums.isEmpty {
                ProgressView()
            }
        }
        .refreshable { await cloud.refresh() }
        .task { await cloud.refresh() }
        .cloudShare(item: $invitation) {
            Task { await cloud.refresh() }
        }
        .confirmationDialog(
            L("Usunąć \(removingFriend?.name ?? "")?"),
            isPresented: Binding(get: { removingFriend != nil }, set: { if !$0 { removingFriend = nil } }),
            titleVisibility: .visible
        ) {
            Button(L("Usuń znajomego"), role: .destructive) {
                if let friend = removingFriend { Task { await cloud.remove(friend) } }
                removingFriend = nil
            }
            Button(L("Anuluj"), role: .cancel) { removingFriend = nil }
        } message: {
            Text(L("Albumy już udostępnione zostają. Nowych nie będzie można wysyłać, dopóki się znowu nie zaprosicie."))
        }
        .confirmationDialog(
            removingAlbum?.mine == true ? L("Przestać udostępniać?") : L("Opuścić album?"),
            isPresented: Binding(get: { removingAlbum != nil }, set: { if !$0 { removingAlbum = nil } }),
            titleVisibility: .visible
        ) {
            Button(removingAlbum?.mine == true ? L("Usuń album z iCloud") : L("Opuść album"), role: .destructive) {
                if let album = removingAlbum { Task { await cloud.remove(album) } }
                removingAlbum = nil
            }
            Button(L("Anuluj"), role: .cancel) { removingAlbum = nil }
        } message: {
            Text(removingAlbum?.mine == true
                 ? L("Album zniknie u wszystkich i zwolni miejsce w Twoim iCloud. Zdjęcia w Twojej bibliotece zostają.")
                 : L("Album zniknie z tej listy. Właściciel może udostępnić go ponownie."))
        }
    }

    private var friendsSection: some View {
        Section {
            ForEach(cloud.friends) { friend in
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.title2)
                        .foregroundStyle(friend.accepted ? GalleryTheme.accent : Color.secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(friend.name)
                        if !friend.accepted {
                            Text(L("Czeka na przyjęcie zaproszenia"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .swipeActions {
                    Button(L("Usuń"), role: .destructive) { removingFriend = friend }
                }
            }
            Button {
                inviting = true
                Task {
                    invitation = await cloud.inviteFriend()
                    inviting = false
                }
            } label: {
                HStack {
                    Label(L("Dodaj znajomego"), systemImage: "person.crop.circle.badge.plus")
                    Spacer()
                    if inviting { ProgressView() }
                }
            }
            .disabled(inviting)
        } header: {
            Text(L("Znajomi"))
        } footer: {
            Text(L("Znajomy dostaje zaproszenie na swoje Apple ID. Gdy je otworzy na iPhonie z GalleryOS, pojawi się tutaj."))
        }
    }

    private func albumsSection(title: String, albums: [CloudAlbum], empty: String) -> some View {
        Section(title) {
            if albums.isEmpty {
                Text(empty)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            ForEach(albums) { album in
                NavigationLink {
                    CloudAlbumScreen(album: album)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(album.title)
                            .font(.body.weight(.semibold))
                        Text(album.mine ? PhotoFormat.count(album.count) : L("\(PhotoFormat.count(album.count)) · od \(album.owner)"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .swipeActions {
                    Button(album.mine ? L("Usuń") : L("Opuść"), role: .destructive) { removingAlbum = album }
                }
            }
        }
    }
}

// MARK: - Composer

/// "Album dla znajomych": title, who gets it, upload with progress.
struct CloudAlbumComposer: View {
    let ids: [String]
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var cloud = CloudShares.shared
    @State private var title = ""
    @State private var chosen = Set<String>()
    @State private var sending = false
    @State private var sent = 0
    @State private var total = 0
    @State private var note = ""
    @State private var invitation: ShareInvitation?

    private var photoIDs: [String] {
        ids.filter { library.photo(id: $0)?.traits.isVideo != true }
    }

    private var skippedVideos: Int { ids.count - photoIDs.count }

    private var acceptedFriends: [CloudFriend] { cloud.friends.filter(\.accepted) }

    var body: some View {
        NavigationStack {
            Form {
                Section(L("Album")) {
                    TextField(L("Nazwa albumu"), text: $title)
                }
                Section {
                    if acceptedFriends.isEmpty {
                        Text(L("Nie masz jeszcze znajomych w GalleryOS. Po utworzeniu albumu zaprosisz kogoś przez Wiadomości lub Mail."))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(acceptedFriends) { friend in
                        Button {
                            if chosen.contains(friend.id) { chosen.remove(friend.id) } else { chosen.insert(friend.id) }
                        } label: {
                            HStack {
                                Text(friend.name)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: chosen.contains(friend.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(chosen.contains(friend.id) ? GalleryTheme.accent : Color.secondary)
                            }
                        }
                    }
                } header: {
                    Text(L("Dla kogo"))
                } footer: {
                    Text(footer)
                }
                if sending {
                    Section {
                        ProgressView(value: Double(sent), total: Double(max(total, 1)))
                        Text(L("Wysyłam do iCloud: \(sent) z \(total)"))
                            .font(.subheadline)
                            .monospacedDigit()
                    }
                }
                if !note.isEmpty {
                    Section {
                        Label(note, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle(L("Album dla znajomych"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Anuluj")) { dismiss() }
                        .disabled(sending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L("Udostępnij")) { Task { await send() } }
                        .fontWeight(.semibold)
                        .disabled(sending || photoIDs.isEmpty || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .task {
                if title.isEmpty { title = suggestedTitle }
                await cloud.refresh()
            }
            .cloudShare(item: $invitation) { dismiss() }
        }
        .interactiveDismissDisabled(sending)
    }

    private var footer: String {
        var text = L("Zdjęcia trafią do Twojego iCloud, najwyżej 1,5 MB każde, bez widocznej straty jakości.")
        if skippedVideos > 0 {
            text += L(" Filmy (\(skippedVideos)) zostaną pominięte.")
        }
        return text
    }

    private var suggestedTitle: String {
        let dates = photoIDs.compactMap { library.photo(id: $0)?.created }
        guard let first = dates.min() else { return L("Album") }
        return PhotoGrouping.dayTitle(for: first)
    }

    private func send() async {
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let friends = acceptedFriends.filter { chosen.contains($0.id) }
        let sources = photoIDs.compactMap { id -> SharedPhotoSource? in
            guard let photo = library.photo(id: id) else { return nil }
            let location: CLLocation? = {
                guard let latitude = photo.latitude, let longitude = photo.longitude else { return nil }
                return CLLocation(latitude: latitude, longitude: longitude)
            }()
            let asset = library.asset(id: id)
            return SharedPhotoSource(id: id, created: photo.created, location: location) { [library] in
                if let asset { return await Self.originalData(asset) }
                await library.prepareCloud(id: id)
                guard let still = library.cloudMedia(id: id)?.still else { return nil }
                return try? Data(contentsOf: still)
            }
        }
        sending = true
        note = ""
        total = sources.count
        UIApplication.shared.isIdleTimerDisabled = true
        defer { UIApplication.shared.isIdleTimerDisabled = false }
        do {
            let share = try await cloud.shareAlbum(title: name, photos: sources, with: friends) { done, all in
                sent = done
                total = all
            }
            sending = false
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            if friends.isEmpty {
                // Nobody chosen: invite people straight to this album.
                invitation = ShareInvitation(share: share, container: cloud.container, readWrite: false)
            } else {
                dismiss()
            }
        } catch {
            sending = false
            note = CloudShares.message(for: error)
        }
    }

    private static func originalData(_ asset: PHAsset) async -> Data? {
        await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.isNetworkAccessAllowed = true
            options.version = .current
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, _ in
                continuation.resume(returning: data)
            }
        }
    }
}

// MARK: - Album screens

struct CloudAlbumScreen: View {
    let album: CloudAlbum
    @ObservedObject private var cloud = CloudShares.shared
    @State private var photos: [CloudPhoto] = []
    @State private var loading = true
    @State private var failure = ""
    @State private var open: CloudPhoto?
    @State private var invitation: ShareInvitation?
    @State private var confirmRemove = false
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.adaptive(minimum: 104), spacing: 2)]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(photos) { photo in
                    Button { open = photo } label: {
                        Color(uiColor: .secondarySystemFill)
                            .aspectRatio(1, contentMode: .fit)
                            .overlay {
                                if let thumb = photo.thumb {
                                    Image(uiImage: thumb)
                                        .resizable()
                                        .scaledToFill()
                                } else {
                                    Image(systemName: "photo")
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .clipped()
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .navigationTitle(album.title)
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if loading {
                ProgressView()
            } else if !failure.isEmpty {
                ContentUnavailableView(L("Nie udało się wczytać"), systemImage: "icloud.slash", description: Text(failure))
            } else if photos.isEmpty {
                ContentUnavailableView(L("Pusty album"), systemImage: "photo.on.rectangle", description: Text(L("Nie ma tu jeszcze zdjęć.")))
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if album.mine {
                        Button(L("Zaproś więcej osób"), systemImage: "person.crop.circle.badge.plus") {
                            Task { invitation = await cloud.albumShare(album) }
                        }
                        Button(L("Przestań udostępniać"), systemImage: "trash", role: .destructive) { confirmRemove = true }
                    } else {
                        Button(L("Opuść album"), systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) { confirmRemove = true }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .fullScreenCover(item: $open) { photo in
            CloudPhotoViewer(photo: photo, album: album)
        }
        .cloudShare(item: $invitation) {}
        .confirmationDialog(album.mine ? L("Przestać udostępniać?") : L("Opuścić album?"), isPresented: $confirmRemove, titleVisibility: .visible) {
            Button(album.mine ? L("Usuń album z iCloud") : L("Opuść album"), role: .destructive) {
                Task {
                    await cloud.remove(album)
                    dismiss()
                }
            }
            Button(L("Anuluj"), role: .cancel) {}
        }
    }

    private func load() async {
        do {
            photos = try await cloud.photos(in: album)
            failure = ""
        } catch {
            failure = CloudShares.message(for: error)
        }
        loading = false
    }
}

private struct CloudPhotoViewer: View {
    let photo: CloudPhoto
    let album: CloudAlbum
    @Environment(\.dismiss) private var dismiss
    @State private var file: URL?
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                } else if failed {
                    ContentUnavailableView(L("Nie udało się pobrać"), systemImage: "icloud.slash", description: Text(L("Sprawdź połączenie z internetem.")))
                } else {
                    if let thumb = photo.thumb {
                        Image(uiImage: thumb)
                            .resizable()
                            .scaledToFit()
                            .blur(radius: 6)
                    }
                    ProgressView()
                        .tint(.white)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("Zamknij")) { dismiss() }
                }
                if let file {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: file) {
                            Image(systemName: "square.and.arrow.up")
                        }
                        .accessibilityLabel(L("Udostępnij lub zapisz"))
                    }
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .task {
            do {
                let url = try await CloudShares.shared.fullPhoto(photo, in: album)
                file = url
                image = UIImage(contentsOfFile: url.path)
                if image == nil { failed = true }
            } catch {
                failed = true
            }
        }
        .onDisappear {
            if let file { try? FileManager.default.removeItem(at: file) }
        }
    }
}

// MARK: - System invitation sheet

extension View {
    /// Invites through the system share sheet (Messages, Mail, AirDrop…) with iCloud collaboration.
    /// The old UICloudSharingController inside a SwiftUI sheet kept spinning after choosing Messages.
    func cloudShare(item: Binding<ShareInvitation?>, onDismiss: @escaping () -> Void) -> some View {
        onChange(of: item.wrappedValue?.id) { _, id in
            guard id != nil, let invitation = item.wrappedValue else { return }
            CloudSharePresenter.present(invitation) {
                item.wrappedValue = nil
                onDismiss()
            }
        }
    }
}

@MainActor
enum CloudSharePresenter {
    /// Sends a plain iCloud link (Messages, Mail, AirDrop…). The collaboration sheet had to look up
    /// every recipient in iCloud first and often ended with "cannot create link"; a link that
    /// already exists can always be sent. Friend links let the person join as a friend, album
    /// links let them view the album.
    static func present(_ invitation: ShareInvitation, done: @escaping () -> Void) {
        Task {
            guard let url = await linkURL(for: invitation) else {
                done()
                return
            }
            let title = invitation.share[CKShare.SystemFieldKey.title] as? String ?? "GalleryOS"
            let text = invitation.readWrite
                ? L("Dołącz do mnie w GalleryOS, będziemy mogli udostępniać sobie albumy:")
                : L("Album „\(title)” w GalleryOS:")
            let controller = UIActivityViewController(activityItems: [text, url], applicationActivities: nil)
            controller.completionWithItemsHandler = { _, _, _, _ in
                Task { @MainActor in done() }
            }
            guard let top = topController() else {
                done()
                return
            }
            if let popover = controller.popoverPresentationController {
                popover.sourceView = top.view
                popover.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            top.present(controller, animated: true)
        }
    }

    /// Opens the share to people with the link and returns the saved URL.
    private static func linkURL(for invitation: ShareInvitation) async -> URL? {
        let share = invitation.share
        let wanted: CKShare.ParticipantPermission = invitation.readWrite ? .readWrite : .readOnly
        if share.publicPermission == wanted, let url = share.url { return url }
        share.publicPermission = wanted
        let database = invitation.container.privateCloudDatabase
        guard let saved = try? await database.modifyRecords(saving: [share], deleting: [], savePolicy: .changedKeys),
              let stored = (try? saved.saveResults[share.recordID]?.get()) as? CKShare else {
            return share.url
        }
        return stored.url ?? share.url
    }

    private static func topController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
        var top = window?.rootViewController
        while let next = top?.presentedViewController, !next.isBeingDismissed { top = next }
        return top
    }
}

struct CloudShareSheet: UIViewControllerRepresentable {
    let invitation: ShareInvitation

    func makeUIViewController(context: Context) -> UICloudSharingController {
        let controller = UICloudSharingController(share: invitation.share, container: invitation.container)
        // Friend links are read-write so both sides can leave album invitations in them.
        controller.availablePermissions = invitation.readWrite
            ? [.allowPrivate, .allowReadWrite]
            : [.allowPrivate, .allowReadOnly]
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: UICloudSharingController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(title: invitation.share[CKShare.SystemFieldKey.title] as? String) }

    final class Coordinator: NSObject, UICloudSharingControllerDelegate {
        let title: String?
        init(title: String?) { self.title = title }

        func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {}

        func itemTitle(for csc: UICloudSharingController) -> String? {
            title ?? "GalleryOS"
        }
    }
}
