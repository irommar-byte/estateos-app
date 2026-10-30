import CloudKit
import Foundation
import UIKit

enum FamilyShareOwnership {
    /// Private-DB family zones must keep `__defaultOwner__`. CloudKit sometimes
    /// echoes the real user record name on fetched records; treating that as a
    /// participant sends upserts to the shared database and invitees see nothing.
    static func persistedZoneOwner(foundInPrivateDatabase: Bool, zoneOwnerName: String) -> String {
        if foundInPrivateDatabase { return CKCurrentUserDefaultName }
        if FamilyCloudTarget.isOwner(zoneOwnerName) { return CKCurrentUserDefaultName }
        return zoneOwnerName
    }
}

enum FamilyShareHierarchy {
    static func parentReference(walletID: String, childRecordID: CKRecord.ID) -> CKRecord.Reference? {
        guard childRecordID.recordName != walletID else { return nil }
        let parentID = CKRecord.ID(recordName: walletID, zoneID: childRecordID.zoneID)
        return CKRecord.Reference(recordID: parentID, action: .none)
    }

    static func applyParent(_ record: CKRecord, walletID: String) -> Bool {
        guard let reference = parentReference(walletID: walletID, childRecordID: record.recordID) else {
            return false
        }
        let before = record.parent?.recordID
        record.parent = reference
        return before != reference.recordID
    }

    /// Always include the known family zone. An empty shared-zone listing used to
    /// look like a successful empty fetch, so participants never received records.
    static func zoneIDs(
        isSharedDatabase: Bool,
        familyZone: CKRecordZone.ID,
        listedSharedZones: [CKRecordZone.ID]
    ) -> [CKRecordZone.ID] {
        if isSharedDatabase == false {
            return [familyZone]
        }
        var ids: [CKRecordZone.ID] = []
        for zone in listedSharedZones where ids.contains(zone) == false {
            ids.append(zone)
        }
        if ids.contains(familyZone) == false {
            ids.append(familyZone)
        }
        return ids
    }

    static func records(ofType type: String, from records: [CKRecord]) -> [CKRecord] {
        records.filter { $0.recordType == type }
    }
}

enum FamilyFetchOutcome {
    static func succeeded(zoneFetchOK: Bool, recordCount: Int) -> Bool {
        zoneFetchOK || recordCount > 0
    }

    /// A query that returned no records is not a substitute for a successful
    /// shared-zone change fetch. CloudKit may return an empty result while the
    /// accepted share is still materializing.
    static func queryProvidesEvidence(querySucceeded: Bool, recordCount: Int) -> Bool {
        querySucceeded && recordCount > 0
    }
}

enum CloudKitProductionSchema {
    static func forbiddenField(from error: Error) -> String? {
        for message in messages(from: error) {
            if let field = fieldName(in: message) { return field }
        }
        return nil
    }

