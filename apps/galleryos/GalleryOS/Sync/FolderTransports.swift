import Foundation

protocol CatalogTransport: AnyObject {
    func open() async throws
    func close() async
    func writeFile(_ relative: String, from local: URL) async throws
    func readFile(_ relative: String) async throws -> Data
    func list(_ relative: String) async throws -> [String]
    func exists(_ relative: String) async throws -> Bool
    /// Byte size of a stored file, or nil when the path is absent. A short file is not “present”.
    func byteCount(_ relative: String) async throws -> Int?
    func removeFile(_ relative: String) async throws
}

extension CatalogTransport {
    func open() async throws {}
    func close() async {}
    func byteCount(_ relative: String) async throws -> Int? { nil }
    func removeFile(_ relative: String) async throws {}
}

enum CatalogPath {
    static func safe(_ relative: String) -> String? {
        let parts = relative.split(separator: "/").map(String.init)
        guard !parts.isEmpty, parts.allSatisfy({ $0 != "." && $0 != ".." && !$0.isEmpty }) else { return nil }
        return parts.joined(separator: "/")
    }
}

final class FolderTransport: CatalogTransport {
    private let root: URL
    private var accessing = false

    init(root: URL) {
        self.root = root
    }

    static func resolve(bookmark data: Data) throws -> FolderTransport {
        var stale = false
        let url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
        guard url.startAccessingSecurityScopedResource() else {
            throw LibraryError(message: L("Dysk odpięty"))
        }
        let transport = FolderTransport(root: url)
        transport.accessing = true
        return transport
    }

    func open() async throws {
        try FileManager.default.createDirectory(
            at: root.appendingPathComponent(CatalogPaths.root, isDirectory: true),
            withIntermediateDirectories: true
        )
    }

    func close() async {
        if accessing {
            root.stopAccessingSecurityScopedResource()
            accessing = false
        }
    }

    func writeFile(_ relative: String, from local: URL) async throws {
        let destination = try file(relative)
        let temporary = destination.appendingPathExtension("part")
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: temporary.path) {
            try FileManager.default.removeItem(at: temporary)
        }
        try FileManager.default.copyItem(at: local, to: temporary)
        let expected = (try FileManager.default.attributesOfItem(atPath: local.path)[.size] as? NSNumber)?.intValue ?? 0
        let stored = (try FileManager.default.attributesOfItem(atPath: temporary.path)[.size] as? NSNumber)?.intValue ?? -1
        guard expected > 0, stored == expected else {
            try? FileManager.default.removeItem(at: temporary)
            throw LibraryError(message: L("Zapis na dysku urwał się w połowie."))
        }
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporary, to: destination)
    }

    func readFile(_ relative: String) async throws -> Data {
        try Data(contentsOf: try file(relative))
    }

    /// Where a catalog file sits on the folder (for playing a film straight from a pendrive).
    func localURL(_ relative: String) -> URL? {
        try? file(relative)
    }

    func list(_ relative: String) async throws -> [String] {
        let folder = try file(relative)
        guard FileManager.default.fileExists(atPath: folder.path) else { return [] }
        return try FileManager.default.contentsOfDirectory(atPath: folder.path)
    }

    func exists(_ relative: String) async throws -> Bool {
        FileManager.default.fileExists(atPath: try file(relative).path)
    }

    func byteCount(_ relative: String) async throws -> Int? {
        let url = try file(relative)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue
    }

    func removeFile(_ relative: String) async throws {
        let url = try file(relative)
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }

    private func file(_ relative: String) throws -> URL {
        guard let safe = CatalogPath.safe(relative) else {
            throw LibraryError(message: L("Nieprawidłowa ścieżka biblioteki."))
        }
        return root.appendingPathComponent(safe)
    }
}

struct WebDAVLink {
    var transport: WebDAVTransport
    var host: String
    var port: Int
    var directory: String
    var atHome: Bool
    var message: String
}

struct WebEntry: Identifiable, Hashable {
    var name: String
    var isDirectory: Bool
    var id: String { name }
}

final class WebDAVTransport: CatalogTransport {
    let baseURL: URL
    let username: String
    let password: String

    init(baseURL: URL, username: String, password: String) {
        self.baseURL = baseURL
        self.username = username
        self.password = password
    }

    static let knownPorts: [(String, Int)] = [
        ("https", 5001), ("https", 443), ("https", 8443), ("https", 5006),
        ("https", 8081), ("http", 8080), ("http", 5000), ("http", 80)
    ]

