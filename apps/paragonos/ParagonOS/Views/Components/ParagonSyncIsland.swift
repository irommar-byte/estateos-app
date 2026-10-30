import SwiftUI

struct ParagonSyncIsland: View {
    @ObservedObject var cloudSync = CloudSyncMonitor.shared
    @ObservedObject private var liveIsland = FamilySyncLiveActivityCenter.shared
    @Environment(\.dynamicTypeSize) private var typeSize
    var onRetry: () -> Void = {}

    var body: some View {
        Group {
            if liveIsland.isPresenting {
                EmptyView()
            } else {
                inAppToast
            }
        }
    }

    private var inAppToast: some View {
        let state = cloudSync.island
        return Button {
            if state == .failure { onRetry() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: CloudSyncIslandCopy.symbol(state))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(iconTint(state))
                    .symbolEffect(.variableColor.iterative, isActive: state == .running)
                    .symbolEffect(.bounce, value: state == .success)
                    .contentTransition(.symbolEffect(.replace))
                if typeSize.isAccessibilitySize == false, state != .hidden {
                    Text(CloudSyncIslandCopy.title(state: state, phase: cloudSync.phase))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .contentTransition(.opacity)
                }
                if state == .running {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background { islandChrome }
        }
        .buttonStyle(.plain)
        .opacity(state == .hidden ? 0 : 1)
        .offset(y: state == .hidden ? -12 : 0)
        .allowsHitTesting(state == .failure)
        .animation(islandSpring, value: state)
        .sensoryFeedback(.success, trigger: state == .success)
        .sensoryFeedback(.warning, trigger: state == .failure)
        .accessibilityLabel(CloudSyncIslandCopy.accessibility(state: state, phase: cloudSync.phase))
        .accessibilityAddTraits(state == .failure ? .isButton : .updatesFrequently)
        .accessibilityHidden(state == .hidden)
        .padding(.top, 6)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    @ViewBuilder
    private var islandChrome: some View {
        let shape = Capsule(style: .continuous)
        if #available(iOS 26.0, *) {
            shape.glassEffect(.regular, in: .capsule)
        } else {
            shape
                .fill(.ultraThinMaterial)
                .overlay {
                    shape.strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
                }
                .shadow(color: Color.black.opacity(0.12), radius: 18, y: 8)
        }
    }

    private func iconTint(_ state: CloudSyncIslandState) -> Color {
        switch state {
        case .success: return ParagonTheme.osGreen
        case .failure: return .red
        default: return .primary
        }
    }

    private var islandSpring: Animation {
        UIAccessibility.isReduceMotionEnabled
            ? .easeInOut(duration: 0.18)
            : ParagonTheme.snappy
    }
}

struct ParagonCloudDevicesRow: View {
    @ObservedObject var cloudSync: CloudSyncMonitor
    var onSync: () -> Void

    var body: some View {
        Button(action: onSync) {
            HStack(spacing: 12) {
                ParagonSettingsGlyph(
                    systemName: cloudSync.usesCloudKit ? "icloud.fill" : "icloud.slash.fill",
                    background: cloudSync.phase == .failed
                        ? Color.red
                        : Color(red: 0.18, green: 0.48, blue: 0.96)
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text("iCloud")
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(cloudSync.phase == .failed ? Color.red : Color.secondary)
                }
                Spacer(minLength: 8)
                if cloudSync.isInProgress {
                    ProgressView()
                        .controlSize(.regular)
                } else {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.body.weight(.medium))
                        .foregroundStyle(cloudSync.usesCloudKit ? Color.accentColor : Color.secondary)
                        .opacity(cloudSync.usesCloudKit ? 1 : 0.4)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(.primary)
        .disabled(cloudSync.usesCloudKit == false)
        .accessibilityHint("Synchronizuje kaucje, paragony i karty z iCloud.")
    }

    private var subtitle: String {
        if cloudSync.usesCloudKit == false {
            return cloudSync.statusTitle
        }
        if let last = cloudSync.lastSuccessText, cloudSync.phase != .failed, cloudSync.isInProgress == false {
            return "\(cloudSync.statusTitle) · \(last)"
        }
        return cloudSync.statusTitle
    }
}

struct FamilyShareControl: View {
    var isShared: Bool
    var onShare: () -> Void
    var onStop: () -> Void

    var body: some View {
        Toggle(isOn: Binding(
            get: { isShared },
            set: { next in
                if next { onShare() } else { onStop() }
            }
        )) {
            Label("Rodzina", systemImage: "person.2.fill")
        }
    }
}
