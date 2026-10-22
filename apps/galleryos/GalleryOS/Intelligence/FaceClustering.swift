import Accelerate
import Foundation

/// Groups faces into people. Cosine similarity of SFace vectors (1 = identical, ~0.36 = OpenCV's
/// "same person" line). Two strangers in one person are far worse than one person shown twice
/// (the user merges that with a tap), so every step is strict, and two rules always hold:
/// two faces in one photo are never the same person, and a face that drifted away from its
/// person's average face leaves it again.
enum FaceClustering {
    /// A face joins an existing person when it is this close to the person's average face.
    static let assignThreshold: Float = 0.46
    /// A loose face joins a new group when this close to the group's average face.
    static let linkThreshold: Float = 0.52
    /// A face (not confirmed by the user) further than this from its person's average leaves it.
    static let evictThreshold: Float = 0.36
    /// Two unnamed people this close are one person (if they never share a photo).
    static let mergeThreshold: Float = 0.62
    /// A new person needs this many faces from different photos.
    static let minimumGroup = 3
    /// Side profiles and blurred faces stay out (Vision capture quality 0…1).
    static let minimumQuality: Float = 0.12

    struct Plan {
        var assign: [Int64: Int64] = [:]
        var evict: [Int64] = []
        var groups: [[Int64]] = []
        var merges: [(from: Int64, into: Int64)] = []
    }

    private struct Member {
        let face: FaceRecord
        let vector: [Float]
    }

    static func plan(faces: [FaceRecord], people: [PersonRecord], rejections: Set<FacePersonPair>) -> Plan {
        var plan = Plan()
        let usable = faces.filter { $0.embedding?.count == 128 && $0.quality >= minimumQuality }
        guard !usable.isEmpty else { return plan }

        // 1. Clean every person: same-photo duplicates and faces far from the average leave.
        var members: [Int64: [Member]] = [:]
        for face in usable {
            guard let person = face.person, let vector = face.embedding else { continue }
            members[person, default: []].append(Member(face: face, vector: vector))
        }
        // Faces assigned earlier but no longer usable (e.g. quality) are not touched.
        var centroids: [Int64: [Float]] = [:]
        for (person, list) in members {
            var centroid = average(list)
            var kept: [Member] = []
            // Strongest first, so in a shared photo the face that really is this person stays.
            let closeness: [Int64: Float] = Dictionary(list.map { member in
                (member.face.id, (member.face.confirmed ? 2 : 0) + dot(member.vector, centroid))
            }, uniquingKeysWith: { first, _ in first })
            let ranked = list.sorted { (closeness[$0.face.id] ?? 0) > (closeness[$1.face.id] ?? 0) }
            var photos = Set<String>()
            for member in ranked {
                let fits = member.face.confirmed || dot(member.vector, centroid) >= evictThreshold
                if fits, !photos.contains(member.face.photo) {
                    kept.append(member)
                    photos.insert(member.face.photo)
                } else {
                    plan.evict.append(member.face.id)
                }
            }
            if kept.count != list.count { centroid = average(kept) }
            members[person] = kept
            if !kept.isEmpty { centroids[person] = centroid }
        }

        // 2. Unnamed look-alikes that never appear together become one person.
        let named = Dictionary(people.map { ($0.id, !$0.name.isEmpty) }, uniquingKeysWith: { first, _ in first })
        var personIDs = Array(centroids.keys).sorted()
        var absorbed = Set<Int64>()
        for a in personIDs.indices {
            let first = personIDs[a]
            guard !absorbed.contains(first) else { continue }
            for b in personIDs.indices where b > a {
                let second = personIDs[b]
                guard !absorbed.contains(second), named[second] != true,
                      let ca = centroids[first], let cb = centroids[second],
                      dot(ca, cb) >= mergeThreshold else { continue }
                let photosA = Set((members[first] ?? []).map(\.face.photo))
                guard !(members[second] ?? []).contains(where: { photosA.contains($0.face.photo) }) else { continue }
                plan.merges.append((from: second, into: first))
                absorbed.insert(second)
                members[first, default: []] += members[second] ?? []
                centroids[first] = average(members[first] ?? [])
            }
        }
        personIDs = personIDs.filter { !absorbed.contains($0) }
        var personPhotos: [Int64: Set<String>] = [:]
        for id in personIDs { personPhotos[id] = Set((members[id] ?? []).map(\.face.photo)) }

        // 2b. A face that clearly looks more like someone else moves there (after the user split a
        // person, the rest of the other person's faces follow on their own).
        let movable = personIDs.flatMap { person in
            (members[person] ?? []).filter { !$0.face.confirmed }.map { (person, $0) }
        }
        if personIDs.count > 1, !movable.isEmpty {
            let matrix = personIDs.map { centroids[$0]! }
            var start = 0
            while start < movable.count {
                let end = min(movable.count, start + 512)
                let chunk = Array(movable[start..<end])
                let scores = similarities(chunk.map(\.1.vector), matrix)
                for (row, item) in chunk.enumerated() {
                    let (own, member) = item
                    guard let ownColumn = personIDs.firstIndex(of: own) else { continue }
                    let ownScore = scores[row * personIDs.count + ownColumn]
                    var best = -1
                    var bestScore = ownScore + 0.08
                    for column in personIDs.indices where column != ownColumn {
                        let other = personIDs[column]
                        let score = scores[row * personIDs.count + column]
                        guard score >= assignThreshold, score > bestScore,
                              !rejections.contains(FacePersonPair(face: member.face.id, person: other)),
                              personPhotos[other]?.contains(member.face.photo) != true else { continue }
                        best = column
                        bestScore = score
                    }
                    if best >= 0 {
                        let other = personIDs[best]
                        plan.assign[member.face.id] = other
                        personPhotos[other, default: []].insert(member.face.photo)
                        personPhotos[own]?.remove(member.face.photo)
                    }
                }
                start = end
            }
        }

        // 3. Loose faces (and evicted ones) that clearly belong to someone already known.
        let evicted = Set(plan.evict)
        var loose = usable.filter { $0.person == nil || evicted.contains($0.id) }
            .sorted { $0.quality > $1.quality }
        if !personIDs.isEmpty, !loose.isEmpty {
            let matrix = personIDs.map { centroids[$0]! }
            let scores = similarities(loose.map { $0.embedding! }, matrix)
            var remaining: [FaceRecord] = []
            for (row, face) in loose.enumerated() {
                var best = -1, bestScore: Float = -1, second: Float = -1
                for column in personIDs.indices {
                    let person = personIDs[column]
                    if rejections.contains(FacePersonPair(face: face.id, person: person)) { continue }
                    if face.person == person, evicted.contains(face.id) { continue }
                    if personPhotos[person]?.contains(face.photo) == true { continue }
                    let score = scores[row * personIDs.count + column]
                    if score > bestScore {
                        second = bestScore
                        bestScore = score
                        best = column
                    } else if score > second {
                        second = score
                    }
                }
                if best >= 0, bestScore >= assignThreshold, bestScore - second >= 0.05 || second < assignThreshold {
                    let person = personIDs[best]
                    plan.assign[face.id] = person
                    personPhotos[person, default: []].insert(face.photo)
                } else {
                    remaining.append(face)
                }
            }
            loose = remaining
        }

        // 4. What is left forms new people around an average face (no chaining from face to face).
        // All group centres sit in one matrix, so each face is compared with every group at once.
        var groupFaces: [[Int64]] = []
        var groupPhotos: [Set<String>] = []
        var sums: [[Float]] = []
        var centres: [Float] = []
        for face in loose {
            guard let vector = face.embedding, vector.count == 128 else { continue }
            let count = groupFaces.count
            var bestIndex = -1
            var bestScore = linkThreshold
            if count > 0 {
                var scores = [Float](repeating: 0, count: count)
                vDSP_mmul(centres, 1, vector, 1, &scores, 1, vDSP_Length(count), 1, 128)
                for index in 0..<count where scores[index] >= bestScore && !groupPhotos[index].contains(face.photo) {
                    bestScore = scores[index]
                    bestIndex = index
                }
            }
            if bestIndex >= 0 {
                for index in 0..<128 { sums[bestIndex][index] += vector[index] }
                let centre = normalized(sums[bestIndex])
                centres.replaceSubrange((bestIndex * 128)..<((bestIndex + 1) * 128), with: centre)
                groupFaces[bestIndex].append(face.id)
                groupPhotos[bestIndex].insert(face.photo)
            } else {
                groupFaces.append([face.id])
                groupPhotos.append([face.photo])
                sums.append(vector)
                centres.append(contentsOf: vector)
            }
        }
        for index in groupFaces.indices where groupFaces[index].count >= minimumGroup && groupPhotos[index].count >= minimumGroup {
            plan.groups.append(groupFaces[index])
        }
        // Evicted faces that found no new home simply become loose.
        let placed = Set(plan.assign.keys).union(plan.groups.flatMap { $0 })
        plan.evict = plan.evict.filter { !placed.contains($0) }
        return plan
    }

