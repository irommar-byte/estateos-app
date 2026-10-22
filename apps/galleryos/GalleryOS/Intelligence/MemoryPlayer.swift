import AVFoundation
import SwiftUI

/// Full-screen story: slow Ken Burns motion, soft cross-fades, a title card and a soundtrack
/// composed on the device for the memory's mood.
struct MemoryPlayer: View {
    let memory: Memory
    @EnvironmentObject private var library: PhotoLibrary
    @Environment(\.dismiss) private var dismiss
    @StateObject private var music = MemoryMusic()
    @State private var index = 0
    @State private var images: [String: UIImage] = [:]
    @State private var paused = false
    @State private var chrome = true
    @State private var titleShown = true
    @State private var finished = false
    @State private var slideStart = Date()
    @AppStorage("galleryos.memories.muted") private var muted = false

    private static let slide: TimeInterval = 4.6

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let id = memory.photos[safe: index] {
                KenBurnsSlide(image: images[id], seed: index, duration: Self.slide + 1.2)
                    .id(index)
                    .transition(.opacity)
                    .ignoresSafeArea()
            }
            LinearGradient(colors: [.black.opacity(0.45), .clear, .clear, .black.opacity(0.55)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            if titleShown {
                VStack(spacing: 10) {
                    Spacer()
                    Text(memory.title)
                        .font(.system(size: 44, weight: .bold, design: .serif))
                        .multilineTextAlignment(.center)
                        .shadow(radius: 12)
                    Text(memory.subtitle.uppercased())
                        .font(.footnote.weight(.semibold))
                        .tracking(2)
                        .opacity(0.9)
                    Spacer().frame(height: 110)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 28)
                .transition(.opacity.combined(with: .scale(scale: 1.04)))
                .allowsHitTesting(false)
            }
            touchAreas
            if chrome { controls.transition(.opacity) }
            if finished { endCard.transition(.opacity) }
        }
        .statusBarHidden(!chrome)
        .persistentSystemOverlays(.hidden)
        .task { await play() }
        .onAppear {
            music.start(mood: memory.mood, muted: muted)
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear {
            music.stop()
            UIApplication.shared.isIdleTimerDisabled = false
        }
        .onChange(of: muted) { _, value in music.setMuted(value) }
        .onChange(of: paused) { _, value in value ? music.pause() : music.resume() }
    }

    // MARK: Playback

    private func play() async {
        await preload(around: 0)
        slideStart = .now
        try? await Task.sleep(for: .seconds(3.2))
        withAnimation(.easeInOut(duration: 1.0)) { titleShown = false; chrome = false }
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(200))
            guard !paused, !finished else { continue }
            if Date().timeIntervalSince(slideStart) >= Self.slide {
                advance(by: 1)
            }
        }
    }

    private func advance(by step: Int) {
        let next = index + step
        if next >= memory.photos.count {
            withAnimation(.easeInOut(duration: 0.8)) { finished = true; chrome = true }
            music.fadeTo(0.25)
            return
        }
        guard next >= 0 else { return }
        withAnimation(.easeInOut(duration: 1.1)) { index = next }
        slideStart = .now
        Task { await preload(around: next) }
    }

    private func preload(around position: Int) async {
        for offset in 0...2 {
            guard let id = memory.photos[safe: position + offset], images[id] == nil else { continue }
            let side = max(UIScreen.main.bounds.width, UIScreen.main.bounds.height) * UIScreen.main.scale
            if let image = await MemoryImage.load(id, side: min(side, 2400), library: library) {
                images[id] = image
            }
        }
        // Keep memory small: only the neighbours stay.
        let keep = Set((max(0, position - 1)...(position + 3)).compactMap { memory.photos[safe: $0] })
        images = images.filter { keep.contains($0.key) }
    }

    // MARK: Touch

    private var touchAreas: some View {
        HStack(spacing: 0) {
            Color.clear.contentShape(Rectangle())
                .onTapGesture { step(-1) }
                .frame(maxWidth: .infinity)
            Color.clear.contentShape(Rectangle())
                .onTapGesture { withAnimation(.easeInOut(duration: 0.25)) { chrome.toggle() } }
                .frame(maxWidth: .infinity)
            Color.clear.contentShape(Rectangle())
                .onTapGesture { step(1) }
                .frame(maxWidth: .infinity)
        }
        .ignoresSafeArea()
        .onLongPressGesture(minimumDuration: 0.25, maximumDistance: 30) {} onPressingChanged: { pressing in
            paused = pressing
        }
    }

    private func step(_ delta: Int) {
        guard !finished || delta < 0 else { return }
        if finished { withAnimation { finished = false } ; music.fadeTo(1) }
        UISelectionFeedbackGenerator().selectionChanged()
        advance(by: delta)
    }

    private var controls: some View {
        VStack {
            HStack(spacing: 4) {
                if memory.photos.count <= 30 {
                    ForEach(memory.photos.indices, id: \.self) { position in
                        Capsule()
                            .fill(.white.opacity(position <= index ? 0.95 : 0.3))
                            .frame(height: 2.5)
                    }
                } else {
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.3))
                            Capsule().fill(.white)
                                .frame(width: proxy.size.width * CGFloat(index + 1) / CGFloat(memory.photos.count))
                        }
                    }
                    .frame(height: 2.5)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 8)
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial, in: Circle())
                }
                Spacer()
                Button { paused.toggle() } label: {
                    Image(systemName: paused ? "play.fill" : "pause.fill")
                        .font(.headline)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial, in: Circle())
                }
                Button { muted.toggle() } label: {
                    Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                        .font(.headline)
                        .frame(width: 40, height: 40)
                        .background(.ultraThinMaterial, in: Circle())
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            Spacer()
        }
    }

    private var endCard: some View {
        VStack(spacing: 18) {
            Spacer()
            Text(memory.title)
                .font(.system(size: 34, weight: .bold, design: .serif))
            Text(memory.subtitle).font(.subheadline).opacity(0.8)
            HStack(spacing: 14) {
                Button {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        finished = false
                        index = 0
                        chrome = false
                    }
                    slideStart = .now
                    music.fadeTo(1)
                    Task { await preload(around: 0) }
                } label: {
                    Label(L("Jeszcze raz"), systemImage: "arrow.counterclockwise")
                        .padding(.horizontal, 18).padding(.vertical, 12)
                        .background(.white, in: Capsule())
                        .foregroundStyle(.black)
                }
                Button { dismiss() } label: {
                    Text(L("Zamknij"))
                        .padding(.horizontal, 18).padding(.vertical, 12)
                        .background(.ultraThinMaterial, in: Capsule())
                }
            }
            .font(.headline)
            Spacer().frame(height: 60)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.35))
    }
}

