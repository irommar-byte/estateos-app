import CloudKit
import Foundation
import SwiftData
import SwiftUI
import UIKit

@MainActor
final class WalletModel: ObservableObject {
    @Published var showOnboarding: Bool
    @Published var showScanner = false
    @Published var scanDraft: VoucherDraft?
    @Published var scanPhoto: UIImage?
    @Published var isAnalyzing = false
    @Published var scanError: String?
    @Published var pendingTicketID: UUID?
    @Published var showCheckoutFor: UUID?
    @Published var pendingRedeem: Ticket?
    @Published var walletPath = NavigationPath()
    @Published var receiptPath = NavigationPath()
    @Published var scanIntent: ScanIntent = .deposit
    @Published var askScanIntent = false
    @Published var receiptDraft: ReceiptDraft?
    @Published var pendingReceiptID: UUID?

    let family = CloudKitFamilyService.shared
    private var profileContext: ModelContext?
    @Published var settings = AppSettings.load() {
        didSet { settings.save() }
    }

    init() {
        showOnboarding = AppSettings.load().hasCompletedOnboarding == false
        ExpiryNotificationService.shared.configure()
    }

    func bootstrap(context: ModelContext, tickets: [Ticket], receipts: [Receipt]) async {
        profileContext = context
        await refreshDisplayName(context: context)
        await family.refreshAccountStatus()
        await ExpiryNotificationService.shared.requestAuthorization()
        await ExpiryNotificationService.shared.reschedule(
            tickets: tickets,
            receipts: receipts,
            settings: settings.notificationSettings
        )
        await mergeFamilyTickets(context: context, existing: tickets)
        await mergeFamilyReceipts(context: context, existing: receipts)
        repairMissingBarcodes(tickets: tickets, context: context)
        await repairImpossibleDates(tickets: tickets, context: context)
        observeNotifications()
        if let intent = WalletScanBridge.pendingIntent {
            WalletScanBridge.pendingIntent = nil
            OpenScanBridge.pending = false
            openScanner(for: intent)
        } else if OpenScanBridge.pending {
            OpenScanBridge.pending = false
            askScanIntent = true
        }
    }

    func openScanner(for intent: ScanIntent) {
        scanIntent = intent
        scanDraft = nil
        receiptDraft = nil
        scanError = nil
        showScanner = true
    }

    func refreshNotifications(tickets: [Ticket], receipts: [Receipt]) async {
        await ExpiryNotificationService.shared.reschedule(
            tickets: tickets,
            receipts: receipts,
            settings: settings.notificationSettings
        )
    }

    func completeOnboarding() {
        settings.hasCompletedOnboarding = true
        showOnboarding = false
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    }

