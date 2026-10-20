import CryptoKit
import Foundation

final class GalleryNetwork: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    static let shared = GalleryNetwork()
    private let trustLock = NSLock()
    private var trustedHosts: Set<String> = []

    func trust(_ host: String) {
        let name = host.lowercased()
        trustLock.lock()
        trustedHosts.insert(name)
        trustLock.unlock()
    }

    private func isTrusted(_ host: String) -> Bool {
        if Self.isLocalHost(host) { return true }
        trustLock.lock()
        defer { trustLock.unlock() }
        return trustedHosts.contains(host.lowercased())
    }

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 3 * 60
        // A remote NAS that accepts the connection and then stays silent must hit the timeout.
        // Waiting for connectivity holds the request with no progress for many minutes.
        config.waitsForConnectivity = false
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    /// Whole-file downloads (films on Apple TV). A 2 GB Dolby Vision clip over DDNS takes far
    /// longer than the 3 minute resource limit of the regular session.
    private lazy var transferSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 40
        config.timeoutIntervalForResource = 3 * 60 * 60
        config.waitsForConnectivity = false
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    static let backgroundIdentifier = "pl.galleryos.app.uploads"
    private let uploads = BackgroundUploads()

    func trackUpload(_ handler: @escaping @Sendable (Double) -> Void) {
        uploads.onByteProgress = handler
    }

    func useBackgroundTransfers(_ enabled: Bool) {
        _ = enabled
    }

    func prepareBackgroundUploads() {
        _ = backgroundSession
    }

    func handleBackgroundEvents(_ completion: @escaping () -> Void) {
        _ = backgroundSession
        uploads.beginBackgroundEvents(completion)
    }

    func backgroundWorkHandedOff() {
        uploads.markWorkHandedOff()
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }

    /// One byte range of a remote file, for streaming video through this session's TLS trust.
    func range(_ url: URL, headers: [String: String], from start: Int64, through end: Int64) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        for (field, value) in headers { request.setValue(value, forHTTPHeaderField: field) }
        request.setValue("bytes=\(start)-\(end)", forHTTPHeaderField: "Range")
        let (data, response) = try await transferSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return (data, http)
    }

    /// Size and type of a remote file without downloading it.
    func head(_ url: URL, headers: [String: String]) async throws -> HTTPURLResponse {
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 20
        for (field, value) in headers { request.setValue(value, forHTTPHeaderField: field) }
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return http
    }

    /// Saves a whole file straight to disk, in ranges. QNAP closes one long download well
    /// before a film finishes, while short ranges come through, so each piece is fetched and
    /// appended on its own and a dropped connection only repeats the piece it cut.
    func download(for request: URLRequest, to destination: URL) async throws -> HTTPURLResponse {
        guard let url = request.url else { throw URLError(.badURL) }
        let headers = request.allHTTPHeaderFields ?? [:]
        let (_, probe) = try await range(url, headers: headers, from: 0, through: 1)
        var total = Int64(-1)
        if let field = probe.value(forHTTPHeaderField: "Content-Range"), let slash = field.lastIndex(of: "/") {
            total = Int64(field[field.index(after: slash)...].trimmingCharacters(in: .whitespaces)) ?? -1
        }
        // A server that ignores Range sends the whole file at once.
        if total <= 0 || probe.statusCode == 200 {
            return try await downloadWhole(request, to: destination)
        }
        let part = destination.appendingPathExtension("part")
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: part.path) {
            FileManager.default.createFile(atPath: part.path, contents: nil)
        }
        let handle = try FileHandle(forWritingTo: part)
        defer { try? handle.close() }
        var offset = handle.seekToEndOfFile()
        let piece: Int64 = 8 * 1024 * 1024
        while Int64(offset) < total {
            try Task.checkCancellation()
            let start = Int64(offset)
            let end = min(total, start + piece) - 1
            var slice = Data()
            var got = false
            for _ in 0..<4 {
                if let (data, response) = try? await range(url, headers: headers, from: start, through: end),
                   response.statusCode == 206, !data.isEmpty {
                    slice = data
                    got = true
                    break
                }
                try await Task.sleep(nanoseconds: 1_500_000_000)
            }
            guard got else { throw URLError(.networkConnectionLost) }
            try handle.write(contentsOf: slice)
            offset += UInt64(slice.count)
        }
        try handle.close()
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: part, to: destination)
        return probe
    }

    /// One-shot download for a server that does not honour Range.
    private func downloadWhole(_ request: URLRequest, to destination: URL) async throws -> HTTPURLResponse {
        let (temporary, response) = try await transferSession.download(for: request)
        guard let http = response as? HTTPURLResponse else {
            try? FileManager.default.removeItem(at: temporary)
            throw URLError(.badServerResponse)
        }
        guard (200..<300).contains(http.statusCode) else {
            try? FileManager.default.removeItem(at: temporary)
            throw URLError(.badServerResponse)
        }
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporary, to: destination)
        return http
    }

    func upload(for request: URLRequest, fromFile file: URL) async throws -> (Data, URLResponse) {
        guard let target = request.url,
              ["http", "https"].contains(target.scheme?.lowercased() ?? ""),
              target.host?.isEmpty == false else {
            throw URLError(.badURL)
        }
        let source = file.standardizedFileURL
        guard source.isFileURL,
              FileManager.default.fileExists(atPath: source.path),
              FileManager.default.isReadableFile(atPath: source.path) else {
            throw URLError(.fileDoesNotExist)
        }
        var copy = request
        copy.httpBody = nil
        copy.httpBodyStream = nil
        // Stay on the in-process session. A background session hands the file to the system
        // and suspends this process within a few seconds, which kills the copy loop and
        // makes the next launch start the same photo from the first byte.
        return try await session.upload(for: copy, fromFile: source)
    }

    private lazy var backgroundSession: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: Self.backgroundIdentifier)
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        config.timeoutIntervalForRequest = 120
        config.timeoutIntervalForResource = 60 * 60
        config.waitsForConnectivity = true
        return URLSession(configuration: config, delegate: uploads, delegateQueue: nil)
    }()

    /// Background transfers outlive the process only if the file is outside the temporary directory.
    private static func park(_ source: URL) throws -> URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = base.appendingPathComponent("GalleryOS/outgoing", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let dest = folder.appendingPathComponent(UUID().uuidString + "-" + source.lastPathComponent)
        do {
            try FileManager.default.moveItem(at: source, to: dest)
        } catch {
            try FileManager.default.copyItem(at: source, to: dest)
        }
        return dest
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let host = challenge.protectionSpace.host
        guard isTrusted(host),
              challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: trust))
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard session === self.session, totalBytesExpectedToSend > 0 else { return }
        let fraction = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        uploads.onByteProgress?(fraction)
    }

    static func isLocalHost(_ host: String) -> Bool {
        let lower = host.lowercased()
        if lower.hasSuffix(".local") || lower == "localhost" { return true }
        let parts = lower.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4 else { return false }
        switch parts[0] {
        case 10: return true
        case 172: return parts[1] >= 16 && parts[1] <= 31
        case 192: return parts[1] == 168
        default: return false
        }
    }
}

