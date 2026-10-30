import CloudKit
import XCTest
@testable import ParagonOS

final class FamilySharePolicyTests: XCTestCase {
    func testDepositsAndReceiptsAreIndependent() {
        XCTAssertTrue(
            FamilySharePolicy.shouldShare(
                .deposit,
                depositsEnabled: true,
                receiptsEnabled: false,
                familyWalletID: "family"
            )
        )
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .receipt,
                depositsEnabled: true,
                receiptsEnabled: false,
                familyWalletID: "family"
            )
        )
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .deposit,
                depositsEnabled: false,
                receiptsEnabled: true,
                familyWalletID: "family"
            )
        )
        XCTAssertTrue(
            FamilySharePolicy.shouldShare(
                .receipt,
                depositsEnabled: false,
                receiptsEnabled: true,
                familyWalletID: "family"
            )
        )
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .loyalty,
                depositsEnabled: true,
                receiptsEnabled: true,
                cardsEnabled: false,
                familyWalletID: "family"
            )
        )
        XCTAssertTrue(
            FamilySharePolicy.shouldShare(
                .loyalty,
                depositsEnabled: false,
                receiptsEnabled: false,
                cardsEnabled: true,
                familyWalletID: "family"
            )
        )
    }

    func testShareRequiresFamilyWallet() {
        XCTAssertFalse(
            FamilySharePolicy.shouldShare(
                .deposit,
                depositsEnabled: true,
                receiptsEnabled: true,
                familyWalletID: nil
            )
        )
    }
}

final class NotificationReminderOffsetTests: XCTestCase {
    func testNormalizedSortsUniqueAndCaps() {
        XCTAssertEqual(
            NotificationSettings.normalized([7, 7, 1, 0, 14, 30, 3, -1, 99]),
            [30, 14, 7, 3]
        )
    }

    func testLabels() {
        XCTAssertEqual(NotificationSettings.label(for: 0), "W dniu terminu")
        XCTAssertEqual(NotificationSettings.label(for: 1), "1 dzień przed")
        XCTAssertEqual(NotificationSettings.label(for: 7), "7 dni przed")
        XCTAssertEqual(
            NotificationSettings.summary(for: [7, 1, 0]),
            "7 dni · 1 dzień · w dniu"
        )
        XCTAssertEqual(NotificationSettings.summary(for: []), "Wyłączone")
    }
}

final class FamilyCloudTargetTests: XCTestCase {
    func testDefaultOwnerNameWritesToPrivateDatabase() {
        XCTAssertTrue(FamilyCloudTarget.isOwner(CKCurrentUserDefaultName))
        XCTAssertTrue(FamilyCloudTarget.isOwner(""))
        XCTAssertFalse(FamilyCloudTarget.isOwner("_abc123owner"))
    }
}

