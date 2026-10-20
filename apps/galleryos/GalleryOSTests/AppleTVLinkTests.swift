import CryptoKit
import XCTest
@testable import GalleryOS

final class AppleTVLinkTests: XCTestCase {
    private func payload() -> PairingPayload {
        PairingPayload(
            server: AppleTVServer(
                id: "gallery@nas.example.com",
                title: "NAS",
                kind: DestinationKind.webdav,
                host: "nas.example.com",
                port: 5001,
                username: "gallery",
                directory: "Multimedia",
                localHost: "192.168.1.20",
                localPort: 5000,
                localName: "TS253D",
                remoteHost: "nas.example.com"
            ),
            password: "sekret ąę"
        )
    }

    func testPairingRoundTrip() throws {
        let tv = P256.KeyAgreement.PrivateKey()
        let sealed = try PairingCrypto.seal(payload(), devicePublicKey: PairingCrypto.publicKeyText(tv), code: "k7m2qx")
        let opened = try PairingCrypto.open(sealed, with: tv, code: "K7M2QX")
        XCTAssertEqual(opened, payload())
    }

    func testSealedDataDoesNotContainThePassword() throws {
        let tv = P256.KeyAgreement.PrivateKey()
        let sealed = try PairingCrypto.seal(payload(), devicePublicKey: PairingCrypto.publicKeyText(tv), code: "K7M2QX")
        let raw = Data(base64Encoded: sealed.box) ?? Data()
        XCTAssertNil(String(decoding: raw, as: UTF8.self).range(of: "sekret"))
    }

    func testWrongCodeOrWrongTelevisionCannotOpen() throws {
        let tv = P256.KeyAgreement.PrivateKey()
        let other = P256.KeyAgreement.PrivateKey()
        let sealed = try PairingCrypto.seal(payload(), devicePublicKey: PairingCrypto.publicKeyText(tv), code: "K7M2QX")
        XCTAssertThrowsError(try PairingCrypto.open(sealed, with: tv, code: "AAAAAA"))
        XCTAssertThrowsError(try PairingCrypto.open(sealed, with: other, code: "K7M2QX"))
    }

    func testBadPublicKeyIsRejected() {
        XCTAssertThrowsError(try PairingCrypto.seal(payload(), devicePublicKey: "not-a-key", code: "K7M2QX"))
    }

    func testCodeNormalizationIgnoresSpacesAndCase() {
        XCTAssertEqual(PairingCrypto.normalize(code: " k7m-2qx "), "K7M2QX")
    }

    func testOnlyServerAndWebDAVAreSupportedOnTV() {
        var server = payload().server
        XCTAssertTrue(server.isSupportedOnTV)
        server.kind = DestinationKind.sftp
        XCTAssertFalse(server.isSupportedOnTV)
        server.kind = DestinationKind.server
        XCTAssertTrue(server.isSupportedOnTV)
    }
}
