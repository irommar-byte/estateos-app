import Foundation

/// Decisions for how Apple TV should fetch media. Kept free of UI so unit tests can cover them.
enum TVMediaPolicy {
    /// WebDAV + AVPlayer on tvOS routinely fails TLS/Basic-auth streaming. Download to disk first.
    static func prefersDownloadFirst(transport: CatalogTransport?) -> Bool {
        transport is WebDAVTransport
    }

    /// How many recent items to warm after a successful catalog pull.
    static let warmThumbCount = 40

    /// Seconds to wait on a streaming AVPlayer item before falling back to a full download.
    static let streamFailSeconds: TimeInterval = 20
}
