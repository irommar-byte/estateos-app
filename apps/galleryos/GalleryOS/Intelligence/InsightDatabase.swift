import Accelerate
import CoreGraphics
import Foundation
import SQLite3

/// What GalleryOS learned about one photo. Everything is computed on this device and never leaves it.
struct PhotoInsight: Sendable {
    var id: String
    /// Vision scene labels with confidence, strongest first.
    var labels: [(String, Float)]
    /// Text read from the photo (receipts, signs, documents), lowercased and folded.
    var words: String
    /// Laplacian variance at 384 px; low means blurred or shaken.
    var sharpness: Float
    /// Mean luminance 0…1 and its spread.
    var brightness: Float
    var contrast: Float
    /// Share of pixels burnt out (near white) and crushed (near black).
    var highlights: Float
    var shadows: Float
    /// Apple's aesthetic score -1…1 (0 when unknown) and its "utility" flag (receipts, screenshots).
    var aesthetic: Float
    var utility: Bool
    var eyesClosed: Bool
    var faceCount: Int
    /// CLIP image vector, 512 half floats stored as raw bits.
    var clip: [UInt16]?

    var labelNames: [String] { labels.map(\.0) }
}

struct FaceRecord: Sendable, Identifiable, Hashable {
    let id: Int64
    let photo: String
    /// Normalised box in the upright photo, origin bottom-left (Vision coordinates).
    let box: CGRect
    let quality: Float
    var embedding: [Float]?
    var person: Int64?
    var confirmed: Bool

    static func == (lhs: FaceRecord, rhs: FaceRecord) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct PersonRecord: Sendable, Identifiable, Hashable {
    let id: Int64
    var name: String
    var cover: Int64?
    var favorite: Bool
    var hidden: Bool
}

struct FaceDraft: Sendable {
    var box: CGRect
    var quality: Float
    var embedding: [Float]?
}

/// One small SQLite file in Application Support. Plain SQL through a serial queue, so the
/// analyser (background) and the screens (main) never touch the file at the same time.
final class InsightDatabase: @unchecked Sendable {
    static let shared = InsightDatabase()
    /// Bumped when the analysis changes; older rows are analysed again.
    static let version = 1

    /// The analysis this build can do: the base version plus which models are present, so photos
    /// looked at before the models arrived get their faces and search vector later.
    static var currentVersion: Int {
        version | (IntelligenceModels.shared.hasFaces ? 1 << 8 : 0) | (IntelligenceModels.shared.hasSearch ? 1 << 9 : 0)
    }

    private let queue = DispatchQueue(label: "pl.galleryos.insights")
    private var db: OpaquePointer?

    private init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = base.appendingPathComponent("GalleryOS", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var url = folder.appendingPathComponent("insights.sqlite")
        if sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) != SQLITE_OK {
            db = nil
            return
        }
        // Rebuildable from the photos themselves, so it stays out of iCloud backups.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
        exec("PRAGMA journal_mode=WAL")
        exec("PRAGMA synchronous=NORMAL")
        exec("""
        CREATE TABLE IF NOT EXISTS photo(
            id TEXT PRIMARY KEY, version INTEGER NOT NULL, analyzed REAL NOT NULL,
            labels TEXT, words TEXT, sharpness REAL, brightness REAL, contrast REAL,
            highlights REAL, shadows REAL, aesthetic REAL, utility INTEGER, eyes INTEGER,
            faces INTEGER, clip BLOB)
        """)
        exec("""
        CREATE TABLE IF NOT EXISTS face(
            id INTEGER PRIMARY KEY AUTOINCREMENT, photo TEXT NOT NULL,
            x REAL, y REAL, w REAL, h REAL, quality REAL, embedding BLOB,
            person INTEGER, confirmed INTEGER NOT NULL DEFAULT 0)
        """)
        exec("CREATE INDEX IF NOT EXISTS face_photo ON face(photo)")
        exec("CREATE INDEX IF NOT EXISTS face_person ON face(person)")
        exec("""
        CREATE TABLE IF NOT EXISTS person(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '',
            cover INTEGER, favorite INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0,
            created REAL)
        """)
        exec("CREATE TABLE IF NOT EXISTS rejection(face INTEGER NOT NULL, person INTEGER NOT NULL, PRIMARY KEY(face, person))")
    }