    static func open(
        remoteHost: String,
        localHost: String,
        localPort: Int,
        localName: String,
        forcedPort: Int,
        username: String,
        password: String,
        directory: String
    ) async throws -> WebDAVLink {
        let remote = Self.cleanHost(remoteHost)
        let local = Self.cleanHost(localHost)
        if remote.isEmpty && local.isEmpty {
            throw LibraryError(message: L("Wpisz adres serwera."))
        }
        var sawAuth = false
        if !local.isEmpty {
            GalleryNetwork.shared.trust(local)
            let found = await race(
                host: local,
                attempts: Self.attempts(forced: localPort > 0 ? localPort : forcedPort),
                timeout: 2,
                username: username,
                password: password
            )
            sawAuth = sawAuth || found.auth
            if let transport = found.transport {
                let placed = try await place(on: transport, directory: directory, username: username)
                let title = localName.isEmpty ? local : localName
                return WebDAVLink(
                    transport: placed.transport,
                    host: local,
                    port: found.port,
                    directory: placed.directory,
                    atHome: true,
                    message: L("Połączono w domu z \(title).")
                )
            }
        }
        guard !remote.isEmpty else {
            if sawAuth { throw LibraryError(message: L("Błędny login lub hasło.")) }
            throw LibraryError(message: L("Na tym adresie nie ma WebDAV. W QNAP włącz WebDAV i przekierowanie portu 5001 w myQNAPcloud."))
        }
        GalleryNetwork.shared.trust(remote)
        // The remembered port races alongside the usual QNAP ports instead of going first,
        // so a stale or unforwarded port never costs a full timeout.
        // Over the internet HTTPS goes first: the password must not travel in plain HTTP when
        // the NAS also answers on 5000/8080. Plain ports are tried only when no secure one opens.
        let all = Self.attempts(forced: forcedPort)
        let secure = all.filter { $0.0 == "https" }
        let plainForced = forcedPort > 0 && !ConnectionURL.securePorts.contains(forcedPort)
        var found = await race(
            host: remote,
            attempts: plainForced ? all : secure,
            timeout: 10,
            username: username,
            password: password
        )
        if found.transport == nil, !found.auth, !plainForced {
            let plain = all.filter { $0.0 == "http" }
            let second = await race(host: remote, attempts: plain, timeout: 8, username: username, password: password)
            if second.transport != nil || second.auth { found = second }
        }
        sawAuth = sawAuth || found.auth
        if let transport = found.transport {
            let placed = try await place(on: transport, directory: directory, username: username)
            return WebDAVLink(
                transport: placed.transport,
                host: remote,
                port: found.port,
                directory: placed.directory,
                atHome: false,
                message: L("Połączono zdalnie z \(remote).")
            )
        }
        if sawAuth {
            throw LibraryError(message: L("Błędny login lub hasło."))
        }
        let portText = forcedPort > 0 ? "\(forcedPort)" : "5001"
        throw LibraryError(message: L("Nie udało się otworzyć WebDAV na porcie \(portText). Zostaw ten port i udział Public, hasło wpisz w polu Hasło i stuknij Włącz jeszcze raz."))
    }

    private static func attempts(forced: Int) -> [(String, Int)] {
        var list = knownPorts
        if forced > 0 {
            list.insert(("http", forced), at: 0)
            list.insert(("https", forced), at: 0)
        }
        var seen = Set<String>()
        return list.filter { pair in
            let key = "\(pair.0):\(pair.1)"
            return seen.insert(key).inserted
        }
    }

    private static func cleanHost(_ host: String) -> String {
        var name = host
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if let colon = name.lastIndex(of: ":"), name[name.index(after: colon)...].allSatisfy(\.isNumber) {
            name = String(name[..<colon])
        }
        return name
    }