    private static func average(_ list: [Member]) -> [Float] {
        var sum = [Float](repeating: 0, count: 128)
        for member in list {
            let weight: Float = member.face.confirmed ? 2 : 1
            for index in 0..<128 { sum[index] += member.vector[index] * weight }
        }
        return normalized(sum)
    }

    static func normalized(_ vector: [Float]) -> [Float] {
        var norm: Float = 0
        vDSP_svesq(vector, 1, &norm, vDSP_Length(vector.count))
        norm = norm.squareRoot()
        guard norm > 0 else { return vector }
        return vector.map { $0 / norm }
    }

    static func dot(_ a: [Float], _ b: [Float]) -> Float {
        var result: Float = 0
        vDSP_dotpr(a, 1, b, 1, &result, vDSP_Length(min(a.count, b.count)))
        return result
    }

    /// rows (m × 128) · columns (n × 128)ᵀ → m × n, row-major.
    static func similarities(_ rows: [[Float]], _ columns: [[Float]]) -> [Float] {
        let m = rows.count, n = columns.count, k = 128
        guard m > 0, n > 0 else { return [] }
        let a = rows.flatMap { $0 }
        var bT = [Float](repeating: 0, count: k * n)
        for (column, vector) in columns.enumerated() {
            for index in 0..<k { bT[index * n + column] = vector[index] }
        }
        var c = [Float](repeating: 0, count: m * n)
        vDSP_mmul(a, 1, bT, 1, &c, 1, vDSP_Length(m), vDSP_Length(n), vDSP_Length(k))
        return c
    }
}