    var isOpen: Bool { db != nil }

    // MARK: Photos

    /// Photo id → analysis version, to find what still needs a look.
    func analyzed() -> [String: Int] {
        queue.sync {
            var result: [String: Int] = [:]
            query("SELECT id, version FROM photo") { row in
                result[row.text(0)] = row.int(1)
            }
            return result
        }
    }

    func save(_ insight: PhotoInsight, faces: [FaceDraft], version: Int) {
        queue.sync {
            exec("BEGIN")
            // A photo analysed again keeps its people: the old faces leave only if the new ones differ.
            let previous = facesLocked(photo: insight.id)
            run("""
            INSERT OR REPLACE INTO photo(id, version, analyzed, labels, words, sharpness, brightness, contrast,
                highlights, shadows, aesthetic, utility, eyes, faces, clip)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """) { statement in
                bind(statement, 1, insight.id)
                sqlite3_bind_int(statement, 2, Int32(version))
                sqlite3_bind_double(statement, 3, Date().timeIntervalSince1970)
                bind(statement, 4, insight.labels.map { "\($0.0):\(String(format: "%.2f", $0.1))" }.joined(separator: ","))
                bind(statement, 5, insight.words)
                sqlite3_bind_double(statement, 6, Double(insight.sharpness))
                sqlite3_bind_double(statement, 7, Double(insight.brightness))
                sqlite3_bind_double(statement, 8, Double(insight.contrast))
                sqlite3_bind_double(statement, 9, Double(insight.highlights))
                sqlite3_bind_double(statement, 10, Double(insight.shadows))
                sqlite3_bind_double(statement, 11, Double(insight.aesthetic))
                sqlite3_bind_int(statement, 12, insight.utility ? 1 : 0)
                sqlite3_bind_int(statement, 13, insight.eyesClosed ? 1 : 0)
                sqlite3_bind_int(statement, 14, Int32(insight.faceCount))
                if let clip = insight.clip {
                    bind(statement, 15, clip.withUnsafeBytes { Data($0) })
                } else {
                    sqlite3_bind_null(statement, 15)
                }
            }
            var kept = Set<Int64>()
            for face in faces {
                if let match = previous.first(where: { !kept.contains($0.id) && Self.overlap($0.box, face.box) > 0.5 }) {
                    kept.insert(match.id)
                    run("UPDATE face SET x=?, y=?, w=?, h=?, quality=?, embedding=? WHERE id=?") { statement in
                        bindBox(statement, face, from: 1)
                        sqlite3_bind_int64(statement, 7, match.id)
                    }
                } else {
                    run("INSERT INTO face(photo, x, y, w, h, quality, embedding) VALUES(?,?,?,?,?,?,?)") { statement in
                        bind(statement, 1, insight.id)
                        bindBox(statement, face, from: 2)
                    }
                }
            }
            for old in previous where !kept.contains(old.id) {
                run("DELETE FROM face WHERE id=?") { sqlite3_bind_int64($0, 1, old.id) }
            }
            exec("COMMIT")
        }
    }

    /// Photos that are gone from the library and the server: their faces and text go too.
    func forget(photos: [String]) {
        guard !photos.isEmpty else { return }
        queue.sync {
            exec("BEGIN")
            for id in photos {
                run("DELETE FROM photo WHERE id=?") { bind($0, 1, id) }
                run("DELETE FROM face WHERE photo=?") { bind($0, 1, id) }
            }
            exec("COMMIT")
        }
    }

