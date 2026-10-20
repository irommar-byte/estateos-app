import SwiftUI

enum GalleryTheme {
    static let accent = Color(red: 0.29, green: 0.56, blue: 1.0)
    static let spacing: CGFloat = 2
    static let spring = Animation.spring(response: 0.36, dampingFraction: 0.88)
    static let snappy = Animation.spring(response: 0.3, dampingFraction: 0.82)
    static let page = Animation.spring(response: 0.38, dampingFraction: 0.9)
}
