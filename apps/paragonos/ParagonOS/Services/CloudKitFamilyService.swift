import CloudKit
import Foundation
import UIKit

struct FamilyMember: Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var isOwner: Bool
    var isCurrentUser: Bool = false

    var roleTitle: String {
        isOwner ? "Organizator" : "Członek rodziny"
    }
}

enum FamilyIdentity {
    static func joinedName(given: String?, family: String?) -> String {
        [given, family]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.isEmpty == false }
            .joined(separator: " ")
    }

    static func initials(_ name: String) -> String {
        let parts = name.split { $0.isWhitespace || $0 == "-" }.prefix(2)
        let letters = parts.compactMap { $0.first }.map { String($0).uppercased() }
        return letters.isEmpty ? "•" : letters.joined()
    }

    static func shouldUpgradeStoredName(_ stored: String, suggested: String) -> Bool {
        let current = stored.trimmingCharacters(in: .whitespacesAndNewlines)
        let next = suggested.trimmingCharacters(in: .whitespacesAndNewlines)
        guard next.isEmpty == false else { return false }
        if current.isEmpty { return true }
        if current.contains(where: { $0.isWhitespace }) == false,
           next.contains(where: { $0.isWhitespace }),
           next.lowercased().hasPrefix(current.lowercased()) {
            return true
        }
        return false
    }
}

enum FamilyCloudTarget {
    static func isOwner(_ zoneOwnerName: String) -> Bool {
        zoneOwnerName.isEmpty || zoneOwnerName == CKCurrentUserDefaultName
    }
}

struct FamilyRecordFetch {
    var records: [CKRecord]
    var succeeded: Bool
}

enum FamilyMergePolicy {
    static func shouldDeleteLocalsMissingFromRemote(fetchSucceeded: Bool, remoteCount: Int) -> Bool {
        fetchSucceeded && remoteCount > 0
    }

    static func localID(fromRecordName name: String) -> UUID? {
        UUID(uuidString: name)
    }

    static func keyedByID<T>(_ items: [T], id: KeyPath<T, UUID>) -> [String: T] {
        Dictionary(items.map { ($0[keyPath: id].uuidString, $0) }, uniquingKeysWith: { _, last in last })
    }

    /// Keep one row per public UUID. Concurrent family merges used to insert the
    /// same CloudKit record twice; LoyaltyPassStack then crashed in ForEach.
    static func uniqued<T>(_ items: [T], id: KeyPath<T, UUID>) -> [T] {
        var seen = Set<UUID>()
        return items.filter { seen.insert($0[keyPath: id]).inserted }
    }

    static func extrasToDelete<T>(
        _ items: [T],
        id: KeyPath<T, UUID>,
        updatedAt: KeyPath<T, Date>
    ) -> [T] {
        var keep: [UUID: T] = [:]
        var extras: [T] = []
        for item in items {
            let key = item[keyPath: id]
            if let current = keep[key] {
                if item[keyPath: updatedAt] >= current[keyPath: updatedAt] {
                    extras.append(current)
                    keep[key] = item
                } else {
                    extras.append(item)
                }
            } else {
                keep[key] = item
            }
        }
        return extras
    }
}

private final class ZoneCollector: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [CKRecordZone] = []

    func append(_ zone: CKRecordZone) {
        lock.lock()
        storage.append(zone)
        lock.unlock()
    }

    var zones: [CKRecordZone] {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }
}

private final class RecordCollector: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [CKRecord] = []
    private var ok = false
    private var more = false
    private var token: CKServerChangeToken?

    func append(_ record: CKRecord) {
        lock.lock()
        storage.append(record)
        lock.unlock()
    }

    func markOK(token: CKServerChangeToken?, moreComing: Bool) {
        lock.lock()
        ok = true
        more = moreComing
        self.token = token
        lock.unlock()
    }

    var snapshot: (records: [CKRecord], ok: Bool, more: Bool, token: CKServerChangeToken?) {
        lock.lock()
        defer { lock.unlock() }
        return (storage, ok, more, token)
    }
}

@MainActor
final class CloudKitFamilyService: ObservableObject {
    static let shared = CloudKitFamilyService()

    @Published var isICloudAvailable = false
    @Published var members: [FamilyMember] = []
    @Published var familyWalletID: String?
    @Published var statusMessage: String?
    @Published var share: CKShare?
    @Published var meFullName: String = ""
    private(set) var lastPushFailed = false
    private var pendingShareMerge = false

    var isFamilyOwner: Bool {
        FamilyCloudTarget.isOwner(familyZoneOwnerName)
    }

    private lazy var container = CKContainer(identifier: Brand.iCloudContainer)
    private let walletType = "FamilyWallet"
    private let ticketType = "SharedTicket"
    private let receiptType = "SharedReceipt"
    private let loyaltyType = "SharedLoyaltyCard"
    private let memberNameType = "FamilyMemberName"
    private let familyWalletIDKey = "paragonos.familyWalletID"
    private let familyZoneOwnerKey = "paragonos.familyZoneOwner"
    private let familyZoneName = "FamilyWalletZone"

