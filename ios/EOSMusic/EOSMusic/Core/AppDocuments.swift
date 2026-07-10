import Foundation

enum AppDocuments {
    static let downloadsFolderName = "Pobrane"

    /// Folder widoczny w Plikach → Na moim iPhonie → EOS™ Music.
    static var root: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }

    static var downloads: URL {
        root.appendingPathComponent(downloadsFolderName, isDirectory: true)
    }

    static func ensureStructure() {
        let fm = FileManager.default
        try? fm.createDirectory(at: downloads, withIntermediateDirectories: true)
        let readme = root.appendingPathComponent("O aplikacji.txt")
        if !fm.fileExists(atPath: readme.path) {
            let text = """
            EOS™ Music — folder dokumentów aplikacji.

            Podfolder „Pobrane” zawiera utwory pobrane w aplikacji.
            Możesz je kopiować, przenosić i odtwarzać w innych aplikacjach.
            """
            try? text.write(to: readme, atomically: true, encoding: .utf8)
        }
    }

    static func revealDownloadsInFiles() {
        // iOS nie ma publicznego URL do konkretnego folderu w Plikach — folder jest widoczny automatycznie.
        ensureStructure()
    }
}
