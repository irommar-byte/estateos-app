import SwiftUI
import UIKit

/// Photo grid for the television. A SwiftUI grid makes one focusable button per photo, and with
/// several thousand of them the remote's focus search locks up the main thread and the app is
/// killed. UICollectionView keeps a handful of cells and reuses them, however far you scroll.
struct TVPhotoBrowser: UIViewControllerRepresentable {
    let sections: [TVSection]
    let pipeline: TVImagePipeline
    let returnID: String?
    let onOpen: (PhotoRef, Bool) -> Void
    var onCompact: (Bool) -> Void = { _ in }

    func makeUIViewController(context: Context) -> TVPhotoBrowserController {
        TVPhotoBrowserController()
    }

    func updateUIViewController(_ controller: TVPhotoBrowserController, context: Context) {
        controller.pipeline = pipeline
        controller.onOpen = onOpen
        controller.onCompact = onCompact
        controller.apply(sections)
        if controller.seenEpoch != pipeline.epoch {
            controller.seenEpoch = pipeline.epoch
            controller.reloadVisibleThumbs()
        }
        if let returnID, returnID != controller.revealedID {
            controller.revealedID = returnID
            controller.reveal(returnID)
        }
    }
}

final class TVPhotoBrowserController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegate {
    var pipeline: TVImagePipeline?
    var onOpen: (PhotoRef, Bool) -> Void = { _, _ in }
    var onCompact: (Bool) -> Void = { _ in }
    private var compact = false
    var seenEpoch = -1
    var revealedID: String?
    private var sections: [TVSection] = []
    private var signature = ""
    private var indexByID: [String: IndexPath] = [:]
    private var pendingFocus: IndexPath?
    private var focusedIndexPath: IndexPath?
    private var collectionView: UICollectionView!

    override func loadView() {
        let layout = UICollectionViewCompositionalLayout { [weak self] section, _ in
            self?.layout(for: section)
        }
        let collection = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collection.backgroundColor = .clear
        collection.contentInsetAdjustmentBehavior = .never
        collection.remembersLastFocusedIndexPath = true
        collection.clipsToBounds = true
        collection.dataSource = self
        collection.delegate = self
        collection.register(TVPhotoCell.self, forCellWithReuseIdentifier: TVPhotoCell.reuse)
        collection.register(TVDayHeader.self, forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader, withReuseIdentifier: TVDayHeader.reuse)
        collectionView = collection
        view = collection
    }

    override var preferredFocusEnvironments: [UIFocusEnvironment] {
        if let pendingFocus, let cell = collectionView.cellForItem(at: pendingFocus) {
            return [cell]
        }
        return super.preferredFocusEnvironments
    }

    func apply(_ sections: [TVSection]) {
        let next = sections.filter { !$0.photos.isEmpty }
        let signature = next.map { section in
            let hearts = section.photos.reduce(0) { $0 + ($1.isFavorite ? 1 : 0) }
            return "\(section.id)#\(section.photos.count)#\(hearts)#\(section.photos.first?.id ?? "")#\(section.photos.last?.id ?? "")"
        }.joined(separator: "|")
        guard signature != self.signature else { return }
        // New photos arrive at the top: keep the remote on the same photo, not the same slot.
        let keepID = focusedIndexPath.flatMap { photo(at: $0)?.id }
        self.sections = next
        self.signature = signature
        var index: [String: IndexPath] = [:]
        index.reserveCapacity(next.reduce(0) { $0 + $1.photos.count })
        for (sectionIndex, section) in next.enumerated() {
            for item in section.photos.indices {
                index[section.photos[item].id] = IndexPath(item: item, section: sectionIndex)
            }
        }
        indexByID = index
        collectionView.reloadData()
        if let keepID, let path = index[keepID], path != focusedIndexPath {
            collectionView.layoutIfNeeded()
            collectionView.scrollToItem(at: path, at: .centeredVertically, animated: false)
            pendingFocus = path
            focusedIndexPath = path
            setNeedsFocusUpdate()
        }
    }