    func analyze(image: UIImage) async {
        isAnalyzing = true
        scanError = nil
        defer { isAnalyzing = false }
        do {
            if scanIntent == .receipt {
                let recognized = try await ScanService.recognize(image: image)
                scanPhoto = image
                receiptDraft = ReceiptParser.parse(lines: recognized.lines, barcodes: recognized.barcodes)
                scanDraft = nil
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                return
            }
            let result = try await ScanService.analyze(image: image)
            if offerRedeemIfDuplicate(result.draft) { return }
            scanPhoto = image
            scanDraft = Self.draftWithBarcode(result.draft)
            receiptDraft = nil
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {
            scanError = scanIntent == .receipt
                ? "Nie udało się odczytać paragonu. Wpisz dane ręcznie."
                : "Nie udało się odczytać kwitka. Wpisz dane ręcznie."
            scanPhoto = image
            if scanIntent == .receipt {
                receiptDraft = .blank()
            } else {
                scanDraft = .blank()
            }
        }
    }

    func applyLiveScan(draft: VoucherDraft, photo: UIImage?) {
        if scanIntent == .receipt {
            if let photo {
                Task { await analyze(image: photo) }
                return
            }
            let lines = draft.ocrText.isEmpty ? [] : draft.ocrText.components(separatedBy: "\n")
            var parsed = ReceiptParser.parse(lines: lines, barcodes: [
                DetectedBarcode(payload: draft.barcodePayload, symbology: draft.barcodeSymbology)
            ])
            if parsed.amount == 0, draft.amount > 0 {
                parsed.amount = draft.amount
            }
            if parsed.merchantName.isEmpty, draft.retailerID != "unknown" {
                parsed.merchantName = RetailerCatalog.policy(id: draft.retailerID).name
                parsed.category = ReceiptParser.inferCategory(merchant: parsed.merchantName, text: draft.ocrText)
            }
            scanPhoto = photo
            receiptDraft = parsed
            scanDraft = nil
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            return
        }
        if offerRedeemIfDuplicate(draft) { return }
        scanPhoto = photo
        scanDraft = Self.draftWithBarcode(draft)
        receiptDraft = nil
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func applyLiveBarcode(_ barcode: DetectedBarcode, extraText: [String] = []) {
        applyLiveScan(draft: VoucherParser.parse(lines: extraText, barcodes: [barcode]), photo: nil)
    }

    func shouldShare(_ target: FamilyShareTarget) -> Bool {
        FamilySharePolicy.shouldShare(
            target,
            depositsEnabled: settings.shareNewTicketsWithFamily,
            receiptsEnabled: settings.shareNewReceiptsWithFamily,
            familyWalletID: family.familyWalletID
        )
    }

    func save(draft: VoucherDraft, photo: UIImage?, context: ModelContext, shareWithFamily _: Bool) throws -> Ticket {
        guard draft.amount > 0 else {
            throw ScanSaveError.missingAmount
        }
        let prepared = Self.draftWithBarcode(draft)
        let photoData = photo.flatMap { ScanService.compressPhoto($0) }
        let ticket = Ticket(
            retailerID: prepared.retailerID,
            amount: prepared.amount,
            issuedAt: prepared.issuedAt,
            expiresAt: prepared.expiresAt,
            barcodePayload: prepared.barcodePayload,
            barcodeSymbology: prepared.barcodeSymbology,
            ticketNumber: prepared.ticketNumber,
            photoData: photoData,
            scannedByName: settings.displayName,
            ocrConfidence: prepared.ocrConfidence
        )
        if shouldShare(.deposit) {
            ticket.familyWalletID = family.familyWalletID
        }
        context.insert(ticket)
        try context.save()
        scanDraft = nil
        scanPhoto = nil
        showScanner = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if shouldShare(.deposit) {
            Task { await family.upsertShared(ticket: ticket) }
        }
        return ticket
    }

    func saveReceipt(draft: ReceiptDraft, photo: UIImage?, context: ModelContext, shareWithFamily _: Bool) throws -> Receipt {
        guard draft.amount > 0 else {
            throw ScanSaveError.missingAmount
        }
        let merchant = draft.merchantName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard merchant.isEmpty == false else {
            throw ScanSaveError.missingMerchant
        }
        let photoData = photo.flatMap { ScanService.compressPhoto($0) }
        let dates = ReceiptParser.applyCategoryDates(category: draft.category, issuedAt: draft.issuedAt)
        let receipt = Receipt(
            merchantName: merchant,
            merchantNIP: draft.merchantNIP,
            amount: draft.amount,
            taxAmount: draft.taxAmount,
            issuedAt: draft.issuedAt,
            category: draft.category,
            documentType: draft.documentType,
            documentNumber: draft.documentNumber,
            paymentMethod: draft.payment.rawValue,
            itemName: draft.itemName,
            photoData: photoData,
            ocrText: draft.ocrText,
            scannedByName: settings.displayName,
            ocrConfidence: draft.ocrConfidence,
            warrantyUntil: draft.warrantyUntil ?? dates.warranty,
            returnUntil: draft.returnUntil ?? dates.returning
        )
        if shouldShare(.receipt) {
            receipt.familyShareID = family.familyWalletID
        }
        context.insert(receipt)
        try context.save()
        receiptDraft = nil
        scanPhoto = nil
        showScanner = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if shouldShare(.receipt) {
            Task { await family.upsertShared(receipt: receipt) }
        }
        pendingReceiptID = receipt.id
        return receipt
    }

    func persistReceipt(_ receipt: Receipt, context: ModelContext) throws {
        receipt.updatedAt = Date()
        try context.save()
        if receipt.familyShareID != nil {
            Task { await family.upsertShared(receipt: receipt) }
        }
    }

    func shareReceiptWithFamily(_ receipt: Receipt, context: ModelContext) async {
        receipt.familyShareID = family.familyWalletID
        receipt.updatedAt = Date()
        try? context.save()
        await family.upsertShared(receipt: receipt)
    }

    func markRedeemed(_ ticket: Ticket, context: ModelContext) throws {
        let result = TicketStatusEngine.markRedeemed()
        ticket.storedStatus = result.status
        ticket.redeemedAt = result.at
        ticket.redeemedByName = settings.displayName
        ticket.updatedAt = Date()
        try context.save()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if ticket.familyWalletID != nil {
            Task { await family.upsertShared(ticket: ticket) }
        }
    }

    func restoreToWallet(_ ticket: Ticket, context: ModelContext) throws {
        ticket.storedStatus = .active
        ticket.redeemedAt = nil
        ticket.redeemedByName = ""
        ticket.updatedAt = Date()
        try context.save()
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        if ticket.familyWalletID != nil {
            Task { await family.upsertShared(ticket: ticket) }
        }
    }

    private func offerRedeemIfDuplicate(_ draft: VoucherDraft) -> Bool {
        guard let existing = matchingActiveTicket(for: draft) else { return false }
        pendingRedeem = existing
        scanDraft = nil
        scanPhoto = nil
        showScanner = false
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        return true
    }

    private func matchingActiveTicket(for draft: VoucherDraft) -> Ticket? {
        guard let context = profileContext else { return nil }
        let keys = Set(
            [draft.barcodePayload, draft.ticketNumber, CheckoutCode.payload(barcode: draft.barcodePayload, ticketNumber: draft.ticketNumber)]
                .map { $0.filter(\.isNumber) }
                .filter { $0.count >= 16 }
        )
        guard keys.isEmpty == false else { return nil }
        let all = (try? context.fetch(FetchDescriptor<Ticket>())) ?? []
        return all.first { ticket in
            ticket.resolvedStatus() == .active
                && keys.contains(ticket.displayBarcode.filter(\.isNumber))
        }
    }

    private func repairMissingBarcodes(tickets: [Ticket], context: ModelContext) {
        var changed = false
        for ticket in tickets {
            let resolved = CheckoutCode.payload(barcode: ticket.barcodePayload, ticketNumber: ticket.ticketNumber)
            if ticket.barcodePayload.isEmpty, resolved.isEmpty == false {
                ticket.barcodePayload = resolved
                if ticket.barcodeSymbology == .unknown {
                    ticket.barcodeSymbology = .code128
                }
                ticket.updatedAt = Date()
                changed = true
            }
        }
        if changed {
            try? context.save()
        }
    }

    private func repairImpossibleDates(tickets: [Ticket], context: ModelContext) async {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Warsaw") ?? .current
        var changed = false
        for ticket in tickets {
            guard ticket.storedStatus != .redeemed else { continue }
            guard Self.hasImplausibleDates(ticket, calendar: calendar) else { continue }
            if let data = ticket.photoData, let image = UIImage(data: data),
               let result = try? await ScanService.analyze(image: image),
               result.draft.issuedWasPrinted {
                ticket.issuedAt = result.draft.issuedAt
                ticket.expiresAt = result.draft.expiresAt
                if ticket.retailerID == "unknown", result.draft.retailerID != "unknown" {
                    ticket.retailerID = result.draft.retailerID
                }
                ticket.updatedAt = Date()
                changed = true
                continue
            }
            let issued = calendar.startOfDay(for: ticket.createdAt)
            ticket.issuedAt = issued
            ticket.expiresAt = RetailerCatalog.defaultExpiry(
                for: RetailerCatalog.policy(id: ticket.retailerID),
                issuedAt: issued,
                calendar: calendar
            )
            ticket.updatedAt = Date()
            changed = true
        }
        if changed {
            try? context.save()
        }
    }

    static func hasImplausibleDates(_ ticket: Ticket, now: Date = .now, calendar: Calendar) -> Bool {
        let issuedYear = calendar.component(.year, from: ticket.issuedAt)
        if issuedYear < 2020 || issuedYear > 2035 { return true }
        if ticket.issuedAt > now.addingTimeInterval(86_400 * 60) { return true }
        if let expires = ticket.expiresAt {
            let days = calendar.dateComponents(
                [.day],
                from: calendar.startOfDay(for: ticket.issuedAt),
                to: calendar.startOfDay(for: expires)
            ).day ?? 0
            if days > 400 { return true }
            if expires > now.addingTimeInterval(86_400 * 800) { return true }
        }
        return false
    }

    private static func draftWithBarcode(_ draft: VoucherDraft) -> VoucherDraft {
        var next = draft
        let resolved = CheckoutCode.payload(barcode: draft.barcodePayload, ticketNumber: draft.ticketNumber)
        let fromOCR = draft.ocrText.isEmpty ? nil : VoucherParser.parseDigitBarcode(in: draft.ocrText)
        if next.barcodePayload.isEmpty {
            next.barcodePayload = resolved.isEmpty ? (fromOCR ?? "") : resolved
        }
        if next.barcodePayload.isEmpty == false, next.barcodeSymbology == .unknown {
            next.barcodeSymbology = .code128
        }
        if next.ticketNumber.isEmpty {
            next.ticketNumber = next.barcodePayload
        }
        return next
    }

    func delete(_ ticket: Ticket, context: ModelContext) throws {
        context.delete(ticket)
        try context.save()
    }

    func deleteReceipt(_ receipt: Receipt, context: ModelContext) throws {
        context.delete(receipt)
        try context.save()
    }

    private func mergeFamilyTickets(context: ModelContext, existing: [Ticket]) async {
        let records = await family.fetchSharedTickets()
        guard records.isEmpty == false else { return }
        let byID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id.uuidString, $0) })
        for record in records {
            let name = record.recordID.recordName
            let amount = record["amount"] as? Double ?? 0
            let retailerID = record["retailerID"] as? String ?? "unknown"
            let issuedAt = record["issuedAt"] as? Date ?? Date()
            let expiresAt = record["expiresAt"] as? Date
            let status = record["status"] as? String ?? TicketLifecycleStatus.active.rawValue
            let payload = record["barcodePayload"] as? String ?? ""
            let symbology = record["barcodeSymbology"] as? String ?? BarcodeSymbology.unknown.rawValue
            let number = record["ticketNumber"] as? String ?? ""
            let scannedBy = record["scannedByName"] as? String ?? ""
            let redeemedBy = record["redeemedByName"] as? String ?? ""
            var photo: Data?
            if let asset = record["photo"] as? CKAsset, let url = asset.fileURL {
                photo = try? Data(contentsOf: url)
            }
            if let ticket = byID[name] {
                ticket.amount = amount
                ticket.statusRaw = status
                ticket.redeemedByName = redeemedBy
                ticket.expiresAt = expiresAt
                ticket.updatedAt = Date()
            } else {
                let ticket = Ticket(
                    id: UUID(uuidString: name) ?? UUID(),
                    retailerID: retailerID,
                    amount: amount,
                    issuedAt: issuedAt,
                    expiresAt: expiresAt,
                    barcodePayload: payload,
                    barcodeSymbology: BarcodeSymbology(rawValue: symbology) ?? .unknown,
                    ticketNumber: number,
                    photoData: photo,
                    scannedByName: scannedBy,
                    ocrConfidence: 1
                )
                ticket.statusRaw = status
                ticket.redeemedByName = redeemedBy
                ticket.familyWalletID = family.familyWalletID
                context.insert(ticket)
            }
        }
        try? context.save()
    }

    private func mergeFamilyReceipts(context: ModelContext, existing: [Receipt]) async {
        let records = await family.fetchSharedReceipts()
        guard records.isEmpty == false else { return }
        let byID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id.uuidString, $0) })
        for record in records {
            let name = record.recordID.recordName
            let merchant = record["merchantName"] as? String ?? ""
            let nip = record["merchantNIP"] as? String ?? ""
            let amount = record["amount"] as? Double ?? 0
            let tax = record["taxAmount"] as? Double ?? 0
            let issuedAt = record["issuedAt"] as? Date ?? Date()
            let category = ReceiptCategory(rawValue: record["category"] as? String ?? "") ?? .inne
            let documentType = ReceiptDocumentType(rawValue: record["documentType"] as? String ?? "") ?? .receipt
            let number = record["documentNumber"] as? String ?? ""
            let payment = record["paymentMethod"] as? String ?? ""
            let itemName = record["itemName"] as? String ?? ""
            let scannedBy = record["scannedByName"] as? String ?? ""
            let warrantyUntil = record["warrantyUntil"] as? Date
            let returnUntil = record["returnUntil"] as? Date
            var photo: Data?
            if let asset = record["photo"] as? CKAsset, let url = asset.fileURL {
                photo = try? Data(contentsOf: url)
            }
            if let receipt = byID[name] {
                receipt.amount = amount
                receipt.merchantName = merchant
                receipt.category = category
                receipt.itemName = itemName
                receipt.warrantyUntil = warrantyUntil
                receipt.returnUntil = returnUntil
                receipt.updatedAt = Date()
            } else {
                let receipt = Receipt(
                    id: UUID(uuidString: name) ?? UUID(),
                    merchantName: merchant,
                    merchantNIP: nip,
                    amount: amount,
                    taxAmount: tax,
                    issuedAt: issuedAt,
                    category: category,
                    documentType: documentType,
                    documentNumber: number,
                    paymentMethod: payment,
                    itemName: itemName,
                    photoData: photo,
                    ocrText: "",
                    scannedByName: scannedBy,
                    ocrConfidence: 1,
                    warrantyUntil: warrantyUntil,
                    returnUntil: returnUntil
                )
                receipt.familyShareID = family.familyWalletID
                context.insert(receipt)
            }
        }
        try? context.save()
    }

    private var observers: [NSObjectProtocol] = []

    private func observeNotifications() {
        guard observers.isEmpty else { return }
        observers.append(NotificationCenter.default.addObserver(forName: .paragonOpenTicket, object: nil, queue: .main) { [weak self] note in
            if let raw = note.object as? String, let id = UUID(uuidString: raw) {
                Task { @MainActor in self?.pendingTicketID = id }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonMarkRedeemed, object: nil, queue: .main) { [weak self] note in
            if let raw = note.object as? String, let id = UUID(uuidString: raw) {
                Task { @MainActor in self?.pendingTicketID = id }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonOpenReceipt, object: nil, queue: .main) { [weak self] note in
            if let raw = note.object as? String, let id = UUID(uuidString: raw) {
                Task { @MainActor in self?.pendingReceiptID = id }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonOpenScanner, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if let intent = WalletScanBridge.pendingIntent {
                    WalletScanBridge.pendingIntent = nil
                    self.openScanner(for: intent)
                } else {
                    self.askScanIntent = true
                }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: NSUbiquitousKeyValueStore.default, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if let context = self.profileContext {
                    await self.refreshDisplayName(context: context)
                }
            }
        })
        NSUbiquitousKeyValueStore.default.synchronize()
    }

    private var persistNameTask: Task<Void, Never>?

    func schedulePersistDisplayName(_ name: String) {
        persistNameTask?.cancel()
        persistNameTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 500_000_000)
            guard Task.isCancelled == false else { return }
            persistDisplayName(name)
        }
    }

    func persistDisplayName(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var next = settings
        next.displayName = trimmed
        settings = next
        NSUbiquitousKeyValueStore.default.set(trimmed, forKey: AppSettings.kvsDisplayName)
        NSUbiquitousKeyValueStore.default.synchronize()
        if let context = profileContext {
            let profile = Self.profile(in: context)
            profile.displayName = trimmed
            profile.updatedAt = Date()
            try? context.save()
        }
        Task { await family.publishDisplayName(trimmed) }
    }

    func refreshDisplayName(context: ModelContext) async {
        profileContext = context
        NSUbiquitousKeyValueStore.default.synchronize()
        let kvsName = NSUbiquitousKeyValueStore.default.string(forKey: AppSettings.kvsDisplayName)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let profile = Self.profile(in: context)
        var resolved = settings.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if kvsName.isEmpty == false {
            resolved = kvsName
        } else if profile.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
            resolved = profile.displayName
        } else if resolved.isEmpty {
            resolved = await family.suggestedGivenName()
        }
        if resolved != settings.displayName {
            var next = settings
            next.displayName = resolved
            settings = next
        }
        if profile.displayName != resolved {
            profile.displayName = resolved
            profile.updatedAt = Date()
            try? context.save()
        }
        if resolved.isEmpty == false {
            NSUbiquitousKeyValueStore.default.set(resolved, forKey: AppSettings.kvsDisplayName)
            await family.publishDisplayName(resolved)
        }
    }

    private static func profile(in context: ModelContext) -> AppProfile {
        let found = (try? context.fetch(FetchDescriptor<AppProfile>())) ?? []
        if let newest = found.max(by: { $0.updatedAt < $1.updatedAt }) {
            for extra in found where extra.persistentModelID != newest.persistentModelID {
                context.delete(extra)
            }
            return newest
        }
        let created = AppProfile(displayName: "")
        context.insert(created)
        return created
    }
}

