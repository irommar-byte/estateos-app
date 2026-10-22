import CryptoKit
import Foundation

/// Shows a short code on the TV and waits until the iPhone sends the (encrypted) server.
@MainActor
final class TVPairing: ObservableObject {
    enum State: Equatable {
        case starting
        case waiting(code: String)
        case failed(String)
    }

    @Published private(set) var state: State = .starting
    @Published private(set) var secondsLeft = 0

    private var key = P256.KeyAgreement.PrivateKey()
    private var session: String?
    private var code = ""
    private var expires = Date.distantPast
    private var task: Task<Void, Never>?
    private var onPaired: ((AppleTVServer, String) -> Void)?

    private static let root = "https://lineage.mycloudnas.com/galleryos"

    func run(onPaired: @escaping (AppleTVServer, String) -> Void) {
        self.onPaired = onPaired
        task?.cancel()
        task = Task { [weak self] in await self?.loop() }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    var deepLink: String {
        guard case .waiting(let code) = state else { return "galleryos://pair" }
        return "galleryos://pair?code=\(code)"
    }

    private func loop() async {
        while !Task.isCancelled {
            if session == nil || Date() >= expires {
                await begin()
            }
            if let session, case .waiting = state {
                await poll(session)
            }
            secondsLeft = max(0, Int(expires.timeIntervalSinceNow))
            let delay: UInt64 = {
                if case .failed = state { return 6 }
                return 2
            }()
            try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
        }
    }

    private func begin() async {
        key = P256.KeyAgreement.PrivateKey()
        session = nil
        do {
            var request = try Self.request("/v1/people/pair/start", method: "POST")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["publicKey": PairingCrypto.publicKeyText(key)])
            let (data, response) = try await GalleryNetwork.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
                  let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let id = object["id"] as? String,
                  let code = object["code"] as? String else {
                state = .failed(L("Serwer parowania nie odpowiada. Spróbuję jeszcze raz."))
                return
            }
            let lifetime = object["expiresIn"] as? Double ?? 600
            session = id
            self.code = code
            expires = Date().addingTimeInterval(lifetime - 5)
            state = .waiting(code: code)
        } catch {
            state = .failed(L("Brak połączenia z internetem. Spróbuję jeszcze raz."))
        }
    }

    private func poll(_ id: String) async {
        do {
            var request = try Self.request("/v1/people/pair/poll?id=\(id)", method: "GET")
            request.timeoutInterval = 15
            let (data, response) = try await GalleryNetwork.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return }
            if http.statusCode == 404 {
                session = nil
                return
            }
            guard (200...299).contains(http.statusCode),
                  let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  object["status"] as? String == "ready",
                  let sealedObject = object["sealed"] as? [String: Any],
                  let ephemeral = sealedObject["ephemeral"] as? String,
                  let box = sealedObject["box"] as? String else { return }
            let payload = try PairingCrypto.open(SealedPairing(ephemeral: ephemeral, box: box), with: key, code: code)
            session = nil
            stop()
            onPaired?(payload.server, payload.password)
        } catch let failure as PairingFailure {
            _ = failure
            session = nil
        } catch {
            // transient network error, next tick tries again
        }
    }

    private static func request(_ path: String, method: String) throws -> URLRequest {
        guard let url = URL(string: root + path), let host = url.host else {
            throw LibraryError(message: L("Serwis parowania jest niedostępny."))
        }
        GalleryNetwork.shared.trust(host)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        return request
    }
}