final class FamilyShareTransportTests: XCTestCase {
    private let familyZone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: "_owner")

    func testPrivateFetchAlwaysPersistsDefaultOwner() {
        XCTAssertEqual(
            FamilyShareOwnership.persistedZoneOwner(foundInPrivateDatabase: true, zoneOwnerName: "_abc123"),
            CKCurrentUserDefaultName
        )
    }

    func testSharedFetchKeepsRealOwner() {
        XCTAssertEqual(
            FamilyShareOwnership.persistedZoneOwner(foundInPrivateDatabase: false, zoneOwnerName: "_abc123"),
            "_abc123"
        )
        XCTAssertEqual(
            FamilyShareOwnership.persistedZoneOwner(foundInPrivateDatabase: false, zoneOwnerName: CKCurrentUserDefaultName),
            CKCurrentUserDefaultName
        )
    }

    func testEmptySharedListingStillQueriesFamilyZone() {
        let ids = FamilyShareHierarchy.zoneIDs(
            isSharedDatabase: true,
            familyZone: familyZone,
            listedSharedZones: []
        )
        XCTAssertEqual(ids, [familyZone])
    }

    func testSharedListingKeepsFamilyZoneOnce() {
        let extra = CKRecordZone.ID(zoneName: "Other", ownerName: "_owner")
        let ids = FamilyShareHierarchy.zoneIDs(
            isSharedDatabase: true,
            familyZone: familyZone,
            listedSharedZones: [familyZone, extra]
        )
        XCTAssertEqual(ids, [familyZone, extra])
    }

    func testPrivateDatabaseOnlyQueriesFamilyZone() {
        let ids = FamilyShareHierarchy.zoneIDs(
            isSharedDatabase: false,
            familyZone: CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName),
            listedSharedZones: [CKRecordZone.default().zoneID]
        )
        XCTAssertEqual(ids.count, 1)
        XCTAssertEqual(ids.first?.zoneName, "FamilyWalletZone")
        XCTAssertEqual(ids.first?.ownerName, CKCurrentUserDefaultName)
    }

    func testParentIsSetOnChildNotOnRoot() {
        let zone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let walletID = UUID().uuidString
        XCTAssertNil(
            FamilyShareHierarchy.parentReference(
                walletID: walletID,
                childRecordID: CKRecord.ID(recordName: walletID, zoneID: zone)
            )
        )
        let childID = CKRecord.ID(recordName: UUID().uuidString, zoneID: zone)
        let reference = FamilyShareHierarchy.parentReference(walletID: walletID, childRecordID: childID)
        XCTAssertEqual(reference?.recordID.recordName, walletID)
        XCTAssertEqual(reference?.recordID.zoneID, zone)
    }

    func testApplyParentWritesHierarchyAndIsIdempotent() {
        let zone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let walletID = UUID().uuidString
        let record = CKRecord(
            recordType: "SharedReceipt",
            recordID: CKRecord.ID(recordName: UUID().uuidString, zoneID: zone)
        )
        XCTAssertTrue(FamilyShareHierarchy.applyParent(record, walletID: walletID))
        XCTAssertEqual(record.parent?.recordID.recordName, walletID)
        XCTAssertFalse(FamilyShareHierarchy.applyParent(record, walletID: walletID))
    }

    func testFetchOutcomeDoesNotTreatFailedEmptyAsSuccess() {
        XCTAssertFalse(FamilyFetchOutcome.succeeded(zoneFetchOK: false, recordCount: 0))
        XCTAssertTrue(FamilyFetchOutcome.succeeded(zoneFetchOK: true, recordCount: 0))
        XCTAssertTrue(FamilyFetchOutcome.succeeded(zoneFetchOK: false, recordCount: 2))
    }

    func testEmptyQueryIsNotEvidenceOfAReadySharedZone() {
        XCTAssertFalse(
            FamilyFetchOutcome.queryProvidesEvidence(
                querySucceeded: true,
                recordCount: 0
            )
        )
        XCTAssertTrue(
            FamilyFetchOutcome.queryProvidesEvidence(
                querySucceeded: true,
                recordCount: 1
            )
        )
    }

    func testFiltersHierarchyByRecordType() {
        let zone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let ticket = CKRecord(recordType: "SharedTicket", recordID: CKRecord.ID(recordName: "t", zoneID: zone))
        let receipt = CKRecord(recordType: "SharedReceipt", recordID: CKRecord.ID(recordName: "r", zoneID: zone))
        let cards = FamilyShareHierarchy.records(ofType: "SharedReceipt", from: [ticket, receipt])
        XCTAssertEqual(cards.map(\.recordType), ["SharedReceipt"])
    }

    func testParsesProductionSchemaForbiddenField() {
        let message = "Error saving record <CKRecordID: 0x1; recordName=32C5690F-ABCA-4F5C-A7AF-87DF0BCD3674, zoneID=FamilyWalletZone:__defaultOwner__> to server: Cannot create or modify field 'photo' in record 'SharedLoyaltyCard' in production schema"
        XCTAssertEqual(CloudKitProductionSchema.fieldName(in: message), "photo")
        XCTAssertEqual(
            CloudKitProductionSchema.forbiddenField(from: NSError(domain: CKErrorDomain, code: 12, userInfo: [NSLocalizedDescriptionKey: message])),
            "photo"
        )
    }

    func testCopyKeepsParentAfterSystemFieldsClone() {
        let zone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let walletID = UUID().uuidString
        let record = CKRecord(
            recordType: "SharedLoyaltyCard",
            recordID: CKRecord.ID(recordName: UUID().uuidString, zoneID: zone)
        )
        record["programName"] = "Payback" as CKRecordValue
        record["photo"] = "skip" as CKRecordValue
        XCTAssertTrue(FamilyShareHierarchy.applyParent(record, walletID: walletID))
        let stripped = CloudKitProductionSchema.copy(record, excluding: ["photo"])
        XCTAssertEqual(stripped.parent?.recordID.recordName, walletID)
        XCTAssertEqual(stripped.parent?.recordID.zoneID, zone)
        XCTAssertEqual(stripped["programName"] as? String, "Payback")
        XCTAssertNil(stripped["photo"])
    }

    func testFamilySaveSendsAllKeysSoParentSurvives() {
        XCTAssertEqual(CloudKitProductionSchema.familySavePolicy, .allKeys)
    }

    func testSaveRetryStripsForbiddenFieldAndRebuildsZone() {
        let schema = NSError(
            domain: CKErrorDomain,
            code: 12,
            userInfo: [NSLocalizedDescriptionKey: "Cannot create or modify field 'photo' in record 'SharedTicket' in production schema"]
        )
        XCTAssertEqual(CloudKitProductionSchema.saveRetry(for: schema), .stripField("photo"))
        XCTAssertEqual(
            CloudKitProductionSchema.saveRetry(for: CKError(.serverRecordChanged)),
            .mergeServer
        )
        XCTAssertEqual(
            CloudKitProductionSchema.saveRetry(for: CKError(.zoneNotFound)),
            .recreateZone
        )
        XCTAssertNil(CloudKitProductionSchema.saveRetry(for: CKError(.notAuthenticated)))
    }

    func testCopyDropsForbiddenFields() {
        let zone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let record = CKRecord(recordType: "SharedLoyaltyCard", recordID: CKRecord.ID(recordName: UUID().uuidString, zoneID: zone))
        record["programName"] = "Payback" as CKRecordValue
        record["barcodePayload"] = "123" as CKRecordValue
        record["photo"] = "skip" as CKRecordValue
        let stripped = CloudKitProductionSchema.copy(record, excluding: ["photo"])
        XCTAssertEqual(stripped["programName"] as? String, "Payback")
        XCTAssertEqual(stripped["barcodePayload"] as? String, "123")
        XCTAssertNil(stripped["photo"])
    }

    func testKnownProductionSchemaOmitsPhoto() {
        XCTAssertFalse(FamilySchemaGaps.allows("photo", in: "SharedLoyaltyCard"))
        XCTAssertFalse(FamilySchemaGaps.allows("photo", in: "SharedTicket"))
        XCTAssertFalse(FamilySchemaGaps.allows("photo", in: "SharedReceipt"))
        XCTAssertTrue(FamilySchemaGaps.allows("barcodePayload", in: "SharedLoyaltyCard"))
        XCTAssertTrue(FamilySchemaGaps.allows("programName", in: "SharedLoyaltyCard"))
        XCTAssertFalse(FamilySchemaGaps.allows(FamilyPhotoCodec.receiptBytesField, in: "SharedReceipt"))
    }

    func testReceiptPhotoRidesAlongExistingItemName() {
        let jpeg = Data([0xFF, 0xD8, 0xFF, 0x00, 0x01, 0x02])
        let packed = FamilyPhotoCodec.packItemName("Mleko, chleb", photo: jpeg)
        XCTAssertTrue(packed.hasPrefix("Mleko, chleb"))
        let unpacked = FamilyPhotoCodec.unpack(packed)
        XCTAssertEqual(unpacked.items, "Mleko, chleb")
        XCTAssertEqual(unpacked.photo, jpeg)
        XCTAssertEqual(FamilyPhotoCodec.packItemName(packed, photo: nil), "Mleko, chleb")
        let zone = CKRecordZone.ID(zoneName: "FamilyWalletZone", ownerName: CKCurrentUserDefaultName)
        let record = CKRecord(recordType: "SharedReceipt", recordID: CKRecord.ID(recordName: "r", zoneID: zone))
        record["itemName"] = packed as CKRecordValue
        XCTAssertFalse(FamilyPhotoCodec.shrinkPackedPhoto(record))
        XCTAssertEqual(FamilyPhotoCodec.unpack(record["itemName"] as? String).photo, jpeg)
        var leaked = packed
        var recovered: Data?
        XCTAssertTrue(FamilyPhotoCodec.settleLocal(itemName: &leaked, photoData: &recovered))
        XCTAssertEqual(leaked, "Mleko, chleb")
        XCTAssertEqual(recovered, jpeg)
    }

    func testFamilyShareDefaultsToNewItemsOnly() {
        XCTAssertFalse(AppSettings.sharesExistingByDefault)
        XCTAssertEqual(
            FamilyShareAllPrompt.message(
                deposits: 2,
                receipts: 1,
                cards: 5,
                depositsOn: true,
                receiptsOn: true,
                cardsOn: true
            ),
            "Bliscy zobaczą też to, co już masz: 2 kaucje, 1 paragon, 5 kart. Zdjęcie paragonu idzie raz, we wspólnym portfelu — bez osobnej kopii u każdego."
        )
        XCTAssertEqual(
            FamilyShareAllPrompt.message(
                deposits: 0,
                receipts: 0,
                cards: 0,
                depositsOn: false,
                receiptsOn: false,
                cardsOn: false
            ),
            "Najpierw włącz kategorię wyżej. Sam zakres nic nie wyśle."
        )
        XCTAssertEqual(
            FamilyShareAllPrompt.message(
                deposits: 2,
                receipts: 4,
                cards: 5,
                depositsOn: true,
                receiptsOn: false,
                cardsOn: true
            ),
            "Bliscy zobaczą też to, co już masz: 2 kaucje, 5 kart."
        )
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(1, one: "kartę", few: "karty", many: "kart"), "kartę")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(2, one: "kartę", few: "karty", many: "kart"), "karty")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(5, one: "kartę", few: "karty", many: "kart"), "kart")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(12, one: "kartę", few: "karty", many: "kart"), "kart")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(15, one: "kartę", few: "karty", many: "kart"), "kart")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(21, one: "kartę", few: "karty", many: "kart"), "kart")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(22, one: "kartę", few: "karty", many: "kart"), "karty")
        XCTAssertEqual(FamilyShareAllPrompt.polishPlural(25, one: "kartę", few: "karty", many: "kart"), "kart")
    }

    func testRetryRepushesTaggedWhenOnlyNew() {
        XCTAssertTrue(
            FamilyUploadRetry.shouldRepush(categoryEnabled: true, shareExisting: false, isTagged: true)
        )
        XCTAssertFalse(
            FamilyUploadRetry.shouldRepush(categoryEnabled: true, shareExisting: false, isTagged: false)
        )
        XCTAssertTrue(
            FamilyUploadRetry.shouldRepush(categoryEnabled: true, shareExisting: true, isTagged: false)
        )
        XCTAssertFalse(
            FamilyUploadRetry.shouldRepush(categoryEnabled: false, shareExisting: true, isTagged: true)
        )
    }

    func testSchemaSaveErrorIsSilentNowThatPhotosRideItemName() {
        let schema = NSError(
            domain: CKErrorDomain,
            code: 12,
            userInfo: [NSLocalizedDescriptionKey: "Cannot create or modify field 'photo' in record 'SharedLoyaltyCard' in production schema"]
        )
        XCTAssertNil(FamilyCloudCopy.userFacingSaveMessage(for: schema))
        XCTAssertTrue(FamilyCloudCopy.isHandledSchemaGap(schema))
        XCTAssertTrue(
            FamilyCloudCopy.isObsoleteStatus(
                "Część danych (np. zdjęcie) zostaje na tym iPhonie. Reszta idzie do rodziny."
            )
        )
        XCTAssertEqual(
            CloudKitProductionSchema.fieldName(
                in: #"Cannot create or modify field "jpeg" in record 'SharedReceipt' in production schema"#
            ),
            "jpeg"
        )
        XCTAssertEqual(
            CloudKitProductionSchema.saveRetry(
                for: NSError(domain: CKErrorDomain, code: 27, userInfo: [
                    NSLocalizedDescriptionKey: "Limit exceeded: record too large"
                ])
            ),
            .shrinkPhoto
        )
    }
}