    private static func race(
        host: String,
        attempts: [(String, Int)],
        timeout: TimeInterval,
        username: String,
        password: String
    ) async -> (transport: WebDAVTransport?, port: Int, auth: Bool, timedOut: Bool) {
        if let explicit = URL(string: host), explicit.scheme == "http" || explicit.scheme == "https" {
            GalleryNetwork.shared.trust(explicit.host ?? host)
            let transport = WebDAVTransport(baseURL: explicit, username: username, password: password)
            if (try? await transport.propfind("", timeout: timeout, requireDAV: true)) != nil {
                return (transport, explicit.port ?? 443, false, false)
            }
        }
        let box = ProbeBox()
        await withTaskGroup(of: (WebDAVTransport, Int)?.self) { group in
            for (scheme, port) in attempts {
                group.addTask {
                    do {
                        let transport = try await probe(
                            scheme: scheme,
                            port: port,
                            name: host,
                            username: username,
                            password: password,
                            timeout: timeout
                        )
                        return (transport, port)
                    } catch {
                        box.note(error)
                        return nil
                    }
                }
            }
            for await item in group {
                if let item {
                    box.found = item.0
                    box.port = item.1
                    group.cancelAll()
                    break
                }
            }
        }
        return (box.found, box.port, box.sawAuth, box.sawTimeout)
    }

    /// One library, on the Public share. An empty share name used to probe Multimedia
    /// first and create a second GalleryOS folder there.
    private static func place(on root: WebDAVTransport, directory: String, username: String) async throws -> (transport: WebDAVTransport, directory: String) {
        _ = username
        let requested = directory.trimmingCharacters(in: .whitespacesAndNewlines)
        let share = (requested.isEmpty || requested.caseInsensitiveCompare("Multimedia") == .orderedSame) // l10n:skip
            ? "Public" // l10n:skip
            : requested
        let child = WebDAVTransport(
            baseURL: shareURL(root.baseURL, path: share),
            username: root.username,
            password: root.password
        )
        if await child.acceptsLibrary() {
            return (child, share)
        }
        throw LibraryError(message: L("Konto nie może zapisać folderu na QNAP. Nadaj mu prawo zapisu do \(share)."))
    }

    private static func shareURL(_ root: URL, path: String) -> URL {
        path.split(separator: "/").map(String.init).reduce(root) {
            $0.appendingPathComponent($1, isDirectory: true)
        }
    }

    private static func probe(scheme: String, port: Int, name: String, username: String, password: String, timeout: TimeInterval) async throws -> WebDAVTransport {
        guard let url = URL(string: "\(scheme)://\(name):\(port)") else {
            throw LibraryError(message: L("Nie udało się połączyć z QNAP."))
        }
        let transport = WebDAVTransport(baseURL: url, username: username, password: password)
        _ = try await transport.propfind("", timeout: timeout, requireDAV: true)
        return transport
    }

    func writeFile(_ relative: String, from local: URL) async throws {
        let expected = (try FileManager.default.attributesOfItem(atPath: local.path)[.size] as? NSNumber)?.intValue ?? 0
        guard expected > 0 else { throw LibraryError(message: L("Pusty plik nie został wysłany.")) }
        let partial = relative + ".part"
        do {
            try await put(partial, from: local)
            let stored = try await byteCount(partial)
            guard stored == expected else {
                try? await removeFile(partial)
                throw LibraryError(message: L("Serwer zapisał niepełny plik."))
            }
            try await replace(partial, with: relative, from: local, expected: expected)
        } catch {
            try? await removeFile(partial)
            throw error
        }
    }

    private func put(_ relative: String, from local: URL) async throws {
        try await makeParents(relative)
        var request = URLRequest(url: try url(relative))
        request.httpMethod = "PUT"
        // Idle limit, not a total: a link that moves no bytes for 90 s is reopened.
        request.timeoutInterval = 90
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        let (data, response) = try await GalleryNetwork.shared.upload(for: request, fromFile: local)
        try throwIfNeeded(response, data: data)
    }

