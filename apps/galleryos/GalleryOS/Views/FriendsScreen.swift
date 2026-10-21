import CloudKit
import SwiftUI
import UIKit

struct FriendsScreen: View {
    @StateObject private var model = GalleryShareModel()

    var body: some View {
        List {
            Section {
                Text("Album zostaje na Twoim serwerze. Znajomy dostaje zaproszenie na swoje Apple ID i widzi ten album. Hasła do NAS nie dostaje.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Section {
                Button {
                    Task { await model.shareLibrary() }
                } label: {
                    Label("Udostępnij bibliotekę", systemImage: "person.crop.circle.badge.plus")
                }
                .disabled(model.busy)
            }
            if !model.titles.isEmpty {
                Section("Udostępnione") {
                    ForEach(model.titles, id: \.self) { title in
                        Text(title)
                    }
                }
            }
            if !model.message.isEmpty {
                Section {
                    Text(model.message)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Znajomi")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.reload() }
        .sheet(item: $model.invitation) { invitation in
            CloudShareSheet(share: invitation.share, container: invitation.container)
        }
    }
}

struct ShareInvitation: Identifiable {
    let id = UUID()
    let share: CKShare
    let container: CKContainer
}

@MainActor
final class GalleryShareModel: ObservableObject {
    static let containerID = "iCloud.pl.galleryos.app"
    @Published var titles: [String] = []
    @Published var message = ""
    @Published var busy = false
    @Published var invitation: ShareInvitation?

    func reload() async {
        let container = CKContainer(identifier: Self.containerID)
        var found: [String] = []
        for database in [container.privateCloudDatabase, container.sharedCloudDatabase] {
            let query = CKQuery(recordType: "GalleryAlbum", predicate: NSPredicate(value: true))
            if let (rows, _) = try? await database.records(matching: query, resultsLimit: 40) {
                for (_, result) in rows {
                    if case .success(let record) = result, let title = record["title"] as? String, !title.isEmpty {
                        found.append(title)
                    }
                }
            }
        }
        titles = Array(Set(found)).sorted()
    }

    func shareLibrary() async {
        message = ""
        busy = true
        defer { busy = false }
        let container = CKContainer(identifier: Self.containerID)
        do {
            let status = try await container.accountStatus()
            guard status == .available else {
                message = "Włącz iCloud, żeby zaprosić kogoś na jego Apple ID."
                return
            }
            let album = CKRecord(recordType: "GalleryAlbum")
            album["title"] = "Biblioteka GalleryOS" as CKRecordValue
            let share = CKShare(rootRecord: album)
            share[CKShare.SystemFieldKey.title] = "Biblioteka GalleryOS" as CKRecordValue
            share.publicPermission = .none
            _ = try await container.privateCloudDatabase.modifyRecords(saving: [album, share], deleting: [])
            invitation = ShareInvitation(share: share, container: container)
            await reload()
        } catch {
            message = "Nie udało się przygotować zaproszenia. iCloud dla GalleryOS musi być włączony na tym Apple ID."
        }
    }
}

struct CloudShareSheet: UIViewControllerRepresentable {
    let share: CKShare
    let container: CKContainer

    func makeUIViewController(context: Context) -> UICloudSharingController {
        let controller = UICloudSharingController(share: share, container: container)
        controller.availablePermissions = [.allowReadOnly, .allowPrivate]
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: UICloudSharingController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, UICloudSharingControllerDelegate {
        func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {}

        func itemTitle(for csc: UICloudSharingController) -> String? {
            "Biblioteka GalleryOS"
        }
    }
}