final class CloudSyncStatusCopyTests: XCTestCase {
    override func tearDown() {
        AppLocale.override = nil
        super.tearDown()
    }

    func testQuietSuccessIsUpToDateNotCatchingUp() {
        AppLocale.apply(.pl)
        let title = CloudSyncStatusCopy.title(
            usesCloudKit: true,
            hasContainerError: false,
            inProgress: false,
            phase: .idle,
            hasSuccess: true
        )
        XCTAssertEqual(title, "Aktualne")
        XCTAssertFalse(title.localizedCaseInsensitiveContains("dogry"))
        XCTAssertFalse(title.localizedCaseInsensitiveContains("up to date"))
    }

    func testSuccessTitleFollowsEnglishAppLocale() {
        AppLocale.apply(.en)
        let title = CloudSyncStatusCopy.title(
            usesCloudKit: true,
            hasContainerError: false,
            inProgress: false,
            phase: .idle,
            hasSuccess: true
        )
        XCTAssertEqual(title, "Up to date")
    }

    func testHardFailureIsTheOnlyRedState() {
        AppLocale.apply(.pl)
        let title = CloudSyncStatusCopy.title(
            usesCloudKit: true,
            hasContainerError: false,
            inProgress: false,
            phase: .failed,
            hasSuccess: true
        )
        XCTAssertEqual(title, "Nie udało się")
    }
}