    private var canUseCloudKit: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil
            && NSClassFromString("XCTestCase") == nil
            && FileManager.default.ubiquityIdentityToken != nil
    }

    func suggestedGivenName() async -> String {
        await iCloudFullName()
    }

    func refreshIdentity() async {
        meFullName = await iCloudFullName()
    }

    /// iOS 27 CloudKit Swift overlay inlines `userIdentity(forUserRecordID:)`, `record(for:)`,
    /// `accept(_:)` and `allRecordZones()` onto `_userIdentity` / `_record` / `_accept` /
    /// `_allRecordZones`. Those symbols are missing on iOS 26, so dyld aborts at launch.
    ///
    /// None of the raw CloudKit calls below carry a timeout of their own — on a flaky
    /// connection they can hang far longer than feels alive to the user, which used to
    /// leave "Synchronizuj teraz" (and the Dynamic Island) stuck forever. Every network
    /// hop is bounded here so the caller always gets an answer.
    private func fetchRecord(_ id: CKRecord.ID, from database: CKDatabase) async -> CKRecord? {
        await AsyncTimeout.value(seconds: 10) {
            let map = try? await database.records(for: [id])
            guard case .success(let record) = map?[id] else { return nil }
            return record
        } ?? nil
    }

    private func acceptShare(_ metadata: CKShare.Metadata) async throws {
        let results = try await container.accept([metadata])
        for value in results.values {
            if case .failure(let error) = value {
                throw error
            }
        }
    }

    private func fetchAllZones(from database: CKDatabase) async -> [CKRecordZone] {
        await AsyncTimeout.value(seconds: 8) {
            await withCheckedContinuation { continuation in
                let op = CKFetchRecordZonesOperation.fetchAllRecordZonesOperation()
                op.qualityOfService = .userInitiated
                let bag = ZoneCollector()
                op.perRecordZoneResultBlock = { _, result in
                    if case .success(let zone) = result {
                        bag.append(zone)
                    }
                }
                op.fetchRecordZonesResultBlock = { _ in
                    continuation.resume(returning: bag.zones)
                }
                database.add(op)
            }
        } ?? []
    }

    private func iCloudFullName() async -> String {
        guard canUseCloudKit else { return "" }
        let container = self.container
        guard let recordID = await AsyncTimeout.value(seconds: 8, operation: {
            try? await container.userRecordID()
        }) ?? nil else { return "" }
        let identities = await AsyncTimeout.value(seconds: 8, operation: {
            try? await container.userIdentities(forUserRecordIDs: [recordID])
        }) ?? nil
        guard let identity = identities?[recordID] else { return "" }
        return FamilyIdentity.joinedName(
            given: identity.nameComponents?.givenName,
            family: identity.nameComponents?.familyName
        )
    }

    func publishDisplayName(_ name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canUseCloudKit, trimmed.isEmpty == false else { return }
        let container = self.container
        do {
            guard let userRecordID = await AsyncTimeout.value(seconds: 8, operation: {
                try? await container.userRecordID()
            }) ?? nil else { return }
            let database: CKDatabase
            let zoneID: CKRecordZone.ID
            if familyWalletID != nil {
                zoneID = familyZoneID
                database = familyDatabase
                if FamilyCloudTarget.isOwner(familyZoneOwnerName) {
                    _ = try? await container.privateCloudDatabase.modifyRecordZones(
                        saving: [CKRecordZone(zoneID: zoneID)],
                        deleting: []
                    )
                }
            } else {
                zoneID = CKRecordZone.default().zoneID
                database = container.privateCloudDatabase
            }
            let recordName = "member-name-\(userRecordID.recordName)"
            let recordID = CKRecord.ID(recordName: recordName, zoneID: zoneID)
            let record: CKRecord
            if let existing = await fetchRecord(recordID, from: database),
               existing.recordType == memberNameType {
                record = existing
            } else {
                record = CKRecord(recordType: memberNameType, recordID: recordID)
            }
            record["displayName"] = trimmed as CKRecordValue
            record["userRecordName"] = userRecordID.recordName as CKRecordValue
            if familyWalletID != nil {
                attachParent(record)
            }
            _ = try? await database.modifyRecords(saving: [record], deleting: [])

            if FamilyCloudTarget.isOwner(familyZoneOwnerName), let familyWalletID {
                let walletID = CKRecord.ID(
                    recordName: familyWalletID,
                    zoneID: familyZoneID
                )
                if let wallet = await fetchRecord(walletID, from: container.privateCloudDatabase) {
                    wallet["ownerName"] = trimmed as CKRecordValue
                    _ = try? await container.privateCloudDatabase.modifyRecords(saving: [wallet], deleting: [])
                }
            }
        } catch {
            report(error)
        }
    }

    func refreshAccountStatus() async {
        if familyWalletID == nil {
            familyWalletID = UserDefaults.standard.string(forKey: familyWalletIDKey)
        }
        guard canUseCloudKit else {
            isICloudAvailable = false
            if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil,
               NSClassFromString("XCTestCase") == nil {
                statusMessage = "Włącz iCloud, aby synchronizować i udostępniać."
            }
            return
        }
        isICloudAvailable = true
        let container = self.container
        let status = await AsyncTimeout.value(seconds: 8, operation: {
            try? await container.accountStatus()
        }) ?? nil
        // A transient account-status timeout is not evidence that iCloud is
        // disabled. Keep the usable-token state and let the subsequent record
        // operation report its concrete CloudKit error instead of silently
        // skipping every family upload and fetch for this app session.
        guard let status else {
            return
        }
        if status != .available {
            isICloudAvailable = false
            statusMessage = "Włącz iCloud, aby synchronizować i udostępniać."
        } else if isNoisyStatus(statusMessage) {
            statusMessage = nil
        }
        await restoreFamilyShare()
    }

    func prepareShare(displayName: String) async throws -> CKShare {
        let database = container.privateCloudDatabase
        let zoneID = familyZoneID
        let zone = CKRecordZone(zoneID: zoneID)
        _ = await AsyncTimeout.value(seconds: 10) {
            try? await database.modifyRecordZones(saving: [zone], deleting: [])
        }

        let recordID: CKRecord.ID
        if let existing = familyWalletID {
            recordID = CKRecord.ID(recordName: existing, zoneID: zoneID)
        } else {
            recordID = CKRecord.ID(recordName: UUID().uuidString, zoneID: zoneID)
        }

        let wallet: CKRecord
        if let fetched = await fetchRecord(recordID, from: database) {
            wallet = fetched
        } else {
            let created = CKRecord(recordType: walletType, recordID: recordID)
            created["name"] = "Rodzina" as CKRecordValue
            created["ownerName"] = displayName as CKRecordValue
            wallet = created
        }

        let share: CKShare
        if let existingShare = wallet.share,
           let fetched = await fetchRecord(existingShare.recordID, from: database) as? CKShare {
            share = fetched
        } else {
            share = CKShare(rootRecord: wallet)
            share[CKShare.SystemFieldKey.title] = Brand.displayName as CKRecordValue
            if let thumbnail = ParagonMark.png(size: 120) {
                share[CKShare.SystemFieldKey.thumbnailImageData] = thumbnail as CKRecordValue
            }
            share.publicPermission = .none
            let result = try await database.modifyRecords(saving: [wallet, share], deleting: [])
            if let walletResult = result.saveResults[wallet.recordID],
               case .failure(let error) = walletResult {
                throw error
            }
            if let shareResult = result.saveResults[share.recordID],
               case .failure(let error) = shareResult {
                throw error
            }
        }

        persistFamilyWalletID(wallet.recordID.recordName, zoneOwner: CKCurrentUserDefaultName)
        self.share = share
        members = [
            FamilyMember(
                id: "owner",
                name: displayName.isEmpty ? (meFullName.isEmpty ? "Ty" : meFullName) : displayName,
                isOwner: true,
                isCurrentUser: true
            )
        ]
        return share
    }

    func accept(_ metadata: CKShare.Metadata) async {
        do {
            try await acceptShare(metadata)
            persistFamilyWalletID(
                metadata.rootRecordID.recordName,
                zoneOwner: FamilyShareOwnership.persistedZoneOwner(
                    foundInPrivateDatabase: false,
                    zoneOwnerName: metadata.rootRecordID.zoneID.ownerName
                )
            )
            statusMessage = "Dołączono do portfela rodzinnego."
            // CloudKit accepts the invite before the shared zone has always
            // appeared in the local database. Wait briefly for the root record
            // so the subsequent local merge sees the participant's real zone.
            for attempt in 0..<4 {
                await restoreFamilyShare()
                if share != nil { break }
                if attempt < 3 {
                    try? await Task.sleep(nanoseconds: 750_000_000)
                }
            }
            pendingShareMerge = true
            await refreshParticipants()
        } catch {
            report(error)
        }
    }

    func consumePendingShareMerge() -> Bool {
        defer { pendingShareMerge = false }
        return pendingShareMerge
    }

    func refreshParticipants() async {
        await restoreFamilyShare()
        await refetchShare()
        var names = await fetchMemberNames()
        if let familyWalletID {
            let walletID = CKRecord.ID(
                recordName: familyWalletID,
                zoneID: familyZoneID
            )
            if let wallet = await fetchRecord(walletID, from: familyDatabase),
               let ownerName = wallet["ownerName"] as? String,
               ownerName.isEmpty == false {
                names["owner"] = ownerName
            }
        }
        let myRecordName = (try? await container.userRecordID())?.recordName
        guard let share else {
            let ownerName = names["owner"] ?? (meFullName.isEmpty ? nil : meFullName)
            if let ownerName {
                members = [
                    FamilyMember(id: myRecordName ?? "owner", name: ownerName, isOwner: true, isCurrentUser: true)
                ]
            } else if meFullName.isEmpty == false {
                members = [
                    FamilyMember(id: myRecordName ?? "owner", name: meFullName, isOwner: true, isCurrentUser: true)
                ]
            }
            return
        }
        var next: [FamilyMember] = []
        for participant in share.participants {
            let id = participant.userIdentity.userRecordID?.recordName ?? UUID().uuidString
            let fallback = FamilyIdentity.joinedName(
                given: participant.userIdentity.nameComponents?.givenName,
                family: participant.userIdentity.nameComponents?.familyName
            )
            let stored = names[id]
            let isMe = id == myRecordName
            let name: String
            if participant.role == .owner {
                name = names["owner"] ?? stored ?? (isMe && meFullName.isEmpty == false ? meFullName : nil) ?? (fallback.isEmpty ? "Ty" : fallback)
            } else {
                name = stored ?? (isMe && meFullName.isEmpty == false ? meFullName : nil) ?? (fallback.isEmpty ? "Uczestnik" : fallback)
            }
            next.append(FamilyMember(
                id: id,
                name: name,
                isOwner: participant.role == .owner,
                isCurrentUser: isMe
            ))
        }
        members = next
    }

    func restoreFamilyShare() async {
        guard canUseCloudKit else { return }
        if familyWalletID == nil {
            familyWalletID = UserDefaults.standard.string(forKey: familyWalletIDKey)
        }

        // Participants: shared database first so a stale "owner" flag never
        // hides an accepted invite behind an empty private zone.
        let sharedWallets = await records(ofType: walletType, in: container.sharedCloudDatabase)
        if let wallet = sharedWallets.first {
            persistFamilyWalletID(
                wallet.recordID.recordName,
                zoneOwner: FamilyShareOwnership.persistedZoneOwner(
                    foundInPrivateDatabase: false,
                    zoneOwnerName: wallet.recordID.zoneID.ownerName
                )
            )
            if let shareRef = wallet.share,
               let fetched = await fetchRecord(shareRef.recordID, from: container.sharedCloudDatabase) as? CKShare {
                share = fetched
            }
            return
        }

        if let familyWalletID {
            let sharedID = CKRecord.ID(recordName: familyWalletID, zoneID: familyZoneID)
            if FamilyCloudTarget.isOwner(familyZoneOwnerName) == false,
               let wallet = await fetchRecord(sharedID, from: container.sharedCloudDatabase) {
                persistFamilyWalletID(
                    wallet.recordID.recordName,
                    zoneOwner: FamilyShareOwnership.persistedZoneOwner(
                        foundInPrivateDatabase: false,
                        zoneOwnerName: wallet.recordID.zoneID.ownerName
                    )
                )
                if let shareRef = wallet.share,
                   let fetched = await fetchRecord(shareRef.recordID, from: container.sharedCloudDatabase) as? CKShare {
                    share = fetched
                }
                return
            }

            // We already know this device accepted someone else's share. If
            // the shared zone is still materializing, never fall through to a
            // stale/private wallet and overwrite the participant owner ID —
            // that routes all subsequent reads to an empty private database.
            if FamilyCloudTarget.isOwner(familyZoneOwnerName) == false {
                return
            }

            let privateID = CKRecord.ID(
                recordName: familyWalletID,
                zoneID: CKRecordZone.ID(zoneName: familyZoneName, ownerName: CKCurrentUserDefaultName)
            )
            if let wallet = await fetchRecord(privateID, from: container.privateCloudDatabase) {
                persistFamilyWalletID(
                    wallet.recordID.recordName,
                    zoneOwner: FamilyShareOwnership.persistedZoneOwner(
                        foundInPrivateDatabase: true,
                        zoneOwnerName: wallet.recordID.zoneID.ownerName
                    )
                )
                if let shareRef = wallet.share,
                   let fetched = await fetchRecord(shareRef.recordID, from: container.privateCloudDatabase) as? CKShare {
                    share = fetched
                }
                return
            }
        }

        let privateWallets = await records(ofType: walletType, in: container.privateCloudDatabase)
        if let wallet = privateWallets.first {
            persistFamilyWalletID(
                wallet.recordID.recordName,
                zoneOwner: FamilyShareOwnership.persistedZoneOwner(
                    foundInPrivateDatabase: true,
                    zoneOwnerName: wallet.recordID.zoneID.ownerName
                )
            )
            if let shareRef = wallet.share,
               let fetched = await fetchRecord(shareRef.recordID, from: container.privateCloudDatabase) as? CKShare {
                share = fetched
            }
        }
    }

    private func refetchShare() async {
        guard let share else { return }
        let owner = share.recordID.zoneID.ownerName
        let database = owner == CKCurrentUserDefaultName
            ? container.privateCloudDatabase
            : container.sharedCloudDatabase
        if let fresh = await fetchRecord(share.recordID, from: database) as? CKShare {
            self.share = fresh
        }
    }

    private func fetchMemberNames() async -> [String: String] {
        guard canUseCloudKit else { return [:] }
        var map: [String: String] = [:]
        for database in [container.privateCloudDatabase, container.sharedCloudDatabase] {
            let found = await records(ofType: memberNameType, in: database)
            for record in found {
                guard let name = record["displayName"] as? String, name.isEmpty == false else { continue }
                let key = (record["userRecordName"] as? String) ?? record.recordID.recordName
                map[key] = name
            }
        }
        return map
    }

    func beginFamilyPush() {
        lastPushFailed = false
    }

    @discardableResult
    func upsertShared(ticket: Ticket) async -> Bool {
        guard await canWriteFamilyRecords(), let familyWalletID else { return false }
        let record = await familyRecord(type: ticketType, name: ticket.id.uuidString)
        record["familyWalletID"] = familyWalletID as CKRecordValue
        record["retailerID"] = ticket.retailerID as CKRecordValue
        record["amount"] = ticket.amount as CKRecordValue
        record["issuedAt"] = ticket.issuedAt as CKRecordValue
        record["status"] = ticket.statusRaw as CKRecordValue
        record["barcodePayload"] = ticket.barcodePayload as CKRecordValue
        record["barcodeSymbology"] = ticket.barcodeSymbologyRaw as CKRecordValue
        record["ticketNumber"] = ticket.ticketNumber as CKRecordValue
        record["scannedByName"] = ticket.scannedByName as CKRecordValue
        record["redeemedByName"] = ticket.redeemedByName as CKRecordValue
        if let expiresAt = ticket.expiresAt {
            record["expiresAt"] = expiresAt as CKRecordValue
        }
        if let data = ticket.photoData, FamilySchemaGaps.allows("photo", in: ticketType) {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(ticket.id.uuidString).jpg")
            try? data.write(to: url)
            record["photo"] = CKAsset(fileURL: url)
        }
        attachParent(record)
        return await saveFamilyRecord(record)
    }

    @discardableResult
    func upsertShared(receipt: Receipt) async -> Bool {
        guard await canWriteFamilyRecords(), let familyWalletID else { return false }
        let record = await familyRecord(type: receiptType, name: receipt.id.uuidString)
        record["familyWalletID"] = familyWalletID as CKRecordValue
        record["merchantName"] = receipt.merchantName as CKRecordValue
        record["merchantNIP"] = receipt.merchantNIP as CKRecordValue
        record["amount"] = receipt.amount as CKRecordValue
        record["taxAmount"] = receipt.taxAmount as CKRecordValue
        record["issuedAt"] = receipt.issuedAt as CKRecordValue
        record["category"] = receipt.categoryRaw as CKRecordValue
        record["documentType"] = receipt.documentTypeRaw as CKRecordValue
        record["documentNumber"] = receipt.documentNumber as CKRecordValue
        record["paymentMethod"] = receipt.paymentMethod as CKRecordValue
        let photo = receipt.photoData.map { ScanService.recompressStoredPhoto($0) }
        // Production SharedReceipt has no `photo` asset. Pack the compact image
        // into existing `itemName` so the first save succeeds. Do not also send
        // a new `jpeg` Bytes field — production rejects unknown fields and that
        // would be a second copy in the family zone.
        record["itemName"] = FamilyPhotoCodec.packedItemName(receipt.itemName, photo: photo) as CKRecordValue
        record["scannedByName"] = receipt.scannedByName as CKRecordValue
        if let warrantyUntil = receipt.warrantyUntil {
            record["warrantyUntil"] = warrantyUntil as CKRecordValue
        }
        if let returnUntil = receipt.returnUntil {
            record["returnUntil"] = returnUntil as CKRecordValue
        }
        attachParent(record)
        return await saveFamilyRecord(record)
    }

    @discardableResult
    func upsertShared(card: LoyaltyCard) async -> Bool {
        guard await canWriteFamilyRecords(), let familyWalletID else { return false }
        let record = await familyRecord(type: loyaltyType, name: card.id.uuidString)
        record["familyWalletID"] = familyWalletID as CKRecordValue
        record["programID"] = card.programID as CKRecordValue
        record["programName"] = card.programName as CKRecordValue
        record["holderName"] = card.holderName as CKRecordValue
        record["barcodePayload"] = card.barcodePayload as CKRecordValue
        record["barcodeSymbology"] = card.barcodeSymbologyRaw as CKRecordValue
        record["note"] = card.note as CKRecordValue
        record["scannedByName"] = card.scannedByName as CKRecordValue
        if let data = card.photoData, FamilySchemaGaps.allows("photo", in: loyaltyType) {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("card-\(card.id.uuidString).jpg")
            try? data.write(to: url)
            record["photo"] = CKAsset(fileURL: url)
        }
        attachParent(record)
        return await saveFamilyRecord(record)
    }

    func fetchSharedReceipts() async -> FamilyRecordFetch {
        await fetchFamilyRecords(ofType: receiptType)
    }

    func fetchSharedCards() async -> FamilyRecordFetch {
        await fetchFamilyRecords(ofType: loyaltyType)
    }

    func fetchSharedTickets() async -> FamilyRecordFetch {
        await fetchFamilyRecords(ofType: ticketType)
    }

    func deleteSharedRecord(named name: String) async {
        guard canUseCloudKit, familyWalletID != nil else { return }
        let recordID = CKRecord.ID(recordName: name, zoneID: familyZoneID)
        _ = try? await familyDatabase.modifyRecords(saving: [], deleting: [recordID])
        if FamilyCloudTarget.isOwner(familyZoneOwnerName) == false {
            _ = try? await container.privateCloudDatabase.modifyRecords(saving: [], deleting: [recordID])
        }
    }

    func leaveFamily() async {
        if canUseCloudKit, let share {
            let owner = FamilyCloudTarget.isOwner(share.recordID.zoneID.ownerName)
            if owner {
                for type in [ticketType, receiptType, loyaltyType] {
                    let recs = await records(ofType: type, in: familyDatabase)
                    let ids = recs.map(\.recordID)
                    if ids.isEmpty == false {
                        _ = try? await familyDatabase.modifyRecords(saving: [], deleting: ids)
                    }
                }
                _ = try? await container.privateCloudDatabase.modifyRecords(saving: [], deleting: [share.recordID])
                self.share = nil
                members = members.filter(\.isOwner)
                statusMessage = "Udostępnianie rodzinie jest wyłączone."
                await refreshParticipants()
                return
            }
            _ = try? await container.sharedCloudDatabase.modifyRecords(saving: [], deleting: [share.recordID])
        }
        clearFamilyLink()
        statusMessage = "Opuściłeś portfel rodzinny. Twoje kopie zostają na tym iPhonie."
    }

    func clearFamilyLink() {
        familyWalletID = nil
        share = nil
        members = []
        UserDefaults.standard.removeObject(forKey: familyWalletIDKey)
        UserDefaults.standard.removeObject(forKey: familyZoneOwnerKey)
    }

    func repairMissingParents() async {
        guard canUseCloudKit, familyWalletID != nil, FamilyCloudTarget.isOwner(familyZoneOwnerName) else { return }
        var dirty: [CKRecord] = []
        for type in [ticketType, receiptType, loyaltyType] {
            let banned = FamilySchemaGaps.bannedFields(for: type)
            for record in await records(ofType: type, in: familyDatabase) {
                let hadBanned = record.allKeys().contains { banned.contains($0) }
                let prepared = CloudKitProductionSchema.copy(record, excluding: banned)
                if attachParent(prepared) || hadBanned {
                    dirty.append(prepared)
                }
            }
        }
        guard dirty.isEmpty == false else { return }
        var index = 0
        while index < dirty.count {
            let end = min(index + 200, dirty.count)
            let chunk = Array(dirty[index..<end])
            do {
                let result = try await familyDatabase.modifyRecords(
                    saving: chunk,
                    deleting: [],
                    savePolicy: CloudKitProductionSchema.familySavePolicy,
                    atomically: false
                )
                for (id, item) in result.saveResults {
                    if case .failure = item, let record = chunk.first(where: { $0.recordID == id }) {
                        await saveFamilyRecord(record)
                    }
                }
            } catch {
                for record in chunk {
                    await saveFamilyRecord(record)
                }
            }
            index = end
        }
    }

    private var familyZoneOwnerName: String {
        UserDefaults.standard.string(forKey: familyZoneOwnerKey) ?? CKCurrentUserDefaultName
    }

    private var familyZoneID: CKRecordZone.ID {
        CKRecordZone.ID(zoneName: familyZoneName, ownerName: familyZoneOwnerName)
    }

    private var familyDatabase: CKDatabase {
        FamilyCloudTarget.isOwner(familyZoneOwnerName)
            ? container.privateCloudDatabase
            : container.sharedCloudDatabase
    }

    private func persistFamilyWalletID(_ id: String, zoneOwner: String = CKCurrentUserDefaultName) {
        familyWalletID = id
        UserDefaults.standard.set(id, forKey: familyWalletIDKey)
        UserDefaults.standard.set(zoneOwner, forKey: familyZoneOwnerKey)
    }

    func subscribeToRemoteChanges() async {
        guard canUseCloudKit else { return }
        UIApplication.shared.registerForRemoteNotifications()
        let info = CKSubscription.NotificationInfo()
        info.shouldSendContentAvailable = true
        let privateSub = CKDatabaseSubscription(subscriptionID: "paragonos.family.private")
        privateSub.notificationInfo = info
        let sharedSub = CKDatabaseSubscription(subscriptionID: "paragonos.family.shared")
        sharedSub.notificationInfo = info
        let container = self.container
        _ = await AsyncTimeout.value(seconds: 8) {
            try? await container.privateCloudDatabase.modifySubscriptions(saving: [privateSub], deleting: [])
        }
        _ = await AsyncTimeout.value(seconds: 8) {
            try? await container.sharedCloudDatabase.modifySubscriptions(saving: [sharedSub], deleting: [])
        }
    }

    func handlePush(_ userInfo: [AnyHashable: Any]) async {
        guard CKNotification(fromRemoteNotificationDictionary: userInfo) != nil else { return }
        await refreshAccountStatus()
        NotificationCenter.default.post(name: .paragonFamilyRemoteChange, object: nil)
    }

    private func familyRecord(type: String, name: String) async -> CKRecord {
        let recordID = CKRecord.ID(recordName: name, zoneID: familyZoneID)
        if let existing = await fetchRecord(recordID, from: familyDatabase) {
            _ = attachParent(existing)
            return existing
        }
        let record = CKRecord(recordType: type, recordID: recordID)
        _ = attachParent(record)
        return record
    }

    private func fetchFamilyRecords(ofType type: String) async -> FamilyRecordFetch {
        guard isICloudAvailable, familyWalletID != nil else {
            return FamilyRecordFetch(records: [], succeeded: false)
        }
        var map: [String: CKRecord] = [:]
        var zoneOK = false

        let listed: [CKRecordZone.ID]
        if familyDatabase.databaseScope == .shared {
            let zones = await fetchAllZones(from: familyDatabase)
            listed = zones.map(\.zoneID)
        } else {
            listed = []
        }
        let zoneIDs = FamilyShareHierarchy.zoneIDs(
            isSharedDatabase: familyDatabase.databaseScope == .shared,
            familyZone: familyZoneID,
            listedSharedZones: listed
        )
        for zoneID in zoneIDs {
            let batch = await zoneRecords(in: familyDatabase, zoneID: zoneID)
            if batch.ok { zoneOK = true }
            for record in FamilyShareHierarchy.records(ofType: type, from: batch.records) {
                map[record.recordID.recordName] = record
            }
        }

        if zoneOK == false || map.isEmpty {
            let other = familyDatabase.databaseScope == .private
                ? container.sharedCloudDatabase
                : container.privateCloudDatabase
            let otherZones: [CKRecordZone.ID]
            if other.databaseScope == .shared {
                otherZones = await fetchAllZones(from: other).map(\.zoneID)
            } else {
                otherZones = []
            }
            let extra = FamilyShareHierarchy.zoneIDs(
                isSharedDatabase: other.databaseScope == .shared,
                familyZone: familyZoneID,
                listedSharedZones: otherZones
            )
            for zoneID in extra {
                let batch = await zoneRecords(in: other, zoneID: zoneID)
                if batch.ok { zoneOK = true }
                for record in FamilyShareHierarchy.records(ofType: type, from: batch.records) {
                    map[record.recordID.recordName] = record
                }
            }
        }

        if map.isEmpty {
            let fallback = await recordsResult(ofType: type, in: familyDatabase)
            // A successful but empty CKQuery does not prove the share is
            // empty: shared-zone queries may be unavailable while the change
            // fetch is still materializing. Treat it as evidence only when
            // it actually returned a family record.
            if FamilyFetchOutcome.queryProvidesEvidence(
                querySucceeded: fallback.ok,
                recordCount: fallback.records.count
            ) {
                zoneOK = true
            }
            for record in fallback.records {
                map[record.recordID.recordName] = record
            }
        }

        let records = Array(map.values)
        return FamilyRecordFetch(
            records: records,
            succeeded: FamilyFetchOutcome.succeeded(zoneFetchOK: zoneOK, recordCount: records.count)
        )
    }

    /// A save may be triggered immediately after the user accepts an invite or
    /// creates a share, before bootstrap has finished its account-status check.
    /// Refresh once here instead of silently dropping that first record.
    private func canWriteFamilyRecords() async -> Bool {
        guard familyWalletID != nil else {
            lastPushFailed = true
            return false
        }
        if isICloudAvailable == false {
            await refreshAccountStatus()
        }
        guard isICloudAvailable else {
            lastPushFailed = true
            if statusMessage == nil {
                statusMessage = "Włącz iCloud, aby wysłać dane do rodziny."
            }
            return false
        }
        return true
    }

    @discardableResult
    private func attachParent(_ record: CKRecord) -> Bool {
        guard let familyWalletID else { return false }
        return FamilyShareHierarchy.applyParent(record, walletID: familyWalletID)
    }

    @discardableResult
    private func saveFamilyRecord(_ record: CKRecord) async -> Bool {
        var banned = FamilySchemaGaps.bannedFields(for: record.recordType)
        var current = CloudKitProductionSchema.copy(record, excluding: banned)
        _ = attachParent(current)
        var lastError: Error?
        for _ in 0..<8 {
            let error = await commitFamilyRecord(current)
            guard let error else {
                if isNoisyStatus(statusMessage)
                    || FamilyCloudCopy.isObsoleteStatus(statusMessage)
                    || statusMessage?.contains("CKRecord") == true {
                    statusMessage = nil
                }
                return true
            }
            lastError = error
            switch CloudKitProductionSchema.saveRetry(for: error) {
            case .stripField(let field):
                FamilySchemaGaps.remember(field: field, recordType: current.recordType)
                banned.insert(field)
                current = CloudKitProductionSchema.copy(current, excluding: banned)
                _ = attachParent(current)
            case .shrinkPhoto:
                guard FamilyPhotoCodec.shrinkPackedPhoto(current) else {
                    reportSave(error)
                    return false
                }
                _ = attachParent(current)
            case .mergeServer:
                if let ck = error as? CKError, let server = ck.serverRecord {
                    let merged = CloudKitProductionSchema.copy(server, excluding: banned)
                    for key in current.allKeys() where banned.contains(key) == false {
                        merged[key] = current[key]
                    }
                    _ = attachParent(merged)
                    current = merged
                }
                try? await Task.sleep(nanoseconds: 250_000_000)
            case .recreateZone:
                if FamilyCloudTarget.isOwner(familyZoneOwnerName) {
                    _ = try? await container.privateCloudDatabase.modifyRecordZones(
                        saving: [CKRecordZone(zoneID: familyZoneID)],
                        deleting: []
                    )
                }
                try? await Task.sleep(nanoseconds: 350_000_000)
            case nil:
                reportSave(error)
                return false
            }
        }
        if let lastError { reportSave(lastError) }
        return false
    }

    private func commitFamilyRecord(_ record: CKRecord) async -> Error? {
        await AsyncTimeout.value(seconds: 12) {
            do {
                if FamilyCloudTarget.isOwner(self.familyZoneOwnerName) {
                    _ = try? await self.container.privateCloudDatabase.modifyRecordZones(
                        saving: [CKRecordZone(zoneID: self.familyZoneID)],
                        deleting: []
                    )
                }
                let result = try await self.familyDatabase.modifyRecords(
                    saving: [record],
                    deleting: [],
                    savePolicy: CloudKitProductionSchema.familySavePolicy,
                    atomically: true
                )
                if let saved = result.saveResults[record.recordID], case .failure(let error) = saved {
                    return error
                }
                return nil
            } catch {
                return error
            }
        } ?? FamilyCloudTimeoutError()
    }

    private func zoneRecords(in database: CKDatabase, zoneID: CKRecordZone.ID) async -> (records: [CKRecord], ok: Bool) {
        var token: CKServerChangeToken?
        var all: [CKRecord] = []
        var more = true
        var ok = false
        var pages = 0
        while more, pages < 24 {
            pages += 1
            let page = await zoneRecordsPage(in: database, zoneID: zoneID, token: token)
            if page.ok { ok = true }
            all.append(contentsOf: page.records)
            token = page.token
            more = page.more
            if page.ok == false, page.records.isEmpty { break }
        }
        return (all, ok)
    }

    private func zoneRecordsPage(
        in database: CKDatabase,
        zoneID: CKRecordZone.ID,
        token: CKServerChangeToken?
    ) async -> (records: [CKRecord], ok: Bool, more: Bool, token: CKServerChangeToken?) {
        await AsyncTimeout.value(seconds: 12) {
            await withCheckedContinuation { continuation in
                let config = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
                config.previousServerChangeToken = token
                let op = CKFetchRecordZoneChangesOperation(
                    recordZoneIDs: [zoneID],
                    configurationsByRecordZoneID: [zoneID: config]
                )
                op.qualityOfService = .userInitiated
                op.fetchAllChanges = true
                let bag = RecordCollector()
                op.recordWasChangedBlock = { _, result in
                    if case .success(let record) = result {
                        bag.append(record)
                    }
                }
                op.recordZoneFetchResultBlock = { _, result in
                    switch result {
                    case .success(let details):
                        bag.markOK(token: details.serverChangeToken, moreComing: details.moreComing)
                    case .failure:
                        break
                    }
                }
                op.fetchRecordZoneChangesResultBlock = { result in
                    let snap = bag.snapshot
                    switch result {
                    case .success:
                        continuation.resume(returning: (snap.records, snap.ok || snap.records.isEmpty == false, snap.more, snap.token))
                    case .failure:
                        continuation.resume(returning: (snap.records, snap.records.isEmpty == false, false, snap.token))
                    }
                }
                database.add(op)
            }
        } ?? ([], false, false, nil)
    }

    private func records(ofType type: String, in database: CKDatabase) async -> [CKRecord] {
        let listed: [CKRecordZone.ID]
        if database.databaseScope == .shared {
            listed = await fetchAllZones(from: database).map(\.zoneID)
        } else {
            listed = []
        }
        let zoneIDs = FamilyShareHierarchy.zoneIDs(
            isSharedDatabase: database.databaseScope == .shared,
            familyZone: familyZoneID,
            listedSharedZones: listed
        )
        var map: [String: CKRecord] = [:]
        for zoneID in zoneIDs {
            let batch = await zoneRecords(in: database, zoneID: zoneID)
            for record in FamilyShareHierarchy.records(ofType: type, from: batch.records) {
                map[record.recordID.recordName] = record
            }
        }
        if map.isEmpty {
            let fallback = await recordsResult(ofType: type, in: database)
            for record in fallback.records {
                map[record.recordID.recordName] = record
            }
        }
        return Array(map.values)
    }

    private func recordsResult(ofType type: String, in database: CKDatabase) async -> (records: [CKRecord], ok: Bool) {
        let listed: [CKRecordZone.ID]
        if database.databaseScope == .shared {
            let zones = await AsyncTimeout.value(seconds: 8, operation: {
                await self.fetchAllZones(from: database)
            }) ?? []
            listed = zones.map(\.zoneID)
        } else {
            listed = []
        }
        let zoneIDs = FamilyShareHierarchy.zoneIDs(
            isSharedDatabase: database.databaseScope == .shared,
            familyZone: familyZoneID,
            listedSharedZones: listed
        )
        var records: [CKRecord] = []
        var ok = false
        for zoneID in zoneIDs {
            let batch = await queryResult(queryForType(type), in: database, zoneID: zoneID)
            if batch.ok { ok = true }
            records.append(contentsOf: batch.records)
        }
        return (records, ok)
    }

    private func queryForType(_ type: String) -> CKQuery {
        CKQuery(recordType: type, predicate: NSPredicate(value: true))
    }

    private func query(_ query: CKQuery, in database: CKDatabase, zoneID: CKRecordZone.ID) async -> [CKRecord] {
        await queryResult(query, in: database, zoneID: zoneID).records
    }

    private func queryResult(_ query: CKQuery, in database: CKDatabase, zoneID: CKRecordZone.ID) async -> (records: [CKRecord], ok: Bool) {
        await AsyncTimeout.value(seconds: 10) {
            do {
                let (result, _) = try await database.records(matching: query, inZoneWith: zoneID)
                var records: [CKRecord] = []
                for (_, item) in result {
                    if let record = try? item.get() {
                        records.append(record)
                    }
                }
                return (records, true)
            } catch {
                return ([], false)
            }
        } ?? ([], false)
    }

    private func isNoisyStatus(_ message: String?) -> Bool {
        guard let message, message.isEmpty == false else { return true }
        if FamilyCloudCopy.isObsoleteStatus(message) { return true }
        if message == "Włącz iCloud, aby synchronizować i udostępniać." { return true }
        let lowered = message.lowercased()
        return lowered.contains("zone wide")
            || lowered.contains("shareddb")
            || lowered.contains("ckrecord")
            || lowered.contains("production schema")
    }

    private func report(_ error: Error) {
        if isNoisyCloudKit(error, forSave: false) { return }
        if isNoisyStatus(error.localizedDescription) { return }
        if FamilyCloudCopy.isHandledSchemaGap(error) { return }
        statusMessage = FamilyCloudCopy.userFacingSaveMessage(for: error)
    }

    private func reportSave(_ error: Error) {
        lastPushFailed = true
        if isNoisyCloudKit(error, forSave: true) { return }
        if CloudKitProductionSchema.forbiddenField(from: error) != nil { return }
        if FamilyCloudCopy.isHandledSchemaGap(error) { return }
        statusMessage = FamilyCloudCopy.userFacingSaveMessage(for: error)
    }

    private func isNoisyCloudKit(_ error: Error, forSave: Bool) -> Bool {
        let text = error.localizedDescription.lowercased()
        if text.contains("zone wide") || text.contains("shareddb") { return true }
        if let ck = error as? CKError {
            switch ck.code {
            case .unknownItem, .notAuthenticated:
                return true
            case .zoneNotFound:
                return forSave == false
            case .invalidArguments:
                return forSave == false
            default:
                break
            }
        }
        return false
    }
}