    func insights() -> [PhotoInsight] {
        queue.sync {
            var result: [PhotoInsight] = []
            query("""
            SELECT id, labels, words, sharpness, brightness, contrast, highlights, shadows, aesthetic,
                   utility, eyes, faces, clip FROM photo
            """) { row in
                let labels: [(String, Float)] = row.text(1).split(separator: ",").compactMap { part in
                    let pieces = part.split(separator: ":")
                    guard pieces.count == 2, let value = Float(pieces[1]) else { return nil }
                    return (String(pieces[0]), value)
                }
                var clip: [UInt16]?
                if let data = row.blob(12), data.count == 512 * 2 {
                    clip = data.withUnsafeBytes { Array($0.bindMemory(to: UInt16.self)) }
                }
                result.append(PhotoInsight(
                    id: row.text(0), labels: labels, words: row.text(2),
                    sharpness: row.float(3), brightness: row.float(4), contrast: row.float(5),
                    highlights: row.float(6), shadows: row.float(7), aesthetic: row.float(8),
                    utility: row.int(9) == 1, eyesClosed: row.int(10) == 1, faceCount: row.int(11), clip: clip
                ))
            }
            return result
        }
    }

    // MARK: Faces and people

    func faces(withEmbeddings: Bool = true) -> [FaceRecord] {
        queue.sync {
            var result: [FaceRecord] = []
            let columns = withEmbeddings ? "embedding" : "NULL"
            query("SELECT id, photo, x, y, w, h, quality, \(columns), person, confirmed FROM face") { row in
                result.append(Self.face(row))
            }
            return result
        }
    }

    func faces(photo: String) -> [FaceRecord] {
        queue.sync { facesLocked(photo: photo) }
    }

    /// One person's faces with their identity vectors, for the review screen.
    func faces(person: Int64) -> [FaceRecord] {
        queue.sync {
            var result: [FaceRecord] = []
            query("SELECT id, photo, x, y, w, h, quality, embedding, person, confirmed FROM face WHERE person=?", bind: {
                sqlite3_bind_int64($0, 1, person)
            }) { row in result.append(Self.face(row)) }
            return result
        }
    }

    func face(id: Int64) -> FaceRecord? {
        queue.sync {
            var found: FaceRecord?
            query("SELECT id, photo, x, y, w, h, quality, NULL, person, confirmed FROM face WHERE id=?", bind: {
                sqlite3_bind_int64($0, 1, id)
            }) { row in found = Self.face(row) }
            return found
        }
    }

    func assign(_ assignments: [Int64: Int64?], confirmed: Bool = false) {
        guard !assignments.isEmpty else { return }
        queue.sync {
            exec("BEGIN")
            for (face, person) in assignments {
                run("UPDATE face SET person=?, confirmed=? WHERE id=?") { statement in
                    if let person { sqlite3_bind_int64(statement, 1, person) } else { sqlite3_bind_null(statement, 1) }
                    sqlite3_bind_int(statement, 2, confirmed ? 1 : 0)
                    sqlite3_bind_int64(statement, 3, face)
                }
            }
            exec("COMMIT")
        }
    }

    func people() -> [PersonRecord] {
        queue.sync {
            var result: [PersonRecord] = []
            query("SELECT id, name, cover, favorite, hidden FROM person") { row in
                result.append(PersonRecord(
                    id: row.int64(0), name: row.text(1), cover: row.isNull(2) ? nil : row.int64(2),
                    favorite: row.int(3) == 1, hidden: row.int(4) == 1
                ))
            }
            return result
        }
    }

    func createPerson() -> Int64 {
        queue.sync {
            run("INSERT INTO person(name, created) VALUES('', ?)") {
                sqlite3_bind_double($0, 1, Date().timeIntervalSince1970)
            }
            return sqlite3_last_insert_rowid(db)
        }
    }

    func update(_ person: PersonRecord) {
        queue.sync {
            run("UPDATE person SET name=?, cover=?, favorite=?, hidden=? WHERE id=?") { statement in
                bind(statement, 1, person.name)
                if let cover = person.cover { sqlite3_bind_int64(statement, 2, cover) } else { sqlite3_bind_null(statement, 2) }
                sqlite3_bind_int(statement, 3, person.favorite ? 1 : 0)
                sqlite3_bind_int(statement, 4, person.hidden ? 1 : 0)
                sqlite3_bind_int64(statement, 5, person.id)
            }
        }
    }