final class FamilySyncLiveActivityPolicyTests: XCTestCase {
    func testSystemIslandRequiresPhoneLiveActivitiesAndHardware() {
        XCTAssertTrue(
            FamilySyncLiveActivityPolicy.prefersSystemIsland(
                isPhone: true,
                activitiesEnabled: true,
                hasDynamicIsland: true
            )
        )
        XCTAssertFalse(
            FamilySyncLiveActivityPolicy.prefersSystemIsland(
                isPhone: true,
                activitiesEnabled: true,
                hasDynamicIsland: false
            )
        )
        XCTAssertFalse(
            FamilySyncLiveActivityPolicy.prefersSystemIsland(
                isPhone: true,
                activitiesEnabled: false,
                hasDynamicIsland: true
            )
        )
        XCTAssertFalse(
            FamilySyncLiveActivityPolicy.prefersSystemIsland(
                isPhone: false,
                activitiesEnabled: true,
                hasDynamicIsland: true
            )
        )
    }

    func testRunningContentStateKeepsMeasuredProgress() {
        let state = FamilySyncActivityAttributes.ContentState.running(
            "Pobieranie",
            progress: 0.625
        )
        XCTAssertEqual(state.progress, 0.625)
        XCTAssertTrue(state.isRunning)
    }

    func testRingClampsToValidRange() {
        XCTAssertEqual(FamilyRingProgress.clamped(-0.5), 0)
        XCTAssertEqual(FamilyRingProgress.clamped(1.5), 1)
    }

