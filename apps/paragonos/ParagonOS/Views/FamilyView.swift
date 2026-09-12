import CloudKit
import SwiftUI

struct FamilyView: View {
    @EnvironmentObject private var wallet: WalletModel
    @State private var shareToPresent: CKShare?
    @State private var showShareSheet = false
    @State private var isPreparingShare = false

    var body: some View {
        Form {
            Section {
                TextField("Wyświetlana nazwa", text: $wallet.settings.displayName)
                    .textInputAutocapitalization(.words)
                    .onChange(of: wallet.settings.displayName) { _, name in
                        wallet.schedulePersistDisplayName(name)
                    }
            } header: {
                Text("Ty")
            } footer: {
                Text("Imię widać przy kaucjach i paragonach udostępnionych rodzinie oraz na Twoich innych iPhone’ach. To nie jest konto — tożsamość to Twój Apple ID.")
            }

            Section("iCloud") {
                LabeledContent("Status") {
                    Text(wallet.family.isICloudAvailable ? "Włączony" : "Wyłączony")
                        .foregroundStyle(wallet.family.isICloudAvailable ? ParagonTheme.osGreen : .secondary)
                }
                if let message = wallet.family.statusMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if wallet.family.isSyncing {
                    Label("Synchronizacja…", systemImage: "icloud")
                }
            }

            Section {
                if wallet.family.isICloudAvailable == false {
                    Text("Włącz iCloud, aby synchronizować i udostępniać.")
                        .foregroundStyle(.secondary)
                } else {
                    Toggle("Udostępniaj nowe kaucje", isOn: $wallet.settings.shareNewTicketsWithFamily)
                    Toggle("Udostępniaj nowe paragony", isOn: $wallet.settings.shareNewReceiptsWithFamily)
                    Button {
                        Task { await invite() }
                    } label: {
                        if isPreparingShare {
                            ProgressView()
                        } else {
                            Label("Zaproś bliskich", systemImage: "person.badge.plus")
                        }
                    }
                }
            } header: {
                Text("Rodzina")
            } footer: {
                Text("Kaucje i paragony udostępniasz osobno — te same przełączniki są w Ustawieniach. Zaproszenie jest jedno.")
            }

            if wallet.family.members.isEmpty == false || wallet.settings.displayName.isEmpty == false {
                Section("Członkowie") {
                    if wallet.family.members.isEmpty {
                        LabeledContent(wallet.settings.displayName) {
                            Text("To urządzenie")
                                .foregroundStyle(.secondary)
                        }
                    }
                    ForEach(wallet.family.members) { member in
                        LabeledContent(member.name) {
                            Text(member.isOwner ? "Właściciel" : "Członek")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Rodzina")
        .task {
            await wallet.family.refreshAccountStatus()
            await wallet.family.refreshParticipants()
        }
        .sheet(isPresented: $showShareSheet) {
            if let share = shareToPresent {
                CloudSharingView(
                    share: share,
                    container: CKContainer(identifier: Brand.iCloudContainer),
                    onDismiss: {
                        showShareSheet = false
                        shareToPresent = nil
                    }
                )
            }
        }
    }

    private func invite() async {
        isPreparingShare = true
        defer { isPreparingShare = false }
        do {
            let share = try await wallet.family.prepareShare(displayName: wallet.settings.displayName)
            shareToPresent = share
            showShareSheet = true
            await wallet.family.refreshParticipants()
        } catch {
            wallet.family.statusMessage = error.localizedDescription
        }
    }
}