enum FamilyShareTarget: Equatable {
    case deposit
    case receipt
}

enum FamilySharePolicy {
    static func shouldShare(
        _ target: FamilyShareTarget,
        depositsEnabled: Bool,
        receiptsEnabled: Bool,
        familyWalletID: String?
    ) -> Bool {
        guard familyWalletID != nil else { return false }
        switch target {
        case .deposit: return depositsEnabled
        case .receipt: return receiptsEnabled
        }
    }
}

enum ScanSaveError: LocalizedError {
    case missingAmount
    case missingMerchant
    var errorDescription: String? {
        switch self {
        case .missingAmount: return "Podaj kwotę, zanim zapiszesz dokument."
        case .missingMerchant: return "Podaj nazwę sklepu lub sprzedawcy."
        }
    }
}

struct AppSettings: Equatable {
    var hasCompletedOnboarding: Bool
    var displayName: String
    var reminder7Days: Bool
    var reminder1Day: Bool
    var reminderOnDay: Bool
    var boostBrightness: Bool
    var shareNewTicketsWithFamily: Bool
    var shareNewReceiptsWithFamily: Bool
    var scanOpensImmediately: Bool
    var warrantyReminder30: Bool
    var warrantyReminder7: Bool
    var returnReminder3: Bool
    var lockWithBiometrics: Bool