enum CloudKitShareHandoff {
    static func accept(_ metadata: CKShare.Metadata) {
        Task { @MainActor in
            await CloudKitFamilyService.shared.accept(metadata)
            NotificationCenter.default.post(name: .paragonFamilyRemoteChange, object: nil)
        }
    }
}

final class ParagonAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        application.registerForRemoteNotifications()
        if let shortcut = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            captureLaunchShortcut(shortcut)
        }
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        if let shortcut = options.shortcutItem {
            captureLaunchShortcut(shortcut)
        }
        let configuration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        configuration.delegateClass = ParagonSceneDelegate.self
        return configuration
    }

    func application(
        _ application: UIApplication,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        captureLaunchShortcut(shortcutItem)
        NotificationCenter.default.post(name: .paragonShortcut, object: shortcutItem)
        completionHandler(true)
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task {
            await CloudKitFamilyService.shared.handlePush(userInfo)
            completionHandler(.newData)
        }
    }

    private func captureLaunchShortcut(_ shortcut: UIApplicationShortcutItem) {
        HomeQuickActions.captureIncoming(shortcut)
    }

    func application(
        _ application: UIApplication,
        userDidAcceptCloudKitShareWith cloudKitShareMetadata: CKShare.Metadata
    ) {
        CloudKitShareHandoff.accept(cloudKitShareMetadata)
    }
}
