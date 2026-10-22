import Citadel
import Foundation
import NIO

final class SFTPTransport: CatalogTransport {
    let host: String
    let port: Int
    let username: String
    let password: String
    let directory: String
    private var client: SSHClient?
    private var sftp: SFTPClient?

    init(host: String, port: Int, username: String, password: String, directory: String) {
        self.host = host
        self.port = port == 0 ? 22 : port
        self.username = username
        self.password = password
        self.directory = directory.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    func open() async throws {
        if sftp != nil { return }
        let user = username
        let pass = password
        let settings = SSHClientSettings(
            host: host,
            port: port,
            authenticationMethod: { .passwordBased(username: user, password: pass) },
            hostKeyValidator: .acceptAnything()
        )
        let client = try await SSHClient.connect(to: settings)
        let sftp = try await client.openSFTP()
        self.client = client
        self.sftp = sftp
        if !directory.isEmpty {
            try await ensure(directory)
        }
    }

    func close() async {
        try? await sftp?.close()
        try? await client?.close()
        sftp = nil
        client = nil
    }

    func writeFile(_ relative: String, from local: URL) async throws {
        let expected = (try FileManager.default.attributesOfItem(atPath: local.path)[.size] as? NSNumber)?.intValue ?? 0
        guard expected > 0 else { throw LibraryError(message: L("Pusty plik nie został wysłany.")) }
        let remote = try remotePath(relative)
        let partial = remote + ".part"
        try await ensureParents(remote)
        let session = try await ready()
        do {
            try await session.withFile(filePath: partial, flags: [.write, .create, .truncate]) { file in
                let handle = try FileHandle(forReadingFrom: local)
                defer { try? handle.close() }
                var offset: UInt64 = 0
                while true {
                    let chunk = try handle.chunk(256 * 1024)
                    if chunk.isEmpty { break }
                    try await file.write(ByteBuffer(bytes: chunk), at: offset)
                    offset += UInt64(chunk.count)
                }
            }
            let stored = try await session.getAttributes(at: partial).size.map { Int($0) } ?? -1
            guard stored == expected else {
                try? await session.remove(at: partial)
                throw LibraryError(message: L("Serwer zapisał niepełny plik."))
            }
            if (try? await session.getAttributes(at: remote)) != nil {
                try? await session.remove(at: remote)
            }
            try await session.rename(at: partial, to: remote)
        } catch {
            try? await session.remove(at: partial)
            throw error
        }
    }

    func readFile(_ relative: String) async throws -> Data {
        let remote = try remotePath(relative)
        let session = try await ready()
        let buffer = try await session.withFile(filePath: remote, flags: [.read]) { file in
            try await file.readAll()
        }
        return Data(buffer.readableBytesView)
    }

    func list(_ relative: String) async throws -> [String] {
        let remote = try remotePath(relative)
        let session = try await ready()
        do {
            let entries = try await session.listDirectory(atPath: remote)
            return entries
                .flatMap { $0.components.map(\.filename) }
                .filter { $0 != "." && $0 != ".." && !$0.isEmpty }
        } catch {
            return []
        }
    }

    func exists(_ relative: String) async throws -> Bool {
        if let count = try await byteCount(relative) { return count >= 0 }
        return false
    }

    func byteCount(_ relative: String) async throws -> Int? {
        let remote = try remotePath(relative)
        let session = try await ready()
        guard let attributes = try? await session.getAttributes(at: remote) else { return nil }
        return attributes.size.map { Int($0) }
    }

    func removeFile(_ relative: String) async throws {
        let remote = try remotePath(relative)
        let session = try await ready()
        try? await session.remove(at: remote)
    }

    private func ready() async throws -> SFTPClient {
        try await open()
        guard let sftp else { throw LibraryError(message: L("Nie udało się połączyć przez SFTP.")) }
        return sftp
    }

    private func remotePath(_ relative: String) throws -> String {
        guard let safe = CatalogPath.safe(relative) else {
            throw LibraryError(message: L("Nieprawidłowa ścieżka biblioteki."))
        }
        if directory.isEmpty { return safe }
        return directory + "/" + safe
    }

    private func ensureParents(_ remote: String) async throws {
        let parts = remote.split(separator: "/").map(String.init).dropLast()
        var path = ""
        for part in parts {
            path = path.isEmpty ? part : path + "/" + part
            try await ensure(path)
        }
    }

    private func ensure(_ path: String) async throws {
        let session = try await ready()
        if (try? await session.getAttributes(at: path)) != nil { return }
        try? await session.createDirectory(atPath: path)
    }
}
