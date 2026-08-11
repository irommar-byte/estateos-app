import Foundation

struct GoogleDriveItem: Identifiable, Hashable {
    let id: String
    let name: String
    let isFolder: Bool
    let mimeType: String?
    let size: Int64?
}

enum GoogleDriveClientError: LocalizedError {
    case unauthorized
    case server(String)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Sesja Google wygasła — zaloguj się ponownie."
        case .server(let msg): return msg
        }
    }
}

struct GoogleDriveClient {
    let accessToken: String

    private static let downloadSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 600
        config.waitsForConnectivity = true
        return URLSession(configuration: config)
    }()

    func listChildren(folderId: String) async throws -> [GoogleDriveItem] {
        let q = "'\(folderId)' in parents and trashed=false"
        let encoded = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q
        let url = URL(string: "https://www.googleapis.com/drive/v3/files?q=\(encoded)&fields=files(id,name,mimeType,size)&pageSize=200&orderBy=folder,name")!
        return try await fetchFiles(url: url)
    }

    func listRootFolders() async throws -> [GoogleDriveItem] {
        try await listChildren(folderId: "root")
            .filter(\.isFolder)
    }

    func collectAudioFiles(folderId: String) async throws -> [GoogleDriveItem] {
        var results: [GoogleDriveItem] = []
        try await collectAudio(folderId: folderId, into: &results)
        return results
    }

    func downloadTemporaryFile(fileId: String, filename: String) async throws -> URL {
        var request = URLRequest(url: URL(string: "https://www.googleapis.com/drive/v3/files/\(fileId)?alt=media")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 180
        let (tempURL, response) = try await Self.downloadSession.download(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw GoogleDriveClientError.server("Brak odpowiedzi Google Drive.")
        }
        if http.statusCode == 401 { throw GoogleDriveClientError.unauthorized }
        guard http.statusCode < 400 else {
            throw GoogleDriveClientError.server("Nie udało się pobrać pliku z Google Drive.")
        }
        let safeName = filename.replacingOccurrences(of: "/", with: "_")
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "_" + safeName)
        if FileManager.default.fileExists(atPath: dest.path) {
            try FileManager.default.removeItem(at: dest)
        }
        try FileManager.default.moveItem(at: tempURL, to: dest)
        return dest
    }

    private func collectAudio(folderId: String, into results: inout [GoogleDriveItem]) async throws {
        let items = try await listChildren(folderId: folderId)
        for item in items {
            if item.isFolder {
                try await collectAudio(folderId: item.id, into: &results)
            } else if isAudioFileName(item.name) {
                results.append(item)
            }
        }
    }

    private func fetchFiles(url: URL) async throws -> [GoogleDriveItem] {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw GoogleDriveClientError.server("Brak odpowiedzi Google Drive.")
        }
        if http.statusCode == 401 { throw GoogleDriveClientError.unauthorized }
        if http.statusCode >= 400 { throw GoogleDriveClientError.server("Google Drive błąd \(http.statusCode).") }

        struct Response: Decodable {
            struct File: Decodable {
                let id: String
                let name: String
                let mimeType: String?
                let size: String?
            }
            let files: [File]
        }
        let decoded = try JSONDecoder().decode(Response.self, from: data)
        return decoded.files.map { file in
            let isFolder = file.mimeType == "application/vnd.google-apps.folder"
            return GoogleDriveItem(
                id: file.id,
                name: file.name,
                isFolder: isFolder,
                mimeType: file.mimeType,
                size: file.size.flatMap(Int64.init)
            )
        }
    }
}
