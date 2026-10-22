import SwiftUI

struct TVSection: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let photos: [PhotoRef]
}

struct TVViewerContext: Identifiable {
    let id = UUID()
    let photos: [PhotoRef]
    let start: Int
    var slideshow = false
}

/// Scrollable grid of photo sections. The tiles are a reused collection, so a library of
/// many thousands of photos never builds a button for each one.
struct TVSectionsGrid<Header: View>: View {
    let sections: [TVSection]
    @ViewBuilder var header: () -> Header

    @State private var viewer: TVViewerContext?
    @State private var returnID: String?
    @State private var compact = false
    @EnvironmentObject private var pipeline: TVImagePipeline

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if !compact {
                header()
                    .padding(.horizontal, TVTheme.margin)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            TVPhotoBrowser(
                sections: visible,
                pipeline: pipeline,
                returnID: returnID,
                onOpen: { photo, slideshow in open(photo, slideshow: slideshow) },
                onCompact: { value in
                    guard Header.self != EmptyView.self else { return }
                    compact = value
                }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .animation(TVTheme.spring, value: compact)
        .fullScreenCover(item: $viewer) { context in
            TVViewer(context: context) { last in
                returnID = last.id
            }
        }
    }

    /// A file that never finished copying is left out until a later try produces a real thumbnail.
    private var visible: [TVSection] {
        sections.compactMap { section in
            let photos = section.photos.filter { photo in
                guard let hash = photo.cloudHash else { return true }
                return !pipeline.withheld.contains(hash)
            }
            guard !photos.isEmpty else { return nil }
            return TVSection(id: section.id, title: section.title, subtitle: section.subtitle, photos: photos)
        }
    }

    private func open(_ photo: PhotoRef, slideshow: Bool = false) {
        var flat: [PhotoRef] = []
        flat.reserveCapacity(sections.reduce(0) { $0 + $1.photos.count })
        for section in visible { flat.append(contentsOf: section.photos) }
        guard let start = flat.firstIndex(where: { $0.id == photo.id }) else { return }
        viewer = TVViewerContext(photos: flat, start: start, slideshow: slideshow)
    }
}

extension TVSectionsGrid where Header == EmptyView {
    init(sections: [TVSection]) {
        self.init(sections: sections) { EmptyView() }
    }
}