    var notificationSettings: NotificationSettings {
        NotificationSettings(
            reminder7Days: reminder7Days,
            reminder1Day: reminder1Day,
            reminderOnDay: reminderOnDay,
            warrantyReminder30: warrantyReminder30,
            warrantyReminder7: warrantyReminder7,
            returnReminder3: returnReminder3
        )
    }

    static func load() -> AppSettings {
        let defaults = UserDefaults.standard
        return AppSettings(
            hasCompletedOnboarding: defaults.bool(forKey: Keys.onboarding),
            displayName: defaults.string(forKey: Keys.displayName) ?? "",
            reminder7Days: defaults.object(forKey: Keys.reminder7) as? Bool ?? true,
            reminder1Day: defaults.object(forKey: Keys.reminder1) as? Bool ?? true,
            reminderOnDay: defaults.object(forKey: Keys.reminder0) as? Bool ?? true,
            boostBrightness: defaults.object(forKey: Keys.brightness) as? Bool ?? true,
            shareNewTicketsWithFamily: defaults.object(forKey: Keys.shareFamily) as? Bool ?? true,
            shareNewReceiptsWithFamily: defaults.object(forKey: Keys.shareReceipts) as? Bool ?? true,
            scanOpensImmediately: defaults.object(forKey: Keys.scanImmediate) as? Bool ?? false,
            warrantyReminder30: defaults.object(forKey: Keys.warranty30) as? Bool ?? true,
            warrantyReminder7: defaults.object(forKey: Keys.warranty7) as? Bool ?? true,
            returnReminder3: defaults.object(forKey: Keys.return3) as? Bool ?? true,
            lockWithBiometrics: defaults.bool(forKey: Keys.lockBiometrics)
        )
    }