private final class BackgroundUploads: NSObject, URLSessionDataDelegate, @unchecked Sendable {
    var trust: (String) -> Bool = { GalleryNetwork.isLocalHost($0) }
    var onByteProgress: (@Sendable (Double) -> Void)?
    private let lock = NSLock()
    private var uploads: [Int: UploadBox] = [:]
    private var backgroundCompletion: (() -> Void)?
    private var eventsFinished = false
    private var workHandedOff = false
    private var eventGeneration = 0

    func send(
        _ request: URLRequest,
        fromFile file: URL,
        session: URLSession
    ) async throws -> (Data, URLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            let task = session.uploadTask(with: request, fromFile: file)
            task.taskDescription = file.path
            let box = UploadBox(continuation: continuation)
            box.cleanup = file
            lock.lock()
            uploads[task.taskIdentifier] = box
            lock.unlock()
            task.resume()
            markWorkHandedOff()
        }
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        let host = challenge.protectionSpace.host
        guard trust(host),
              challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        lock.lock()
        uploads[dataTask.taskIdentifier]?.data.append(data)
        lock.unlock()
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        lock.lock()
        uploads[dataTask.taskIdentifier]?.response = response
        lock.unlock()
        completionHandler(.allow)
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        guard totalBytesExpectedToSend > 0 else { return }
        let fraction = Double(totalBytesSent) / Double(totalBytesExpectedToSend)
        onByteProgress?(fraction)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let box = uploads.removeValue(forKey: task.taskIdentifier)
        lock.unlock()
        let cleanup = box?.cleanup ?? task.taskDescription.map { URL(fileURLWithPath: $0) }
        if let cleanup {
            try? FileManager.default.removeItem(at: cleanup)
        }
        guard let box else { return }
        if let error {
            box.finish(.failure(error))
        } else if let response = box.response ?? task.response {
            box.finish(.success((box.data, response)))
        } else {
            box.finish(.failure(URLError(.badServerResponse)))
        }
    }

    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        markEventsFinished()
    }

    func beginBackgroundEvents(_ completion: @escaping () -> Void) {
        lock.lock()
        backgroundCompletion = completion
        eventsFinished = false
        workHandedOff = false
        eventGeneration &+= 1
        lock.unlock()
    }

    func markWorkHandedOff() {
        finishBackgroundEvents(eventsAreFinished: false, workIsHandedOff: true, force: false)
    }

    private func markEventsFinished() {
        lock.lock()
        let generation = eventGeneration
        lock.unlock()
        finishBackgroundEvents(
            eventsAreFinished: true,
            workIsHandedOff: false,
            force: false,
            expectedGeneration: generation
        )
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            self?.finishBackgroundEvents(
                eventsAreFinished: false,
                workIsHandedOff: false,
                force: true,
                expectedGeneration: generation
            )
        }
    }

    private func finishBackgroundEvents(
        eventsAreFinished: Bool,
        workIsHandedOff: Bool,
        force: Bool,
        expectedGeneration: Int? = nil
    ) {
        lock.lock()
        if let expectedGeneration, expectedGeneration != eventGeneration {
            lock.unlock()
            return
        }
        if eventsAreFinished { eventsFinished = true }
        if workIsHandedOff { workHandedOff = true }
        let ready = force || (eventsFinished && workHandedOff)
        let completion = ready ? backgroundCompletion : nil
        if ready {
            backgroundCompletion = nil
            eventsFinished = false
            workHandedOff = false
        }
        lock.unlock()
        if let completion {
            DispatchQueue.main.async(execute: completion)
        }
    }
}

