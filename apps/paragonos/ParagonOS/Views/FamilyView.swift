import CloudKit
import SwiftUI

struct FamilyView: View {
    @EnvironmentObject private var wallet: WalletModel
    @State private var shareToPresent: CKShare?
    @State private var showShareSheet = false
    @State private var isPreparingShare = false

    private var accountName: String {
        let stored = wallet.settings.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if stored.isEmpty == false { return stored }
        let iCloud = wallet.family.meFullName.trimmingCharacters(in: .whitespacesAndNewlines)
        return iCloud.isEmpty ? "Ty" : iCloud
    }

    private var otherMembers: [FamilyMember] {
        let mine = accountName.lowercased()
        return wallet.family.members.filter { member in
            guard member.isOwner else { return true }
            let name = member.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return name != mine && name != "ty"
        }
    }

    var body: some View {
        Form {
            Section {
                VStack(spacing: 10) {
                    FamilyAvatar(name: accountName, size: 96)
                    Text(accountName)
                        .font(.title2.weight(.semibold))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            Section("Twoje urządzenia") {
                LabeledContent("iCloud") {
                    Text(wallet.family.isICloudAvailable ? "Włączony" : "Wyłączony")
                        .foregroundStyle(wallet.family.isICloudAvailable ? ParagonTheme.osGreen : .secondary)
                }
                LabeledContent("Synchronizacja") {
                    Text(wallet.cloudSync.statusTitle)
                        .foregroundStyle(wallet.cloudSync.phase == .failed ? .red : .primary)
                }
                if let last = wallet.cloudSync.lastSuccessText {
                    LabeledContent("Ostatnio") {
                        Text(last)
                    }
                }
                if wallet.cloudSync.isInProgress {
                    ProgressView("Łączenie z iCloud…")
                }
                if let error = wallet.cloudSync.errorText ?? wallet.cloudSync.containerError {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                if let message = wallet.family.statusMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Button("Synchronizuj teraz") {
                    wallet.requestCloudSync()
                }
                .disabled(wallet.cloudSync.usesCloudKit == false)
            }

            Section {
                TextField("Twoje imię", text: $wallet.settings.displayName)
                    .textInputAutocapitalization(.words)
                    .onChange(of: wallet.settings.displayName) { _, name in
                        wallet.schedulePersistDisplayName(name)
                    }
                if wallet.family.isICloudAvailable == false {
                    Text("Włącz iCloud, aby zapraszać bliskich.")
                        .foregroundStyle(.secondary)
                } else {
                    Toggle("Udostępniaj nowe kaucje", isOn: $wallet.settings.shareNewTicketsWithFamily)
                    Toggle("Udostępniaj nowe paragony", isOn: $wallet.settings.shareNewReceiptsWithFamily)
                    Toggle("Udostępniaj nowe karty", isOn: $wallet.settings.shareNewLoyaltyCardsWithFamily)
                    Button {
                        Task { await invite() }
                    } label: {
                        if isPreparingShare {
                            ProgressView()
                        } else {
                            Label("Zaproś bliskich", systemImage: "person.badge.plus")
                        }
                    }
                    .disabled(isPreparingShare)
                }
            } header: {
                Text("Rodzina")
            } footer: {
                Text("iPhone i iPad z Twoim Apple ID dostają kaucje, paragony i karty same — jak Notatki. Zaproszenie jest tylko dla innych osób. Przy zaproszeniu zostaw „Może wprowadzać zmiany”, żeby mogli też dodawać.")
            }

            if otherMembers.isEmpty == false {
                Section("Członkowie") {
                    ForEach(otherMembers) { member in
                        FamilyMemberRow(member: member)
                    }
                }
            }
        }
        .navigationTitle("Rodzina")
        .refreshable {
            wallet.requestCloudSync()
        }
        .task {
            await wallet.family.refreshIdentity()
            await wallet.applySuggestedIdentityIfNeeded()
            await wallet.family.refreshAccountStatus()
            await wallet.family.refreshParticipants()
        }
        .sheet(isPresented: $showShareSheet, onDismiss: {
            shareToPresent = nil
            Task { await wallet.family.refreshParticipants() }
        }) {
            if let share = shareToPresent {
                CloudSharingView(
                    share: share,
                    container: CKContainer(identifier: Brand.iCloudContainer),
                    onShareChanged: {
                        Task { await wallet.family.refreshParticipants() }
                    },
                    onDismiss: {
                        showShareSheet = false
                    }
                )
            }
        }
    }

    private func invite() async {
        isPreparingShare = true
        defer { isPreparingShare = false }
        do {
            let share = try await wallet.family.prepareShare(displayName: accountName)
            shareToPresent = share
            showShareSheet = true
        } catch {
            wallet.family.statusMessage = error.localizedDescription
        }
    }
}

private struct FamilyMemberRow: View {
    let member: FamilyMember

    var body: some View {
        HStack(spacing: 12) {
            FamilyAvatar(name: member.name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(member.name)
                    .font(.body.weight(.medium))
                Text(member.roleTitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct FamilyAvatar: View {
    var name: String
    var size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(.tertiarySystemFill))
            Text(FamilyIdentity.initials(name))
                .font(.system(size: size * 0.36, weight: .semibold, design: .rounded))
                .foregroundStyle(.primary)
        }
        .frame(width: size, height: size)
        .overlay {
            Circle()
                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5)
        }
        .accessibilityLabel(name)
    }
}
