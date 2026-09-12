import CloudKit
import Foundation
import UIKit

struct FamilyMember: Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var isOwner: Bool
}

@MainActor
final class CloudKitFamilyService: ObservableObject {
    static let shared = CloudKitFamilyService()

    @Published var isICloudAvailable = false
    @Published var isSyncing = false
    @Published var members: [FamilyMember] = []
    @Published var familyWalletID: String?
    @Published var statusMessage: String?
    @Published var share: CKShare?

    private lazy var container = CKContainer(identifier: Brand.iCloudContainer)
    private let walletType = "FamilyWallet"
    private let ticketType = "SharedTicket"
    private let receiptType = "SharedReceipt"
    private let memberNameType = "FamilyMemberName"

    private var canUseCloudKit: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil
            && NSClassFromString("XCTestCase") == nil
            && FileManager.default.ubiquityIdentityToken != nil
    }

    func suggestedGivenName() async -> String {
        guard canUseCloudKit else { return "" }
        guard let recordID = try? await container.userRecordID(),
              let identity = try? await container.userIdentity(forUserRecordID: recordID) else {
            return ""
        }
        let given = identity.nameComponents?.givenName ?? ""
        let familyName = identity.nameComponents?.familyName ?? ""
        return [given, familyName].filter { $0.isEmpty == false }.joined(separator: " ")
    }

    func publishDisplayName(_ name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canUseCloudKit, trimmed.isEmpty == false else { return }
        do {
            let userRecordID = try await container.userRecordID()
            let zoneID: CKRecordZone.ID
            if familyWalletID != nil {
                zoneID = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
                _ = try? await container.privateCloudDatabase.modifyRecordZones(
                    saving: [CKRecordZone(zoneID: zoneID)],
                    deleting: []
                )
            } else {
                zoneID = CKRecordZone.default().zoneID
            }
            let recordName = "member-name-\(userRecordID.recordName)"
            let recordID = CKRecord.ID(recordName: recordName, zoneID: zoneID)
            let record: CKRecord
            if let existing = try? await container.privateCloudDatabase.record(for: recordID),
               existing.recordType == memberNameType {
                record = existing
            } else {
                record = CKRecord(recordType: memberNameType, recordID: recordID)
            }
            record["displayName"] = trimmed as CKRecordValue
            record["userRecordName"] = userRecordID.recordName as CKRecordValue
            _ = try? await container.privateCloudDatabase.modifyRecords(saving: [record], deleting: [])

            if let familyWalletID {
                let walletID = CKRecord.ID(
                    recordName: familyWalletID,
                    zoneID: CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
                )
                if let wallet = try? await container.privateCloudDatabase.record(for: walletID) {
                    wallet["ownerName"] = trimmed as CKRecordValue
                    _ = try? await container.privateCloudDatabase.modifyRecords(saving: [wallet], deleting: [])
                }
            }
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func refreshAccountStatus() async {
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
        } else if statusMessage == "Włącz iCloud, aby synchronizować i udostępniać." {
            statusMessage = nil
        }
    }

    func prepareShare(displayName: String) async throws -> CKShare {
        let database = container.privateCloudDatabase
        let zoneID = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
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
            share.publicPermission = .none
            let result = try await database.modifyRecords(saving: [wallet, share], deleting: [])
            _ = result
        }

        familyWalletID = wallet.recordID.recordName
        self.share = share
        members = [
            FamilyMember(id: "owner", name: displayName.isEmpty ? "Ty" : displayName, isOwner: true)
        ]
        return share
    }

    func accept(_ metadata: CKShare.Metadata) async {
        do {
            try await container.accept(metadata)
            familyWalletID = metadata.rootRecordID.recordName
            statusMessage = "Dołączono do portfela rodzinnego."
            await refreshParticipants()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func refreshParticipants() async {
        var names = await fetchMemberNames()
        if let familyWalletID {
            let walletID = CKRecord.ID(
                recordName: familyWalletID,
                zoneID: CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
            )
            if let wallet = try? await container.privateCloudDatabase.record(for: walletID),
               let ownerName = wallet["ownerName"] as? String,
               ownerName.isEmpty == false {
                names["owner"] = ownerName
            }
        }
        guard let share else {
            if let owner = names["owner"] ?? names.values.first {
                members = [FamilyMember(id: "owner", name: owner, isOwner: true)]
            }
            return
        }
        var next: [FamilyMember] = []
        for participant in share.participants {
            let id = participant.userIdentity.userRecordID?.recordName ?? UUID().uuidString
            let fallback = [participant.userIdentity.nameComponents?.givenName, participant.userIdentity.nameComponents?.familyName]
                .compactMap { $0 }
                .filter { $0.isEmpty == false }
                .joined(separator: " ")
            let stored = names[id]
            let name: String
            if participant.role == .owner {
                name = names["owner"] ?? stored ?? (fallback.isEmpty ? "Ty" : fallback)
            } else {
                name = stored ?? (fallback.isEmpty ? "Uczestnik" : fallback)
            }
            next.append(FamilyMember(
                id: id,
                name: name,
                isOwner: participant.role == .owner
            ))
        }
        members = next
    }

    private func fetchMemberNames() async -> [String: String] {
        guard canUseCloudKit else { return [:] }
        let query = CKQuery(recordType: memberNameType, predicate: NSPredicate(value: true))
        var map: [String: String] = [:]
        for database in [container.privateCloudDatabase, container.sharedCloudDatabase] {
            guard let (result, _) = try? await database.records(matching: query) else { continue }
            for (_, item) in result {
                guard let record = try? item.get(),
                      let name = record["displayName"] as? String,
                      name.isEmpty == false else { continue }
                let key = (record["userRecordName"] as? String) ?? record.recordID.recordName
                map[key] = name
            }
        }
        return map
    }

    func upsertShared(ticket: Ticket) async {
        guard isICloudAvailable, let familyWalletID else { return }
        let database = container.privateCloudDatabase
        let zoneID = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let recordID = CKRecord.ID(recordName: ticket.id.uuidString, zoneID: zoneID)
        let record = CKRecord(recordType: ticketType, recordID: recordID)
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
        do {
            _ = try await database.modifyRecords(saving: [record], deleting: [])
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func upsertShared(receipt: Receipt) async {
        guard isICloudAvailable, let familyWalletID else { return }
        let database = container.privateCloudDatabase
        let zoneID = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let recordID = CKRecord.ID(recordName: receipt.id.uuidString, zoneID: zoneID)
        let record = CKRecord(recordType: receiptType, recordID: recordID)
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
        do {
            _ = try await database.modifyRecords(saving: [record], deleting: [])
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func fetchSharedReceipts() async -> [CKRecord] {
        guard isICloudAvailable else { return [] }
        let query = CKQuery(recordType: receiptType, predicate: NSPredicate(value: true))
        guard let (result, _) = try? await container.sharedCloudDatabase.records(matching: query) else { return [] }
        var records: [CKRecord] = []
        for (_, item) in result {
            if let record = try? item.get() {
                records.append(record)
            }
        }
        return records
    }

    func fetchSharedTickets() async -> [CKRecord] {
        guard isICloudAvailable else { return [] }
        isSyncing = true
        defer { isSyncing = false }
        let query = CKQuery(recordType: ticketType, predicate: NSPredicate(value: true))
        var records: [CKRecord] = []
        do {
            let (result, _) = try await container.sharedCloudDatabase.records(matching: query)
            for (_, item) in result {
                if let record = try? item.get() {
                    records.append(record)
                }
            }
        } catch {
            statusMessage = error.localizedDescription
        }
        return records
    }
}

final class ParagonAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        true
    }

    func application(
        _ application: UIApplication,
        userDidAcceptCloudKitShareWith cloudKitShareMetadata: CKShare.Metadata
    ) {
        Task { @MainActor in
            await CloudKitFamilyService.shared.accept(cloudKitShareMetadata)
        }
    }
}
