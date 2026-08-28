import SwiftUI
import UniformTypeIdentifiers
import UIKit
import ObjectiveC

/// Folder picker that actually allows selecting directories on iOS.
/// SwiftUI `.fileImporter` with `.folder` often only highlights files (copy mode).
struct FolderDocumentPicker: UIViewControllerRepresentable {
    var onPick: (URL) -> Void
    var onCancel: (() -> Void)? = nil

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick, onCancel: onCancel)
    }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.folder],
            asCopy: false
        )
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        picker.shouldShowFileExtensions = true
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {
        context.coordinator.onPick = onPick
        context.coordinator.onCancel = onCancel
    }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        var onPick: (URL) -> Void
        var onCancel: (() -> Void)?

        init(onPick: @escaping (URL) -> Void, onCancel: (() -> Void)?) {
            self.onPick = onPick
            self.onCancel = onCancel
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else {
                onCancel?()
                return
            }
            onPick(url)
        }

        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onCancel?()
        }
    }
}

/// Presents the system folder picker from the top view controller.
/// Prefer this over nesting another SwiftUI sheet inside an existing sheet.
enum FolderPickerPresenter {
    @MainActor
    static func present(onPick: @escaping (URL) -> Void, onCancel: (() -> Void)? = nil) {
        let picker = UIDocumentPickerViewController(
            forOpeningContentTypes: [.folder],
            asCopy: false
        )
        picker.allowsMultipleSelection = false
        picker.shouldShowFileExtensions = true

        let coordinator = FolderPickerCoordinator(onPick: onPick, onCancel: onCancel)
        picker.delegate = coordinator
        // Retain coordinator for the lifetime of the picker.
        objc_setAssociatedObject(
            picker,
            &FolderPickerCoordinator.assocKey,
            coordinator,
            .OBJC_ASSOCIATION_RETAIN_NONATOMIC
        )

        guard let host = topViewController() else {
            onCancel?()
            return
        }
        host.present(picker, animated: true)
    }

    @MainActor
    private static func topViewController(base: UIViewController? = nil) -> UIViewController? {
        let root = base ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
        if let nav = root as? UINavigationController {
            return topViewController(base: nav.visibleViewController)
        }
        if let tab = root as? UITabBarController {
            return topViewController(base: tab.selectedViewController)
        }
        if let presented = root?.presentedViewController {
            return topViewController(base: presented)
        }
        return root
    }
}

private final class FolderPickerCoordinator: NSObject, UIDocumentPickerDelegate {
    static var assocKey: UInt8 = 0

    let onPick: (URL) -> Void
    let onCancel: (() -> Void)?

    init(onPick: @escaping (URL) -> Void, onCancel: (() -> Void)?) {
        self.onPick = onPick
        self.onCancel = onCancel
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else {
            onCancel?()
            return
        }
        onPick(url)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        onCancel?()
    }
}
