@_spi(CMS) import X509
import Foundation

enum PassCMSSigner {
    static var canSign: Bool {
        Bundle.main.url(forResource: "PassType", withExtension: "cer") != nil
            && Bundle.main.url(forResource: "AppleWWDRCAG4", withExtension: "cer") != nil
            && Bundle.main.url(forResource: "PassType", withExtension: "key") != nil
    }

    static func signature(for manifest: Data) throws -> Data {
        guard
            let certURL = Bundle.main.url(forResource: "PassType", withExtension: "cer"),
            let wwdrURL = Bundle.main.url(forResource: "AppleWWDRCAG4", withExtension: "cer"),
            let keyURL = Bundle.main.url(forResource: "PassType", withExtension: "key")
        else {
            throw WalletPassError.unsigned
        }

        let cert = try Certificate(derEncoded: Array(Data(contentsOf: certURL)))
        let wwdr = try Certificate(derEncoded: Array(Data(contentsOf: wwdrURL)))
        let keyPEM = String(decoding: try Data(contentsOf: keyURL), as: UTF8.self)
        let key = try Certificate.PrivateKey(pemEncoded: keyPEM)

        // Wallet historically verifies SHA-1 CMS of manifest.json. Fall back to the key default if SHA-1 is unavailable.
        let bytes: [UInt8]
        do {
            bytes = try CMS.sign(
                Array(manifest),
                signatureAlgorithm: .sha1WithRSAEncryption,
                additionalIntermediateCertificates: [wwdr],
                certificate: cert,
                privateKey: key,
                signingTime: Date(),
                detached: true
            )
        } catch {
            bytes = try CMS.sign(
                Array(manifest),
                additionalIntermediateCertificates: [wwdr],
                certificate: cert,
                privateKey: key,
                signingTime: Date(),
                detached: true
            )
        }
        return Data(bytes)
    }
}