/// One photo with a slow, gentle camera move; the move depends on the slide so it never repeats twice in a row.
private struct KenBurnsSlide: View {
    let image: UIImage?
    let seed: Int
    let duration: TimeInterval
    @State private var moving = false

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .scaleEffect(moving ? motion.toScale : motion.fromScale)
                        .offset(x: (moving ? motion.toOffset.width : motion.fromOffset.width) * proxy.size.width,
                                y: (moving ? motion.toOffset.height : motion.fromOffset.height) * proxy.size.height)
                        .clipped()
                } else {
                    ProgressView().tint(.white)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
        }
        .onAppear { start() }
        .onChange(of: image) { _, _ in start() }
    }

    private func start() {
        guard image != nil, !moving else { return }
        withAnimation(.linear(duration: duration)) { moving = true }
    }

    private var motion: (fromScale: CGFloat, toScale: CGFloat, fromOffset: CGSize, toOffset: CGSize) {
        switch seed % 4 {
        case 0: return (1.04, 1.16, .zero, CGSize(width: -0.02, height: -0.01))
        case 1: return (1.16, 1.05, CGSize(width: 0.02, height: 0.01), .zero)
        case 2: return (1.12, 1.12, CGSize(width: -0.035, height: 0), CGSize(width: 0.035, height: 0))
        default: return (1.12, 1.14, CGSize(width: 0, height: 0.03), CGSize(width: 0, height: -0.03))
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