private final class UploadBox: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<(Data, URLResponse), Error>?
    var data = Data()
    var response: URLResponse?
    var cleanup: URL?

    init(continuation: CheckedContinuation<(Data, URLResponse), Error>) {
        self.continuation = continuation
    }

    func finish(_ result: Result<(Data, URLResponse), Error>) {
        lock.lock()
        let continuation = continuation
        self.continuation = nil
        lock.unlock()
        continuation?.resume(with: result)
    }
}

private final class UploadOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false

    func finish(
        _ continuation: CheckedContinuation<(Data, URLResponse), Error>,
        _ result: Result<(Data, URLResponse), Error>
    ) {
        lock.lock()
        defer { lock.unlock() }
        guard !done else { return }
        done = true
        continuation.resume(with: result)
    }
}

enum ContentHash {
    static func sha256(of file: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            let chunk = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }
        return hex(hasher.finalize())
    }

    static func sha1(of file: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var hasher = Insecure.SHA1()
        while true {
            let chunk = try handle.read(upToCount: 1024 * 1024) ?? Data()
            if chunk.isEmpty { break }
            hasher.update(data: chunk)
        }
        return hex(hasher.finalize())
    }

    private static func hex<D: Sequence>(_ digest: D) -> String where D.Element == UInt8 {
        digest.map { String(format: "%02x", $0) }.joined()
    }
}
