import Foundation

/// Stabilny identyfikator utworu z iCloud / Drive / WebDAV w bibliotece serwera.
enum ExternalTrackReference {
    struct Parsed {
        let sourceId: UUID
        let relativePath: String?
        let webDAVPath: String?
        let googleDriveFileId: String?
    }

    static func libraryURL(
        sourceId: UUID,
        relativePath: String? = nil,
        webDAVPath: String? = nil,
        googleDriveFileId: String? = nil
    ) -> String {
        var components = URLComponents()
        components.scheme = "eosmusic"
        components.host = "external"
        components.path = "/\(sourceId.uuidString)"

        if let googleDriveFileId, !googleDriveFileId.isEmpty {
            components.path += "/gdrive/\(googleDriveFileId)"
        } else if let webDAVPath, !webDAVPath.isEmpty {
            components.path += "/webdav/\(percentEncodePath(webDAVPath))"
        } else if let relativePath, !relativePath.isEmpty {
            components.path += "/file/\(percentEncodePath(relativePath))"
        }

        return components.url?.absoluteString ?? "eosmusic://external/\(sourceId.uuidString)"
    }

    static func parse(_ url: String) -> Parsed? {
        guard let components = URLComponents(string: url),
              components.scheme?.lowercased() == "eosmusic",
              components.host?.lowercased() == "external" else {
            return nil
        }

        let parts = components.path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        guard let sourceRaw = parts.first, let sourceId = UUID(uuidString: sourceRaw) else { return nil }

        if parts.count >= 3, parts[1] == "gdrive" {
            return Parsed(sourceId: sourceId, relativePath: nil, webDAVPath: nil, googleDriveFileId: parts[2])
        }
        if parts.count >= 3, parts[1] == "webdav" {
            let encoded = parts.dropFirst(2).joined(separator: "/")
            return Parsed(
                sourceId: sourceId,
                relativePath: nil,
                webDAVPath: percentDecodePath(encoded),
                googleDriveFileId: nil
            )
        }
        if parts.count >= 3, parts[1] == "file" {
            let encoded = parts.dropFirst(2).joined(separator: "/")
            return Parsed(
                sourceId: sourceId,
                relativePath: percentDecodePath(encoded),
                webDAVPath: nil,
                googleDriveFileId: nil
            )
        }

        return Parsed(sourceId: sourceId, relativePath: nil, webDAVPath: nil, googleDriveFileId: nil)
    }

    static func isLibraryURL(_ url: String) -> Bool {
        parse(url) != nil
    }

    private static func percentEncodePath(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.union(.urlQueryAllowed)) ?? value
    }

    private static func percentDecodePath(_ value: String) -> String {
        value.removingPercentEncoding ?? value
    }
}
