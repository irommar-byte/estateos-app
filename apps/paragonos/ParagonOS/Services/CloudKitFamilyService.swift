import CloudKit
import Foundation
import UIKit

struct FamilyMember: Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var isOwner: Bool

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

@MainActor
final class CloudKitFamilyService: ObservableObject {
    static let shared = CloudKitFamilyService()

    @Published var isICloudAvailable = false
    @Published var members: [FamilyMember] = []
    @Published var familyWalletID: String?
    @Published var statusMessage: String?
    @Published var share: CKShare?
    @Published var meFullName: String = ""

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

    private func iCloudFullName() async -> String {
        guard canUseCloudKit else { return "" }
        guard let recordID = try? await container.userRecordID(),
              let identity = try? await container.userIdentity(forUserRecordID: recordID) else {
            return ""
        }
        return FamilyIdentity.joinedName(
            given: identity.nameComponents?.givenName,
            family: identity.nameComponents?.familyName
        )
    }

    func publishDisplayName(_ name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canUseCloudKit, trimmed.isEmpty == false else { return }
        do {
            let userRecordID = try await container.userRecordID()
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
            if let existing = try? await database.record(for: recordID),
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
                if let wallet = try? await container.privateCloudDatabase.record(for: walletID) {
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
        let status = try? await container.accountStatus()
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
        _ = try? await database.modifyRecordZones(saving: [zone], deleting: [])

        let recordID: CKRecord.ID
        if let existing = familyWalletID {
            recordID = CKRecord.ID(recordName: existing, zoneID: zoneID)
        } else {
            recordID = CKRecord.ID(recordName: UUID().uuidString, zoneID: zoneID)
        }

        let wallet: CKRecord
        if let fetched = try? await database.record(for: recordID) {
            wallet = fetched
        } else {
            let created = CKRecord(recordType: walletType, recordID: recordID)
            created["name"] = "Rodzina" as CKRecordValue
            created["ownerName"] = displayName as CKRecordValue
            wallet = created
        }

        let share: CKShare
        if let existingShare = wallet.share {
            share = try await database.record(for: existingShare.recordID) as! CKShare
        } else {
            share = CKShare(rootRecord: wallet)
            share[CKShare.SystemFieldKey.title] = Brand.displayName as CKRecordValue
            if let thumbnail = ParagonMark.png(size: 120) {
                share[CKShare.SystemFieldKey.thumbnailImageData] = thumbnail as CKRecordValue
            }
            share.publicPermission = .none
            let result = try await database.modifyRecords(saving: [wallet, share], deleting: [])
            _ = result
        }

        persistFamilyWalletID(wallet.recordID.recordName, zoneOwner: CKCurrentUserDefaultName)
        self.share = share
        members = [
            FamilyMember(
                id: "owner",
                name: displayName.isEmpty ? (meFullName.isEmpty ? "Ty" : meFullName) : displayName,
                isOwner: true
            )
        ]
        return share
    }

    func accept(_ metadata: CKShare.Metadata) async {
        do {
            try await container.accept(metadata)
            persistFamilyWalletID(
                metadata.rootRecordID.recordName,
                zoneOwner: metadata.rootRecordID.zoneID.ownerName
            )
            statusMessage = "Dołączono do portfela rodzinnego."
            await refreshParticipants()
        } catch {
            report(error)
        }
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
            if let wallet = try? await container.privateCloudDatabase.record(for: walletID),
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
                    FamilyMember(id: myRecordName ?? "owner", name: ownerName, isOwner: true)
                ]
            } else if meFullName.isEmpty == false {
                members = [
                    FamilyMember(id: myRecordName ?? "owner", name: meFullName, isOwner: true)
                ]
            }
            return
        }
        var next: [FamilyMember] = []
        for participant in share.participants {
            let id = participant.userIdentity.userRecordID?.recordName ?? UUID().uuidString
            var fallback = FamilyIdentity.joinedName(
                given: participant.userIdentity.nameComponents?.givenName,
                family: participant.userIdentity.nameComponents?.familyName
            )
            if fallback.isEmpty, let recordID = participant.userIdentity.userRecordID,
               let identity = try? await container.userIdentity(forUserRecordID: recordID) {
                fallback = FamilyIdentity.joinedName(
                    given: identity.nameComponents?.givenName,
                    family: identity.nameComponents?.familyName
                )
            }
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
                isOwner: participant.role == .owner
            ))
        }
        members = next
    }

    func restoreFamilyShare() async {
        guard canUseCloudKit else { return }
        if familyWalletID == nil {
            familyWalletID = UserDefaults.standard.string(forKey: familyWalletIDKey)
        }

        if let familyWalletID {
            let recordID = CKRecord.ID(recordName: familyWalletID, zoneID: familyZoneID)
            if let wallet = try? await container.privateCloudDatabase.record(for: recordID) {
                if let shareRef = wallet.share,
                   let fetched = try? await container.privateCloudDatabase.record(for: shareRef.recordID) as? CKShare {
                    share = fetched
                }
                return
            }
        }

        let privateWallets = await records(ofType: walletType, in: container.privateCloudDatabase)
        if let wallet = privateWallets.first {
            persistFamilyWalletID(wallet.recordID.recordName, zoneOwner: wallet.recordID.zoneID.ownerName)
            if let shareRef = wallet.share,
               let fetched = try? await container.privateCloudDatabase.record(for: shareRef.recordID) as? CKShare {
                share = fetched
            }
            return
        }

        let sharedWallets = await records(ofType: walletType, in: container.sharedCloudDatabase)
        if let wallet = sharedWallets.first {
            persistFamilyWalletID(wallet.recordID.recordName, zoneOwner: wallet.recordID.zoneID.ownerName)
            if let shareRef = wallet.share,
               let fetched = try? await container.sharedCloudDatabase.record(for: shareRef.recordID) as? CKShare {
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
        if let fresh = try? await database.record(for: share.recordID) as? CKShare {
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

    func upsertShared(ticket: Ticket) async {
        guard isICloudAvailable, let familyWalletID else { return }
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
        if let data = ticket.photoData {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(ticket.id.uuidString).jpg")
            try? data.write(to: url)
            record["photo"] = CKAsset(fileURL: url)
        }
        attachParent(record)
        do {
            _ = try await familyDatabase.modifyRecords(saving: [record], deleting: [])
        } catch {
            report(error)
        }
    }

    func upsertShared(receipt: Receipt) async {
        guard isICloudAvailable, let familyWalletID else { return }
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
        record["itemName"] = receipt.itemName as CKRecordValue
        record["scannedByName"] = receipt.scannedByName as CKRecordValue
        if let warrantyUntil = receipt.warrantyUntil {
            record["warrantyUntil"] = warrantyUntil as CKRecordValue
        }
        if let returnUntil = receipt.returnUntil {
            record["returnUntil"] = returnUntil as CKRecordValue
        }
        if let data = receipt.photoData {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("receipt-\(receipt.id.uuidString).jpg")
            try? data.write(to: url)
            record["photo"] = CKAsset(fileURL: url)
        }
        attachParent(record)
        do {
            _ = try await familyDatabase.modifyRecords(saving: [record], deleting: [])
        } catch {
            report(error)
        }
    }

    func upsertShared(card: LoyaltyCard) async {
        guard isICloudAvailable, let familyWalletID else { return }
        let record = await familyRecord(type: loyaltyType, name: card.id.uuidString)
        record["familyWalletID"] = familyWalletID as CKRecordValue
        record["programID"] = card.programID as CKRecordValue
        record["programName"] = card.programName as CKRecordValue
        record["holderName"] = card.holderName as CKRecordValue
        record["barcodePayload"] = card.barcodePayload as CKRecordValue
        record["barcodeSymbology"] = card.barcodeSymbologyRaw as CKRecordValue
        record["note"] = card.note as CKRecordValue
        record["scannedByName"] = card.scannedByName as CKRecordValue
        if let data = card.photoData {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("card-\(card.id.uuidString).jpg")
            try? data.write(to: url)
            record["photo"] = CKAsset(fileURL: url)
        }
        attachParent(record)
        do {
            _ = try await familyDatabase.modifyRecords(saving: [record], deleting: [])
        } catch {
            report(error)
        }
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
            for record in await records(ofType: type, in: familyDatabase) where record.parent == nil {
                attachParent(record)
                if record.parent != nil {
                    dirty.append(record)
                }
            }
        }
        guard dirty.isEmpty == false else { return }
        var index = 0
        while index < dirty.count {
            let end = min(index + 200, dirty.count)
            _ = try? await familyDatabase.modifyRecords(saving: Array(dirty[index..<end]), deleting: [])
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
        _ = try? await container.privateCloudDatabase.modifySubscriptions(saving: [privateSub], deleting: [])
        _ = try? await container.sharedCloudDatabase.modifySubscriptions(saving: [sharedSub], deleting: [])
    }

    func handlePush(_ userInfo: [AnyHashable: Any]) async {
        guard CKNotification(fromRemoteNotificationDictionary: userInfo) != nil else { return }
        await refreshAccountStatus()
        NotificationCenter.default.post(name: .paragonFamilyRemoteChange, object: nil)
    }

    private func familyRecord(type: String, name: String) async -> CKRecord {
        let recordID = CKRecord.ID(recordName: name, zoneID: familyZoneID)
        if let existing = try? await familyDatabase.record(for: recordID) {
            attachParent(existing)
            return existing
        }
        let record = CKRecord(recordType: type, recordID: recordID)
        attachParent(record)
        return record
    }

    private func fetchFamilyRecords(ofType type: String) async -> FamilyRecordFetch {
        guard isICloudAvailable, familyWalletID != nil else {
            return FamilyRecordFetch(records: [], succeeded: false)
        }
        var map: [String: CKRecord] = [:]
        var succeeded = false
        for database in [container.privateCloudDatabase, container.sharedCloudDatabase] {
            let result = await recordsResult(ofType: type, in: database)
            if result.ok { succeeded = true }
            for record in result.records {
                map[record.recordID.recordName] = record
            }
        }
        return FamilyRecordFetch(records: Array(map.values), succeeded: succeeded)
    }

    private func attachParent(_ record: CKRecord) {
        guard let familyWalletID, record.parent == nil else { return }
        let parentID = CKRecord.ID(recordName: familyWalletID, zoneID: familyZoneID)
        record.parent = CKRecord.Reference(recordID: parentID, action: .none)
    }

    private func records(ofType type: String, in database: CKDatabase) async -> [CKRecord] {
        await recordsResult(ofType: type, in: database).records
    }

    private func recordsResult(ofType type: String, in database: CKDatabase) async -> (records: [CKRecord], ok: Bool) {
        let query = CKQuery(recordType: type, predicate: NSPredicate(value: true))
        let zoneIDs: [CKRecordZone.ID]
        if database.databaseScope == .shared {
            zoneIDs = await AsyncTimeout.value(seconds: 8) {
                ((try? await database.allRecordZones()) ?? []).map(\.zoneID)
            } ?? []
        } else {
            zoneIDs = [
                CKRecordZone.default().zoneID,
                familyZoneID
            ]
        }
        var records: [CKRecord] = []
        var ok = false
        for zoneID in zoneIDs {
            let batch = await queryResult(query, in: database, zoneID: zoneID)
            if batch.ok { ok = true }
            records.append(contentsOf: batch.records)
        }
        if database.databaseScope == .shared, zoneIDs.isEmpty {
            ok = true
        }
        return (records, ok)
    }

    private func query(_ query: CKQuery, in database: CKDatabase, zoneID: CKRecordZone.ID) async -> [CKRecord] {
        await queryResult(query, in: database, zoneID: zoneID).records
    }

    private func queryResult(_ query: CKQuery, in database: CKDatabase, zoneID: CKRecordZone.ID) async -> (records: [CKRecord], ok: Bool) {
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
            if let ck = error as? CKError, ck.code == .unknownItem || ck.code == .zoneNotFound {
                return ([], true)
            }
            return ([], false)
        }
    }

    private func isNoisyStatus(_ message: String?) -> Bool {
        guard let message, message.isEmpty == false else { return true }
        if message == "Włącz iCloud, aby synchronizować i udostępniać." { return true }
        let lowered = message.lowercased()
        return lowered.contains("zone wide") || lowered.contains("shareddb")
    }

    private func report(_ error: Error) {
        if isNoisyCloudKit(error) { return }
        statusMessage = error.localizedDescription
    }

    private func isNoisyCloudKit(_ error: Error) -> Bool {
        let text = error.localizedDescription.lowercased()
        if text.contains("zone wide") || text.contains("shareddb") { return true }
        if let ck = error as? CKError {
            switch ck.code {
            case .unknownItem, .zoneNotFound, .invalidArguments, .notAuthenticated:
                return true
            default:
                break
            }
        }
        return false
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
        Task { @MainActor in
            await CloudKitFamilyService.shared.accept(cloudKitShareMetadata)
            NotificationCenter.default.post(name: .paragonFamilyRemoteChange, object: nil)
        }
    }
}