    /// The screen title folds away once the grid scrolls, so more than two rows fit on the TV.
    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let offset = scrollView.contentOffset.y
        let next = compact ? offset > 20 : offset > 90
        guard next != compact else { return }
        compact = next
        onCompact(next)
    }

    func reloadVisibleThumbs() {
        for indexPath in collectionView.indexPathsForVisibleItems {
            guard let cell = collectionView.cellForItem(at: indexPath) as? TVPhotoCell,
                  let photo = photo(at: indexPath), let pipeline else { continue }
            cell.show(photo, pipeline: pipeline, onPlay: playHandler(photo))
        }
    }

    func reveal(_ id: String) {
        guard let indexPath = indexByID[id] else { return }
        guard collectionView.bounds.width > 0 else {
            DispatchQueue.main.async { [weak self] in self?.reveal(id) }
            return
        }
        collectionView.layoutIfNeeded()
        collectionView.scrollToItem(at: indexPath, at: .centeredVertically, animated: false)
        collectionView.layoutIfNeeded()
        pendingFocus = indexPath
        setNeedsFocusUpdate()
        updateFocusIfNeeded()
    }

    // MARK: Layout

    private func layout(for sectionIndex: Int) -> NSCollectionLayoutSection {
        let item = NSCollectionLayoutItem(layoutSize: NSCollectionLayoutSize(
            widthDimension: .fractionalWidth(1),
            heightDimension: .fractionalHeight(1)
        ))
        let group = NSCollectionLayoutGroup.horizontal(
            layoutSize: NSCollectionLayoutSize(
                widthDimension: .fractionalWidth(1),
                heightDimension: .absolute(TVGridLayout.photoSide)
            ),
            subitem: item,
            count: TVGridLayout.columnCount
        )
        group.interItemSpacing = .fixed(TVGridLayout.gap)
        let section = NSCollectionLayoutSection(group: group)
        section.interGroupSpacing = TVGridLayout.gap
        section.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: TVTheme.margin, bottom: 28, trailing: TVTheme.margin)
        if sections.indices.contains(sectionIndex), !sections[sectionIndex].title.isEmpty {
            let header = NSCollectionLayoutBoundarySupplementaryItem(
                layoutSize: NSCollectionLayoutSize(widthDimension: .fractionalWidth(1), heightDimension: .absolute(58)),
                elementKind: UICollectionView.elementKindSectionHeader,
                alignment: .top
            )
            section.boundarySupplementaryItems = [header]
        }
        return section
    }

    // MARK: Data

    func numberOfSections(in collectionView: UICollectionView) -> Int { sections.count }

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        sections[section].photos.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: TVPhotoCell.reuse, for: indexPath)
        if let cell = cell as? TVPhotoCell, let photo = photo(at: indexPath), let pipeline {
            cell.show(photo, pipeline: pipeline, onPlay: playHandler(photo))
        }
        return cell
    }

    func collectionView(
        _ collectionView: UICollectionView,
        viewForSupplementaryElementOfKind kind: String,
        at indexPath: IndexPath
    ) -> UICollectionReusableView {
        let header = collectionView.dequeueReusableSupplementaryView(ofKind: kind, withReuseIdentifier: TVDayHeader.reuse, for: indexPath)
        if let header = header as? TVDayHeader, sections.indices.contains(indexPath.section) {
            let section = sections[indexPath.section]
            header.show(title: section.title, subtitle: section.subtitle)
        }
        return header
    }

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        guard let photo = photo(at: indexPath) else { return }
        onOpen(photo, false)
    }

    func collectionView(_ collectionView: UICollectionView, didUpdateFocusIn context: UICollectionViewFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        focusedIndexPath = context.nextFocusedIndexPath ?? focusedIndexPath
        if context.nextFocusedIndexPath != nil { pendingFocus = nil }
    }

    func collectionView(
        _ collectionView: UICollectionView,
        contextMenuConfigurationForItemsAt indexPaths: [IndexPath],
        point: CGPoint
    ) -> UIContextMenuConfiguration? {
        guard let indexPath = indexPaths.first, let photo = photo(at: indexPath) else { return nil }
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [onOpen] _ in
            UIMenu(children: [
                UIAction(title: L("Otwórz"), image: UIImage(systemName: "arrow.up.left.and.arrow.down.right")) { _ in
                    onOpen(photo, false)
                },
                UIAction(title: L("Pokaz slajdów od tego zdjęcia"), image: UIImage(systemName: "play.rectangle.on.rectangle")) { _ in
                    onOpen(photo, true)
                },
            ])
        }
    }

    private func photo(at indexPath: IndexPath) -> PhotoRef? {
        guard sections.indices.contains(indexPath.section) else { return nil }
        let photos = sections[indexPath.section].photos
        guard photos.indices.contains(indexPath.item) else { return nil }
        return photos[indexPath.item]
    }

    private func playHandler(_ photo: PhotoRef) -> () -> Void {
        { [weak self] in self?.onOpen(photo, true) }
    }
}

// MARK: - Cell

final class TVPhotoCell: UICollectionViewCell {
    static let reuse = "tv-photo"

    private let photoView = UIImageView()
    private let symbolView = UIImageView()
    private let shade = UIView()
    private let caption = UILabel()
    private let heart = UIImageView()
    private var loadTask: Task<Void, Never>?
    private var photoHash = ""
    private var onPlay: () -> Void = {}

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.clipsToBounds = true
        contentView.layer.cornerRadius = 16
        contentView.backgroundColor = UIColor(white: 0.16, alpha: 1)

        photoView.contentMode = .scaleAspectFill
        photoView.frame = contentView.bounds
        photoView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        contentView.addSubview(photoView)