    /// Everything of `source` moves to `target`; a name or favourite on either side survives.
    func merge(_ source: Int64, into target: Int64) {
        queue.sync {
            exec("BEGIN")
            run("UPDATE face SET person=? WHERE person=?") {
                sqlite3_bind_int64($0, 1, target)
                sqlite3_bind_int64($0, 2, source)
            }
            run("UPDATE rejection SET person=? WHERE person=?") {
                sqlite3_bind_int64($0, 1, target)
                sqlite3_bind_int64($0, 2, source)
            }
            run("DELETE FROM person WHERE id=?") { sqlite3_bind_int64($0, 1, source) }
            exec("COMMIT")
        }
    }

    func deletePerson(_ id: Int64) {
        queue.sync {
            exec("BEGIN")
            run("UPDATE face SET person=NULL, confirmed=0 WHERE person=?") { sqlite3_bind_int64($0, 1, id) }
            run("DELETE FROM rejection WHERE person=?") { sqlite3_bind_int64($0, 1, id) }
            run("DELETE FROM person WHERE id=?") { sqlite3_bind_int64($0, 1, id) }
            exec("COMMIT")
        }
    }

    /// "This is not X": the face leaves the person and is never put back there automatically.
    func reject(faces: [Int64], person: Int64) {
        queue.sync {
            exec("BEGIN")
            for face in faces {
                run("INSERT OR IGNORE INTO rejection(face, person) VALUES(?,?)") {
                    sqlite3_bind_int64($0, 1, face)
                    sqlite3_bind_int64($0, 2, person)
                }
                run("UPDATE face SET person=NULL, confirmed=0 WHERE id=? AND person=?") {
                    sqlite3_bind_int64($0, 1, face)
                    sqlite3_bind_int64($0, 2, person)
                }
            }
            exec("COMMIT")
        }
    }

    func rejections() -> Set<FacePersonPair> {
        queue.sync {
            var result = Set<FacePersonPair>()
            query("SELECT face, person FROM rejection") { row in
                result.insert(FacePersonPair(face: row.int64(0), person: row.int64(1)))
            }
            return result
        }
    }

    func wipe() {
        queue.sync {
            exec("DELETE FROM photo")
            exec("DELETE FROM face")
            exec("DELETE FROM person")
            exec("DELETE FROM rejection")
            exec("VACUUM")
        }
    }

    // MARK: SQLite plumbing (always called on `queue`)

    private func facesLocked(photo: String) -> [FaceRecord] {
        var result: [FaceRecord] = []
        query("SELECT id, photo, x, y, w, h, quality, embedding, person, confirmed FROM face WHERE photo=?", bind: {
            bind($0, 1, photo)
        }) { row in result.append(Self.face(row)) }
        return result
    }

    private static func face(_ row: Row) -> FaceRecord {
        var embedding: [Float]?
        if let data = row.blob(7), data.count == 128 * 4 {
            embedding = data.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
        }
        return FaceRecord(
            id: row.int64(0), photo: row.text(1),
            box: CGRect(x: row.double(2), y: row.double(3), width: row.double(4), height: row.double(5)),
            quality: row.float(6), embedding: embedding,
            person: row.isNull(8) ? nil : row.int64(8), confirmed: row.int(9) == 1
        )
    }

    private static func overlap(_ a: CGRect, _ b: CGRect) -> CGFloat {
        let inter = a.intersection(b)
        guard !inter.isNull else { return 0 }
        let union = a.width * a.height + b.width * b.height - inter.width * inter.height
        return union > 0 ? inter.width * inter.height / union : 0
    }

