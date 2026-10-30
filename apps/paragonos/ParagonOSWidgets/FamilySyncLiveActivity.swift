import ActivityKit
import SwiftUI
import WidgetKit

/// A compact ring that fills clockwise while running, then morphs into a
/// solid green checkmark (or red exclamation) — the same "still working →
/// done" language as Apple Mail's send indicator, not a spinner borrowed
/// from a progress bar.
struct SyncProgressRing: View {
    var state: FamilySyncActivityAttributes.ContentState
    var diameter: CGFloat
    var lineWidth: CGFloat

    private var tint: Color {
        if state.isSuccess { return ParagonRingPalette.success }
        if state.isFailure { return ParagonRingPalette.failure }
        return ParagonRingPalette.running
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.22), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: state.isRunning ? state.progress : 1)
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.4), value: state.progress)
            if state.isSuccess || state.isFailure {
                Circle()
                    .fill(tint)
                    .transition(.scale.combined(with: .opacity))
                Image(systemName: state.isSuccess ? "checkmark" : "exclamationmark")
                    .font(.system(size: diameter * 0.46, weight: .bold))
                    .foregroundStyle(.white)
                    .transition(.scale.combined(with: .opacity))
            } else {
                Image(systemName: "icloud.fill")
                    .font(.system(size: diameter * 0.42, weight: .semibold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: diameter, height: diameter)
        .animation(.spring(response: 0.32, dampingFraction: 0.78), value: state.phase)
    }
}

enum ParagonRingPalette {
    static let running = Color(red: 0.35, green: 0.78, blue: 1.0)
    static let success = Color(red: 0.20, green: 0.82, blue: 0.44)
    static let failure = Color(red: 0.98, green: 0.36, blue: 0.36)
}

struct FamilySyncLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FamilySyncActivityAttributes.self) { context in
            LockScreenBanner(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.55))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    SyncProgressRing(state: context.state, diameter: 30, lineWidth: 3)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .minimumScaleFactor(0.85)
                        .lineLimit(1)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("iCloud")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.55))
                }
            } compactLeading: {
                SyncProgressRing(state: context.state, diameter: 18, lineWidth: 2.2)
            } compactTrailing: {
                EmptyView()
            } minimal: {
                SyncProgressRing(state: context.state, diameter: 18, lineWidth: 2.2)
            }
            .keylineTint(ParagonRingPalette.running)
        }
    }
}

private struct LockScreenBanner: View {
    var state: FamilySyncActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            SyncProgressRing(state: state, diameter: 30, lineWidth: 3)
            VStack(alignment: .leading, spacing: 1) {
                Text("iCloud")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                Text(state.title)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }
}