    /// Publishes a finished upload over the real name. A leftover short file at that name is replaced.
    private func replace(_ partial: String, with relative: String, from local: URL, expected: Int) async throws {
        var request = URLRequest(url: try url(partial))
        request.httpMethod = "MOVE"
        request.timeoutInterval = 30
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.setValue(try url(relative).absoluteString, forHTTPHeaderField: "Destination")
        request.setValue("T", forHTTPHeaderField: "Overwrite")
        let (_, response) = try await GalleryNetwork.shared.data(for: request)
        if let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) { return }
        try? await removeFile(relative)
        try await put(relative, from: local)
        guard try await byteCount(relative) == expected else {
            try? await removeFile(relative)
            throw LibraryError(message: L("Serwer zapisał niepełny plik."))
        }
    }

    func readFile(_ relative: String) async throws -> Data {
        var request = URLRequest(url: try url(relative))
        request.timeoutInterval = 60 * 20
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        try throwIfNeeded(response, data: data)
        return data
    }

    func availableBytes() async -> Int64? {
        if let quota = await quotaBytes(at: baseURL) { return quota }
        let parent = baseURL.deletingLastPathComponent()
        if parent != baseURL, let quota = await quotaBytes(at: parent) { return quota }
        return await qnapFreeBytes()
    }

    private func quotaBytes(at url: URL) async -> Int64? {
        var request = URLRequest(url: url)
        request.httpMethod = "PROPFIND"
        request.timeoutInterval = 8
        request.setValue("0", forHTTPHeaderField: "Depth")
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.httpBody = Data("<?xml version=\"1.0\" encoding=\"utf-8\"?><D:propfind xmlns:D=\"DAV:\"><D:prop><D:quota-available-bytes/><D:quota-used-bytes/></D:prop></D:propfind>".utf8)
        guard let (data, _) = try? await GalleryNetwork.shared.data(for: request) else { return nil }
        let text = String(decoding: data, as: UTF8.self)
        guard let regex = try? NSRegularExpression(pattern: "quota-available-bytes[^>]*>\\s*([0-9]+)", options: .caseInsensitive) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range), let span = Range(match.range(at: 1), in: text) else { return nil }
        return Int64(text[span])
    }

    /// QNAP leaves the WebDAV quota empty. The volume list on the admin port has the real free space.
    private func qnapFreeBytes() async -> Int64? {
        guard let host = baseURL.host, !host.isEmpty else { return nil }
        GalleryNetwork.shared.trust(host)
        let encoded = username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? username
        let secret = Data(password.utf8).base64EncodedString()
        // The admin service answers on 8080/443 by default, but often only the WebDAV port is
        // forwarded or changed, so that port is asked first.
        var doors: [(String, Int)] = []
        if let scheme = baseURL.scheme, let port = baseURL.port { doors.append((scheme, port)) }
        doors += [("http", 8080), ("https", 443), ("https", 8443), ("https", 5001), ("http", 5000)]
        var seenDoors = Set<String>()
        doors = doors.filter { seenDoors.insert("\($0.0):\($0.1)").inserted }
        for (scheme, port) in doors {
            guard let login = URL(string: "\(scheme)://\(host):\(port)/cgi-bin/authLogin.cgi") else { continue }
            var request = URLRequest(url: login)
            request.httpMethod = "POST"
            request.timeoutInterval = 5
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            request.httpBody = "user=\(encoded)&pwd=\(secret)".data(using: .utf8)
            guard let (data, response) = try? await GalleryNetwork.shared.data(for: request),
                  let http = response as? HTTPURLResponse, http.statusCode < 400,
                  let xml = String(data: data, encoding: .utf8),
                  xml.contains("<authPassed>1</authPassed>"),
                  let sid = Self.xmlValue("authSid", in: xml) else { continue }
            if let free = await qnapVolumeFree(scheme: scheme, host: host, port: port, sid: sid) {
                return free
            }
            if let free = await qnapSystemFree(scheme: scheme, host: host, port: port, sid: sid) {
                return free
            }
        }
        return nil
    }

    private func qnapVolumeFree(scheme: String, host: String, port: Int, sid: String) async -> Int64? {
        guard let url = URL(string: "\(scheme)://\(host):\(port)/cgi-bin/filemanager/utilRequest.cgi?func=volume_list&sid=\(sid)") else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 6
        guard let (data, _) = try? await GalleryNetwork.shared.data(for: request),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let rows = (json["datas"] as? [[String: Any]]) ?? (json["result"] as? [[String: Any]]) ?? []
        var total: Int64 = 0
        for row in rows {
            let raw = row["free_size"] ?? row["freeSize"] ?? row["freesize"]
            guard let number = Self.byteCount(raw) else { continue }
            total += number
        }
        return total > 0 ? total : nil
    }

    /// System information (the same source as QTS Storage & Snapshots): `<freesize>` per volume.
    private func qnapSystemFree(scheme: String, host: String, port: Int, sid: String) async -> Int64? {
        guard let url = URL(string: "\(scheme)://\(host):\(port)/cgi-bin/management/manaRequest.cgi?subfunc=sysinfo&hd=no&multicpu=1&sid=\(sid)") else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 6
        guard let (data, _) = try? await GalleryNetwork.shared.data(for: request),
              let xml = String(data: data, encoding: .utf8),
              let regex = try? NSRegularExpression(pattern: "<freesize>\\s*(?:<!\\[CDATA\\[)?\\s*([0-9]+)", options: .caseInsensitive) else { return nil }
        var total: Int64 = 0
        for match in regex.matches(in: xml, range: NSRange(xml.startIndex..., in: xml)) {
            guard let span = Range(match.range(at: 1), in: xml), let value = Int64(xml[span]) else { continue }
            total += value
        }
        return total > 0 ? total : nil
    }

    private static func byteCount(_ raw: Any?) -> Int64? {
        let number: Int64?
        if let value = raw as? Int64 { number = value }
        else if let value = raw as? Int { number = Int64(value) }
        else if let value = raw as? NSNumber { number = value.int64Value }
        else if let value = raw as? String { number = Int64(value.filter(\.isNumber)) }
        else { number = nil }
        guard let number, number > 0 else { return nil }
        // A figure under 1 GB is the volume size in megabytes, not bytes.
        if number < 1_048_576 { return number * 1024 * 1024 }
        return number
    }

    private static func xmlValue(_ tag: String, in xml: String) -> String? {
        guard let start = xml.range(of: "<\(tag)>"), let end = xml.range(of: "</\(tag)>", range: start.upperBound..<xml.endIndex) else { return nil }
        let value = xml[start.upperBound..<end.lowerBound].trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    func children(_ relative: String) async throws -> [WebEntry] {
        let data = try await propfindData(relative)
        return Self.entries(in: data, current: relative)
    }

    func shareChoices() async -> [String] {
        let parent = baseURL.deletingLastPathComponent()
        let root = parent == baseURL ? self : WebDAVTransport(baseURL: parent, username: username, password: password)
        let found = (try? await root.children("")) ?? []
        let folders = found.filter(\.isDirectory).map(\.name).filter { !$0.hasPrefix(".") }
        if !folders.isEmpty {
            return folders.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        }
        return ((try? await root.list("")) ?? []).sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    func list(_ relative: String) async throws -> [String] {
        try await propfind(relative, timeout: 20, requireDAV: false)
    }

    func propfind(_ relative: String, timeout: TimeInterval, requireDAV: Bool) async throws -> [String] {
        Self.names(in: try await propfindData(relative, timeout: timeout, requireDAV: requireDAV), current: relative)
    }

    private func propfindData(_ relative: String, timeout: TimeInterval = 20, requireDAV: Bool = false) async throws -> Data {
        var request = URLRequest(url: try url(relative, directory: true))
        request.httpMethod = "PROPFIND"
        request.timeoutInterval = timeout
        request.setValue("1", forHTTPHeaderField: "Depth")
        request.setValue("application/xml", forHTTPHeaderField: "Content-Type")
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.httpBody = Data("<?xml version=\"1.0\" encoding=\"utf-8\"?><D:propfind xmlns:D=\"DAV:\"><D:prop><D:displayname/><D:resourcetype/></D:prop></D:propfind>".utf8)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        if requireDAV, let http = response as? HTTPURLResponse, http.statusCode == 401 {
            let port = request.url?.port ?? (request.url?.scheme == "https" ? 443 : 80)
            if Self.confirmsWebDAVPassword(http, port: port) {
                throw LibraryError(message: L("Błędny login lub hasło."))
            }
            throw LibraryError(message: L("Ten port nie obsługuje WebDAV."))
        }
        try throwIfNeeded(response, data: data, allowMissing: true)
        if requireDAV { try Self.requireWebDAV(response, data: data) }
        if let http = response as? HTTPURLResponse, http.statusCode == 404 { return Data() }
        return data
    }

    private static func confirmsWebDAVPassword(_ response: HTTPURLResponse, port: Int) -> Bool {
        if response.value(forHTTPHeaderField: "DAV") != nil { return true }
        return [5000, 5001, 5005, 5006].contains(port)
    }

    private static func requireWebDAV(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw LibraryError(message: L("Brak odpowiedzi."))
        }
        if http.statusCode == 207 { return }
        let body = String(decoding: data.prefix(900), as: UTF8.self).lowercased()
        if body.contains("multistatus") || body.contains("d:href") || body.contains(":href") { return }
        throw LibraryError(message: L("Ten port nie obsługuje WebDAV."))
    }

    func exists(_ relative: String) async throws -> Bool {
        if let count = try await byteCount(relative) { return count >= 0 }
        return false
    }

    /// QNAP answers HEAD with 404 for files that are there, so the size comes from PROPFIND or one ranged byte.
    func byteCount(_ relative: String) async throws -> Int? {
        if let counted = try? await propfindLength(relative) { return counted }
        return try await rangedLength(relative)
    }

    func removeFile(_ relative: String) async throws {
        var request = URLRequest(url: try url(relative))
        request.httpMethod = "DELETE"
        request.timeoutInterval = 20
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        let (_, response) = try await GalleryNetwork.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 || (200..<300).contains(http.statusCode) {
            return
        }
        try throwIfNeeded(response, data: Data(), allowMissing: true)
    }

    private func propfindLength(_ relative: String) async throws -> Int? {
        var request = URLRequest(url: try url(relative))
        request.httpMethod = "PROPFIND"
        request.timeoutInterval = 20
        request.setValue("0", forHTTPHeaderField: "Depth")
        request.setValue("application/xml", forHTTPHeaderField: "Content-Type")
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.httpBody = Data("<?xml version=\"1.0\" encoding=\"utf-8\"?><D:propfind xmlns:D=\"DAV:\"><D:prop><D:getcontentlength/></D:prop></D:propfind>".utf8)
        let (data, response) = try await GalleryNetwork.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 { return nil }
        try throwIfNeeded(response, data: data, allowMissing: true)
        let text = String(decoding: data, as: UTF8.self)
        guard let marker = text.range(of: "getcontentlength>", options: .caseInsensitive) else { return nil }
        let digits = text[marker.upperBound...].prefix { $0.isNumber }
        guard !digits.isEmpty, let value = Int(digits) else { return nil }
        return value
    }

    private func rangedLength(_ relative: String) async throws -> Int? {
        var request = URLRequest(url: try url(relative))
        request.timeoutInterval = 20
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        request.setValue("bytes=0-0", forHTTPHeaderField: "Range")
        let (_, response) = try await GalleryNetwork.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { return nil }
        if http.statusCode == 404 { return nil }
        if http.statusCode >= 400 { return nil }
        if let range = http.value(forHTTPHeaderField: "Content-Range"), let slash = range.lastIndex(of: "/") {
            let total = range[range.index(after: slash)...].trimmingCharacters(in: .whitespaces)
            if total != "*", let value = Int(total) { return value }
        }
        if http.statusCode == 200, let length = http.value(forHTTPHeaderField: "Content-Length"), let value = Int(length) {
            return value
        }
        return nil
    }

    private func makeParents(_ relative: String) async throws {
        let parts = relative.split(separator: "/").map(String.init).dropLast()
        var path = ""
        for part in parts {
            path = path.isEmpty ? part : path + "/" + part
            var request = URLRequest(url: try url(path, directory: true))
            request.httpMethod = "MKCOL"
            request.timeoutInterval = 20
            request.setValue(authorization, forHTTPHeaderField: "Authorization")
            let (data, response) = try await GalleryNetwork.shared.data(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode == 405 || http.statusCode == 301 || http.statusCode == 409 {
                continue
            }
            try throwIfNeeded(response, data: data)
        }
    }

    private func url(_ relative: String, directory: Bool = false) throws -> URL {
        guard !relative.isEmpty else { return baseURL }
        guard let safe = CatalogPath.safe(relative) else {
            throw LibraryError(message: L("Nieprawidłowa ścieżka biblioteki."))
        }
        return baseURL.appendingPathComponent(safe, isDirectory: directory)
    }

    private var authorization: String {
        let raw = "\(username):\(password)"
        return "Basic \(Data(raw.utf8).base64EncodedString())"
    }

    private func throwIfNeeded(_ response: URLResponse, data: Data, allowMissing: Bool = false) throws {
        guard let http = response as? HTTPURLResponse else {
            throw LibraryError(message: L("Brak odpowiedzi."))
        }
        if allowMissing, http.statusCode == 404 { return }
        if http.statusCode == 401 { throw LibraryError(message: L("Błędny login lub hasło.")) }
        if http.statusCode == 403 { throw LibraryError(message: L("Brak dostępu do tego folderu.")) }
        if http.statusCode >= 400 {
            throw LibraryError(message: L("WebDAV błąd \(http.statusCode)."))
        }
    }

    func acceptsLibrary() async -> Bool {
        var request = URLRequest(url: baseURL.appendingPathComponent("GalleryOS", isDirectory: true))
        request.httpMethod = "MKCOL"
        request.timeoutInterval = 4
        request.setValue(authorization, forHTTPHeaderField: "Authorization")
        do {
            let (_, response) = try await GalleryNetwork.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            if http.statusCode == 401 || http.statusCode == 403 { return false }
            return http.statusCode < 300 || http.statusCode == 301 || http.statusCode == 405 || http.statusCode == 409
        } catch {
            return false
        }
    }

    private static func entries(in data: Data, current: String) -> [WebEntry] {
        let xml = String(decoding: data, as: UTF8.self)
        let blocks = xml.components(separatedBy: "esponse>")
        let here = current.trimmingCharacters(in: CharacterSet(charactersIn: "/")).split(separator: "/").last.map(String.init)
        var items: [WebEntry] = []
        for block in blocks {
            guard let href = Self.firstTag("href", in: block) else { continue }
            let decoded = href.removingPercentEncoding ?? href
            let trimmed = decoded.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let name = trimmed.split(separator: "/").last.map(String.init) ?? ""
            if name.isEmpty || name == here { continue }
            let folder = decoded.hasSuffix("/") || block.lowercased().contains("collection")
            if items.contains(where: { $0.name == name }) { continue }
            items.append(WebEntry(name: name, isDirectory: folder))
        }
        return items.sorted { lhs, rhs in
            if lhs.isDirectory != rhs.isDirectory { return lhs.isDirectory && !rhs.isDirectory }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private static func firstTag(_ tag: String, in xml: String) -> String? {
        let lower = xml.lowercased()
        guard let marker = lower.range(of: tag + ">"), let end = xml[marker.upperBound...].firstIndex(of: "<") else { return nil }
        return String(xml[marker.upperBound..<end])
    }

    private static func names(in data: Data, current: String) -> [String] {
        let xml = String(decoding: data, as: UTF8.self)
        let hrefs = xml.components(separatedBy: "<").compactMap { part -> String? in
            guard part.lowercased().hasPrefix("d:href") || part.lowercased().hasPrefix("href") else { return nil }
            guard let start = part.firstIndex(of: ">") else { return nil }
            let value = part[part.index(after: start)...]
            return value.removingPercentEncoding ?? String(value)
        }
        let currentTrimmed = current.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var names: [String] = []
        for href in hrefs {
            let trimmed = href.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let name = trimmed.split(separator: "/").last.map(String.init) ?? ""
            if name.isEmpty || name == currentTrimmed.split(separator: "/").last.map(String.init) { continue }
            if !names.contains(name) { names.append(name) }
        }
        return names
    }
}

private final class ProbeBox: @unchecked Sendable {
    private let lock = NSLock()
    var found: WebDAVTransport?
    var port = 0
    var sawAuth = false
    var sawTimeout = false
    var last: LibraryError?

    func note(_ error: Error) {
        let message = SyncPause.message(for: error)
        lock.lock()
        defer { lock.unlock() }
        if message.contains(L("hasło")) || message.contains(L("dostępu")) { sawAuth = true }
        if let url = error as? URLError, url.code == .timedOut { sawTimeout = true }
        last = LibraryError(message: message)
    }
}

extension WebDAVTransport: StreamingTransport {
    func streamTarget(_ relative: String) -> (url: URL, headers: [String: String])? {
        // Never embed user:password in the URL — special characters break the request,
        // and AVPlayer on tvOS often ignores URL credentials anyway. Header auth only.
        guard let target = try? url(relative) else { return nil }
        return (target, ["Authorization": authorization])
    }
}

extension WebDAVTransport {
    /// Fast reachability check of one route (home LAN or DDNS) with the account credentials.
    static func reach(
        host: String,
        port: Int,
        username: String,
        password: String,
        timeout: TimeInterval
    ) async -> (ok: Bool, auth: Bool, millis: Int) {
        let clean = cleanHost(host)
        guard !clean.isEmpty else { return (false, false, 0) }
        GalleryNetwork.shared.trust(clean)
        let start = Date()
        let found = await race(
            host: clean,
            attempts: attempts(forced: port),
            timeout: timeout,
            username: username,
            password: password
        )
        return (found.transport != nil, found.auth, Int(Date().timeIntervalSince(start) * 1000))
    }
}