    func testRunningContentStateNeverReportsFullProgress() {
        let state = FamilySyncActivityAttributes.ContentState.running("Wysyłanie", progress: 1.4)
        XCTAssertEqual(state.progress, 1)
        XCTAssertTrue(state.isRunning)
    }

    func testSuccessAndFailureStatesFillTheRingCompletely() {
        XCTAssertEqual(FamilySyncActivityAttributes.ContentState.success().progress, 1)
        XCTAssertEqual(FamilySyncActivityAttributes.ContentState.failure().progress, 1)
    }
}

final class CloudSyncIslandCopyTests: XCTestCase {
    func testIslandWordsStayShort() {
        XCTAssertEqual(CloudSyncIslandCopy.title(state: .running, phase: .exporting), "Wysyłanie")
        XCTAssertEqual(CloudSyncIslandCopy.title(state: .success, phase: .idle), "Aktualne")
        XCTAssertEqual(CloudSyncIslandCopy.title(state: .failure, phase: .failed), "Spróbuj")
        XCTAssertEqual(CloudSyncIslandCopy.symbol(.success), "checkmark")
        XCTAssertEqual(CloudSyncIslandCopy.symbol(.failure), "exclamationmark")
        XCTAssertEqual(CloudSyncIslandCopy.accessibility(state: .running, phase: .exporting), "iCloud, Wysyłanie")
    }
}