    func save() {
        let defaults = UserDefaults.standard
        defaults.set(hasCompletedOnboarding, forKey: Keys.onboarding)
        defaults.set(displayName, forKey: Keys.displayName)
        defaults.set(reminder7Days, forKey: Keys.reminder7)
        defaults.set(reminder1Day, forKey: Keys.reminder1)
        defaults.set(reminderOnDay, forKey: Keys.reminder0)
        defaults.set(boostBrightness, forKey: Keys.brightness)
        defaults.set(shareNewTicketsWithFamily, forKey: Keys.shareFamily)
        defaults.set(shareNewReceiptsWithFamily, forKey: Keys.shareReceipts)
        defaults.set(scanOpensImmediately, forKey: Keys.scanImmediate)
        defaults.set(warrantyReminder30, forKey: Keys.warranty30)
        defaults.set(warrantyReminder7, forKey: Keys.warranty7)
        defaults.set(returnReminder3, forKey: Keys.return3)
        defaults.set(lockWithBiometrics, forKey: Keys.lockBiometrics)
    }

    private enum Keys {
        static let onboarding = "hasCompletedOnboarding"
        static let displayName = "displayName"
        static let reminder7 = "reminder7Days"
        static let reminder1 = "reminder1Day"
        static let reminder0 = "reminderOnDay"
        static let brightness = "boostBrightness"
        static let shareFamily = "shareNewTicketsWithFamily"
        static let shareReceipts = "shareNewReceiptsWithFamily"
        static let scanImmediate = "scanOpensImmediately"
        static let warranty30 = "warrantyReminder30"
        static let warranty7 = "warrantyReminder7"
        static let return3 = "returnReminder3"
        static let lockBiometrics = "lockWithBiometrics"
    }

    static let kvsDisplayName = "paragonos.displayName"
}

enum OpenScanBridge {
    static var pending = false
}
