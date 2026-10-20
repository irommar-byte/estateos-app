import Foundation

/// The shared catalog code stores the library place as a plain string. On Apple TV only the
/// raw values matter; the full picker lives in the iOS app.
enum LibraryPlace: String, CaseIterable {
    case thisPhone
    case server
    case qnap
    case otherServer
    case disk
}
