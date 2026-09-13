import CloudKit
import SwiftUI
import UIKit

struct CloudSharingView: UIViewControllerRepresentable {
    let share: CKShare
    let container: CKContainer
    var onShareChanged: () -> Void = {}
    var onDismiss: () -> Void

    func makeUIViewController(context: Context) -> UICloudSharingController {
        let controller = UICloudSharingController(share: share, container: container)
        controller.delegate = context.coordinator
        controller.availablePermissions = [.allowReadWrite, .allowPrivate]
        return controller
    }

    func updateUIViewController(_ uiViewController: UICloudSharingController, context: Context) {
        context.coordinator.onShareChanged = onShareChanged
        context.coordinator.onDismiss = onDismiss
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onShareChanged: onShareChanged, onDismiss: onDismiss)
    }

    final class Coordinator: NSObject, UICloudSharingControllerDelegate {
        var onShareChanged: () -> Void
        var onDismiss: () -> Void

        init(onShareChanged: @escaping () -> Void, onDismiss: @escaping () -> Void) {
            self.onShareChanged = onShareChanged
            self.onDismiss = onDismiss
        }

        func cloudSharingControllerDidSaveShare(_ csc: UICloudSharingController) {
            onShareChanged()
        }

        func cloudSharingControllerDidStopSharing(_ csc: UICloudSharingController) {
            onDismiss()
        }

        func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {
            onDismiss()
        }

        func itemTitle(for csc: UICloudSharingController) -> String? {
            Brand.displayName
        }

        func itemThumbnailData(for csc: UICloudSharingController) -> Data? {
            ParagonMark.png(size: 120)
        }
    }
}