    static func fieldName(in message: String) -> String? {
        let pattern = #"Cannot create or modify field ['\"]([^'\"]+)['\"]"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(message.startIndex..., in: message)
        guard let match = regex.firstMatch(in: message, range: range),
              let fieldRange = Range(match.range(at: 1), in: message) else { return nil }
        let field = String(message[fieldRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        return field.isEmpty ? nil : field
    }

    static func copy(_ record: CKRecord, excluding fields: Set<String>) -> CKRecord {
        let next = cloneSystemFields(of: record) ?? CKRecord(recordType: record.recordType, recordID: record.recordID)
        // Re-assign after encodeSystemFields so `parent` is a local change.
        // Saving with .changedKeys after a clone used to drop the hierarchy, so
        // share participants never received child records.
        next.parent = record.parent
        for key in record.allKeys() where fields.contains(key) == false {
            next[key] = record[key]
        }
        return next
    }

    /// Photo is already stripped on the local record; send every remaining key plus
    /// system fields (parent). `.changedKeys` skipped parent after a system-fields clone.
    static var familySavePolicy: CKModifyRecordsOperation.RecordSavePolicy { .allKeys }

    static func saveRetry(for error: Error) -> FamilyCloudSaveRetry? {
        if let field = forbiddenField(from: error) {
            return .stripField(field)
        }
        if let ck = error as? CKError {
            switch ck.code {
            case .serverRecordChanged, .batchRequestFailed:
                return .mergeServer
            case .limitExceeded:
                return .shrinkPhoto
            case .zoneNotFound, .zoneBusy, .requestRateLimited, .serviceUnavailable,
                 .networkFailure, .networkUnavailable:
                return .recreateZone
            default:
                break
            }
        }
        let joined = messages(from: error).joined(separator: " ").lowercased()
        if joined.contains("limit exceeded") || joined.contains("too large") || joined.contains("maximum size") {
            return .shrinkPhoto
        }
        let ns = error as NSError
        if ns.domain == CKErrorDomain {
            if ns.code == 14 { return .mergeServer }
            if ns.code == 27 { return .shrinkPhoto }
            if [3, 4, 6, 7, 23, 26].contains(ns.code) { return .recreateZone }
        }
        return nil
    }

    private static func cloneSystemFields(of record: CKRecord) -> CKRecord? {
        let archiver = NSKeyedArchiver(requiringSecureCoding: true)
        record.encodeSystemFields(with: archiver)
        archiver.finishEncoding()
        guard let unarchiver = try? NSKeyedUnarchiver(forReadingFrom: archiver.encodedData) else { return nil }
        unarchiver.requiresSecureCoding = true
        return CKRecord(coder: unarchiver)
    }

    static func messages(from error: Error) -> [String] {
        var texts = [error.localizedDescription]
        let ns = error as NSError
        if let reason = ns.localizedFailureReason { texts.append(reason) }
        if let nested = ns.userInfo[NSUnderlyingErrorKey] as? Error {
            texts.append(contentsOf: messages(from: nested))
        }
        if let partial = ns.userInfo[CKPartialErrorsByItemIDKey] as? [AnyHashable: Error] {
            for inner in partial.values {
                texts.append(contentsOf: messages(from: inner))
            }
        }
        return texts.filter { $0.isEmpty == false }
    }
}

enum FamilySchemaGaps {
    private static let defaultsKey = "paragonos.ck.schemaGaps"
    /// Production CloudKit has no `photo` on family record types. Skip it up front
    /// so the first save succeeds instead of failing then retrying.
    static let knownProductionGaps: [String: Set<String>] = [
        "SharedLoyaltyCard": ["photo", "jpeg"],
        "SharedTicket": ["photo", "jpeg"],
        "SharedReceipt": ["photo", "jpeg"],
    ]

    static func bannedFields(for recordType: String) -> Set<String> {
        let all = UserDefaults.standard.dictionary(forKey: defaultsKey) as? [String: [String]] ?? [:]
        return Set(all[recordType] ?? []).union(knownProductionGaps[recordType] ?? [])
    }

    static func allows(_ field: String, in recordType: String) -> Bool {
        bannedFields(for: recordType).contains(field) == false
    }

    static func remember(field: String, recordType: String) {
        var all = UserDefaults.standard.dictionary(forKey: defaultsKey) as? [String: [String]] ?? [:]
        var fields = Set(all[recordType] ?? [])
        fields.insert(field)
        all[recordType] = Array(fields)
        UserDefaults.standard.set(all, forKey: defaultsKey)
    }
}

/// Thrown when a bounded CloudKit call (see `AsyncTimeout`) never came back —
/// surfaced to the user as an ordinary "spróbuj ponownie" rather than hanging UI.
struct FamilyCloudTimeoutError: Error {}

enum FamilyCloudSaveRetry: Equatable {
    case stripField(String)
    case mergeServer
    case recreateZone
    case shrinkPhoto
}

enum FamilyUploadRetry {
    static func shouldRepush(
        categoryEnabled: Bool,
        shareExisting: Bool,
        isTagged: Bool
    ) -> Bool {
        guard categoryEnabled else { return false }
        return shareExisting || isTagged
    }
}

enum FamilyShareAllPrompt {
    static func message(
        deposits: Int,
        receipts: Int,
        cards: Int,
        depositsOn: Bool,
        receiptsOn: Bool,
        cardsOn: Bool
    ) -> String {
        var parts: [String] = []
        if depositsOn { parts.append(count(deposits, one: "kaucję", few: "kaucje", many: "kaucji")) }
        if receiptsOn { parts.append(count(receipts, one: "paragon", few: "paragony", many: "paragonów")) }
        if cardsOn { parts.append(count(cards, one: "kartę", few: "karty", many: "kart")) }
        if parts.isEmpty {
            return "Najpierw włącz kategorię wyżej. Sam zakres nic nie wyśle."
        }
        var text = "Bliscy zobaczą też to, co już masz: \(parts.joined(separator: ", "))."
        if receiptsOn {
            text += " Zdjęcie paragonu idzie raz, we wspólnym portfelu — bez osobnej kopii u każdego."
        }
        return text
    }

    static func count(_ n: Int, one: String, few: String, many: String) -> String {
        "\(n) \(polishPlural(n, one: one, few: few, many: many))"
    }

    static func polishPlural(_ n: Int, one: String, few: String, many: String) -> String {
        let abs = Swift.abs(n)
        if abs == 1 { return one }
        let mod10 = abs % 10
        let mod100 = abs % 100
        if (12...14).contains(mod100) { return many }
        if (2...4).contains(mod10) { return few }
        return many
    }
}

/// Receipt photos ride the existing `itemName` string — one copy in the family
/// zone. Production CloudKit rejected new `photo` / `jpeg` fields.
enum FamilyPhotoCodec {
    static let receiptBytesField = "jpeg"
    static let itemMarker = "\n\u{1e}PHO1:"
    static let familyMaxBytes = 72_000

    static func attachReceiptPhoto(_ record: CKRecord, data: Data?) {
        guard let data, data.isEmpty == false else { return }
        guard FamilySchemaGaps.allows(receiptBytesField, in: record.recordType) else { return }
        record[receiptBytesField] = data as CKRecordValue
    }

    static func packedItemName(_ items: String, photo: Data?) -> String {
        packItemName(items, photo: compactFamilyPhoto(photo))
    }

    static func compactFamilyPhoto(_ photo: Data?) -> Data? {
        guard let photo, photo.isEmpty == false else { return nil }
        guard photo.count > familyMaxBytes, let image = UIImage(data: photo) else { return photo }
        guard let next = ScanService.compressPhoto(image, maxBytes: familyMaxBytes), next.count < photo.count else {
            return photo
        }
        return next
    }

    /// Production SharedReceipt has no `photo` asset. `itemName` already exists, so
    /// the compact JPEG/HEIC rides along that string — one copy in the family zone.
    static func packItemName(_ items: String, photo: Data?) -> String {
        let clean = unpack(items).items
        guard let photo, photo.isEmpty == false else { return clean }
        return clean + itemMarker + photo.base64EncodedString()
    }

    @discardableResult
    static func shrinkPackedPhoto(_ record: CKRecord) -> Bool {
        let unpacked = unpack(record["itemName"] as? String)
        guard let photo = unpacked.photo, photo.isEmpty == false else { return false }
        let nextCap = max(12_000, photo.count / 2)
        if let image = UIImage(data: photo),
           let next = ScanService.compressPhoto(image, maxBytes: nextCap),
           next.count < photo.count {
            record["itemName"] = packItemName(unpacked.items, photo: next) as CKRecordValue
            return true
        }
        // Tiny blobs are not why CloudKit said "too large" — keep them and fail
        // the save instead of silently dropping the picture.
        guard photo.count > 24_000 else { return false }
        record["itemName"] = packItemName(unpacked.items, photo: nil) as CKRecordValue
        return true
    }

    /// If a packed family payload leaked into local SwiftData, split it back so
    /// the item field stays a name and iCloud does not store the photo twice.
    @discardableResult
    static func settleLocal(itemName: inout String, photoData: inout Data?) -> Bool {
        let unpacked = unpack(itemName)
        guard unpacked.items != itemName || unpacked.photo != nil else { return false }
        var changed = false
        if unpacked.items != itemName {
            itemName = unpacked.items
            changed = true
        }
        if let packed = unpacked.photo, photoData == nil {
            photoData = packed
            changed = true
        }
        return changed
    }

    @discardableResult
    static func settle(_ receipt: Receipt) -> Bool {
        var name = receipt.itemName
        var photo = receipt.photoData
        guard settleLocal(itemName: &name, photoData: &photo) else { return false }
        receipt.itemName = name
        receipt.photoData = photo
        return true
    }

    static func unpack(_ raw: String?) -> (items: String, photo: Data?) {
        guard let raw, let range = raw.range(of: itemMarker) else {
            return (raw ?? "", nil)
        }
        let items = String(raw[..<range.lowerBound])
        let encoded = String(raw[range.upperBound...])
        return (items, Data(base64Encoded: encoded))
    }

    static func photoData(from record: CKRecord) -> Data? {
        if let data = record[receiptBytesField] as? Data, data.isEmpty == false {
            return data
        }
        if let packed = unpack(record["itemName"] as? String).photo {
            return packed
        }
        if let asset = record["photo"] as? CKAsset, let url = asset.fileURL {
            return try? Data(contentsOf: url)
        }
        return nil
    }
}

enum FamilyCloudCopy {
    static func userFacingSaveMessage(for error: Error) -> String? {
        if isHandledSchemaGap(error) { return nil }
        let text = CloudKitProductionSchema.messages(from: error).joined(separator: " ").lowercased()
        if text.contains("ckrecord") || text.contains("ckerror") || text.contains("cloudkit") {
            return "Nie udało się wysłać do rodziny. Spróbuj ponownie za chwilę."
        }
        return "Nie udało się wysłać do rodziny. Spróbuj ponownie za chwilę."
    }

    static func isHandledSchemaGap(_ error: Error) -> Bool {
        let text = CloudKitProductionSchema.messages(from: error).joined(separator: " ").lowercased()
        return text.contains("production schema") || text.contains("cannot create or modify field")
    }

    static func isObsoleteStatus(_ message: String?) -> Bool {
        guard let message else { return false }
        return message.contains("zostaje na tym iPhonie") || message.contains("np. zdjęcie")
    }

    static func shouldAutoClear(_ message: String) -> Bool {
        message.contains("Włącz iCloud") == false
    }
}
