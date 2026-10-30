import CloudKit
import SwiftData
import SwiftUI

struct FamilyView: View {
    @EnvironmentObject private var wallet: WalletModel
    @Environment(\.modelContext) private var context
    @ObservedObject private var cloudSync = CloudSyncMonitor.shared
    @ObservedObject private var family = CloudKitFamilyService.shared
    @State private var shareToPresent: CKShare?
    @State private var showShareSheet = false
    @State private var isPreparingShare = false
    @State private var confirmLeave = false
    @State private var confirmShareAll = false
    @State private var isBackfilling = false

    private var accountName: String {
        let stored = wallet.settings.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if stored.isEmpty == false { return stored }
        let iCloud = family.meFullName.trimmingCharacters(in: .whitespacesAndNewlines)
        return iCloud.isEmpty ? "Ty" : iCloud
    }

    private var household: [FamilyMember] {
        if family.members.isEmpty == false { return family.members }
        return [
            FamilyMember(
                id: "self",
                name: accountName,
                isOwner: family.isFamilyOwner || family.familyWalletID == nil,
                isCurrentUser: true
            )
        ]
    }

    private var isBusy: Bool { isPreparingShare || isBackfilling }
    private var hasFamily: Bool { family.familyWalletID != nil }

    var body: some View {
        Form {
            identitySection
            devicesSection

            if family.isICloudAvailable == false {
                Section("Rodzina") {
                    Label("Włącz iCloud w Ustawieniach iPhone’a, żeby zapraszać bliskich.", systemImage: "icloud.slash")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                }
                .listRowBackground(ParagonTheme.surface)
            } else if hasFamily == false {
                inviteHeroSection
            } else {
                membersSection
                if family.isFamilyOwner {
                    sharingOwnerSections
                } else {
                    sharingMemberSection
                }
                leaveSection
            }
        }
        .navigationTitle("Rodzina")
        .navigationBarTitleDisplayMode(.large)
        .paragonTabClearance()
        .toolbar {
            if family.isICloudAvailable, family.isFamilyOwner || hasFamily == false {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await invite() }
                    } label: {
                        Image(systemName: "person.badge.plus")
                    }
                    .disabled(isBusy)
                    .accessibilityLabel(
                        hasFamily ? "Zaproś kolejną osobę" : "Zaproś bliskich"
                    )
                }
            }
        }
        .refreshable {
            await wallet.requestCloudSyncAndWait()
            await family.refreshParticipants()
        }
        .task {
            if FamilyCloudCopy.isObsoleteStatus(family.statusMessage) {
                family.statusMessage = nil
            }
            await family.refreshIdentity()
            await wallet.applySuggestedIdentityIfNeeded()
            await family.refreshAccountStatus()
            await family.refreshParticipants()
            await wallet.retryFamilyUploads(context: context)
            await wallet.refreshFamilyFromCloud()
        }
        .onChange(of: family.statusMessage) { _, message in
            clearTransientStatus(message)
        }
        .confirmationDialog(
            family.isFamilyOwner ? "Zatrzymać udostępnianie?" : "Opuścić rodzinę?",
            isPresented: $confirmLeave,
            titleVisibility: .visible
        ) {
            Button(family.isFamilyOwner ? "Zatrzymaj" : "Opuść", role: .destructive) {
                Task { await wallet.leaveFamily(context: context) }
            }
            Button("Anuluj", role: .cancel) {}
        }
        .alert("Udostępnić wszystko?", isPresented: $confirmShareAll) {
            Button("Udostępnij") {
                wallet.settings.familyShareExisting = true
                Task { await backfillIfNeeded() }
            }
            Button("Anuluj", role: .cancel) {}
        } message: {
            Text(shareAllPromptText)
        }
        .sheet(isPresented: $showShareSheet, onDismiss: {
            shareToPresent = nil
            Task {
                await family.refreshParticipants()
                await backfillIfNeeded()
            }
        }) {
            if let share = shareToPresent {
                CloudSharingView(
                    share: share,
                    container: CKContainer(identifier: Brand.iCloudContainer),
                    onShareChanged: {
                        Task { await family.refreshParticipants() }
                    },
                    onDismiss: {
                        showShareSheet = false
                    }
                )
            }
        }
        .onChange(of: wallet.settings.shareNewTicketsWithFamily) { _, enabled in
            if enabled, wallet.settings.familyShareExisting {
                Task { await backfillIfNeeded(forceCategory: .deposit) }
            }
        }
        .onChange(of: wallet.settings.shareNewReceiptsWithFamily) { _, enabled in
            if enabled, wallet.settings.familyShareExisting {
                Task { await backfillIfNeeded(forceCategory: .receipt) }
            }
        }
        .onChange(of: wallet.settings.shareNewLoyaltyCardsWithFamily) { _, enabled in
            if enabled, wallet.settings.familyShareExisting {
                Task { await backfillIfNeeded(forceCategory: .loyalty) }
            }
        }
        .sensoryFeedback(.success, trigger: family.statusMessage == "Dołączono do portfela rodzinnego.")
    }

    private var identitySection: some View {
        Section {
            VStack(spacing: 12) {
                ParagonContactAvatar(name: accountName, size: 96)
                Text(accountName)
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                if hasFamily {
                    Text(family.isFamilyOwner ? "Organizator" : "Członek rodziny")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        }
        .listRowBackground(ParagonTheme.surface)
    }

    private var devicesSection: some View {
        Section {
            ParagonCloudDevicesRow(cloudSync: cloudSync) {
                wallet.requestCloudSync()
            }
            if let error = cloudSync.visibleError, cloudSync.island == .hidden {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            if let message = family.statusMessage, FamilyCloudCopy.isObsoleteStatus(message) == false {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .transition(.opacity)
            }
        } header: {
            Text("Twoje urządzenia")
        } footer: {
            Text("Ten sam Apple ID na Twoich iPhone’ach idzie sam. Rodzina — zaproszeniem.")
        }
        .listRowBackground(ParagonTheme.surface)
    }

    private var inviteHeroSection: some View {
        Section {
            VStack(spacing: 14) {
                Image(systemName: "person.2.badge.plus")
                    .font(.system(size: 34, weight: .medium))
                    .foregroundStyle(ParagonTheme.osGreen)
                    .symbolRenderingMode(.hierarchical)
                Text("Wspólny portfel")
                    .font(.headline)
                Text("Bliscy widzą kaucje, paragony i karty, które włączysz. Ty decydujesz, czy tylko nowe, czy też to, co już masz.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button {
                    Task { await invite() }
                } label: {
                    if isBusy {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Zaproś bliskich")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isBusy)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
        }
        .listRowBackground(ParagonTheme.surface)
    }

    private var membersSection: some View {
        Section("Członkowie") {
            ForEach(household) { member in
                FamilyMemberRow(member: member, isMe: member.isCurrentUser)
            }
            if family.isICloudAvailable, family.isFamilyOwner {
                Button {
                    Task { await invite() }
                } label: {
                    Label("Dodaj osobę", systemImage: "person.badge.plus")
                }
                .disabled(isBusy)
            }
        }
        .listRowBackground(ParagonTheme.surface)
    }

    private var sharingMemberSection: some View {
        Section {
            Text("Widzisz wspólny portfel organizatora. Nowe skany możesz dodawać, jeśli masz uprawnienie do edycji.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } header: {
            Text("Udostępnianie")
        }
        .listRowBackground(ParagonTheme.surface)
    }

    @ViewBuilder
    private var sharingOwnerSections: some View {
        Section {
            Picker("Zakres", selection: shareExistingBinding) {
                Text("Tylko nowe").tag(false)
                Text("Wszystko").tag(true)
            }
            .pickerStyle(.segmented)
            .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            shareToggle(
                "Kaucje",
                symbol: "waterbottle.fill",
                tint: ParagonSettingsTint.deposit,
                isOn: $wallet.settings.shareNewTicketsWithFamily
            )
            shareToggle(
                "Paragony",
                symbol: "doc.text.fill",
                tint: ParagonSettingsTint.receipt,
                isOn: $wallet.settings.shareNewReceiptsWithFamily
            )
            shareToggle(
                "Karty",
                symbol: "creditcard.fill",
                tint: ParagonSettingsTint.loyalty,
                isOn: $wallet.settings.shareNewLoyaltyCardsWithFamily
            )
        } header: {
            Text("Udostępnianie")
        } footer: {
            Text(familyFooter)
        }
        .listRowBackground(ParagonTheme.surface)
    }

    private var leaveSection: some View {
        Section {
            Button(family.isFamilyOwner ? "Zatrzymaj udostępnianie" : "Opuść rodzinę", role: .destructive) {
                confirmLeave = true
            }
        } footer: {
            Text(family.isFamilyOwner
                 ? "Bliscy stracą dostęp do wspólnego portfela. Twoje kaucje, paragony i karty zostaną na tym iPhonie."
                 : "Wypiszesz się ze wspólnego portfela. Kopie na tym iPhonie zostaną.")
        }
        .listRowBackground(ParagonTheme.surface)
    }

    private func shareToggle(_ title: String, symbol: String, tint: Color, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            HStack(spacing: 12) {
                ParagonSettingsGlyph(systemName: symbol, background: tint)
                Text(title)
            }
        }
    }

    private var shareExistingBinding: Binding<Bool> {
        Binding(
            get: { wallet.settings.familyShareExisting },
            set: { next in
                if next, wallet.settings.familyShareExisting == false {
                    confirmShareAll = true
                    return
                }
                wallet.settings.familyShareExisting = next
            }
        )
    }

    private var shareAllPromptText: String {
        let tickets = (try? context.fetch(FetchDescriptor<Ticket>()))?.count ?? 0
        let receipts = (try? context.fetch(FetchDescriptor<Receipt>()))?.count ?? 0
        let cards = (try? context.fetch(FetchDescriptor<LoyaltyCard>()))?.count ?? 0
        return FamilyShareAllPrompt.message(
            deposits: tickets,
            receipts: receipts,
            cards: cards,
            depositsOn: wallet.settings.shareNewTicketsWithFamily,
            receiptsOn: wallet.settings.shareNewReceiptsWithFamily,
            cardsOn: wallet.settings.shareNewLoyaltyCardsWithFamily
        )
    }

    private var familyFooter: String {
        if hasFamily == false {
            return "Bliscy z zaproszenia. Ten sam Apple ID na Twoich urządzeniach idzie sam przez iCloud."
        }
        if wallet.settings.familyShareExisting {
            if wallet.settings.shareNewReceiptsWithFamily {
                return "Bliscy widzą kaucje, paragony (ze zdjęciem) i karty z włączonych kategorii — też te, które już masz."
            }
            return "Bliscy widzą kaucje, paragony i karty z włączonych kategorii — też te, które już masz."
        }
        return "Do wspólnego portfela trafiają tylko nowe skany z włączonych kategorii."
    }

    private func invite() async {
        isPreparingShare = true
        defer { isPreparingShare = false }
        do {
            let share = try await family.prepareShare(displayName: accountName)
            shareToPresent = share
            showShareSheet = true
        } catch {
            family.statusMessage = FamilyCloudCopy.userFacingSaveMessage(for: error)
        }
    }

    private func backfillIfNeeded(forceCategory: FamilyShareTarget? = nil) async {
        guard family.isFamilyOwner, hasFamily else { return }
        guard wallet.settings.familyShareExisting else { return }
        isBackfilling = true
        defer { isBackfilling = false }
        await wallet.backfillFamilyShare(context: context, only: forceCategory)
    }

    private func clearTransientStatus(_ message: String?) {
        guard let message, FamilyCloudCopy.shouldAutoClear(message) else { return }
        Task {
            try? await Task.sleep(nanoseconds: 3_200_000_000)
            if family.statusMessage == message {
                family.statusMessage = nil
            }
        }
    }
}

private struct FamilyMemberRow: View {
    let member: FamilyMember
    var isMe: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            ParagonContactAvatar(name: member.name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(member.name)
                        .font(.body.weight(.medium))
                    if isMe, member.name != "Ty" {
                        Text("Ty")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color(.tertiarySystemFill))
                            )
                    }
                }
                Text(member.roleTitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(isMe ? "\(member.name), Ty, \(member.roleTitle)" : "\(member.name), \(member.roleTitle)")
    }
}

struct ParagonContactAvatar: View {
    var name: String
    var size: CGFloat

    private var fill: Color {
        ParagonContactColor.color(for: name)
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            fill.shaded(brightness: 1.08, saturation: 0.92),
                            fill.shaded(brightness: 0.78)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(FamilyIdentity.initials(name))
                .font(.system(size: size * 0.36, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .overlay {
            Circle()
                .strokeBorder(.white.opacity(0.22), lineWidth: 0.6)
        }
        .shadow(
            color: size >= 72 ? fill.opacity(0.28) : .clear,
            radius: size >= 72 ? 16 : 0,
            y: size >= 72 ? 8 : 0
        )
        .accessibilityHidden(true)
    }
}