        symbolView.tintColor = UIColor.white.withAlphaComponent(0.35)
        symbolView.contentMode = .scaleAspectFit
        symbolView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 44, weight: .light)
        contentView.addSubview(symbolView)

        let gradient = CAGradientLayer()
        gradient.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.55).cgColor]
        gradient.frame = CGRect(x: 0, y: 0, width: 10, height: 10)
        shade.layer.addSublayer(gradient)
        shade.isUserInteractionEnabled = false
        contentView.addSubview(shade)

        caption.font = .systemFont(ofSize: 24, weight: .semibold)
        caption.textColor = .white
        contentView.addSubview(caption)

        heart.image = UIImage(systemName: "heart.fill")
        heart.tintColor = .white
        heart.contentMode = .scaleAspectFit
        contentView.addSubview(heart)

        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0
        layer.shadowRadius = 18
        layer.shadowOffset = CGSize(width: 0, height: 10)
    }

    required init?(coder: NSCoder) { nil }

    override var canBecomeFocused: Bool { true }

    override func layoutSubviews() {
        super.layoutSubviews()
        let bounds = contentView.bounds
        symbolView.frame = CGRect(x: (bounds.width - 52) / 2, y: (bounds.height - 44) / 2, width: 52, height: 44)
        shade.frame = CGRect(x: 0, y: bounds.height - 78, width: bounds.width, height: 78)
        shade.layer.sublayers?.first?.frame = shade.bounds
        caption.frame = CGRect(x: 14, y: bounds.height - 42, width: bounds.width - 62, height: 28)
        heart.frame = CGRect(x: bounds.width - 40, y: bounds.height - 42, width: 24, height: 24)
    }

    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        coordinator.addCoordinatedAnimations {
            let on = self.isFocused
            self.transform = on ? CGAffineTransform(scaleX: 1.045, y: 1.045) : .identity
            self.contentView.layer.borderWidth = on ? 4 : 0
            self.contentView.layer.borderColor = UIColor.white.cgColor
            self.layer.shadowOpacity = on ? 0.45 : 0
        }
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .playPause }) { return }
        super.pressesBegan(presses, with: event)
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .playPause }) {
            onPlay()
            return
        }
        super.pressesEnded(presses, with: event)
    }

    func show(_ photo: PhotoRef, pipeline: TVImagePipeline, onPlay: @escaping () -> Void) {
        self.onPlay = onPlay
        let hash = photo.cloudHash ?? ""
        let video = photo.traits.isVideo
        photoHash = hash
        accessibilityLabel = TVFormat.dayTitle(photo.created)

        let showsCaption = video || photo.traits.contains(.live) || photo.isFavorite
        shade.isHidden = !showsCaption
        caption.text = video ? "▶︎  \(PhotoFormat.duration(photo.duration))" : (photo.traits.contains(.live) ? "LIVE" : "")
        heart.isHidden = !photo.isFavorite
        symbolView.image = UIImage(systemName: video ? "film" : "photo")

        loadTask?.cancel()
        if let cached = pipeline.cachedThumbnail(hash: hash) {
            photoView.image = cached
            symbolView.isHidden = true
            return
        }
        photoView.image = nil
        symbolView.isHidden = false
        guard !hash.isEmpty else { return }
        loadTask = Task { [weak self] in
            var attempt = 0
            while !Task.isCancelled {
                let image = await pipeline.thumbnail(hash: hash)
                let hidden = pipeline.isWithheld(hash)
                let applied = await MainActor.run { () -> Bool in
                    guard let self, !Task.isCancelled, self.photoHash == hash else { return true }
                    guard let image else { return false }
                    UIView.transition(with: self.photoView, duration: 0.25, options: .transitionCrossDissolve) {
                        self.photoView.image = image
                    }
                    self.symbolView.isHidden = true
                    return true
                }
                if applied || hidden || Task.isCancelled { return }
                attempt += 1
                if attempt > 5 { return }
                try? await Task.sleep(nanoseconds: UInt64(attempt) * 4_000_000_000)
            }
        }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        loadTask?.cancel()
        loadTask = nil
        photoHash = ""
        photoView.image = nil
        symbolView.isHidden = false
        transform = .identity
        contentView.layer.borderWidth = 0
        layer.shadowOpacity = 0
    }
}

// MARK: - Day header

final class TVDayHeader: UICollectionReusableView {
    static let reuse = "tv-day"

    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        titleLabel.font = .systemFont(ofSize: 32, weight: .semibold)
        titleLabel.textColor = .white
        subtitleLabel.font = .systemFont(ofSize: 28, weight: .medium)
        subtitleLabel.textColor = UIColor.secondaryLabel
        let row = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        row.axis = .horizontal
        row.spacing = 16
        row.alignment = .firstBaseline
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
        ])
    }

    required init?(coder: NSCoder) { nil }

    func show(title: String, subtitle: String) {
        titleLabel.text = title
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle.isEmpty
    }
}