    private func bindBox(_ statement: OpaquePointer, _ face: FaceDraft, from index: Int32) {
        sqlite3_bind_double(statement, index, Double(face.box.minX))
        sqlite3_bind_double(statement, index + 1, Double(face.box.minY))
        sqlite3_bind_double(statement, index + 2, Double(face.box.width))
        sqlite3_bind_double(statement, index + 3, Double(face.box.height))
        sqlite3_bind_double(statement, index + 4, Double(face.quality))
        if let embedding = face.embedding {
            bind(statement, index + 5, embedding.withUnsafeBytes { Data($0) })
        } else {
            sqlite3_bind_null(statement, index + 5)
        }
    }

    private func exec(_ sql: String) {
        guard let db else { return }
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    private func run(_ sql: String, bind: (OpaquePointer) -> Void) {
        guard let db else { return }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { return }
        defer { sqlite3_finalize(statement) }
        bind(statement)
        sqlite3_step(statement)
    }

    private func query(_ sql: String, bind: ((OpaquePointer) -> Void)? = nil, row: (Row) -> Void) {
        guard let db else { return }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { return }
        defer { sqlite3_finalize(statement) }
        bind?(statement)
        while sqlite3_step(statement) == SQLITE_ROW {
            row(Row(statement: statement))
        }
    }

    struct Row {
        let statement: OpaquePointer
        func text(_ index: Int32) -> String {
            guard let pointer = sqlite3_column_text(statement, index) else { return "" }
            return String(cString: pointer)
        }
        func int(_ index: Int32) -> Int { Int(sqlite3_column_int64(statement, index)) }
        func int64(_ index: Int32) -> Int64 { sqlite3_column_int64(statement, index) }
        func double(_ index: Int32) -> Double { sqlite3_column_double(statement, index) }
        func float(_ index: Int32) -> Float { Float(sqlite3_column_double(statement, index)) }
        func isNull(_ index: Int32) -> Bool { sqlite3_column_type(statement, index) == SQLITE_NULL }
        func blob(_ index: Int32) -> Data? {
            guard let bytes = sqlite3_column_blob(statement, index) else { return nil }
            return Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, index)))
        }
    }
}

struct FacePersonPair: Hashable, Sendable {
    let face: Int64
    let person: Int64
}

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

private func bind(_ statement: OpaquePointer, _ index: Int32, _ text: String) {
    sqlite3_bind_text(statement, index, text, -1, sqliteTransient)
}

private func bind(_ statement: OpaquePointer, _ index: Int32, _ data: Data) {
    data.withUnsafeBytes { raw in
        _ = sqlite3_bind_blob(statement, index, raw.baseAddress, Int32(data.count), sqliteTransient)
    }
}

/// Half-float packing for CLIP vectors: half the memory, no Float16 type (absent on Intel simulators).
enum HalfFloats {
    static func pack(_ values: [Float]) -> [UInt16] {
        var output = [UInt16](repeating: 0, count: values.count)
        var source = values
        source.withUnsafeMutableBytes { input in
            output.withUnsafeMutableBytes { result in
                var from = vImage_Buffer(data: input.baseAddress, height: 1, width: vImagePixelCount(values.count), rowBytes: values.count * 4)
                var to = vImage_Buffer(data: result.baseAddress, height: 1, width: vImagePixelCount(values.count), rowBytes: values.count * 2)
                vImageConvert_PlanarFtoPlanar16F(&from, &to, vImage_Flags(kvImageNoFlags))
            }
        }
        return output
    }

    static func unpack(_ bits: UnsafeBufferPointer<UInt16>, into floats: UnsafeMutableBufferPointer<Float>) {
        var from = vImage_Buffer(data: UnsafeMutableRawPointer(mutating: bits.baseAddress), height: 1, width: vImagePixelCount(bits.count), rowBytes: bits.count * 2)
        var to = vImage_Buffer(data: floats.baseAddress, height: 1, width: vImagePixelCount(bits.count), rowBytes: bits.count * 4)
        vImageConvert_Planar16FtoPlanarF(&from, &to, vImage_Flags(kvImageNoFlags))
    }
}