final class FamilyCloudCopyTests: XCTestCase {
    func testICloudOffStatusStaysOnScreen() {
        XCTAssertFalse(FamilyCloudCopy.shouldAutoClear("Włącz iCloud, aby synchronizować i udostępniać."))
        XCTAssertTrue(FamilyCloudCopy.shouldAutoClear("Dołączono do portfela rodzinnego."))
    }
}

final class FamilyMergePolicyTests: XCTestCase {
    func testUniquedKeepsFirstCardWithAGivenID() {
        let first = UUID(uuidString: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA")!
        let second = UUID(uuidString: "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB")!
        let rows = [
            (id: first, updatedAt: Date(timeIntervalSince1970: 1)),
            (id: first, updatedAt: Date(timeIntervalSince1970: 3)),
            (id: second, updatedAt: Date(timeIntervalSince1970: 2))
        ]
        XCTAssertEqual(FamilyMergePolicy.uniqued(rows, id: \.id).map(\.id), [first, second])
    }

    func testExtrasToDeleteKeepTheNewestDuplicate() {
        let id = UUID(uuidString: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA")!
        let older = (id: id, updatedAt: Date(timeIntervalSince1970: 1))
        let newer = (id: id, updatedAt: Date(timeIntervalSince1970: 4))
        let extras = FamilyMergePolicy.extrasToDelete(
            [older, newer],
            id: \.id,
            updatedAt: \.updatedAt
        )
        XCTAssertEqual(extras.count, 1)
        XCTAssertEqual(extras.first?.updatedAt, older.updatedAt)
    }

    func testEmptySuccessfulFetchDoesNotAuthorizeDeletes() {
        XCTAssertFalse(
            FamilyMergePolicy.shouldDeleteLocalsMissingFromRemote(fetchSucceeded: true, remoteCount: 0)
        )
        XCTAssertFalse(
            FamilyMergePolicy.shouldDeleteLocalsMissingFromRemote(fetchSucceeded: false, remoteCount: 4)
        )
        XCTAssertTrue(
            FamilyMergePolicy.shouldDeleteLocalsMissingFromRemote(fetchSucceeded: true, remoteCount: 2)
        )
    }

    func testInvalidRecordNameIsSkippedInsteadOfMintingUUID() {
        XCTAssertNil(FamilyMergePolicy.localID(fromRecordName: "not-a-uuid"))
        XCTAssertNil(FamilyMergePolicy.localID(fromRecordName: ""))
        let id = UUID()
        XCTAssertEqual(FamilyMergePolicy.localID(fromRecordName: id.uuidString), id)
    }

    func testKeyedByIDKeepsLastDuplicate() {
        struct Item {
            var id: UUID
            var name: String
        }
        let shared = UUID()
        let items = [
            Item(id: shared, name: "first"),
            Item(id: shared, name: "last"),
            Item(id: UUID(), name: "other")
        ]
        let keyed = FamilyMergePolicy.keyedByID(items, id: \.id)
        XCTAssertEqual(keyed[shared.uuidString]?.name, "last")
        XCTAssertEqual(keyed.count, 2)
    }
}

final class FamilyIdentityTests: XCTestCase {
    func testJoinsGivenAndFamilyName() {
        XCTAssertEqual(FamilyIdentity.joinedName(given: "Marian", family: "Kowalski"), "Marian Kowalski")
        XCTAssertEqual(FamilyIdentity.joinedName(given: "Marian", family: "  "), "Marian")
        XCTAssertEqual(FamilyIdentity.joinedName(given: nil, family: nil), "")
    }

    func testInitialsUseTwoLetters() {
        XCTAssertEqual(FamilyIdentity.initials("Marian Kowalski"), "MK")
        XCTAssertEqual(FamilyIdentity.initials("Anna"), "A")
        XCTAssertEqual(FamilyIdentity.initials("  "), "•")
    }

    func testContactColorIsStableForTheSameName() {
        let a = ParagonContactColor.color(for: "Marian")
        let b = ParagonContactColor.color(for: "Marian")
        XCTAssertEqual(a.hexRGB.r, b.hexRGB.r, accuracy: 0.001)
        XCTAssertEqual(a.hexRGB.g, b.hexRGB.g, accuracy: 0.001)
        XCTAssertNotEqual(
            ParagonContactColor.color(for: "Anna").hexRGB.r,
            ParagonContactColor.color(for: "Zofia").hexRGB.r,
            accuracy: 0.001
        )
    }

    func testUpgradesFirstNameOnlyToICloudFullName() {
        XCTAssertTrue(FamilyIdentity.shouldUpgradeStoredName("", suggested: "Marian Kowalski"))
        XCTAssertTrue(FamilyIdentity.shouldUpgradeStoredName("Marian", suggested: "Marian Kowalski"))
        XCTAssertFalse(FamilyIdentity.shouldUpgradeStoredName("Ania", suggested: "Marian Kowalski"))
        XCTAssertFalse(FamilyIdentity.shouldUpgradeStoredName("Marian Kowalski", suggested: "Marian"))
    }
}

final class HistorySpendTests: XCTestCase {
    func testGroupsReceiptsByMonthOfSelectedYear() {
        let calendar = Calendar(identifier: .gregorian)
        let year = 2026
        let march = calendar.date(from: DateComponents(year: year, month: 3, day: 4))!
        let april = calendar.date(from: DateComponents(year: year, month: 4, day: 9))!
        let receipts = [
            Receipt(
                merchantName: "Lidl",
                merchantNIP: "",
                amount: 10,
                taxAmount: 0,
                issuedAt: march,
                category: .spozywcze,
                documentType: .receipt,
                documentNumber: "",
                paymentMethod: ReceiptPaymentMethod.cash.rawValue,
                photoData: nil,
                ocrText: "",
                scannedByName: "",
                ocrConfidence: 1,
                warrantyUntil: nil,
                returnUntil: nil
            ),
            Receipt(
                merchantName: "x-kom",
                merchantNIP: "",
                amount: 20,
                taxAmount: 0,
                issuedAt: april,
                category: .elektronika,
                documentType: .invoice,
                documentNumber: "",
                paymentMethod: ReceiptPaymentMethod.card.rawValue,
                photoData: nil,
                ocrText: "",
                scannedByName: "",
                ocrConfidence: 1,
                warrantyUntil: nil,
                returnUntil: nil
            )
        ]
        let points = HistorySpend.receiptPoints(receipts, grain: .month, year: year, month: 3, calendar: calendar)
        XCTAssertEqual(points.count, 12)
        XCTAssertEqual(points[2].total, 10, accuracy: 0.01)
        XCTAssertEqual(points[3].total, 20, accuracy: 0.01)
        XCTAssertEqual(points[0].total, 0, accuracy: 0.01)
    }
}
