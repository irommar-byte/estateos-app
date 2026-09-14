import CloudKit
import Combine
import Foundation
import SwiftData
import SwiftUI
import UIKit
import WidgetKit

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
    @Published var loyaltyPath = NavigationPath()
    @Published var scanIntent: ScanIntent = .deposit
    @Published var askScanIntent = false
    @Published var receiptDraft: ReceiptDraft?
    @Published var loyaltyDraft: LoyaltyDraft?
    @Published var pendingReceiptID: UUID?
    @Published var pendingLoyaltyID: UUID?
    @Published var showLoyaltyCheckoutFor: UUID?
    @Published var skipLiveScanner = false
    @Published var requestedTab: AppTab?
    @Published var chromeReady = false
    @Published var coffeeSheetPresented = false
    @Published var reviewSheetPresented = false
    @Published var quietPromptTick = 0
    let promptSession = UUID().uuidString
    private var coffeeShownThisSession = false
    private var reviewShownThisSession = false

    let family = CloudKitFamilyService.shared
    let cloudSync = CloudSyncMonitor.shared
    private var profileContext: ModelContext?
    private var didBootstrap = false
    private var cloudCancellables = Set<AnyCancellable>()
    @Published var settings = AppSettings.load() {
        didSet { settings.save() }
    }

    init() {
        showOnboarding = AppSettings.load().hasCompletedOnboarding == false
        AppLocale.apply(AppSettings.load().language)
        ExpiryNotificationService.shared.configure()
        cloudSync.start()
        cloudSync.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cloudCancellables)
    }

    func bootstrap(context: ModelContext, tickets: [Ticket], receipts: [Receipt], cards: [LoyaltyCard] = []) async {
        profileContext = context
        if FileManager.default.ubiquityIdentityToken == nil {
            cloudSync.markLocalOnly()
        }
        await refreshDisplayName(context: context)
        await family.refreshAccountStatus()
        repairMissingBarcodes(tickets: tickets, context: context)
        healReceiptDates(receipts: receipts, context: context)
        await repairImpossibleDates(tickets: tickets, context: context)
        await mergeFamilyTickets(context: context, existing: tickets)
        await mergeFamilyReceipts(context: context, existing: receipts)
        await mergeFamilyCards(context: context, existing: cards)
        let latestTickets = storedTickets(in: context)
        let latestReceipts = storedReceipts(in: context)
        healReceiptDates(receipts: latestReceipts, context: context)
        await ExpiryNotificationService.shared.reschedule(
            tickets: latestTickets,
            receipts: latestReceipts,
            settings: settings.notificationSettings
        )
        await family.subscribeToRemoteChanges()
        await family.repairMissingParents()
        observeNotifications()
        cloudSync.requestExport(from: context)
        didBootstrap = true
        publishHomeChrome(from: context)
        consumePendingLaunch()
        if settings.hasCompletedOnboarding {
            await ExpiryNotificationService.shared.requestAuthorization()
        }
    }

    func consumePendingLaunch() {
        guard chromeReady else { return }
        if let pending = ShortcutLaunch.pending {
            HomeQuickActions.handle(pending, wallet: self)
            return
        }
        guard showScanner == false else { return }
        if let intent = PendingLaunch.takeScan() {
            openScanner(for: intent)
        }
    }

    func openScanner(for intent: ScanIntent) {
        PendingLaunch.clearScan()
        switch intent {
        case .deposit: requestedTab = .wallet
        case .receipt: requestedTab = .receipts
        case .loyalty: requestedTab = .cards
        }
        scanIntent = intent
        scanDraft = nil
        receiptDraft = nil
        loyaltyDraft = nil
        scanError = nil
        skipLiveScanner = false
        showScanner = true
    }

    func openManualLoyalty(program: LoyaltyProgram) {
        scanIntent = .loyalty
        scanDraft = nil
        receiptDraft = nil
        loyaltyDraft = .blank(program: program)
        scanPhoto = nil
        scanError = nil
        skipLiveScanner = true
        showScanner = true
    }

    func openManualDeposit(retailerID: String = "unknown") {
        scanIntent = .deposit
        var draft = VoucherDraft.blank()
        draft.retailerID = retailerID
        scanDraft = draft
        receiptDraft = nil
        loyaltyDraft = nil
        scanPhoto = nil
        scanError = nil
        skipLiveScanner = true
        showScanner = true
    }

    func refreshNotifications(tickets: [Ticket], receipts: [Receipt]) async {
        await ExpiryNotificationService.shared.reschedule(
            tickets: tickets,
            receipts: receipts,
            settings: settings.notificationSettings
        )
    }

    func requestCloudSync() {
        guard let context = profileContext else { return }
        cloudSync.requestExport(from: context)
        Task { await refreshFamilyFromCloud() }
    }

    func refreshFamilyFromCloud() async {
        guard didBootstrap, let context = profileContext else { return }
        let tickets = storedTickets(in: context)
        let receipts = storedReceipts(in: context)
        let cards = storedCards(in: context)
        await mergeFamilyTickets(context: context, existing: tickets)
        await mergeFamilyReceipts(context: context, existing: receipts)
        await mergeFamilyCards(context: context, existing: cards)
        let latestReceipts = storedReceipts(in: context)
        healReceiptDates(receipts: latestReceipts, context: context)
        await ExpiryNotificationService.shared.reschedule(
            tickets: storedTickets(in: context),
            receipts: latestReceipts,
            settings: settings.notificationSettings
        )
    }

    private func prepareRedeem(id: UUID) {
        guard let context = profileContext else {
            pendingTicketID = id
            return
        }
        pendingRedeem = storedTickets(in: context).first { $0.id == id }
        if pendingRedeem == nil {
            pendingTicketID = id
        }
    }

    private func storedTickets(in context: ModelContext) -> [Ticket] {
        (try? context.fetch(FetchDescriptor<Ticket>())) ?? []
    }

    private func storedReceipts(in context: ModelContext) -> [Receipt] {
        (try? context.fetch(FetchDescriptor<Receipt>())) ?? []
    }

    private func storedCards(in context: ModelContext) -> [LoyaltyCard] {
        (try? context.fetch(FetchDescriptor<LoyaltyCard>())) ?? []
    }

    func noteSuccessfulSave() {
        QuietPromptStore.recordSave()
        quietPromptTick += 1
    }

    func considerQuietPrompts(blocked: Bool) {
        guard chromeReady, blocked == false else { return }
        guard coffeeSheetPresented == false, reviewSheetPresented == false else { return }
        var state = QuietPromptStore.load()
        if coffeeShownThisSession { state.coffeeSession = promptSession }
        if reviewShownThisSession { state.reviewSession = promptSession }
        switch QuietPromptPolicy.next(state, now: .now, session: promptSession) {
        case .review:
            QuietPromptStore.markReviewPrompt()
            reviewShownThisSession = true
            reviewSheetPresented = true
        case .coffee:
            QuietPromptStore.markCoffeePrompt()
            coffeeShownThisSession = true
            coffeeSheetPresented = true
        case nil:
            break
        }
    }

    func rememberCheckoutCard(_ id: UUID) {
        let raw = id.uuidString
        UserDefaults(suiteName: AppGroup.id)?.set(raw, forKey: AppGroup.lastCardKey)
        UserDefaults.standard.set(raw, forKey: AppGroup.lastCardKey)
    }

    func publishHomeChrome(from context: ModelContext) {
        let tickets = storedTickets(in: context)
        let cards = storedCards(in: context)
        let now = Date()
        let active = tickets
            .filter { $0.resolvedStatus(now: now) == .active }
            .sorted { ($0.expiresAt ?? .distantFuture) < ($1.expiresAt ?? .distantFuture) }
        let next = active.first
        let lastID = (UserDefaults(suiteName: AppGroup.id)?.string(forKey: AppGroup.lastCardKey)
            ?? UserDefaults.standard.string(forKey: AppGroup.lastCardKey))
            .flatMap(UUID.init)
        let snapshotCards = cards.prefix(6).map { card -> SnapshotCard in
            let program = card.program
            if let png = WidgetStampRenderer.png(program: program) {
                WidgetStampStore.save(id: card.id, png: png)
            }
            return SnapshotCard(
                id: card.id,
                name: card.displayName,
                colorHex: program.cardColorHex,
                programID: program.id
            )
        }
        let snapshotTickets = active.prefix(6).map { ticket -> SnapshotTicket in
            let program = LoyaltyCatalog.programForRetailer(ticket.retailerID)
            if let png = WidgetStampRenderer.png(program: program) {
                WidgetStampStore.save(id: ticket.id, png: png)
            }
            return SnapshotTicket(
                id: ticket.id,
                brand: RetailerCatalog.policy(id: ticket.retailerID).name,
                amount: ticket.amount,
                expiresAt: ticket.expiresAt,
                brandID: ticket.retailerID,
                colorHex: program.cardColorHex
            )
        }
        let snapshot = HomeSnapshot(
            nextTicket: next.map {
                SnapshotTicket(
                    id: $0.id,
                    brand: RetailerCatalog.policy(id: $0.retailerID).name,
                    amount: $0.amount,
                    expiresAt: $0.expiresAt,
                    brandID: $0.retailerID,
                    colorHex: LoyaltyCatalog.programForRetailer($0.retailerID).cardColorHex
                )
            },
            cards: snapshotCards,
            lastCardID: lastID,
            tickets: snapshotTickets
        )
        HomeSnapshotStore.save(snapshot)
        HomeQuickActions.refresh(snapshot: snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    func completeOnboarding() {
        settings.hasCompletedOnboarding = true
        showOnboarding = false
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        Task { await ExpiryNotificationService.shared.requestAuthorization() }
    }

    func analyze(image: UIImage) async {
        isAnalyzing = true
        scanError = nil
        defer { isAnalyzing = false }
        do {
            if scanIntent == .loyalty {
                let framed = CardScanPhotos.cropToCardFrame(image)
                let recognized = try await ScanService.recognize(image: framed)
                scanPhoto = ScanService.storedPhoto(framed)
                loyaltyDraft = LoyaltyParser.parse(lines: recognized.lines, barcodes: recognized.barcodes)
                scanDraft = nil
                receiptDraft = nil
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                return
            }
            if scanIntent == .receipt {
                let recognized = try await ScanService.recognize(image: image)
                scanPhoto = ScanService.storedPhoto(image)
                receiptDraft = ReceiptParser.parse(lines: recognized.lines, barcodes: recognized.barcodes)
                scanDraft = nil
                loyaltyDraft = nil
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                return
            }
            let result = try await ScanService.analyze(image: image)
            if offerRedeemIfDuplicate(result.draft) { return }
            scanPhoto = ScanService.storedPhoto(image)
            scanDraft = Self.draftWithBarcode(result.draft)
            receiptDraft = nil
            loyaltyDraft = nil
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        } catch {
            scanError = scanIntent == .receipt
                ? "Nie udało się odczytać paragonu. Wpisz dane ręcznie."
                : scanIntent == .loyalty
                    ? "Nie udało się odczytać karty. Wybierz sklep i wpisz kod."
                    : "Nie udało się odczytać kwitka. Wpisz dane ręcznie."
            scanPhoto = ScanService.storedPhoto(image)
            if scanIntent == .receipt {
                receiptDraft = .blank()
            } else if scanIntent == .loyalty {
                loyaltyDraft = .blank()
            } else {
                scanDraft = .blank()
            }
        }
    }

    func finishLoyaltyScan(draft: LoyaltyDraft, photo: UIImage?) {
        scanError = nil
        scanPhoto = photo.map(ScanService.storedPhoto)
        loyaltyDraft = draft
        scanDraft = nil
        receiptDraft = nil
        UINotificationFeedbackGenerator().notificationOccurred(.success)
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
            scanPhoto = photo.map(ScanService.storedPhoto)
            receiptDraft = parsed
            scanDraft = nil
            loyaltyDraft = nil
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            return
        }
        if offerRedeemIfDuplicate(draft) { return }
        scanPhoto = photo.map(ScanService.storedPhoto)
        scanDraft = Self.draftWithBarcode(draft)
        receiptDraft = nil
        loyaltyDraft = nil
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
            cardsEnabled: settings.shareNewLoyaltyCardsWithFamily,
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
        cloudSync.requestExport(from: context)
        scanDraft = nil
        scanPhoto = nil
        showScanner = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if shouldShare(.deposit) {
            Task { await family.upsertShared(ticket: ticket) }
        }
        publishHomeChrome(from: context)
        noteSuccessfulSave()
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
        cloudSync.requestExport(from: context)
        receiptDraft = nil
        scanPhoto = nil
        showScanner = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if shouldShare(.receipt) {
            Task { await family.upsertShared(receipt: receipt) }
        }
        pendingReceiptID = receipt.id
        noteSuccessfulSave()
        return receipt
    }

    func saveLoyalty(draft: LoyaltyDraft, photo: UIImage?, context: ModelContext) throws -> LoyaltyCard {
        let payload = draft.barcodePayload.trimmingCharacters(in: .whitespacesAndNewlines)
        guard payload.isEmpty == false else {
            throw ScanSaveError.missingBarcode
        }
        let name = draft.programName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard name.isEmpty == false else {
            throw ScanSaveError.missingMerchant
        }
        if let existing = matchingLoyaltyCard(payload: payload, in: context) {
            pendingLoyaltyID = existing.id
            loyaltyDraft = nil
            scanPhoto = nil
            showScanner = false
            throw ScanSaveError.duplicateLoyalty
        }
        let photoData = photo.flatMap { ScanService.compressLoyaltyPhoto($0) }
        let card = LoyaltyCard(
            programID: draft.programID.isEmpty ? LoyaltyCatalog.customID : draft.programID,
            programName: name,
            holderName: draft.holderName.trimmingCharacters(in: .whitespacesAndNewlines),
            barcodePayload: payload,
            barcodeSymbology: draft.barcodeSymbology == .unknown
                ? BarcodeSymbology.inferred(from: payload)
                : draft.barcodeSymbology,
            note: draft.note.trimmingCharacters(in: .whitespacesAndNewlines),
            photoData: photoData,
            scannedByName: settings.displayName,
            ocrText: draft.ocrText
        )
        if shouldShare(.loyalty) {
            card.familyShareID = family.familyWalletID
        }
        context.insert(card)
        try context.save()
        cloudSync.requestExport(from: context)
        loyaltyDraft = nil
        scanPhoto = nil
        showScanner = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        if shouldShare(.loyalty) {
            Task { await family.upsertShared(card: card) }
        }
        pendingLoyaltyID = card.id
        rememberCheckoutCard(card.id)
        publishHomeChrome(from: context)
        noteSuccessfulSave()
        return card
    }

    func persistLoyalty(_ card: LoyaltyCard, context: ModelContext) throws {
        let payload = card.barcodePayload.trimmingCharacters(in: .whitespacesAndNewlines)
        if payload.isEmpty == false,
           let existing = matchingLoyaltyCard(payload: payload, excluding: card.id, in: context) {
            card.barcodePayload = existing.barcodePayload
            throw ScanSaveError.duplicateLoyalty
        }
        card.updatedAt = Date()
        try context.save()
        if card.familyShareID != nil {
            Task { await family.upsertShared(card: card) }
        }
        publishHomeChrome(from: context)
    }

    func matchingLoyaltyCard(payload: String, excluding: UUID? = nil, in context: ModelContext) -> LoyaltyCard? {
        storedCards(in: context).first { card in
            if let excluding, card.id == excluding { return false }
            return LoyaltyIdentity.isSamePayload(card.barcodePayload, payload)
        }
    }

    func persistTicket(_ ticket: Ticket, context: ModelContext) throws {
        ticket.updatedAt = Date()
        try context.save()
        if ticket.familyWalletID != nil {
            Task { await family.upsertShared(ticket: ticket) }
        }
    }

    func shareTicketWithFamily(_ ticket: Ticket, context: ModelContext) async {
        ticket.familyWalletID = family.familyWalletID
        ticket.updatedAt = Date()
        try? context.save()
        await family.upsertShared(ticket: ticket)
    }

    func stopSharingTicket(_ ticket: Ticket, context: ModelContext) async {
        await family.deleteSharedRecord(named: ticket.id.uuidString)
        ticket.familyWalletID = nil
        ticket.updatedAt = Date()
        try? context.save()
    }

    func stopSharingReceipt(_ receipt: Receipt, context: ModelContext) async {
        await family.deleteSharedRecord(named: receipt.id.uuidString)
        receipt.familyShareID = nil
        receipt.updatedAt = Date()
        try? context.save()
    }

    func stopSharingLoyalty(_ card: LoyaltyCard, context: ModelContext) async {
        await family.deleteSharedRecord(named: card.id.uuidString)
        card.familyShareID = nil
        card.updatedAt = Date()
        try? context.save()
    }

    func shareLoyaltyWithFamily(_ card: LoyaltyCard, context: ModelContext) async {
        card.familyShareID = family.familyWalletID
        card.updatedAt = Date()
        try? context.save()
        await family.upsertShared(card: card)
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
        publishHomeChrome(from: context)
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
        publishHomeChrome(from: context)
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

    private func healReceiptDates(receipts: [Receipt], context: ModelContext) {
        if ReceiptAnalytics.healMissingDates(receipts) {
            try? context.save()
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
        let id = ticket.id.uuidString
        let shared = ticket.familyWalletID != nil
        context.delete(ticket)
        try context.save()
        if shared {
            Task { await family.deleteSharedRecord(named: id) }
        }
        publishHomeChrome(from: context)
    }

    func deleteReceipt(_ receipt: Receipt, context: ModelContext) throws {
        let id = receipt.id.uuidString
        let shared = receipt.familyShareID != nil
        context.delete(receipt)
        try context.save()
        if shared {
            Task { await family.deleteSharedRecord(named: id) }
        }
    }

    func deleteLoyalty(_ card: LoyaltyCard, context: ModelContext) throws {
        let id = card.id.uuidString
        let shared = card.familyShareID != nil
        context.delete(card)
        try context.save()
        if shared {
            Task { await family.deleteSharedRecord(named: id) }
        }
        publishHomeChrome(from: context)
    }

    func leaveFamily(context: ModelContext) async {
        await family.leaveFamily()
        for ticket in storedTickets(in: context) where ticket.familyWalletID != nil {
            ticket.familyWalletID = nil
            ticket.updatedAt = Date()
        }
        for receipt in storedReceipts(in: context) where receipt.familyShareID != nil {
            receipt.familyShareID = nil
            receipt.updatedAt = Date()
        }
        for card in storedCards(in: context) where card.familyShareID != nil {
            card.familyShareID = nil
            card.updatedAt = Date()
        }
        try? context.save()
    }

    private func mergeFamilyTickets(context: ModelContext, existing: [Ticket]) async {
        let fetch = await family.fetchSharedTickets()
        guard fetch.succeeded else { return }
        let records = fetch.records
        let byID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id.uuidString, $0) })
        let remote = Set(records.map(\.recordID.recordName))
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
                ticket.barcodePayload = payload
                ticket.barcodeSymbologyRaw = symbology
                ticket.ticketNumber = number
                if let photo { ticket.photoData = photo }
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
        for ticket in existing where ticket.familyWalletID != nil {
            if remote.contains(ticket.id.uuidString) == false {
                context.delete(ticket)
            }
        }
        try? context.save()
    }

    private func mergeFamilyReceipts(context: ModelContext, existing: [Receipt]) async {
        let fetch = await family.fetchSharedReceipts()
        guard fetch.succeeded else { return }
        let records = fetch.records
        let byID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id.uuidString, $0) })
        let remote = Set(records.map(\.recordID.recordName))
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
                receipt.merchantNIP = nip
                receipt.category = category
                receipt.itemName = itemName
                receipt.warrantyUntil = warrantyUntil
                receipt.returnUntil = returnUntil
                if let photo { receipt.photoData = photo }
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
        for receipt in existing where receipt.familyShareID != nil {
            if remote.contains(receipt.id.uuidString) == false {
                context.delete(receipt)
            }
        }
        try? context.save()
    }

    private func mergeFamilyCards(context: ModelContext, existing: [LoyaltyCard]) async {
        let fetch = await family.fetchSharedCards()
        guard fetch.succeeded else { return }
        let records = fetch.records
        let byID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id.uuidString, $0) })
        let remote = Set(records.map(\.recordID.recordName))
        for record in records {
            let name = record.recordID.recordName
            let programID = record["programID"] as? String ?? ""
            let programName = record["programName"] as? String ?? ""
            let holderName = record["holderName"] as? String ?? ""
            let payload = record["barcodePayload"] as? String ?? ""
            let symbology = BarcodeSymbology(rawValue: record["barcodeSymbology"] as? String ?? "") ?? .code128
            let note = record["note"] as? String ?? ""
            let scannedBy = record["scannedByName"] as? String ?? ""
            var photo: Data?
            if let asset = record["photo"] as? CKAsset, let url = asset.fileURL {
                photo = try? Data(contentsOf: url)
            }
            if let card = byID[name] {
                card.programName = programName
                card.holderName = holderName
                card.barcodePayload = payload
                card.barcodeSymbology = symbology
                card.note = note
                if let photo { card.photoData = photo }
                card.updatedAt = Date()
            } else {
                let card = LoyaltyCard(
                    id: UUID(uuidString: name) ?? UUID(),
                    programID: programID,
                    programName: programName,
                    holderName: holderName,
                    barcodePayload: payload,
                    barcodeSymbology: symbology,
                    note: note,
                    photoData: photo,
                    scannedByName: scannedBy,
                    ocrText: ""
                )
                card.familyShareID = family.familyWalletID
                context.insert(card)
            }
        }
        for card in existing where card.familyShareID != nil {
            if remote.contains(card.id.uuidString) == false {
                context.delete(card)
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
                Task { @MainActor in self?.prepareRedeem(id: id) }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonOpenReceipt, object: nil, queue: .main) { [weak self] note in
            if let raw = note.object as? String, let id = UUID(uuidString: raw) {
                Task { @MainActor in self?.pendingReceiptID = id }
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonOpenScanner, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                self?.consumePendingLaunch()
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonShortcut, object: nil, queue: .main) { [weak self] note in
            guard let item = note.object as? UIApplicationShortcutItem else { return }
            Task { @MainActor in
                guard let self else { return }
                HomeQuickActions.handle(item, wallet: self)
            }
        })
        observers.append(NotificationCenter.default.addObserver(forName: .paragonFamilyRemoteChange, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in await self?.refreshFamilyFromCloud() }
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

    func applySuggestedIdentityIfNeeded() async {
        let suggested = family.meFullName.isEmpty ? await family.suggestedGivenName() : family.meFullName
        guard FamilyIdentity.shouldUpgradeStoredName(settings.displayName, suggested: suggested) else { return }
        persistDisplayName(suggested)
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
    case loyalty
}

enum FamilySharePolicy {
    static func shouldShare(
        _ target: FamilyShareTarget,
        depositsEnabled: Bool,
        receiptsEnabled: Bool,
        familyWalletID: String?
    ) -> Bool {
        shouldShare(
            target,
            depositsEnabled: depositsEnabled,
            receiptsEnabled: receiptsEnabled,
            cardsEnabled: false,
            familyWalletID: familyWalletID
        )
    }

    static func shouldShare(
        _ target: FamilyShareTarget,
        depositsEnabled: Bool,
        receiptsEnabled: Bool,
        cardsEnabled: Bool,
        familyWalletID: String?
    ) -> Bool {
        guard familyWalletID != nil else { return false }
        switch target {
        case .deposit: return depositsEnabled
        case .receipt: return receiptsEnabled
        case .loyalty: return cardsEnabled
        }
    }
}

enum ScanSaveError: LocalizedError {
    case missingAmount
    case missingMerchant
    case missingBarcode
    case duplicateLoyalty
    var errorDescription: String? {
        switch self {
        case .missingAmount: return "Podaj kwotę, zanim zapiszesz dokument."
        case .missingMerchant: return "Podaj nazwę sklepu lub sprzedawcy."
        case .missingBarcode: return "Podaj numer karty albo zeskanuj kod."
        case .duplicateLoyalty: return "Ta karta już jest w portfelu."
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
    var shareNewLoyaltyCardsWithFamily: Bool
    var scanOpensImmediately: Bool
    var language: AppLanguage
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
            shareNewLoyaltyCardsWithFamily: defaults.object(forKey: Keys.shareCards) as? Bool ?? true,
            scanOpensImmediately: defaults.object(forKey: Keys.scanImmediate) as? Bool ?? true,
            language: AppLanguage(rawValue: defaults.string(forKey: Keys.language) ?? "") ?? .system,
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
        defaults.set(shareNewLoyaltyCardsWithFamily, forKey: Keys.shareCards)
        defaults.set(scanOpensImmediately, forKey: Keys.scanImmediate)
        defaults.set(language.rawValue, forKey: Keys.language)
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
        static let shareCards = "shareNewLoyaltyCardsWithFamily"
        static let scanImmediate = "scanOpensImmediately"
        static let language = "appLanguage"
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
